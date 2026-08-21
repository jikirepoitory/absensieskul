"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Html5Qrcode } from "html5-qrcode";

interface ScannedStudent {
  id: string;
  nisn: string;
  nama: string;
  kelas: string;
  status: "success" | "warning" | "error";
  message: string;
  time: string;
}

export default function ScannerPage() {
  const [statusMessage, setStatusMessage] = useState<string>("Arahkan QR Code ke kamera...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedStudent | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [flashFeedback, setFlashFeedback] = useState<"success" | "warning" | "error" | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scanCount, setScanCount] = useState<number>(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Audio feedback synthesizer (Web Audio API)
  const playBeep = (type: "success" | "warning" | "error") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "warning") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Audio feedback error:", e);
    }
  };

  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;

    const timer = setTimeout(() => {
      try {
        html5QrcodeScanner = new Html5Qrcode("reader");
        scannerRef.current = html5QrcodeScanner;

        html5QrcodeScanner
          .start(
            { facingMode: facingMode },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              handleScan(decodedText);
            },
            () => {
              // Frame scan error biasa saat belum ada QR di depan kamera
            }
          )
          .catch((err) => {
            console.error("Camera Start Error:", err);
            setErrorMessage("Gagal membuka kamera. Pastikan izin kamera aktif & refresh halaman.");
          });
      } catch (err: any) {
        console.error("Init scanner error:", err);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((e) => console.error("Stop error", e));
      }
    };
  }, [facingMode]);

  const handleScan = async (scannedText: string) => {
    const now = Date.now();

    // Kunci proses agar tidak men-scan double saat request berlangsung
    if (isProcessingRef.current) return;

    // Abaikan jika QR code yang sama di-scan lagi dalam rentang waktu 3.5 detik
    if (
      lastScanRef.current &&
      lastScanRef.current.code === scannedText &&
      now - lastScanRef.current.timestamp < 3500
    ) {
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    lastScanRef.current = { code: scannedText, timestamp: now };

    try {
      // Cari data siswa di Supabase
      const { data: siswa, error: errorSiswa } = await supabase
        .from("siswa")
        .select("*")
        .or(`nisn.eq.${scannedText},id.eq.${scannedText},nama.eq.${scannedText}`)
        .maybeSingle();

      const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (errorSiswa || !siswa) {
        playBeep("error");
        setFlashFeedback("error");
        setStatusMessage("❌ Data siswa tidak ditemukan di database!");
        
        setTimeout(() => {
          setFlashFeedback(null);
          isProcessingRef.current = false;
          setIsProcessing(false);
          setStatusMessage("Arahkan QR Code ke kamera...");
        }, 2000);
        return;
      }

      // Cek apakah sudah absen hari ini
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

      if (existingAbsen) {
        playBeep("warning");
        setFlashFeedback("warning");
        setStatusMessage(`⚠️ Siswa ${siswa.nama} sudah HADIR hari ini!`);

        setScannedData({
          id: siswa.id,
          nisn: siswa.nisn || "-",
          nama: siswa.nama,
          kelas: siswa.kelas,
          status: "warning",
          message: "Sudah Hadir Hari Ini",
          time: timeStr,
        });

        setTimeout(() => {
          setFlashFeedback(null);
          isProcessingRef.current = false;
          setIsProcessing(false);
          setStatusMessage("Siap scan QR berikutnya...");
        }, 1800);
        return;
      }

      // Simpan kehadiran ke tabel absensi
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
        playBeep("error");
        setFlashFeedback("error");
        setStatusMessage("❌ Gagal mencatat absensi: " + errorAbsen.message);

        setTimeout(() => {
          setFlashFeedback(null);
          isProcessingRef.current = false;
          setIsProcessing(false);
          setStatusMessage("Arahkan QR Code ke kamera...");
        }, 2000);
      } else {
        playBeep("success");
        setFlashFeedback("success");
        setStatusMessage(`✅ ${siswa.nama} (${siswa.kelas}) Berhasil Absen!`);
        setScanCount((prev) => prev + 1);

        setScannedData({
          id: siswa.id,
          nisn: siswa.nisn || "-",
          nama: siswa.nama,
          kelas: siswa.kelas,
          status: "success",
          message: "Absensi Berhasil Dicatat",
          time: timeStr,
        });

        // Langsung siap scan siswa berikutnya secara otomatis
        setTimeout(() => {
          setFlashFeedback(null);
          isProcessingRef.current = false;
          setIsProcessing(false);
          setStatusMessage("Siap scan QR berikutnya...");
        }, 1800);
      }
    } catch (err: any) {
      playBeep("error");
      setFlashFeedback("error");
      setStatusMessage("❌ Terjadi kesalahan: " + (err.message || "Unknown error"));

      setTimeout(() => {
        setFlashFeedback(null);
        isProcessingRef.current = false;
        setIsProcessing(false);
        setStatusMessage("Arahkan QR Code ke kamera...");
      }, 2000);
    }
  };

  const handleToggleCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch((e) => console.error(e));
    }
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleManualReset = () => {
    setScannedData(null);
    setErrorMessage(null);
    setFlashFeedback(null);
    isProcessingRef.current = false;
    setIsProcessing(false);
    setStatusMessage("Arahkan QR Code ke kamera...");
  };

  const getStatusStyle = () => {
    if (statusMessage.includes("✅")) return "text-emerald-400";
    if (statusMessage.includes("⚠️")) return "text-amber-400";
    if (statusMessage.includes("❌")) return "text-rose-400";
    return "text-yellow-300";
  };

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

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col items-center mb-4">
        <div className="flex items-center gap-2 mb-1.5">
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
            Scanner Absensi Otomatis
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Auto-Scan Aktif
          </span>
          {scanCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold">
              {scanCount} Siswa Terabsen
            </span>
          )}
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="relative z-10 w-full max-w-sm bg-slate-900/70 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-2xl shadow-black/40 flex flex-col items-center gap-4">
        <div className="w-full relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 min-h-[280px] flex items-center justify-center">
          
          {/* Tombol Tukar Kamera Overlay */}
          {!errorMessage && (
            <button
              onClick={handleToggleCamera}
              className="absolute top-3 right-3 z-30 p-2 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 rounded-full text-yellow-400 shadow-lg backdrop-blur-md transition-all active:scale-90"
              title={`Tukar ke kamera ${facingMode === "environment" ? "depan" : "belakang"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16v-2a4 4 0 0 0-4-4H5" />
                <polyline points="8 6 5 10 8 14" />
                <path d="M3 8v2a4 4 0 0 0 4 4h12" />
                <polyline points="16 18 19 14 16 10" />
              </svg>
            </button>
          )}

          {/* Error Message */}
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
                onClick={handleManualReset}
                className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {/* Video Scanner Element (Selalu Aktif) */}
              <div id="reader" className="w-full h-full [&_video]:rounded-2xl"></div>

              {/* Target Scan Guides & Animasi Scanline */}
              {!flashFeedback && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative w-[230px] h-[230px]">
                    <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-yellow-400 rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-yellow-400 rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-yellow-400 rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-yellow-400 rounded-br-lg" />
                    <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-[scanline_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* Flash Feedback Overlay saat Berhasil/Peringatan */}
              {flashFeedback && (
                <div
                  className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 backdrop-blur-sm transition-all duration-300 animate-[fadeIn_0.2s_ease-out] ${
                    flashFeedback === "success"
                      ? "bg-emerald-950/80 border-2 border-emerald-500/50"
                      : flashFeedback === "warning"
                      ? "bg-amber-950/80 border-2 border-amber-500/50"
                      : "bg-rose-950/80 border-2 border-rose-500/50"
                  }`}
                >
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl animate-[popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] ${
                      flashFeedback === "success"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : flashFeedback === "warning"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    }`}
                  >
                    {flashFeedback === "success" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                    {flashFeedback === "warning" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                    {flashFeedback === "error" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wider text-white">
                    {flashFeedback === "success" && "Absensi Berhasil!"}
                    {flashFeedback === "warning" && "Sudah Hadir!"}
                    {flashFeedback === "error" && "Gagal Absen!"}
                  </p>

                  {/* Progress bar countdown sebelum siap scan lagi */}
                  <div className="w-28 h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-white animate-[countdown_1.8s_linear_forwards]" />
                  </div>
                </div>
              )}
            </>
          )}

          <style>{`
            @keyframes scanline {
              0% { transform: translateY(-110px); opacity: 0; }
              15% { opacity: 1; }
              85% { opacity: 1; }
              100% { transform: translateY(110px); opacity: 0; }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes popIn {
              0% { transform: scale(0.4); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes countdown {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>

        {/* Live Status Text */}
        <div className="w-full flex items-center justify-center gap-2 px-2 min-h-[24px]">
          {!isProcessing && !errorMessage && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
          )}
          <p className={`text-center font-bold text-xs sm:text-sm transition-colors duration-300 ${getStatusStyle()}`}>
            {statusMessage}
          </p>
        </div>

        {/* Info Siswa Terakhir Yang Di-scan */}
        {scannedData && (
          <div className="w-full p-3.5 bg-gradient-to-b from-slate-800/90 to-slate-800/50 border border-yellow-400/30 rounded-2xl text-center space-y-1.5 shadow-lg animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold border-b border-slate-700/60 pb-1.5">
              <span className="flex items-center gap-1 text-yellow-400">
                <span>👤</span> Siswa Terakhir
              </span>
              <span className="text-slate-400 font-normal">{scannedData.time}</span>
            </div>

            <p className="text-base font-extrabold text-white leading-tight">{scannedData.nama}</p>

            <div className="flex justify-center items-center gap-3 text-xs font-semibold pt-1">
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

        {/* Navigation & Helper Actions */}
        <div className="w-full flex items-center justify-between pt-1 text-xs text-slate-400">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Dashboard
          </Link>

          <span className="text-[11px] text-slate-500 font-medium">
            Dekatkan QR untuk lanjut scan
          </span>
        </div>
      </div>
    </div>
  );
}