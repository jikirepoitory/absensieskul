"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Html5Qrcode } from "html5-qrcode";

export default function ScannerPage() {
  const [statusMessage, setStatusMessage] = useState<string>("Arahkan QR Code ke kamera...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<{
    id: string;
    nisn: string;
    nama: string;
    kelas: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  
  // State baru untuk mengatur kamera (environment = belakang, user = depan)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;

    if (isScanning && !scannedData) {
      const timer = setTimeout(() => {
        html5QrcodeScanner = new Html5Qrcode("reader");
        scannerRef.current = html5QrcodeScanner;

        html5QrcodeScanner
          .start(
            { facingMode: facingMode }, // Menggunakan state facingMode
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => {
              // Ignore frame scanning errors (biasa terjadi saat tidak ada QR)
            }
          )
          .catch((err) => {
            console.error("Camera Start Error:", err);
            setErrorMessage("Gagal membuka kamera. Pastikan izin kamera aktif & refresh halaman.");
          });
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch((e) => console.error("Stop error", e));
        }
      };
    }
  }, [isScanning, scannedData, facingMode]); // Tambahkan facingMode ke dependency array

  const handleScanSuccess = async (scannedText: string) => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
    }

    setIsScanning(false);
    setStatusMessage("QR Terbaca! Memproses data...");

    try {
      let { data: siswa, error: errorSiswa } = await supabase
        .from("siswa")
        .select("*")
        .or(`nisn.eq.${scannedText},id.eq.${scannedText},nama.eq.${scannedText}`)
        .maybeSingle();

      if (errorSiswa || !siswa) {
        setStatusMessage("❌ Data siswa tidak ditemukan di database!");
        return;
      }

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

      setScannedData({
        id: siswa.id,
        nisn: siswa.nisn || "-",
        nama: siswa.nama,
        kelas: siswa.kelas,
      });

      if (existingAbsen) {
        setStatusMessage(`⚠️ Siswa ${siswa.nama} sudah terdata HADIR hari ini!`);
        return;
      }

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
    }
  };

  const handleResetScanner = () => {
    setScannedData(null);
    setErrorMessage(null);
    setStatusMessage("Arahkan QR Code ke kamera...");
    setIsScanning(true);
  };

  // Fungsi untuk menukar kamera
  const handleToggleCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch((e) => console.error(e));
    }
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const getResultVariant = (): "success" | "warning" | "error" => {
    if (statusMessage.includes("✅")) return "success";
    if (statusMessage.includes("⚠️")) return "warning";
    return "error";
  };

  const getStatusStyle = () => {
    if (statusMessage.includes("✅")) return "text-emerald-400";
    if (statusMessage.includes("⚠️")) return "text-amber-400";
    if (statusMessage.includes("❌")) return "text-rose-400";
    return "text-yellow-300";
  };

  const resultVariant = getResultVariant();
  const resultStyles = {
    success: {
      ring: "border-emerald-500/30",
      glow: "bg-emerald-500/10",
      icon: "text-emerald-400",
      bg: "from-emerald-500/10 to-transparent",
    },
    warning: {
      ring: "border-amber-500/30",
      glow: "bg-amber-500/10",
      icon: "text-amber-400",
      bg: "from-amber-500/10 to-transparent",
    },
    error: {
      ring: "border-rose-500/30",
      glow: "bg-rose-500/10",
      icon: "text-rose-400",
      bg: "from-rose-500/10 to-transparent",
    },
  }[resultVariant];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 w-72 h-72 bg-yellow-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-slate-950"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM20 14v3M17 20h3" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            Scanner Absensi Siswa
          </h1>
        </div>
        <p className="text-xs text-slate-500 font-medium tracking-wide">
          Pindai QR Code untuk mencatat kehadiran
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm bg-slate-900/70 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-2xl shadow-black/40 flex flex-col items-center gap-4">
        <div className="w-full relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 min-h-[280px] flex items-center justify-center">
          
          {/* Tombol Tukar Kamera Overlay */}
          {isScanning && !scannedData && !errorMessage && (
            <button
              onClick={handleToggleCamera}
              className="absolute top-3 right-3 z-50 p-2 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 rounded-full text-yellow-400 shadow-lg backdrop-blur-md transition-all active:scale-90"
              title="Tukar Kamera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16v-2a4 4 0 0 0-4-4H5" />
                <polyline points="8 6 5 10 8 14" />
                <path d="M3 8v2a4 4 0 0 0 4 4h12" />
                <polyline points="16 18 19 14 16 10" />
              </svg>
            </button>
          )}

          {errorMessage ? (
            <div className="p-6 text-center text-rose-400 text-xs font-semibold space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p>{errorMessage}</p>
              <button
                onClick={handleResetScanner}
                className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Coba Lagi
              </button>
            </div>
          ) : !isScanning ? (
            <div className={`w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b ${resultStyles.bg} animate-[fadeIn_0.4s_ease-out]`}>
              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: scale(0.9); }
                  to { opacity: 1; transform: scale(1); }
                }
                @keyframes popIn {
                  0% { transform: scale(0); opacity: 0; }
                  60% { transform: scale(1.15); opacity: 1; }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
              <div
                className={`w-20 h-20 rounded-full ${resultStyles.glow} border ${resultStyles.ring} flex items-center justify-center`}
                style={{ animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                {resultVariant === "success" && (
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-10 h-10 ${resultStyles.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {resultVariant === "warning" && (
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-10 h-10 ${resultStyles.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {resultVariant === "error" && (
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-10 h-10 ${resultStyles.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>
              <p className={`text-xs font-bold uppercase tracking-widest ${resultStyles.icon}`}>
                {resultVariant === "success" && "Absensi Tercatat"}
                {resultVariant === "warning" && "Sudah Hadir"}
                {resultVariant === "error" && "Gagal Diproses"}
              </p>
            </div>
          ) : (
            <>
              <div id="reader" className="w-full h-full [&_video]:rounded-2xl"></div>
              {isScanning && !scannedData && (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative w-[250px] h-[250px]">
                      <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-yellow-400 rounded-tl-lg" />
                      <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-yellow-400 rounded-tr-lg" />
                      <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-yellow-400 rounded-bl-lg" />
                      <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-yellow-400 rounded-br-lg" />
                      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-[scanline_2s_ease-in-out_infinite]" />
                    </div>
                  </div>
                  <style>{`
                    @keyframes scanline {
                      0% { transform: translateY(-120px); opacity: 0; }
                      15% { opacity: 1; }
                      85% { opacity: 1; }
                      100% { transform: translateY(120px); opacity: 0; }
                    }
                  `}</style>
                </>
              )}
            </>
          )}
        </div>

        <div className="w-full flex items-center justify-center gap-2 px-2">
          {isScanning && !scannedData && !errorMessage && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
            </span>
          )}
          <p className={`text-center font-semibold text-sm transition-colors duration-300 ${getStatusStyle()}`}>
            {statusMessage}
          </p>
        </div>

        {scannedData && (
          <div className="w-full p-4 bg-gradient-to-b from-slate-800/80 to-slate-800/40 border border-yellow-400/30 rounded-2xl text-center space-y-2 shadow-inner animate-[fadeIn_0.4s_ease-out]">
            <div className="w-10 h-10 mx-auto rounded-full bg-yellow-400/10 flex items-center justify-center mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Data Siswa</p>
            <p className="text-lg font-extrabold text-white leading-snug">{scannedData.nama}</p>

            <div className="flex justify-center items-center gap-3 text-xs font-semibold pt-2 border-t border-slate-700/60">
              <span className="text-slate-300">
                NISN: <span className="text-yellow-400 font-bold">{scannedData.nisn}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">
                Kelas: <span className="text-yellow-400 font-bold">{scannedData.kelas}</span>
              </span>
            </div>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={handleResetScanner}
            className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-bold py-3 rounded-xl transition-all mt-1 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Scan Selanjutnya
          </button>
        )}
      </div>
    </div>
  );
}