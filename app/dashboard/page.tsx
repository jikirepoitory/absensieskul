'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ListAbsensi from './components/ListAbsensi';

interface Siswa {
  id: string;
  nisn: string;
  nama: string;
  kelas: string;
}

interface DataAbsensi {
  id: number;
  created_at: string;
  nis?: string;
  nisn: string;
  nama_siswa: string;
  kelas: string;
  status: string;
}

interface AuditLog {
  id: number;
  created_at: string;
  username: string;
  aksi: string;
  detail: string;
}

export default function DashboardPage() {
  const router = useRouter();

  // State User Login
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // State Master Data Siswa & Kelas
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [kelasSelected, setKelasSelected] = useState<string>('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('');
  const [statusAbsen, setStatusAbsen] = useState<'Hadir' | 'Izin'>('Hadir');
  const [tanggalAbsen, setTanggalAbsen] = useState<string>(''); // Tambahan tanggal custom

  // State App & Logs
  const [filterKelas, setFilterKelas] = useState<string>('SEMUA');
  const [listAbsensi, setListAbsensi] = useState<DataAbsensi[]>([]);
  const [listLogs, setListLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingKelas, setLoadingKelas] = useState<boolean>(true);
  const [loadingSiswa, setLoadingSiswa] = useState<boolean>(false);
  const [pesan, setPesan] = useState<{ tipe: 'success' | 'error'; teks: string } | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [editingItem, setEditingItem] = useState<DataAbsensi | null>(null);

  // Protection Guard: Cek session login
  useEffect(() => {
    const savedUser = localStorage.getItem('user_absensi');
    if (!savedUser) {
      router.push('/');
    } else {
      setCurrentUser(savedUser);
    }
  }, [router]);

  // 1. Fetch Daftar Kelas Unik dari Tabel Siswa
  useEffect(() => {
    const fetchKelas = async () => {
      setLoadingKelas(true);
      const { data, error } = await supabase.from('siswa').select('kelas');

      if (!error && data) {
        const uniqueKelas = Array.from(
          new Set(data.map((item) => item.kelas).filter(Boolean))
        ).sort();
        setKelasList(uniqueKelas as string[]);
      }
      setLoadingKelas(false);
    };

    fetchKelas();
  }, []);

  // 2. Fetch Daftar Siswa berdasarkan Kelas yang dipilih
  useEffect(() => {
    if (!kelasSelected) {
      setSiswaList([]);
      setSelectedSiswaId('');
      return;
    }

    const fetchSiswa = async () => {
      setLoadingSiswa(true);
      const { data, error } = await supabase
        .from('siswa')
        .select('*')
        .eq('kelas', kelasSelected)
        .order('nama', { ascending: true });

      if (!error && data) {
        setSiswaList(data as Siswa[]);
      }
      setLoadingSiswa(false);
    };

    fetchSiswa();
  }, [kelasSelected]);

  // Fetch Data Absensi
  const fetchAbsensi = async () => {
    const { data } = await supabase.from('absensi').select('*').order('created_at', { ascending: false });
    if (data) setListAbsensi(data);
  };

  // Fetch Audit Logs
  const fetchLogs = async () => {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setListLogs(data);
  };

  useEffect(() => {
    if (currentUser) {
      fetchAbsensi();
      if (currentUser.toLowerCase() !== 'ilham') {
        fetchLogs();
      }
    }
  }, [currentUser]);

  // Catat Audit Log ke Supabase
  const logActivity = async (aksi: string, detail: string) => {
    if (!currentUser) return;
    await supabase.from('audit_logs').insert([{ username: currentUser, aksi, detail }]);
    if (currentUser.toLowerCase() !== 'ilham') fetchLogs();
  };

  // Handle Logout
  const handleLogout = async () => {
    await logActivity('LOGOUT', `User ${currentUser} logout.`);
    localStorage.removeItem('user_absensi');
    router.push('/');
  };

  // Simpan Absensi Manual
  const simpanAbsensi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiswaId) return alert('Silakan pilih nama siswa!');

    const targetSiswa = siswaList.find((s) => s.id === selectedSiswaId);
    if (!targetSiswa) return;

    setLoading(true);
    setPesan(null);

    // Menyiapkan payload insert
    const insertData: any = {
      nisn: targetSiswa.nisn || '',
      nama_siswa: targetSiswa.nama,
      kelas: kelasSelected,
      status: statusAbsen,
    };

    // Jika user memilih tanggal khusus (Manual Absen Backdate/Future)
    if (tanggalAbsen) {
      const selectedDate = new Date(tanggalAbsen);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      insertData.created_at = selectedDate.toISOString();
    }

    const { error } = await supabase.from('absensi').insert([insertData]);

    setLoading(false);

    if (error) {
      setPesan({ tipe: 'error', teks: 'Gagal mencatat absensi: ' + error.message });
    } else {
      setPesan({
        tipe: 'success',
        teks: `Berhasil absensi (${statusAbsen}): ${targetSiswa.nama} (${kelasSelected}) ${
          tanggalAbsen ? `pada tanggal ${tanggalAbsen}` : ''
        }`,
      });

      await logActivity(
        'ADD_ABSEN',
        `Menambahkan absensi [${statusAbsen}] NISN: ${targetSiswa.nisn}, Nama: ${targetSiswa.nama}, Kelas: ${kelasSelected} ${
          tanggalAbsen ? `(Manual Tanggal: ${tanggalAbsen})` : ''
        }`
      );

      // Reset Form Siswa & Tanggal
      setSelectedSiswaId('');
      setTanggalAbsen('');
      fetchAbsensi();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  // Hapus Data Absensi
  const handleHapus = async (item: DataAbsensi) => {
    const displayIdentifier = item.nisn || item.nis || '-';
    if (!confirm(`Yakin ingin menghapus absensi ${item.nama_siswa} (${displayIdentifier})?`)) return;

    const { error } = await supabase.from('absensi').delete().eq('id', item.id);

    if (error) {
      alert('Gagal menghapus: ' + error.message);
    } else {
      await logActivity('DELETE', `Menghapus data absensi ID ${item.id} (${item.nama_siswa} - NISN: ${displayIdentifier})`);
      fetchAbsensi();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  // Edit Data Absensi
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const { error } = await supabase
      .from('absensi')
      .update({
        nama_siswa: editingItem.nama_siswa,
        nisn: editingItem.nisn,
        kelas: editingItem.kelas,
        status: editingItem.status || 'Hadir',
      })
      .eq('id', editingItem.id);

    if (error) {
      alert('Gagal update data: ' + error.message);
    } else {
      await logActivity('EDIT', `Mengedit data ID ${editingItem.id} menjadi NISN: ${editingItem.nisn}, Nama: ${editingItem.nama_siswa}, Kelas: ${editingItem.kelas}, Status: ${editingItem.status}`);
      setEditingItem(null);
      fetchAbsensi();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  // Filter Data Absensi
  const filteredAbsensi = listAbsensi.filter((item) => {
    if (filterKelas === 'SEMUA') return true;
    return item.kelas === filterKelas;
  });

  // Download Data CSV
  const handleDownloadCSV = async () => {
    if (listAbsensi.length === 0) return alert('Tidak ada data untuk di-download');

    const sortedData = [...listAbsensi].sort((a, b) => a.kelas.localeCompare(b.kelas));
    const headers = ['ID,Waktu,NISN,Nama Siswa,Kelas,Status\n'];
    const rows = sortedData.map(
      (item) => `${item.id},"${new Date(item.created_at).toLocaleString('id-ID')}","${item.nisn || item.nis || '-'}","${item.nama_siswa}","${item.kelas}","${item.status || 'Hadir'}"\n`
    );

    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Absensi_Eskul_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await logActivity('DOWNLOAD', `Mendownload rekap data absensi CSV terurut (${listAbsensi.length} baris data).`);
  };

  if (!currentUser) return null;

  const isIlham = currentUser.toLowerCase() === 'ilham';

  return (
    <main className="min-h-screen bg-slate-100 p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Dashboard */}
        <header className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sistem Absensi Siswa</h1>
            <p className="text-sm text-slate-500">Input manual absensi dan manajemen rekap data</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Petugas Aktif</span>
              <span className="font-bold text-blue-600 capitalize">👤 {currentUser}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-700 text-sm font-semibold rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Notifikasi */}
        {pesan && (
          <div
            className={`p-4 rounded-lg text-sm font-semibold ${
              pesan.tipe === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {pesan.teks}
          </div>
        )}

        {/* Grid Utama (Form Input & Riwayat Absensi) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Kolom 1: Form Input Manual Absensi (Pilih Kelas & Siswa) */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-4">
            <h2 className="font-semibold text-lg text-slate-800 pb-2 border-b border-slate-100">
              1. Absensi Manual 
            </h2>

            <form onSubmit={simpanAbsensi} className="space-y-4 pt-1">
              {/* Dropdown Pilih Kelas */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pilih Kelas
                </label>
                <select
                  required
                  value={kelasSelected}
                  onChange={(e) => {
                    setKelasSelected(e.target.value);
                    setSelectedSiswaId('');
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="">
                    {loadingKelas ? '-- Memuat Kelas... --' : '-- Pilih Kelas --'}
                  </option>
                  {kelasList.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Pilih Nama Siswa */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pilih Nama Siswa
                </label>
                <select
                  required
                  disabled={!kelasSelected || loadingSiswa}
                  value={selectedSiswaId}
                  onChange={(e) => setSelectedSiswaId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-slate-800"
                >
                  <option value="">
                    {!kelasSelected
                      ? '-- Pilih Kelas Terlebih Dahulu --'
                      : loadingSiswa
                      ? '-- Memuat Siswa... --'
                      : '-- Pilih Nama Siswa --'}
                  </option>
                  {siswaList.map((siswa) => (
                    <option key={siswa.id} value={siswa.id}>
                      {siswa.nama} (NISN: {siswa.nisn || '-'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pilihan Status (Hadir / Izin) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatusAbsen('Hadir')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      statusAbsen === 'Hadir'
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>✅</span>
                    <span>Hadir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusAbsen('Izin')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      statusAbsen === 'Izin'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>📝</span>
                    <span>Izin</span>
                  </button>
                </div>
              </div>

              {/* Input Tanggal (Opsional untuk Absen Manual Hari Lain) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pilih Tanggal Absen (Opsional / Manual Date)
                </label>
                <input
                  type="date"
                  value={tanggalAbsen}
                  onChange={(e) => setTanggalAbsen(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  *Kosongkan jika ingin mencatat absensi untuk hari ini (realtime).
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedSiswaId}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50 shadow-sm mt-2"
              >
                {loading ? 'Menyimpan...' : 'Simpan Absensi'}
              </button>
            </form>
          </div>

          {/* Kolom 2: Riwayat Absensi Hari Ini */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="font-semibold text-lg text-slate-800">2. Riwayat Absensi</h2>
              <button
                onClick={handleDownloadCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
              >
                📥 Download Excel/CSV
              </button>
            </div>

            {/* Filter Per Kelas */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Filter Kelas:</span>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="p-1.5 border border-slate-300 rounded text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
              >
                <option value="SEMUA">Semua Kelas</option>
                {kelasList.map((kls) => (
                  <option key={kls} value={kls}>
                    Kelas {kls}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="p-2">Waktu / Tgl</th>
                    <th className="p-2">Siswa</th>
                    <th className="p-2">Kelas</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAbsensi.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        {filterKelas === 'SEMUA' ? 'Belum ada data absensi.' : `Belum ada data untuk ${filterKelas}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredAbsensi.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                          })}{' '}
                          {new Date(item.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-slate-800">{item.nama_siswa}</div>
                          <div className="text-xs text-slate-400">
                            NISN: {item.nisn || item.nis || '-'}
                          </div>
                        </td>
                        <td className="p-2 font-semibold text-slate-700">{item.kelas}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                              item.status === 'Izin'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-green-100 text-green-700 border-green-200'
                            }`}
                          >
                            {item.status || 'Hadir'}
                          </span>
                        </td>
                        <td className="p-2 text-center space-x-1">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleHapus(item)}
                            className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs font-medium"
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

        {/* Section 3: List Absensi Per Kelas */}
        <ListAbsensi refreshTrigger={refreshTrigger} />

        {/* Log Aktivitas Petugas (Audit Control) */}
        {!isIlham && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-3">
            <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
              <span>🔍 Log Aktivitas Petugas (Audit Control)</span>
            </h2>
            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Waktu</th>
                    <th className="p-2.5">User/Petugas</th>
                    <th className="p-2.5">Aksi</th>
                    <th className="p-2.5">Detail Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">Belum ada catatan aktivitas.</td>
                    </tr>
                  ) : (
                    listLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 font-bold text-blue-600 capitalize">{log.username}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            log.aksi === 'DELETE' ? 'bg-rose-100 text-rose-700' :
                            log.aksi === 'EDIT' ? 'bg-amber-100 text-amber-700' :
                            log.aksi === 'DOWNLOAD' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.aksi}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700">{log.detail}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Modal Popup Edit Data */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Edit Data Absensi</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">NISN</label>
                <input
                  type="text"
                  value={editingItem.nisn || editingItem.nis || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, nisn: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nama Siswa</label>
                <input
                  type="text"
                  value={editingItem.nama_siswa}
                  onChange={(e) => setEditingItem({ ...editingItem, nama_siswa: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Kelas</label>
                <select
                  value={editingItem.kelas}
                  onChange={(e) => setEditingItem({ ...editingItem, kelas: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                >
                  {kelasList.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Status Kehadiran</label>
                <select
                  value={editingItem.status || 'Hadir'}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                >
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}