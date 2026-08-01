"use client";
import { useState, useRef, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";

// Inisialisasi Supabase Client dari Environment Variable
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. Buat tipe data untuk Siswa
interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  created_at?: string;
}

export default function PendaftaranKartuPage() {
  const [nama, setNama] = useState<string>("");
  const [kelas, setKelas] = useState<string>("");
  const [studentData, setStudentData] = useState<Siswa | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nama || !kelas) return alert("Harap isi semua kolom!");

    setLoading(true);

    const { data, error } = await supabase
      .from("siswa")
      .insert([{ nama, kelas }])
      .select()
      .single();

    if (error) {
      alert("Gagal menyimpan data: " + error.message);
    } else {
      setStudentData(data as Siswa);
    }
    setLoading(false);
  };

  // Download Kartu sebagai Gambar PNG
  const handleDownload = async () => {
    if (cardRef.current === null || !studentData) return;

    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = `Kartu_Siswa_${studentData.nama.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mendownload kartu", err);
      alert("Gagal mendownload gambar kartu.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-yellow-400 mb-6 text-center">
        Pendaftaran & Pembuatan Kartu Siswa
      </h1>

      {!studentData ? (
        /* Form Isian Orang Tua */
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 shadow-lg"
        >
          <div>
            <label className="block text-sm mb-1 text-slate-300 font-medium">
              Nama Lengkap Siswa
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Muhammad Ziqi"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-yellow-400 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300 font-medium">
              Kelas / Jenis Kelas
            </label>
            <select
              required
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">-- Pilih Kelas --</option>
              <option value="4A">4A</option>
              <option value="4B">4B</option>
              <option value="5A">5A</option>
              <option value="5B">5B</option>
              <option value="6A">6A</option>
              <option value="6B">6B</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold p-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Membangun Kartu..." : "Buat & Generate Kartu"}
          </button>
        </form>
      ) : (
        /* Tampilan Preview Kartu & Tombol Download */
        <div className="flex flex-col items-center gap-6">
          {/* Elemen Kartu Siswa yang siap didownload */}
          <div
            ref={cardRef}
            className="w-80 p-6 bg-slate-900 border-2 border-yellow-400 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-4"
          >
            <div className="border-b border-slate-800 pb-2 w-full">
              <h2 className="font-extrabold text-base text-yellow-400 tracking-wider">
                KARTU ABSENSI SISWA
              </h2>
            </div>

            {/* 🟢 QR Code dengan Logo Eskul di Tengah */}
           {/* 🟢 QR Code dengan Logo Menyatu & Lebih Besar */}
<div className="bg-white p-3 rounded-xl shadow-inner">
  <QRCodeSVG
    value={studentData.id}
    size={160} // Diperbesar sedikit dari 150 ke 160 agar proporsional
    level="H" 
    imageSettings={{
      src: "/logo-eskul.png",
      x: undefined,
      y: undefined,
      height: 65,      // 👈 Ubah jadi 42
      width: 65,       // 👈 Ubah jadi 42
      excavate: false, // 👈 Ubah dari true jadi false
    }}
  />
</div>


            <div className="space-y-1 w-full">
              <p className="font-bold text-lg text-white truncate">
                {studentData.nama}
              </p>
              <p className="text-sm font-semibold text-yellow-400">
                {studentData.kelas}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-2">
                ID: {studentData.id}
              </p>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold px-5 py-2.5 rounded-lg transition shadow-md"
            >
              Download Kartu (PNG)
            </button>
            <button
              onClick={() => {
                setStudentData(null);
                setNama("");
                setKelas("");
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-lg transition"
            >
              Buat Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}