'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // 1. Import Supabase

const USERS: Record<string, string> = {
  ziqi: 'ziqi12522033',
  ilham: 'ilham12345',
};

export default function LoginPage() {
  const router = useRouter();
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user_absensi');
    if (savedUser) {
      router.push('/dashboard');
    }
  }, [router]);

  // 2. Ubah fungsi menjadi async
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (USERS[loginUsername] && USERS[loginUsername] === loginPassword) {
      setLoading(true);

      // 3. Catat log LOGIN ke Supabase
      const { error } = await supabase.from('audit_logs').insert([
        {
          username: loginUsername,
          aksi: 'LOGIN',
          detail: `User ${loginUsername} berhasil login.`,
        },
      ]);

      if (error) {
        console.error('Gagal mencatat audit log login:', error.message);
      }

      localStorage.setItem('user_absensi', loginUsername);
      router.push('/dashboard');
    } else {
      setLoginError('Username atau Password salah!');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Login Absensi Eskul</h1>
          <p className="text-sm text-slate-500 mt-1">Masukkan username & password petugas</p>
        </div>

        {loginError && (
          <div className="p-3 bg-rose-100 text-rose-800 text-sm rounded-lg font-semibold text-center">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Username</label>
            <input
              type="text"
              placeholder="ziqi / ilham"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </main>
  );
}
