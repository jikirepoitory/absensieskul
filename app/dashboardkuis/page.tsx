"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardKuisPage() {
  const [kelasTarget, setKelasTarget] = useState<string>("4");
  const [kodePertemuan, setKodePertemuan] = useState<number>(1);
  const [partTarget, setPartTarget] = useState<number>(1);

  const [soalList, setSoalList] = useState<{ acak: string; benar: string }[]>([
    { acak: "", benar: "" },
  ]);
  
  // State untuk menyimpan daftar soal dari Database
  const [existingSoal, setExistingSoal] = useState<any[]>([]);
  const [loadingSoal, setLoadingSoal] = useState<boolean>(false);

  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Load Soal & Live Results ketika Kelas, Pertemuan, atau Part Berubah
  useEffect(() => {
    fetchExistingSoal();
    fetchResults();

    // Subscribe Realtime Supabase untuk Jawaban
    const channel = supabase
      .channel("live_kuis_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kuis_jawaban" },
        () => {
          fetchResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kelasTarget, kodePertemuan, partTarget]);

  // Fetch Soal yang tersimpan di DB berdasarkan Kelas, Pertemuan & Part
  const fetchExistingSoal = async () => {
    setLoadingSoal(true);
    const { data, error } = await supabase
      .from("kuis_soal")
      .select("*")
      .eq("kelas", kelasTarget)
      .eq("kode_pertemuan", kodePertemuan)
      .eq("part", partTarget)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Gagal mengambil soal:", error.message);
    } else if (data) {
      setExistingSoal(data);
    }
    setLoadingSoal(false);
  };

  // Fetch Live Results berdasarkan Pertemuan & Part
  const fetchResults = async () => {
    const { data } = await supabase
      .from("kuis_jawaban")
      .select("*")
      .eq("kode_pertemuan", kodePertemuan)
      .eq("part", partTarget)
      .order("durasi_detik", { ascending: true });

    if (data) setLiveResults(data);
  };

  // Handler Form Input Soal
  const handleAddSoalField = () => {
    setSoalList([...soalList, { acak: "", benar: "" }]);
  };

  const handleRemoveSoalField = (index: number) => {
    setSoalList(soalList.filter((_, i) => i !== index));
  };

  const handleInputChange = (index: number, field: "acak" | "benar", value: string) => {
    const updated = [...soalList];
    updated[index][field] = value;

    if (field === "acak" && !updated[index].benar) {
      updated[index].benar = value;
    }

    setSoalList(updated);
  };

  // Fitur Load Soal ke Form untuk Edit
  const handleEditExistingSoal = () => {
    if (existingSoal.length === 0) return;
    const formatted = existingSoal.map((s) => ({
      acak: s.kalimat_acak || "",
      benar: s.kalimat_benar || "",
    }));
    setSoalList(formatted);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fitur Hapus 1 Soal dari DB
  const handleDeleteSingleSoal = async (id: string) => {
    if (confirm("Yakin ingin menghapus soal ini?")) {
      const { error } = await supabase.from("kuis_soal").delete().eq("id", id);
      if (error) {
        alert("Gagal menghapus soal: " + error.message);
      } else {
        fetchExistingSoal();
      }
    }
  };

  // Fitur Hapus Semua Soal pada Pertemuan & Part ini
  const handleDeleteAllSoal = async () => {
    if (
      confirm(
        `Hapus SEMUA soal untuk Kelas ${kelasTarget} (Pertemuan ${kodePertemuan} - Part ${partTarget})?`
      )
    ) {
      const { error } = await supabase
        .from("kuis_soal")
        .delete()
        .eq("kelas", kelasTarget)
        .eq("kode_pertemuan", kodePertemuan)
        .eq("part", partTarget);

      if (error) {
        alert("Gagal menghapus semua soal: " + error.message);
      } else {
        fetchExistingSoal();
      }
    }
  };

  // Submit / Terbitkan Soal Baru / Update
  const handleSubmitSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Hapus soal lama pada kelas, pertemuan & part ini
      const { error: deleteError } = await supabase
        .from("kuis_soal")
        .delete()
        .eq("kelas", kelasTarget)
        .eq("kode_pertemuan", kodePertemuan)
        .eq("part", partTarget);

      if (deleteError) {
        alert("❌ Gagal membersihkan soal lama: " + deleteError.message);
        setLoading(false);
        return;
      }

      // 2. Buat payload soal baru menyertakan kolom part
      const payload = soalList.map((item) => ({
        kelas: kelasTarget,
        kode_pertemuan: kodePertemuan,
        part: partTarget,
        kalimat_acak: item.acak,
        kalimat_benar: item.benar,
      }));

      // 3. Insert soal baru
      const { error: insertError } = await supabase.from("kuis_soal").insert(payload);

      if (insertError) {
        alert("❌ Gagal menyimpan soal baru: " + insertError.message);
      } else {
        alert(
          `✅ Berhasil memperbarui ${soalList.length} soal untuk Kelas ${kelasTarget} (Pertemuan ${kodePertemuan} - Part ${partTarget})!`
        );
        setSoalList([{ acak: "", benar: "" }]);
        fetchExistingSoal(); // Refresh daftar soal tersimpan
      }
    } catch (err: any) {
      alert("❌ Terjadi kesalahan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hapus data monitoring
  const handleDeleteResult = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data siswa ini?")) {
      await supabase.from("kuis_jawaban").delete().eq("id", id);
      fetchResults();
    }
  };

  const handleClearAllResults = async () => {
    if (
      confirm(
        `Hapus SEMUA hasil monitoring untuk Pertemuan ${kodePertemuan} - Part ${partTarget}?`
      )
    ) {
      await supabase
        .from("kuis_jawaban")
        .delete()
        .eq("kode_pertemuan", kodePertemuan)
        .eq("part", partTarget);
      fetchResults();
    }
  };

  const formatWaktu = (detik: number) => {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return m > 0 ? `${m}m ${s}s` : `${s} Detik`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">Dashboard Kuis Guru</h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola soal bertahap per Pertemuan & Part
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          {/* Filter Pertemuan */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Pertemuan:</label>
            <select
              value={kodePertemuan}
              onChange={(e) => setKodePertemuan(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-yellow-400 font-bold text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <option key={num} value={num}>
                  Pertemuan {num}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-700">|</span>

          {/* Filter Part */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Part:</label>
            <select
              value={partTarget}
              onChange={(e) => setPartTarget(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-bold text-sm"
            >
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  Part {num}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Buat / Edit Soal */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-lg font-semibold text-white">
              Input / Edit Soal
            </h2>
            <div className="flex gap-2">
              <span className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-xs px-2.5 py-1 rounded-md font-bold">
                Pertemuan {kodePertemuan}
              </span>
              <span className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-xs px-2.5 py-1 rounded-md font-bold">
                Part {partTarget}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-300">Pilih Kelas Target:</label>
            <select
              value={kelasTarget}
              onChange={(e) => setKelasTarget(e.target.value)}
              className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-yellow-400 font-bold"
            >
              <option value="4">Kelas 4</option>
              <option value="5">Kelas 5</option>
              <option value="6">Kelas 6</option>
            </select>
          </div>

          <form onSubmit={handleSubmitSoal} className="space-y-4">
            {soalList.map((soal, idx) => (
              <div key={idx} className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-yellow-400">Soal #{idx + 1}</span>
                  {soalList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSoalField(idx)}
                      className="text-rose-400 text-xs hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Kalimat/Teks Awal Soal (Tampil di Kolom Siswa):</label>
                  <input
                    type="text"
                    placeholder="Contoh: Panah ke kiri <- atau Simbol @"
                    value={soal.acak}
                    onChange={(e) => handleInputChange(idx, "acak", e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Kunci Jawaban yang Benar (Revisi):</label>
                  <input
                    type="text"
                    placeholder="Kunci jawaban benar yang persis disyaratkan"
                    value={soal.benar}
                    onChange={(e) => handleInputChange(idx, "benar", e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-sm text-white mt-1"
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAddSoalField}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg"
              >
                + Tambah Form Soal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold text-xs rounded-lg transition"
              >
                {loading ? "Menerbitkan..." : `Terbitkan (P${kodePertemuan} - Part ${partTarget})`}
              </button>
            </div>
          </form>
        </div>

        {/* Panel Manajemen Soal Aktif di DB */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                📋 Soal Aktif (K{kelasTarget} - P{kodePertemuan} - Part {partTarget})
              </h2>
              <span className="text-xs text-slate-400">
                Total: {existingSoal.length} Soal Tersimpan
              </span>
            </div>

            {existingSoal.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleEditExistingSoal}
                  className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/40 text-sky-400 border border-sky-500/30 rounded text-xs font-semibold"
                >
                  Edit Di Form
                </button>
                <button
                  onClick={handleDeleteAllSoal}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold"
                >
                  Hapus Semua
                </button>
              </div>
            )}
          </div>

          {loadingSoal ? (
            <p className="text-xs text-slate-500 py-4 text-center">Memuat data soal...</p>
          ) : existingSoal.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/60">
              <p className="text-xs">
                Belum ada soal terbit untuk Kelas {kelasTarget} (Pertemuan {kodePertemuan} - Part {partTarget}).
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {existingSoal.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg space-y-1 relative group"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-yellow-400">#Soal {index + 1}</span>
                    <button
                      onClick={() => handleDeleteSingleSoal(item.id)}
                      className="text-rose-400 hover:text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20"
                    >
                      Hapus
                    </button>
                  </div>
                  <p className="text-xs text-slate-200">
                    <span className="text-slate-400">Teks Soal:</span> {item.kalimat_acak}
                  </p>
                  <p className="text-xs text-emerald-400">
                    <span className="text-slate-400">Kunci:</span> {item.kalimat_benar}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Live Monitoring (Waktu Tercepat) */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">
              🔴 Live Leaderboard Waktu Tercepat (Pertemuan {kodePertemuan} - Part {partTarget})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Data otomatis diperbarui ke record waktu tercepat jika siswa mengulang Part ini.
            </p>
          </div>

          {liveResults.length > 0 && (
            <button
              onClick={handleClearAllResults}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition"
            >
              Hapus Semua Hasil
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="p-3">Peringkat</th>
                <th className="p-3">Nama Siswa</th>
                <th className="p-3">Kelas</th>
                <th className="p-3">Part</th>
                <th className="p-3">Waktu Tercepat</th>
                <th className="p-3">Terakhir Selesai</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {liveResults.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    Belum ada data pengerjaan pada Pertemuan {kodePertemuan} - Part {partTarget}...
                  </td>
                </tr>
              ) : (
                liveResults.map((res, index) => (
                  <tr key={res.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-yellow-400">#{index + 1}</td>
                    <td className="p-3 font-bold text-white">{res.nama_siswa}</td>
                    <td className="p-3">{res.kelas}</td>
                    <td className="p-3 font-bold text-emerald-400">Part {res.part || 1}</td>
                    <td className="p-3 font-extrabold text-emerald-400 text-sm">
                      ⚡ {formatWaktu(res.durasi_detik)}
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(res.waktu_selesai).toLocaleTimeString("id-ID")}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteResult(res.id)}
                        className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 text-[10px] rounded border border-rose-500/30"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}