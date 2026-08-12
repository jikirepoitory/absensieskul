"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function KuisKelas56Page() {
  const [subKelas, setSubKelas] = useState<string>("5A");
  const [tingkatKelas, setTingkatKelas] = useState<string>("5");
  const [kodePertemuan, setKodePertemuan] = useState<number>(1);
  const [selectedPart, setSelectedPart] = useState<number>(1);
  const [durasiPilihan, setDurasiPilihan] = useState<number>(60); // Detik (default 1 menit)

  const [daftarSiswa, setDaftarSiswa] = useState<any[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<string>("");

  // Target Teks
  const [targetText, setTargetText] = useState<string>("");
  const [inputUser, setInputUser] = useState<string>("");

  // Ref untuk menghindari Stale Closure pada setInterval timer
  const inputUserRef = useRef<string>("");
  const targetTextRef = useRef<string>("");
  const keystrokeKasarRef = useRef<number>(0);
  const koreksiCountRef = useRef<number>(0);

  // Game / Typing State
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);

  // Counter Metrik Keystroke
  const [keystrokeKasar, setKeystrokeKasar] = useState<number>(0);
  const [koreksiCount, setKoreksiCount] = useState<number>(0);

  // Hasil Akhir
  const [stats, setStats] = useState({
    wpm: 0,
    akurasi: 100,
    keystrokeBersih: 0,
    keystrokeKasar: 0,
    kesalahan: 0,
    akurasiAktual: 100,
    koreksi: 0,
    totalKeystroke: 0,
    kataDiketik: 0,
    totalKataTarget: 0,
    karakterDiketik: 0,
    totalKarakterTarget: 0,
    totalWaktuFormatted: "00:00:000",
    totalWaktuMs: 0,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Siswa saat kelas berubah
  useEffect(() => {
    fetchSiswaByKelas(subKelas);
  }, [subKelas]);

  // Update tingkat kelas (5 atau 6) dari subKelas (5A -> 5)
  useEffect(() => {
    const tingkat = subKelas.charAt(0);
    setTingkatKelas(tingkat);
  }, [subKelas]);

  // Update Refs agar selalu sinkron
  useEffect(() => {
    inputUserRef.current = inputUser;
  }, [inputUser]);

  useEffect(() => {
    targetTextRef.current = targetText;
  }, [targetText]);

  useEffect(() => {
    keystrokeKasarRef.current = keystrokeKasar;
  }, [keystrokeKasar]);

  useEffect(() => {
    koreksiCountRef.current = koreksiCount;
  }, [koreksiCount]);

  // Timer Countdown & Auto Finish
  useEffect(() => {
    let timer: any;
    if (isStarted && !isCompleted && startTime) {
      timer = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const remaining = durasiPilihan - elapsedSec;

        if (remaining <= 0) {
          setTimeRemaining(0);
          handleFinishTest(inputUserRef.current);
        } else {
          setTimeRemaining(remaining);
        }
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isStarted, isCompleted, startTime, durasiPilihan]);

  const fetchSiswaByKelas = async (kelasParam: string) => {
    const { data } = await supabase
      .from("siswa")
      .select("id, nama")
      .eq("kelas", kelasParam);

    if (data) {
      setDaftarSiswa(data);
      if (data.length > 0) setSelectedSiswa(data[0].nama);
    }
  };

  // Muat Teks Soal dari DB
  const handleLoadSoal = async () => {
    if (!selectedSiswa) {
      alert("Pilih siswa terlebih dahulu!");
      return;
    }

    const { data } = await supabase
      .from("kuis_soal")
      .select("teks_panjang, kalimat_benar, kalimat_acak")
      .eq("kelas", tingkatKelas)
      .eq("kode_pertemuan", kodePertemuan)
      .eq("part", selectedPart)
      .maybeSingle();

    const textToUse =
      data?.teks_panjang ||
      data?.kalimat_benar ||
      data?.kalimat_acak ||
      "Belum ada teks soal yang dimasukkan oleh guru untuk kelas dan pertemuan ini.";

    const formattedText = textToUse.trim();
    setTargetText(formattedText);
    targetTextRef.current = formattedText;

    setInputUser("");
    inputUserRef.current = "";

    setIsStarted(false);
    setIsCompleted(false);

    setKeystrokeKasar(0);
    keystrokeKasarRef.current = 0;

    setKoreksiCount(0);
    koreksiCountRef.current = 0;

    setTimeRemaining(durasiPilihan);

    // Auto Focus ke Textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Trigger saat siswa mengetik di textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;

    // Sesi Mulai Otomatis pada Ketikan Pertama
    if (!isStarted && val.length > 0) {
      setIsStarted(true);
      setStartTime(Date.now());
    }

    setInputUser(val);
    inputUserRef.current = val;

    // Jika siswa selesai mengetik seluruh paragraf
    if (val.length >= targetText.length && targetText.length > 0) {
      handleFinishTest(val);
    }
  };

  // Perekaman Tombol (Keystroke & Koreksi Backspace)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCompleted) return;

    if (e.key === "Backspace") {
      setKoreksiCount((prev) => prev + 1);
      koreksiCountRef.current += 1;
    } else if (e.key.length === 1) {
      setKeystrokeKasar((prev) => prev + 1);
      keystrokeKasarRef.current += 1;
    }
  };

  // Selesai Tes & Hitung Metrik
  const handleFinishTest = async (currentInput?: string) => {
    if (isCompleted) return;
    setIsCompleted(true);

    const endTime = Date.now();
    const durationMs = startTime ? endTime - startTime : 1000;
    const durationSec = Math.max(durationMs / 1000, 1);
    const durationMin = durationSec / 60;

    const finalTyped = currentInput !== undefined ? currentInput : inputUserRef.current;
    const target = targetTextRef.current;

    // Hitung Kesalahan & Karakter Bersih
    let countKesalahan = 0;
    let countBersih = 0;

    for (let i = 0; i < finalTyped.length; i++) {
      if (i < target.length && finalTyped[i] === target[i]) {
        countBersih++;
      } else {
        countKesalahan++;
      }
    }

    const currentKasar = keystrokeKasarRef.current;
    const currentKoreksi = koreksiCountRef.current;
    const totalKeystrokeVal = currentKasar + currentKoreksi;

    // WPM = (Keystroke Bersih / 5) / Waktu Menit
    const calculatedWpm = Math.round(countBersih / 5 / durationMin) || 0;

    // Akurasi
    const akurasiVal =
      finalTyped.length > 0
        ? Math.round((countBersih / finalTyped.length) * 100)
        : 100;

    const akurasiAktualVal =
      totalKeystrokeVal > 0
        ? Math.round((countBersih / totalKeystrokeVal) * 100)
        : 100;

    // Kata & Karakter
    const kataTargetArr = target.trim().split(/\s+/).filter(Boolean);
    const kataTypedArr = finalTyped.trim().split(/\s+/).filter(Boolean);

    let kataBenarCount = 0;
    kataTypedArr.forEach((word, idx) => {
      if (idx < kataTargetArr.length && word === kataTargetArr[idx]) {
        kataBenarCount++;
      }
    });

    // Formatting Waktu (mm:ss:ms)
    const mins = Math.floor(durationSec / 60);
    const secs = Math.floor(durationSec % 60);
    const ms = Math.floor(durationMs % 1000);

    const formattedMins = String(mins).padStart(2, "0");
    const formattedSecs = String(secs).padStart(2, "0");
    const formattedMs = String(ms).padStart(3, "0");
    const formattedTimeStr = `${formattedMins}:${formattedSecs}:${formattedMs}`;

    const calculatedStats = {
      wpm: calculatedWpm,
      akurasi: akurasiVal,
      keystrokeBersih: countBersih,
      keystrokeKasar: currentKasar,
      kesalahan: countKesalahan,
      akurasiAktual: akurasiAktualVal,
      koreksi: currentKoreksi,
      totalKeystroke: totalKeystrokeVal,
      kataDiketik: kataBenarCount,
      totalKataTarget: kataTargetArr.length,
      karakterDiketik: countBersih,
      totalKarakterTarget: target.length,
      totalWaktuFormatted: formattedTimeStr,
      totalWaktuMs: durationMs,
    };

    setStats(calculatedStats);

    // =========================================================================
    // SIMPAN KE SUPABASE: Hanya Simpan/Update Jika Mencapai Rekor Tercepat (WPM Lebih Tinggi)
    // =========================================================================
    try {
      // 1. Cek apakah siswa ini sudah pernah punya record pengerjaan untuk pertemuan & part ini
      const { data: existingData, error: fetchError } = await supabase
        .from("kuis_jawaban")
        .select("id, wpm")
        .eq("nama_siswa", selectedSiswa)
        .eq("kode_pertemuan", kodePertemuan)
        .eq("part", selectedPart)
        .maybeSingle();

      if (fetchError) {
        console.error("Gagal memeriksa rekor terdahulu:", fetchError.message);
      }

      const payload = {
        nama_siswa: selectedSiswa,
        tingkat_kelas: tingkatKelas,
        kelas: tingkatKelas,
        sub_kelas: subKelas,
        kode_pertemuan: kodePertemuan,
        part: selectedPart,
        durasi_detik: Math.round(durationSec),
        wpm: calculatedWpm,
        akurasi: akurasiVal,
        keystroke_bersih: countBersih,
        keystroke_kasar: currentKasar,
        kesalahan: countKesalahan,
        akurasi_aktual: akurasiAktualVal,
        koreksi: currentKoreksi,
        total_keystroke: totalKeystrokeVal,
        total_kata: kataBenarCount,
        total_karakter: countBersih,
        total_waktu_ms: durationMs,
        waktu_selesai: new Date().toISOString(),
      };

      if (!existingData) {
        // BELUM ADA DATA: Langsung Insert Baru
        const { error: insertError } = await supabase
          .from("kuis_jawaban")
          .insert([payload]);

        if (insertError) {
          console.error("Gagal insert data baru:", insertError.message);
        }
      } else {
        // SUDAH ADA DATA: Cek apakah WPM baru LEBIH TINGGI dari rekor lama
        if (calculatedWpm > (existingData.wpm || 0)) {
          // UPDATE data lama dengan rekor baru agar tidak menumpuk
          const { error: updateError } = await supabase
            .from("kuis_jawaban")
            .update(payload)
            .eq("id", existingData.id);

          if (updateError) {
            console.error("Gagal memperbarui rekor baru:", updateError.message);
          }
        } else {
          console.log(
            `Hasil tes (${calculatedWpm} WPM) tidak melewati rekor sebelumnya (${existingData.wpm} WPM). Data tidak diubah.`
          );
        }
      }
    } catch (err) {
      console.error("Terjadi kesalahan saat memproses data kuis:", err);
    }
  };

  const formatSecToMin = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Nilai bantu tampilan
  const progressPercent =
    targetText.length > 0
      ? Math.min(100, Math.round((inputUser.length / targetText.length) * 100))
      : 0;
  const waktuPersen = Math.max(
    0,
    Math.min(100, Math.round((timeRemaining / durasiPilihan) * 100))
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_#241b52_0%,_#140f30_45%,_#0a0720_100%)] text-slate-100 p-4 md:p-8 flex flex-col items-center justify-center">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@600;700;800&display=swap");
        .font-fun {
          font-family: "Baloo 2", "Nunito", ui-sans-serif, sans-serif;
        }
        .font-body {
          font-family: "Nunito", ui-sans-serif, sans-serif;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes floaty {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.75) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rocketWiggle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(3deg); }
        }
        .animate-pop-in { animation: popIn 0.35s ease-out; }
        .animate-floaty { animation: floaty 3.5s ease-in-out infinite; }
        .animate-rocket { animation: rocketWiggle 1s ease-in-out infinite; }
        .star {
          position: absolute;
          border-radius: 9999px;
          background: white;
          animation: twinkle 2.6s ease-in-out infinite;
        }
      `}</style>

      {/* Bintang-bintang latar */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 40 }).map((_, i) => {
          const size = (i % 3) + 1;
          const top = (i * 37) % 100;
          const left = (i * 53) % 100;
          const delay = (i % 10) * 0.3;
          return (
            <span
              key={i}
              className="star"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top: `${top}%`,
                left: `${left}%`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>

      {/* Container Utama */}
      <div className="w-full max-w-4xl bg-slate-900/70 border-2 border-indigo-400/30 backdrop-blur rounded-[2rem] p-6 shadow-[0_0_60px_-15px_rgba(99,102,241,0.6)] space-y-6 relative z-10 font-body">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-dashed border-indigo-400/30 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl animate-floaty">🚀</span>
            <div>
              <h1 className="font-fun text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-fuchsia-300 to-amber-300">
                Misi Ketik Cepat!
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200/80 font-semibold">
                Ayo ketik secepat dan setepat mungkin, Anak Kelas 5 &amp; 6! ⭐
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 border-2 border-amber-400/40 px-3 py-2 rounded-2xl shadow-inner">
            <span className="text-lg">⏳</span>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wide">
                Waktu Sisa
              </span>
              <span className="font-fun font-extrabold text-lg text-amber-300">
                {formatSecToMin(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Bar waktu */}
        {(isStarted || targetText) && (
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all duration-300 rounded-full"
              style={{ width: `${waktuPersen}%` }}
            />
          </div>
        )}

        {/* Form Pilih Identitas Siswa */}
        {!isStarted && inputUser.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/50 p-4 rounded-2xl border-2 border-indigo-400/20">
            <div>
              <label className="text-xs text-sky-300 block mb-1 font-fun font-bold">
                🏫 Kelas
              </label>
              <select
                value={subKelas}
                onChange={(e) => setSubKelas(e.target.value)}
                className="w-full bg-slate-800 border-2 border-sky-400/40 focus:border-sky-400 p-2.5 rounded-xl text-xs font-bold text-sky-300 outline-none transition"
              >
                <option value="5A">Kelas 5A</option>
                <option value="5B">Kelas 5B</option>
                <option value="6A">Kelas 6A</option>
                <option value="6B">Kelas 6B</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-fuchsia-300 block mb-1 font-fun font-bold">
                🧑‍🎓 Siswa
              </label>
              <select
                value={selectedSiswa}
                onChange={(e) => setSelectedSiswa(e.target.value)}
                className="w-full bg-slate-800 border-2 border-fuchsia-400/40 focus:border-fuchsia-400 p-2.5 rounded-xl text-xs font-bold text-fuchsia-300 outline-none transition"
              >
                {daftarSiswa.length === 0 ? (
                  <option value="">Belum Ada Siswa</option>
                ) : (
                  daftarSiswa.map((s) => (
                    <option key={s.id} value={s.nama}>
                      {s.nama}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-xs text-amber-300 block mb-1 font-fun font-bold">
                📖 Pertemuan &amp; Part
              </label>
              <div className="flex gap-1">
                <select
                  value={kodePertemuan}
                  onChange={(e) => setKodePertemuan(Number(e.target.value))}
                  className="w-1/2 bg-slate-800 border-2 border-amber-400/40 focus:border-amber-400 p-2.5 rounded-xl text-xs font-bold text-amber-300 outline-none transition"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                    <option key={p} value={p}>
                      P{p}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(Number(e.target.value))}
                  className="w-1/2 bg-slate-800 border-2 border-emerald-400/40 focus:border-emerald-400 p-2.5 rounded-xl text-xs font-bold text-emerald-300 outline-none transition"
                >
                  {[1, 2, 3, 4, 5].map((pt) => (
                    <option key={pt} value={pt}>
                      Part {pt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-indigo-300 block mb-1 font-fun font-bold">
                ⏱️ Batas Waktu
              </label>
              <select
                value={durasiPilihan}
                onChange={(e) => setDurasiPilihan(Number(e.target.value))}
                className="w-full bg-slate-800 border-2 border-indigo-400/40 focus:border-indigo-400 p-2.5 rounded-xl text-xs font-bold text-indigo-300 outline-none transition"
              >
                <option value={60}>1 Menit</option>
                <option value={120}>2 Menit</option>
                <option value={180}>3 Menit</option>
                <option value={300}>5 Menit (Max)</option>
              </select>
            </div>

            <div className="sm:col-span-4 mt-2">
              <button
                onClick={handleLoadSoal}
                className="w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 hover:brightness-110 active:scale-[0.99] text-slate-950 font-fun font-extrabold py-3 rounded-2xl transition text-sm uppercase tracking-wide shadow-[0_6px_0_0_rgba(79,70,229,0.6)] hover:shadow-[0_4px_0_0_rgba(79,70,229,0.6)] hover:translate-y-[2px]"
              >
                🚀 Muat Soal &amp; Siap Ketik!
              </button>
            </div>
          </div>
        )}

        {/* Tampilan Paragraf Target Soal */}
        {targetText && (
          <div className="space-y-4">
            <div className="relative">
              <div className="w-full h-3 bg-slate-800 rounded-full border border-slate-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span
                className="absolute -top-4 text-lg transition-all duration-200 animate-rocket"
                style={{ left: `calc(${progressPercent}% - 10px)` }}
              >
                🚀
              </span>
            </div>

            <div className="bg-slate-950/70 border-2 border-indigo-400/20 p-4 rounded-2xl max-h-48 overflow-y-auto leading-relaxed text-base font-mono select-none shadow-inner">
              {targetText.split("").map((char, index) => {
                let colorClass = "text-slate-400";
                if (index < inputUser.length) {
                  colorClass =
                    inputUser[index] === char
                      ? "bg-emerald-500/25 text-emerald-300 font-bold rounded"
                      : "bg-rose-500/35 text-rose-300 font-bold underline rounded";
                }
                return (
                  <span key={index} className={colorClass}>
                    {char}
                  </span>
                );
              })}
            </div>

            {/* Input Form Ketikan Siswa */}
            <div>
              <label className="text-xs text-indigo-200 block mb-1.5 font-fun font-bold">
                👉 Ketik di sini ya! Waktu jalan otomatis begitu kamu mulai mengetik 😊
              </label>
              <textarea
                ref={textareaRef}
                value={inputUser}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={isCompleted || !targetText}
                placeholder="Klik di sini dan mulai mengetik paragraf di atas..."
                rows={5}
                spellCheck={false}
                className="w-full bg-slate-950 border-2 border-indigo-400/40 focus:border-sky-400 p-4 rounded-2xl font-mono text-sm leading-relaxed text-slate-100 outline-none transition resize-none disabled:opacity-50 shadow-inner"
              />
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL HASIL */}
      {isCompleted && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-pop-in">
          <div className="w-full max-w-sm bg-gradient-to-b from-sky-100 via-indigo-50 to-fuchsia-100 border-4 border-white rounded-[2rem] p-6 shadow-2xl text-slate-800 space-y-4">
            <div className="text-center border-b-2 border-dashed border-sky-200 pb-2">
              <span className="text-4xl">🎉</span>
              <h2 className="font-fun text-xl font-extrabold text-indigo-700 uppercase tracking-wide">
                Misi Selesai!
              </h2>
            </div>

            <div className="text-center py-1">
              <span className="font-fun text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-sky-500 block">
                {stats.wpm} WPM
              </span>
              <span className="text-xs font-bold text-slate-500">Kata Per Menit</span>
            </div>

            <div className="space-y-1.5 text-sm font-bold text-slate-600 px-2 bg-white/60 rounded-2xl p-3 border-2 border-sky-100">
              <div className="flex justify-between items-center">
                <span>🎯 Akurasi</span>
                <span className="text-sky-600 font-extrabold">{stats.akurasi}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>✅ Keystroke Bersih</span>
                <span className="text-emerald-600 font-extrabold">
                  {stats.keystrokeBersih}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>⌨️ Keystroke Kasar</span>
                <span className="text-sky-600 font-extrabold">
                  {stats.keystrokeKasar}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>❌ Kesalahan</span>
                <span className="text-rose-500 font-extrabold">
                  {stats.kesalahan}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>📊 Akurasi Aktual</span>
                <span className="text-emerald-600 font-extrabold">
                  {stats.akurasiAktual}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>↩️ Koreksi</span>
                <span className="text-emerald-600 font-extrabold">
                  {stats.koreksi}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>🔢 Total Keystroke</span>
                <span className="text-emerald-600 font-extrabold">
                  {stats.totalKeystroke}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>📝 Kata</span>
                <span className="text-sky-600 font-extrabold">
                  {stats.kataDiketik}/{stats.totalKataTarget}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>🔤 Karakter</span>
                <span className="text-sky-600 font-extrabold">
                  {stats.karakterDiketik}/{stats.totalKarakterTarget}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t-2 border-dashed border-sky-200">
                <span>⏱️ Total Waktu</span>
                <span className="text-indigo-600 font-extrabold font-mono">
                  {stats.totalWaktuFormatted}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  setInputUser("");
                  inputUserRef.current = "";
                  setIsStarted(false);
                  setIsCompleted(false);
                }}
                className="bg-gradient-to-b from-blue-500 to-blue-600 hover:brightness-110 active:scale-[0.98] text-white font-fun font-extrabold py-2.5 rounded-2xl shadow-[0_4px_0_0_rgba(30,64,175,0.6)] hover:shadow-[0_2px_0_0_rgba(30,64,175,0.6)] hover:translate-y-[2px] border-2 border-blue-300 text-xs transition"
              >
                🔄 Tes Baru
              </button>
              <button
                onClick={() => {
                  handleLoadSoal();
                }}
                className="bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-fun font-extrabold py-2.5 rounded-2xl shadow-[0_4px_0_0_rgba(203,213,225,0.9)] hover:shadow-[0_2px_0_0_rgba(203,213,225,0.9)] hover:translate-y-[2px] border-2 border-slate-300 text-xs transition"
              >
                🔁 Ulangi Tes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}