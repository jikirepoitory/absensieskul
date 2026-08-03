"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function ScannerPage() {
  const [statusMessage, setStatusMessage] = useState<string>("Arahkan QR Code ke kamera...");
  const [scannedData, setScannedData] = useState<{
    id: string;
    nisn: string;
    nama: string;
    kelas: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  const handleScan = async (result: any) => {
    if (!result || !result[0]?.rawValue || !isScanning) return;

    const scannedText = result[0].rawValue.trim();
    setIsScanning(false); // Hentikan scanner sementara agar tidak request ganda
    setLoading(true);
    setStatusMessage("QR Terbaca! Memproses data...");

    try {
      // 1. Cari data siswa (Cek NISN dulu, lalu ID, lalu Nama jika QR hanya berisi NISN/Nama)
      let { data: siswa, error: errorSiswa } = await supabase
        .from("siswa")
        .select("*")
        .or(`nisn.eq.${scannedText},id.eq.${scannedText},nama.eq.${scannedText}`)
        .maybeSingle();

      if (errorSiswa || !siswa) {
        setStatusMessage("❌ Data siswa tidak ditemukan di database!");
        setLoading(false);
        return;
      }

      // 2. Cek apakah siswa ini sudah absen (Hadir) pada HARI INI
      const todayDate = new Date().toISOString().split("T")[0];
      const startOfDay = `${todayDate}T00:00:00.000Z`;
      const endOfDay = `${todayDate}T23:59:59.999Z`;

      const { data: existingAbsen } = await supabase
        .from("absensi")
        .select("id")
        .eq("nisn", siswa.nisn)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .maybeSingle();

      // Set data siswa ke UI untuk ditampilkan
      setScannedData({
        id: siswa.id,
        nisn: siswa.nisn || "-",
        nama: siswa.nama,
        kelas: siswa.kelas,
      });

      // 3. Jika SUDAH pernah scan hari ini -> Beri Notifikasi & Jangan Insert Baru
      if (existingAbsen) {
        setStatusMessage(`⚠️ Siswa ${siswa.nama} sudah terdata HADIR hari ini!`);
        setLoading(false);
        return;
      }

      // 4. Jika BELUM absen -> Insert data baru dengan status Hadir
      const { error: errorAbsen } = await supabase.from("absensi").insert([
        {
          nis: siswa.id,
          nisn: siswa.nisn,
          nama_siswa: siswa.nama,
          kelas: siswa.kelas,
          status: "Hadir",
        },
      ]);

      if (errorAbsen) {
        setStatusMessage("❌ Gagal mencatat absensi: " + errorAbsen.message);
      } else {
        
        setStatusMessage("✅ ABSENSI BERHASIL DICATAT!");
      }
    } catch (err: any) {
      setStatusMessage("❌ Terjadi kesalahan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-2xl font-bold text-yellow-400 mb-6 text-center">
        Scanner Absensi Siswa
      </h1>

      <div className="w-full max-w-sm bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center gap-4">
        {/* Tampilan Kamera */}
        <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 min-h-[280px]">
          {isScanning && (
            <Scanner
              onScan={handleScan}
              onError={(error) => console.log(error)}
              styles={{
                container: { width: "100%", height: "100%" },
              }}
            />
          )}
        </div>

        <p className="text-center font-semibold text-sm text-yellow-400 mt-2 px-2">
          {statusMessage}
        </p>

        {/* Info Siswa Ter-scan */}
        {scannedData && (
          <div className="w-full p-4 bg-slate-800 border border-yellow-400/40 rounded-xl text-center space-y-1.5">
            <p className="text-xs text-slate-400 font-medium">Data Siswa:</p>
            <p className="text-lg font-extrabold text-white leading-snug">{scannedData.nama}</p>

            <div className="flex justify-center items-center gap-3 text-xs font-semibold pt-1 border-t border-slate-700/60">
              <span className="text-slate-300">
                NISN: <span className="text-yellow-400 font-bold">{scannedData.nisn}</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">
                Kelas: <span className="text-yellow-400 font-bold">{scannedData.kelas}</span>
              </span>
            </div>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={() => {
              setScannedData(null);
              setStatusMessage("Arahkan QR Code ke kamera...");
              setIsScanning(true);
            }}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold py-2.5 rounded-lg transition mt-2 shadow-md"
          >
            Scan Selanjutnya
          </button>
        )}
      </div>
    </div>
  );
}