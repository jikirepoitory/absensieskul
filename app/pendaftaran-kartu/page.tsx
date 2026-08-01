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

// Tipe data untuk Siswa
interface Siswa {
  id: string;
  nisn: string;
  nama: string;
  kelas: string;
  created_at?: string;
}

export default function PendaftaranKartuPage() {
  const [nisn, setNisn] = useState<string>("");
  const [nama, setNama] = useState<string>("");
  const [kelas, setKelas] = useState<string>("");
  const [studentData, setStudentData] = useState<Siswa | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nisn || !nama || !kelas) return alert("Harap isi semua kolom!");

    setLoading(true);

    const { data, error } = await supabase
      .from("siswa")
      .insert([{ nisn, nama, kelas }])
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
      link.download = `Kartu_Absensi_${studentData.nama.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mendownload kartu", err);
      alert("Gagal mendownload gambar kartu.");
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-2xl font-bold text-[#FFF449] mb-6 text-center">
        Pendaftaran & Pembuatan Kartu Siswa
      </h1>

      {!studentData ? (
        /* Form Isian */
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-[#131b2e] p-6 rounded-xl border border-[#525EA7]/40 space-y-4 shadow-xl"
        >
          <div>
            <label className="block text-sm mb-1 text-slate-300 font-medium">
              NISN Siswa
            </label>
            <input
              type="text"
              required
              placeholder="Masukkan NISN"
              value={nisn}
              onChange={(e) => setNisn(e.target.value)}
              className="w-full p-3 bg-[#0d1322] border border-[#525EA7]/60 rounded-lg text-[#FFF449] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5FACD3]"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300 font-medium">
              Nama Lengkap Siswa
            </label>
            <input
              type="text"
              required
              placeholder="Masukkan nama lengkap"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full p-3 bg-[#0d1322] border border-[#525EA7]/60 rounded-lg text-[#FFF449] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5FACD3]"
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
              className="w-full p-3 bg-[#0d1322] border border-[#525EA7]/60 rounded-lg text-[#FFF449] focus:outline-none focus:ring-2 focus:ring-[#5FACD3]"
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
            className="w-full bg-[#FFF449] hover:bg-[#F4D35E] text-[#0d1322] font-bold p-3 rounded-lg transition disabled:opacity-50 shadow-md"
          >
            {loading ? "Membangun Kartu..." : "Buat & Generate Kartu"}
          </button>
        </form>
      ) : (
        /* Tampilan Preview Kartu & Tombol Download */
        <div className="flex flex-col items-center gap-6">
          {/* Desain Kartu Absensi Ukuran KTP (Portrait) - Custom Pattern Background */}
          <div
            ref={cardRef}
            className="relative w-[320px] h-[508px] p-5 bg-[#0d1322] border-2 border-[#F4D35E] rounded-2xl shadow-[0_0_35px_rgba(82,94,167,0.45)] flex flex-col items-center justify-between text-center overflow-hidden"
          >
            {/* Layer Background Pattern / Vector Tech Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#131b2e] via-[#0d1322] to-[#18233c] pointer-events-none" />
            
            {/* Pattern Mesh SVG */}
            <svg
              className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
            >
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#5FACD3" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Aksen Background Glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#5FACD3]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#525EA7]/30 rounded-full blur-3xl pointer-events-none" />

            {/* Corner Bracket Decorators */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#FFF449] pointer-events-none" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#FFF449] pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#FFF449] pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#FFF449] pointer-events-none" />

            {/* 1. HEADER JUDUL */}
            <div className="w-full pt-1 z-10">
              <h2 className="font-black text-lg text-[#FFF449] tracking-widest leading-tight uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                KARTU ABSENSI
              </h2>
              <div className="mt-1 mx-auto w-fit bg-[#525EA7]/40 border border-[#5FACD3]/50 px-3 py-0.5 rounded-full backdrop-blur-sm">
                <p className="text-[10px] font-extrabold text-[#5FACD3] tracking-widest uppercase">
                  EKSTRAKULIKULER KOMPUTER
                </p>
              </div>
            </div>

            {/* 2. NAMA & KELAS (DI ATAS QR CODE) */}
            <div className="w-full bg-[#131b2e]/85 border border-[#525EA7]/50 rounded-xl py-2 px-3 shadow-md z-10 backdrop-blur-md space-y-0.5">
              <p className="font-black text-lg text-white truncate leading-snug tracking-wide">
                {studentData.nama}
              </p>
              <p className="text-xs font-extrabold text-[#F4D35E] tracking-wider">
                KELAS: {studentData.kelas}
              </p>
            </div>

            {/* 3. QR CODE (DI TENGAH) */}
            <div className="relative p-1.5 rounded-2xl bg-gradient-to-tr from-[#525EA7] via-[#5FACD3] to-[#F4D35E] shadow-[0_8px_20px_rgba(0,0,0,0.6)] z-10">
              <div className="bg-white p-2.5 rounded-[12px]">
                <QRCodeSVG
                  value={studentData.id}
                  size={145}
                  level="H"
                  imageSettings={{
                    src: "/logo-eskul.png",
                    x: undefined,
                    y: undefined,
                    height: 65,
                    width: 65,
                    excavate: false,
                  }}
                />
              </div>
            </div>

            {/* 4. NISN (DI PALING BAWAH, SANGAT AMAN UNTUK KODE PANJANG) */}
            <div className="w-full z-10 pb-1">
              <div className="bg-[#090d16]/90 border border-[#525EA7]/60 rounded-lg py-1.5 px-3 backdrop-blur-sm">
                <p className="text-[10px] uppercase font-bold text-[#5FACD3] tracking-wider">
                  NISN
                </p>
                <p className="text-xs font-mono font-bold text-white break-all leading-tight mt-0.5">
                  {studentData.nisn}
                </p>
              </div>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="bg-[#FFF449] hover:bg-[#F4D35E] text-[#0d1322] font-bold px-5 py-2.5 rounded-lg transition shadow-lg"
            >
              Download Kartu (PNG)
            </button>
            <button
              onClick={() => {
                setStudentData(null);
                setNisn("");
                setNama("");
                setKelas("");
              }}
              className="bg-[#131b2e] hover:bg-[#18233c] text-slate-300 font-semibold border border-[#525EA7]/50 px-4 py-2.5 rounded-lg transition"
            >
              Buat Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}