"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function ScannerPage() {
  const [statusMessage, setStatusMessage] = useState<string>("Arahkan QR Code ke kamera...");
  const [scannedData, setScannedData] = useState<{
    nama: string;
    kelas: string;
    id: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  const handleScan = async (result: any) => {
    if (!result || !result[0]?.rawValue || !isScanning) return;

    const scannedText = result[0].rawValue.trim();
    setIsScanning(false); // Hentikan scan agar tidak request berulang kali
    setLoading(true);
    setStatusMessage(`QR Terbaca! Memproses data...`);

    try {
      // 1. Cari data siswa berdasarkan ID dari QR Code
      const { data: siswa, error: errorSiswa } = await supabase
        .from("siswa")
        .select("*")
        .eq("id", scannedText)
        .single();

      if (errorSiswa || !siswa) {
        setStatusMessage("❌ ID Siswa tidak ditemukan di database!");
        setLoading(false);
        return;
      }

      // 2. Simpan ke tabel absensi
      const { error: errorAbsen } = await supabase.from("absensi").insert([
        {
          nis: siswa.id,
          nama_siswa: siswa.nama,
          kelas: siswa.kelas,
          status: "Hadir",
        },
      ]);

      if (errorAbsen) {
        setStatusMessage("❌ Gagal mencatat absensi: " + errorAbsen.message);
      } else {
        setScannedData({
          nama: siswa.nama,
          kelas: siswa.kelas,
          id: siswa.id,
        });
        setStatusMessage("✅ ABSENSI BERHASIL DICATAT!");
      }
    } catch (err: any) {
      setStatusMessage("❌ Terjadi kesalahan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
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
                container: { width: "100%", height: "100%" }
              }}
            />
          )}
        </div>

        <p className="text-center font-semibold text-sm text-yellow-400 mt-2 px-2">
          {statusMessage}
        </p>

        {scannedData && (
          <div className="w-full p-4 bg-slate-800 border border-yellow-400/40 rounded-xl text-center space-y-1">
            <p className="text-xs text-slate-400">Siswa Hadir:</p>
            <p className="text-lg font-bold text-white">{scannedData.nama}</p>
            <p className="text-sm font-medium text-yellow-400">
              Kelas: {scannedData.kelas}
            </p>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={() => {
              setScannedData(null);
              setStatusMessage("Arahkan QR Code ke kamera...");
              setIsScanning(true);
            }}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold py-2.5 rounded-lg transition mt-2"
          >
            Scan Selanjutnya
          </button>
        )}
      </div>
    </div>
  );
}