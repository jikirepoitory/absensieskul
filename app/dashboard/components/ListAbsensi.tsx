"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Siswa {
  id: string;
  nisn: string;
  nama: string;
  kelas: string;
}

interface Absensi {
  id?: number;
  nisn: string;
  waktu?: string;
  status: string;
}

interface RekapSiswa extends Siswa {
  status: "Hadir" | "Tidak Hadir" | "Izin";
  waktuScan?: string;
  absensiId?: number;
}

interface ListAbsensiProps {
  refreshTrigger?: number;
}

export default function ListAbsensi({ refreshTrigger }: ListAbsensiProps) {
  const [selectedKelas, setSelectedKelas] = useState<string>("4A");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [listData, setListData] = useState<RekapSiswa[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // State Modal & Form Tambah Siswa Baru
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newNisn, setNewNisn] = useState<string>("");
  const [newNama, setNewNama] = useState<string>("");
  const [newKelas, setNewKelas] = useState<string>("4A");
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  // 🌟 STATE BARU: Download Multi-Tanggal / Bulanan
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [selectedDatesForExport, setSelectedDatesForExport] = useState<string[]>([]);
  const [tempDateInput, setTempDateInput] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);

  const daftarKelas = ["4A", "4B", "5A", "5B", "6A", "6B"];

  // Fetch Rekap Data Absensi & Siswa
  const fetchRekapAbsensi = useCallback(async () => {
    setLoading(true);

    const { data: siswaData, error: siswaError } = await supabase
      .from("siswa")
      .select("*")
      .eq("kelas", selectedKelas)
      .order("nama", { ascending: true });

    if (siswaError) {
      console.error("Error fetching siswa:", siswaError);
      setLoading(false);
      return;
    }

    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const endOfDay = `${selectedDate}T23:59:59.999Z`;

    const { data: absensiData, error: absensiError } = await supabase
      .from("absensi")
      .select("id, nisn, created_at, status")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    if (absensiError) {
      console.error("Error fetching absensi:", absensiError);
      setLoading(false);
      return;
    }

    const absensiMap = new Map<string, { id: number; waktu: string; status: string }>();
    if (absensiData) {
      absensiData.forEach((item) => {
        absensiMap.set(item.nisn, {
          id: item.id,
          waktu: item.created_at,
          status: item.status || "Hadir",
        });
      });
    }

    const combinedData: RekapSiswa[] = ((siswaData as Siswa[]) || []).map((siswa: Siswa) => {
      const dataAbsen = absensiMap.get(siswa.nisn);
      const rawStatus = dataAbsen?.status;
      const computedStatus: "Hadir" | "Tidak Hadir" | "Izin" =
        rawStatus === "Izin"
          ? "Izin"
          : dataAbsen
          ? "Hadir"
          : "Tidak Hadir";

      return {
        ...siswa,
        status: computedStatus,
        absensiId: dataAbsen?.id,
        waktuScan: dataAbsen?.waktu
          ? new Date(dataAbsen.waktu).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
      };
    });

    setListData(combinedData);
    setLoading(false);
  }, [selectedKelas, selectedDate]);

  useEffect(() => {
    fetchRekapAbsensi();
  }, [fetchRekapAbsensi, refreshTrigger]);

  // Update Status Absensi (Hadir / Izin / Tidak Hadir)
  const handleChangeStatus = async (
    siswa: RekapSiswa,
    newStatus: "Hadir" | "Izin" | "Tidak Hadir"
  ) => {
    if (siswa.status === newStatus) return;
    setActionLoading(siswa.id);

    try {
      if (newStatus === "Tidak Hadir") {
        if (siswa.absensiId) {
          const { error } = await supabase.from("absensi").delete().eq("id", siswa.absensiId);
          if (error) alert("Gagal mengubah status: " + error.message);
        }
      } else if (siswa.absensiId) {
        // Update data absensi yang sudah ada
        const { error } = await supabase
          .from("absensi")
          .update({ status: newStatus })
          .eq("id", siswa.absensiId);
        if (error) alert("Gagal mengubah status: " + error.message);
      } else {
        // Buat data absensi baru
        const customTimestamp = `${selectedDate}T${new Date().toISOString().split("T")[1]}`;
        const { error } = await supabase.from("absensi").insert([
          {
            nisn: siswa.nisn,
            nama_siswa: siswa.nama,
            kelas: siswa.kelas,
            status: newStatus,
            created_at: customTimestamp,
          },
        ]);
        if (error) alert("Gagal mengubah status: " + error.message);
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }

    setActionLoading(null);
    fetchRekapAbsensi();
  };

  // Hapus Siswa Permanen
  const handleHapusSiswaPermanen = async (siswa: RekapSiswa) => {
    const konfirmasi = confirm(
      `⚠️ PERINGATAN!\nApakah Anda yakin ingin menghapus siswa "${siswa.nama}" (NISN: ${siswa.nisn}) secara PERMANEN dari tabel Siswa?`
    );

    if (!konfirmasi) return;

    setActionLoading(siswa.id);
    const { error } = await supabase.from("siswa").delete().eq("id", siswa.id);

    if (error) {
      alert("Gagal menghapus siswa: " + error.message);
    } else {
      alert(`Siswa ${siswa.nama} berhasil dihapus.`);
      fetchRekapAbsensi();
    }
    setActionLoading(null);
  };

  // Tambah Siswa Baru
  const handleTambahSiswaBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNisn || !newNama) {
      alert("NISN dan Nama Siswa wajib diisi!");
      return;
    }

    setSaveLoading(true);

    const { error } = await supabase.from("siswa").insert([
      {
        nisn: newNisn,
        nama: newNama,
        kelas: newKelas,
      },
    ]);

    setSaveLoading(false);

    if (error) {
      alert("Gagal menambahkan siswa baru: " + error.message);
    } else {
      alert(`Berhasil menambahkan siswa "${newNama}" ke Kelas ${newKelas}`);
      setNewNisn("");
      setNewNama("");
      setShowAddModal(false);

      if (newKelas === selectedKelas) {
        fetchRekapAbsensi();
      } else {
        setSelectedKelas(newKelas);
      }
    }
  };

  // 🌟 KONTROL LIST TANGGAL UNTUK EXPORT
  const handleAddDateToExport = () => {
    if (!tempDateInput) return;
    if (selectedDatesForExport.includes(tempDateInput)) {
      alert("Tanggal ini sudah ada di daftar pilihan!");
      return;
    }
    setSelectedDatesForExport([...selectedDatesForExport, tempDateInput]);
  };

  const handleRemoveDateFromExport = (dateToRemove: string) => {
    setSelectedDatesForExport(selectedDatesForExport.filter((d) => d !== dateToRemove));
  };

  // 🌟 PROSES GENERATE & DOWNLOAD EXCEL/CSV BERDASARKAN TANGGAL KRONOLOGIS
  const handleExecuteDownloadCSV = async () => {
    if (selectedDatesForExport.length === 0) {
      alert("Pilih minimal 1 tanggal pertemuan!");
      return;
    }

    setDownloadingCsv(true);

    try {
      // 1. URUTKAN TANGGAL SECARA KRONOLOGIS (TANGGAL TERLAMA -> TANGGAL TERBARU)
      const sortedDates = [...selectedDatesForExport].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );

      // 2. Fetch seluruh data siswa kelas aktif
      const { data: siswaList, error: errSiswa } = await supabase
        .from("siswa")
        .select("*")
        .eq("kelas", selectedKelas)
        .order("nama", { ascending: true });

      if (errSiswa || !siswaList) {
        alert("Gagal mengambil data siswa: " + errSiswa?.message);
        setDownloadingCsv(false);
        return;
      }

      // 3. Fetch data absensi untuk semua tanggal yang dipilih
      const minDate = `${sortedDates[0]}T00:00:00.000Z`;
      const maxDate = `${sortedDates[sortedDates.length - 1]}T23:59:59.999Z`;

      const { data: absensiList } = await supabase
        .from("absensi")
        .select("nisn, created_at, status")
        .gte("created_at", minDate)
        .lte("created_at", maxDate);

      // Mapping status kehadiran per NISN dan per Tanggal (YYYY-MM-DD)
      const absensiMatrix = new Map<string, string>();
      if (absensiList) {
        absensiList.forEach((item) => {
          const dateStr = new Date(item.created_at).toISOString().slice(0, 10);
          const key = `${item.nisn}_${dateStr}`;
          absensiMatrix.set(key, item.status || "Hadir");
        });
      }

      // 4. SUSUN HEADER CSV
      // Format tanggal header: DD/MM/YYYY
      const formattedHeaderDates = sortedDates.map((d) => {
        const [yyyy, mm, dd] = d.split("-");
        return `"Pertemuan (${dd}/${mm}/${yyyy})"`;
      });

      let csvContent = `No,NISN,"Nama Siswa",Kelas,${formattedHeaderDates.join(",")},"Total Hadir","Total Izin","Total Tidak Hadir"\n`;

      // 5. SUSUN BARIS DATA SISWA
      siswaList.forEach((siswa, index) => {
        let totalHadirCount = 0;
        let totalIzinCount = 0;
        let totalTidakHadirCount = 0;

        const rowStatuses = sortedDates.map((dateStr) => {
          const key = `${siswa.nisn}_${dateStr}`;
          const statusValue = absensiMatrix.get(key);
          if (statusValue === "Izin") {
            totalIzinCount++;
            return `"Izin"`;
          } else if (statusValue === "Hadir" || statusValue) {
            totalHadirCount++;
            return `"Hadir"`;
          } else {
            totalTidakHadirCount++;
            return `"Tidak Hadir"`;
          }
        });

        csvContent += `${index + 1},"${siswa.nisn}","${siswa.nama}","${siswa.kelas}",${rowStatuses.join(",")},${totalHadirCount},${totalIzinCount},${totalTidakHadirCount}\n`;
      });

      // 6. TRIGGER DOWNLOAD CSV
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Rekap_Absensi_Kelas_${selectedKelas}_${sortedDates.length}_Pertemuan.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowDownloadModal(false);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengunduh rekap.");
    }

    setDownloadingCsv(false);
  };

  const totalHadir = listData.filter((s) => s.status === "Hadir").length;
  const totalIzin = listData.filter((s) => s.status === "Izin").length;
  const totalTidakHadir = listData.filter((s) => s.status === "Tidak Hadir").length;

  return (
    <div className="p-6 bg-white rounded-xl shadow-md space-y-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Rekap Absensi Per Kelas</h2>
          <p className="text-sm text-gray-500">
            Pilih kelas dan tanggal untuk melihat daftar kehadiran.
          </p>
        </div>

        {/* Filter Kelas & Tanggal */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          >
            {daftarKelas.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />

          {/* 🌟 TOMBOL DOWNLOAD LAPORAN REKAP PERBULAN / MULTI-PERTEMUAN */}
          <button
            onClick={() => {
              if (selectedDatesForExport.length === 0) {
                setSelectedDatesForExport([selectedDate]);
              }
              setShowDownloadModal(true);
            }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>Download Laporan Excel</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Ringkas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="p-3 bg-gray-50 rounded-lg border">
          <p className="text-xs text-gray-500 font-semibold">TOTAL SISWA</p>
          <p className="text-lg font-bold text-gray-800">{listData.length}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-green-600 font-semibold">HADIR</p>
          <p className="text-lg font-bold text-green-700">{totalHadir}</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-600 font-semibold">IZIN</p>
          <p className="text-lg font-bold text-amber-700">{totalIzin}</p>
        </div>
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-600 font-semibold">TIDAK HADIR</p>
          <p className="text-lg font-bold text-red-700">{totalTidakHadir}</p>
        </div>
      </div>

      {/* Tabel List Absensi */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
              <th className="py-3 px-4 border-b">No</th>
              <th className="py-3 px-4 border-b">NISN</th>
              <th className="py-3 px-4 border-b">Nama Siswa</th>
              <th className="py-3 px-4 border-b text-center">Waktu Scan</th>
              <th className="py-3 px-4 border-b text-center">Status</th>
              <th className="py-3 px-4 border-b text-center">Aksi (Ubah Status)</th>
              <th className="py-3 px-4 border-b text-center text-rose-600">!</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Memuat data absensi...
                </td>
              </tr>
            ) : listData.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Tidak ada data siswa untuk kelas ini.
                </td>
              </tr>
            ) : (
              listData.map((siswa, idx) => (
                <tr key={siswa.id || siswa.nisn} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-600">{idx + 1}</td>
                  <td className="py-3 px-4 font-mono text-gray-600">{siswa.nisn}</td>
                  <td className="py-3 px-4 font-semibold text-gray-800">{siswa.nama}</td>
                  <td className="py-3 px-4 text-center font-mono text-gray-600">
                    {siswa.waktuScan}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                        siswa.status === "Hadir"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : siswa.status === "Izin"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {siswa.status}
                    </span>
                  </td>

                  {/* Kolom Aksi Edit Status */}
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      <select
                        disabled={actionLoading === siswa.id}
                        value={siswa.status}
                        onChange={(e) =>
                          handleChangeStatus(
                            siswa,
                            e.target.value as "Hadir" | "Izin" | "Tidak Hadir"
                          )
                        }
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 disabled:opacity-50 ${
                          siswa.status === "Hadir"
                            ? "bg-green-50 border-green-300 text-green-800 focus:ring-green-400"
                            : siswa.status === "Izin"
                            ? "bg-amber-50 border-amber-300 text-amber-800 focus:ring-amber-400"
                            : "bg-red-50 border-red-300 text-red-800 focus:ring-red-400"
                        }`}
                      >
                        <option value="Hadir">✅ Hadir</option>
                        <option value="Izin">📝 Izin</option>
                        <option value="Tidak Hadir">❌ Tidak Hadir</option>
                      </select>
                      {actionLoading === siswa.id && (
                        <span className="text-[10px] text-slate-400 animate-pulse">...</span>
                      )}
                    </div>
                  </td>

                  {/* Kolom ! untuk Hapus Siswa Permanen */}
                  <td className="py-3 px-4 text-center">
                    <button
                      disabled={actionLoading === siswa.id}
                      onClick={() => handleHapusSiswaPermanen(siswa)}
                      title="Hapus Siswa Permanen"
                      className="px-2.5 py-1 bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-700 font-bold rounded-lg text-xs transition disabled:opacity-50"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TOMBOL PALING BAWAH: TAMBAH SISWA BARU */}
      <div className="pt-2 flex justify-end border-t border-slate-100">
        <button
          onClick={() => {
            setNewKelas(selectedKelas);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow transition flex items-center gap-2"
        >
          <span>➕</span>
          <span>Tambah Siswa Baru</span>
        </button>
      </div>

      {/* POP-UP MODAL 1: FORM TAMBAH SISWA BARU */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2">
              ➕ Tambah Siswa Baru ke Master Data
            </h3>
            <form onSubmit={handleTambahSiswaBaru} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  NISN Siswa
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0081234567"
                  value={newNisn}
                  onChange={(e) => setNewNisn(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Subagja"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Kelas Siswa
                </label>
                <select
                  value={newKelas}
                  onChange={(e) => setNewKelas(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {daftarKelas.map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
                >
                  {saveLoading ? "Menyimpan..." : "Simpan Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 POP-UP MODAL 2: PILIH BEBERAPA TANGGAL LAPORAN REKAP */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-bold text-lg text-slate-800">
                📥 Laporan Absensi Per-Bulan / Pertemuan (Kelas {selectedKelas})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Pilih beberapa tanggal pertemuan yang ingin dimasukkan ke dalam file Excel. Data
                otomatis diurutkan dari tanggal yang lebih awal.
              </p>
            </div>

            {/* Input Tambah Tanggal */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Tambah Tanggal Pertemuan:
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={tempDateInput}
                  onChange={(e) => setTempDateInput(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                />
                <button
                  type="button"
                  onClick={handleAddDateToExport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  + Tambah Tanggal
                </button>
              </div>
            </div>

            {/* List Chip Tanggal Terpilih */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700">
                  Tanggal Terpilih ({selectedDatesForExport.length} Pertemuan):
                </label>
                {selectedDatesForExport.length > 0 && (
                  <button
                    onClick={() => setSelectedDatesForExport([])}
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              <div className="min-h-24 max-h-36 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-slate-50 flex flex-wrap gap-2">
                {selectedDatesForExport.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada tanggal terpilih.</p>
                ) : (
                  [...selectedDatesForExport]
                    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                    .map((dateStr) => {
                      const [yyyy, mm, dd] = dateStr.split("-");
                      return (
                        <span
                          key={dateStr}
                          className="px-3 py-1 bg-white border border-blue-300 text-blue-800 text-xs font-bold rounded-full flex items-center gap-2 shadow-sm"
                        >
                          📅 {dd}/{mm}/{yyyy}
                          <button
                            onClick={() => handleRemoveDateFromExport(dateStr)}
                            className="text-slate-400 hover:text-rose-600 font-extrabold"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={downloadingCsv || selectedDatesForExport.length === 0}
                onClick={handleExecuteDownloadCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
              >
                {downloadingCsv ? "Mempersiapkan..." : "Download Excel (CSV)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}