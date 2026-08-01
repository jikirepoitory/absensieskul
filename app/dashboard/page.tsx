'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface DataAbsensi {
  id: number;
  created_at: string;
  nis: string;
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

  // State App
  const [kelasSelected, setKelasSelected] = useState<string>('4A');
  const [filterKelas, setFilterKelas] = useState<string>('SEMUA');
  const [nis, setNis] = useState<string>('');
  const [namaSiswa, setNamaSiswa] = useState<string>('');
  const [listAbsensi, setListAbsensi] = useState<DataAbsensi[]>([]);
  const [listLogs, setListLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pesan, setPesan] = useState<{ tipe: 'success' | 'error'; teks: string } | null>(null);

  // State Edit Modal
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

  // Fetch Data Absensi (Untuk Semua User)
  const fetchAbsensi = async () => {
    const { data } = await supabase.from('absensi').select('*').order('created_at', { ascending: false });
    if (data) setListAbsensi(data);
  };

  // Fetch Audit Logs (Hanya jika bukan Ilham)
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
  const simpanAbsensi = async (nisInput: string, namaInput: string) => {
    setLoading(true);
    setPesan(null);

    const { error } = await supabase.from('absensi').insert([
      { nis: nisInput, nama_siswa: namaInput, kelas: kelasSelected, status: 'Hadir' },
    ]);

    setLoading(false);

    if (error) {
      setPesan({ tipe: 'error', teks: 'Gagal mencatat absensi: ' + error.message });
    } else {
      setPesan({ tipe: 'success', teks: `Berhasil absensi NIS: ${nisInput} (${kelasSelected})` });
      await logActivity('ADD_ABSEN', `Menambahkan absensi NIS: ${nisInput}, Nama: ${namaInput}, Kelas: ${kelasSelected}`);
      setNis('');
      setNamaSiswa('');
      fetchAbsensi();
    }
  };

  // Hapus Data Absensi
  const handleHapus = async (item: DataAbsensi) => {
    if (!confirm(`Yakin ingin menghapus absensi ${item.nama_siswa} (${item.nis})?`)) return;

    const { error } = await supabase.from('absensi').delete().eq('id', item.id);

    if (error) {
      alert('Gagal menghapus: ' + error.message);
    } else {
      await logActivity('DELETE', `Menghapus data absensi ID ${item.id} (${item.nama_siswa} - NIS: ${item.nis})`);
      fetchAbsensi();
    }
  };

  // Edit Data Absensi
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const { error } = await supabase
      .from('absensi')
      .update({ nama_siswa: editingItem.nama_siswa, nis: editingItem.nis, kelas: editingItem.kelas })
      .eq('id', editingItem.id);

    if (error) {
      alert('Gagal update data: ' + error.message);
    } else {
      await logActivity('EDIT', `Mengedit data ID ${editingItem.id} menjadi NIS: ${editingItem.nis}, Nama: ${editingItem.nama_siswa}, Kelas: ${editingItem.kelas}`);
      setEditingItem(null);
      fetchAbsensi();
    }
  };

  // Filter Data Absensi untuk Tampilan Tabel
  const filteredAbsensi = listAbsensi.filter((item) => {
    if (filterKelas === 'SEMUA') return true;
    return item.kelas === filterKelas;
  });

  // Download Data sebagai CSV
  const handleDownloadCSV = async () => {
    if (listAbsensi.length === 0) return alert('Tidak ada data untuk di-download');

    const sortedData = [...listAbsensi].sort((a, b) => a.kelas.localeCompare(b.kelas));

    const headers = ['ID,Waktu,NIS,Nama Siswa,Kelas,Status\n'];
    const rows = sortedData.map(
      (item) => `${item.id},"${new Date(item.created_at).toLocaleString('id-ID')}","${item.nis}","${item.nama_siswa}","${item.kelas}","${item.status}"\n`
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
          
          {/* Kolom 1: Form Input Manual Absensi */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="font-semibold text-lg text-slate-800">1. Pilihan Kelas & Input Absensi</h2>
              <select
                value={kelasSelected}
                onChange={(e) => setKelasSelected(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="4A">Kelas 4A</option>
                <option value="4B">Kelas 4B</option>
                <option value="5A">Kelas 5A</option>
                <option value="5B">Kelas 5B</option>
                <option value="6A">Kelas 6A</option>
                <option value="6B">Kelas 6B</option>
              </select>
            </div>

            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                if (nis && namaSiswa) simpanAbsensi(nis, namaSiswa); 
              }} 
              className="space-y-4 pt-2"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">NIS Siswa</label>
                <input
                  type="text"
                  placeholder="Masukkan NIS Siswa"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Siswa</label>
                <input
                  type="text"
                  placeholder="Masukkan Nama Siswa"
                  value={namaSiswa}
                  onChange={(e) => setNamaSiswa(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Menyimpan...' : 'Simpan Absensi'}
              </button>
            </form>
          </div>

          {/* Kolom 2: Riwayat Absensi Hari Ini */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="font-semibold text-lg text-slate-800">2. Riwayat Absensi Hari Ini</h2>
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
                <option value="4A">Kelas 4A</option>
                <option value="4B">Kelas 4B</option>
                <option value="5A">Kelas 5A</option>
                <option value="5B">Kelas 5B</option>
                <option value="6A">Kelas 6A</option>
                <option value="6B">Kelas 6B</option>
              </select>
            </div>

{/* SESUDAH */}
<div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-lg">
  <table className="w-full text-left text-sm">
    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                
                  <tr>
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Siswa</th>
                    <th className="p-2">Kelas</th>
                    <th className="p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAbsensi.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        {filterKelas === 'SEMUA' ? 'Belum ada data absensi.' : `Belum ada data untuk ${filterKelas}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredAbsensi.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-slate-800">{item.nama_siswa}</div>
                          <div className="text-xs text-slate-400">{item.nis}</div>
                        </td>
                        <td className="p-2 font-semibold text-slate-700">{item.kelas}</td>
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

        {/* Log Aktivitas Petugas (Audit Control) - Sembunyi khusus untuk user 'ilham' */}
        {!isIlham && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-3">
            <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
              <span>🔍 Log Aktivitas Petugas (Audit Control)</span>
            </h2>
          {/* SESUDAH */}
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
                <label className="text-xs font-semibold text-slate-600 block mb-1">NIS</label>
                <input
                  type="text"
                  value={editingItem.nis}
                  onChange={(e) => setEditingItem({ ...editingItem, nis: e.target.value })}
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
                  <option value="4A">Kelas 4A</option>
                  <option value="4B">Kelas 4B</option>
                  <option value="5A">Kelas 5A</option>
                  <option value="5B">Kelas 5B</option>
                  <option value="6A">Kelas 6A</option>
                  <option value="6B">Kelas 6B</option>
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