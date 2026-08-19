"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function Kelas4KuisPage() {
  const [subKelas, setSubKelas] = useState<string>("4A");
  const [kodePertemuan, setKodePertemuan] = useState<number>(1);
  const [selectedPart, setSelectedPart] = useState<number>(1);
  const [daftarSiswa, setDaftarSiswa] = useState<any[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState<string>("" );

  // Track daftar Part yang sudah diselesaikan oleh siswa yang dipilih
  const [completedParts, setCompletedParts] = useState<number[]>([]);

  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [soalList, setSoalList] = useState<any[]>([]);

  // State Navigasi & Jawaban
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userInputValue, setUserInputValue] = useState<string>("");
  const [inputError, setInputError] = useState<boolean>(false);

  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [finalDuration, setFinalDuration] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get data siswa saat subKelas berubah
  useEffect(() => {
    fetchSiswaByKelas(subKelas);
  }, [subKelas]);

  // Cek Part mana saja yang sudah pernah diselesaikan siswa ini
  useEffect(() => {
    if (selectedSiswa) {
      fetchCompletedParts();
    }
  }, [selectedSiswa, subKelas, kodePertemuan]);

  // Timer Stopwatch saat kuis berlangsung
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStarted && !isCompleted && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStarted, isCompleted, startTime]);

  // Auto-focus dan posisikan kursor di textarea saat soal aktif
  useEffect(() => {
    if (isStarted && !isCompleted && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [currentIndex, isStarted, isCompleted]);

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

  const fetchCompletedParts = async () => {
    const { data } = await supabase
      .from("kuis_jawaban")
      .select("part")
      .eq("nama_siswa", selectedSiswa)
      .eq("kelas", subKelas)
      .eq("kode_pertemuan", kodePertemuan);

    if (data) {
      const parts = data.map((item: any) => item.part || 1);
      setCompletedParts(parts);
    } else {
      setCompletedParts([]);
    }
  };

  const handleStartKuis = async () => {
    if (!selectedSiswa) return;

    // Logika Penguncian Part Berurutan
    if (selectedPart > 1) {
      const requiredPart = selectedPart - 1;
      const isPreviousCompleted = completedParts.includes(requiredPart);

      if (!isPreviousCompleted) {
        alert(
          `🔒 Ups! Kamu belum menyelesaikan Part ${requiredPart}.\n\nKamu harus mengerjakan Part ${requiredPart} terlebih dahulu sebelum membuka Part ${selectedPart}!`
        );
        return;
      }
    }

    // Fetch Soal berdasarkan Kelas, Pertemuan & Part
    const { data: soalData } = await supabase
      .from("kuis_soal")
      .select("*")
      .eq("kelas", "4")
      .eq("kode_pertemuan", kodePertemuan)
      .eq("part", selectedPart);

    if (!soalData || soalData.length === 0) {
      alert(
        `Belum ada soal untuk Kelas 4 (Pertemuan ${kodePertemuan} - Part ${selectedPart})!`
      );
      return;
    }

    setSoalList(soalData);
    setCurrentIndex(0);
    setUserInputValue(soalData[0].kalimat_acak);
    setInputError(false);

    setStartTime(Date.now());
    setElapsedTime(0);
    setIsStarted(true);
    setIsCompleted(false);
  };

  // Validasi per soal sebelum lanjut
  const handleNextSoal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentSoal = soalList[currentIndex];

    if (userInputValue.trim() !== currentSoal.kalimat_benar.trim()) {
      setInputError(true);
      return;
    }

    setInputError(false);

    if (currentIndex + 1 < soalList.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setUserInputValue(soalList[nextIndex].kalimat_acak);
    } else {
      handleFinishKuis();
    }
  };

  // Selesai kuis & simpan waktu tercepat per Part
  const handleFinishKuis = async () => {
    if (!startTime) return;

    const totalDetik = Math.floor((Date.now() - startTime) / 1000);
    setFinalDuration(totalDetik);
    setIsCompleted(true);

    // Cek apakah siswa sudah pernah mengerjakan Pertemuan & Part ini
    const { data: existingRecord } = await supabase
      .from("kuis_jawaban")
      .select("id, durasi_detik")
      .eq("nama_siswa", selectedSiswa)
      .eq("kelas", subKelas)
      .eq("kode_pertemuan", kodePertemuan)
      .eq("part", selectedPart)
      .maybeSingle();

    if (existingRecord) {
      // Update jika waktu baru lebih cepat
      if (totalDetik < existingRecord.durasi_detik) {
        await supabase
          .from("kuis_jawaban")
          .update({
            durasi_detik: totalDetik,
            waktu_selesai: new Date().toISOString(),
          })
          .eq("id", existingRecord.id);
      }
    } else {
      // Insert baru jika belum pernah ada
      await supabase.from("kuis_jawaban").insert([
        {
          nama_siswa: selectedSiswa,
          kelas: subKelas,
          tingkat_kelas: "4",
          kode_pertemuan: kodePertemuan,
          part: selectedPart,
          durasi_detik: totalDetik,
          waktu_selesai: new Date().toISOString(),
        },
      ]);
    }

    // Refresh status part terselesaikan agar part berikutnya terbuka
    fetchCompletedParts();
  };

  const handleUlangiTes = () => {
    handleStartKuis();
  };

  const handleGantiSiswa = () => {
    setIsStarted(false);
    setIsCompleted(false);
    fetchCompletedParts();
  };

  const formatWaktu = (detik: number) => {
    const m = Math.floor(detik / 60);
    const s = detik % 60;
    return `${m > 0 ? `${m}m ` : ""}${s} Detik`;
  };

  // Elemen dekoratif
  const BackgroundDecor = () => (
    <>
      <div className="pointer-events-none fixed -top-16 -left-16 w-72 h-72 rounded-full bg-fuchsia-300/40 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -right-10 w-80 h-80 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 right-0 w-64 h-64 rounded-full bg-amber-300/30 blur-3xl" />
      <span className="pointer-events-none fixed top-8 left-8 text-4xl opacity-70 animate-bounce-slow select-none">⭐</span>
      <span className="pointer-events-none fixed top-16 right-10 text-3xl opacity-70 animate-wiggle select-none">🎈</span>
      <span className="pointer-events-none fixed bottom-10 left-12 text-4xl opacity-70 animate-bounce-slow select-none">🚀</span>
      <span className="pointer-events-none fixed bottom-16 right-16 text-3xl opacity-70 animate-wiggle select-none">🎯</span>
    </>
  );

  const GlobalStyle = () => (
    <style jsx global>{`
      @import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@600;700;800;900&display=swap");
      .font-display { font-family: "Baloo 2", system-ui, sans-serif; }
      .font-body { font-family: "Nunito", system-ui, sans-serif; }
      @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
      .animate-bounce-slow { animation: bounce-slow 3.2s ease-in-out infinite; }
      @keyframes wiggle { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
      .animate-wiggle { animation: wiggle 2.4s ease-in-out infinite; }
      @keyframes pop-in { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .animate-pop-in { animation: pop-in 0.35s ease-out; }
      @keyframes confetti-fall { 0% { transform: translateY(-40px) rotate(0deg); opacity: 1; } 100% { transform: translateY(340px) rotate(360deg); opacity: 0; } }
      .animate-confetti { animation: confetti-fall linear infinite; }
      @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
      .animate-shake { animation: shake 0.35s ease-in-out; }
    `}</style>
  );

  // Tampilan Setelah Selesai
  if (isCompleted) {
    const confettiEmojis = ["🎉", "✨", "🎈", "⭐", "🎊", "🏆"];
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-200 via-sky-100 to-amber-100 flex items-center justify-center p-4 font-body">
        <GlobalStyle />
        {[...Array(14)].map((_, i) => (
          <span
            key={i}
            className="pointer-events-none fixed text-2xl animate-confetti select-none"
            style={{
              left: `${(i * 7) % 100}%`,
              top: "-5%",
              animationDuration: `${2.5 + (i % 5) * 0.5}s`,
              animationDelay: `${i * 0.15}s`,
            }}
          >
            {confettiEmojis[i % confettiEmojis.length]}
          </span>
        ))}
        <BackgroundDecor />

        <div className="relative w-full max-w-md bg-white/95 backdrop-blur border-4 border-white shadow-2xl p-6 rounded-[2rem] text-center space-y-5 animate-pop-in">
          <div className="space-y-1">
            <span className="text-6xl animate-bounce-slow inline-block">🏆</span>
            <h1 className="text-2xl font-display font-extrabold text-violet-700">
              Hebat Sekali, {selectedSiswa}!
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              Kamu berhasil menyelesaikan Part {selectedPart}!
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-100 border-2 border-amber-300 p-4 rounded-2xl space-y-1 shadow-inner">
            <span className="text-xs text-amber-600 font-extrabold uppercase tracking-wider block">
              ⏱️ Waktu Pengerjaan
            </span>
            <span className="text-3xl font-display font-black text-amber-700 block">
              {formatWaktu(finalDuration)}
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={handleUlangiTes}
              className="w-full bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-95 text-amber-950 font-display font-extrabold py-3.5 rounded-2xl transition shadow-[0_4px_0_0_#b45309] hover:shadow-[0_2px_0_0_#b45309] hover:translate-y-0.5 text-sm"
            >
              🔄 Coba Ulangi Part Ini
            </button>
            <button
              onClick={handleGantiSiswa}
              className="w-full bg-white hover:bg-slate-50 text-indigo-600 border-2 border-indigo-200 font-display font-extrabold py-3.5 rounded-2xl transition active:scale-95 text-sm"
            >
              🏠 Ganti Siswa / Part Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Utama (Pilih Siswa / Mengerjakan Soal)
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-200 via-sky-100 to-amber-100 flex items-center justify-center p-4 font-body">
      <GlobalStyle />
      <BackgroundDecor />

      <div className="relative w-full max-w-md bg-white/95 backdrop-blur border-4 border-white shadow-2xl p-6 rounded-[2rem] space-y-6 animate-pop-in">
        <div className="text-center space-y-1">
          <span className="text-5xl block">⌨️</span>
          <h1 className="text-2xl font-display font-extrabold text-fuchsia-600">
            Kuis Latihan Keyboard &amp; Simbol
          </h1>
          <p className="text-xs text-indigo-400 font-bold">
            Ayo perbaiki kalimatnya secepat mungkin!
          </p>
        </div>

        {!isStarted ? (
          /* Form Awal Pendaftaran */
          <div className="space-y-4">
            {/* Grid Pertemuan & Part */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-indigo-500 block mb-1 font-extrabold uppercase tracking-wide">
                  🗓️ Pertemuan
                </label>
                <select
                  value={kodePertemuan}
                  onChange={(e) => setKodePertemuan(Number(e.target.value))}
                  className="w-full bg-amber-50 border-2 border-amber-300 p-2.5 rounded-xl text-xs text-amber-700 font-display font-extrabold focus:outline-none focus:ring-4 focus:ring-amber-200 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      Pertemuan {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-indigo-500 block mb-1 font-extrabold uppercase tracking-wide">
                  🧩 Part Ke-
                </label>
                <select
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(Number(e.target.value))}
                  className="w-full bg-emerald-50 border-2 border-emerald-300 p-2.5 rounded-xl text-xs text-emerald-700 font-display font-extrabold focus:outline-none focus:ring-4 focus:ring-emerald-200 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((num) => {
                    const isDone = completedParts.includes(num);
                    const isLocked = num > 1 && !completedParts.includes(num - 1);
                    return (
                      <option key={num} value={num}>
                        Part {num} {isDone ? "✅" : isLocked ? "🔒" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-indigo-500 block mb-1.5 font-extrabold uppercase tracking-wide">
                🏫 Pilih Kelas
              </label>
              <select
                value={subKelas}
                onChange={(e) => setSubKelas(e.target.value)}
                className="w-full bg-sky-50 border-2 border-sky-300 p-3 rounded-xl text-sm text-sky-700 font-display font-extrabold focus:outline-none focus:ring-4 focus:ring-sky-200 cursor-pointer"
              >
                <option value="4A">Kelas 4A</option>
                <option value="4B">Kelas 4B</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-indigo-500 block mb-1.5 font-extrabold uppercase tracking-wide">
                🙋 Pilih Nama Kamu
              </label>
              <select
                value={selectedSiswa}
                onChange={(e) => setSelectedSiswa(e.target.value)}
                className="w-full bg-fuchsia-50 border-2 border-fuchsia-300 p-3 rounded-xl text-sm text-fuchsia-700 font-display font-extrabold focus:outline-none focus:ring-4 focus:ring-fuchsia-200 cursor-pointer"
              >
                {daftarSiswa.map((s) => (
                  <option key={s.id} value={s.nama}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStartKuis}
              disabled={!selectedSiswa}
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white font-display font-extrabold py-4 rounded-2xl transition shadow-[0_5px_0_0_#0f766e] hover:shadow-[0_3px_0_0_#0f766e] hover:translate-y-0.5 mt-2 text-lg"
            >
              🚀 Mulai Kuis!
            </button>
          </div>
        ) : (
          /* Form Pengerjaan Soal */
          <form onSubmit={handleNextSoal} className="space-y-5">
            {/* Header Status & Stopwatch */}
            <div className="flex justify-between items-center bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-3.5 rounded-2xl shadow-md text-xs">
              <span className="text-white font-display font-extrabold flex items-center gap-1">
                👤 {selectedSiswa}
              </span>
              <span className="text-yellow-200 font-mono font-extrabold text-sm bg-black/20 px-2.5 py-1 rounded-lg">
                ⏱️ {formatWaktu(elapsedTime)}
              </span>
            </div>

            {/* Progress Bar & Info */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-extrabold px-1">
                <span className="text-indigo-500">
                  Soal {currentIndex + 1} dari {soalList.length}
                </span>
                <span className="text-fuchsia-500">
                  P{kodePertemuan} • Part {selectedPart}
                </span>
              </div>
              <div className="flex gap-1.5">
                {soalList.map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-3 rounded-full transition-all ${
                      idx < currentIndex
                        ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                        : idx === currentIndex
                        ? "bg-gradient-to-r from-yellow-300 to-amber-400 animate-pulse"
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Tampilan Soal */}
            <div className="space-y-1.5">
              <label className="text-xs text-fuchsia-500 flex items-center gap-1.5 font-extrabold uppercase tracking-wide px-1">
                <span className="text-lg">📋</span> Soal
              </label>
              <div className="bg-gradient-to-br from-fuchsia-50 to-violet-50 border-2 border-fuchsia-200 rounded-xl p-3.5 select-none">
                <p className="text-lg leading-relaxed text-violet-700 font-mono font-bold tracking-wide break-words whitespace-pre-wrap">
                  {soalList[currentIndex]?.kalimat_acak}
                </p>
              </div>
            </div>

            {/* Area Pengerjaan */}
            <div className="space-y-3 bg-sky-50 border-2 border-dashed border-sky-300 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs text-sky-600 flex items-center gap-1.5 font-bold">
                  <span className="text-lg">👉</span> Perbaiki teks berikut:
                </label>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-200/70 border border-sky-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto">
                  🔒 Mouse Terkunci • Pakai Panah ⬅️➡️
                </span>
              </div>

              <textarea
                ref={textareaRef}
                value={userInputValue}
                onChange={(e) => {
                  setUserInputValue(e.target.value);
                  setInputError(false);
                }}
                onMouseDown={(e) => {
                  // Cegah klik mouse mengubah posisi kursor
                  e.preventDefault();
                  textareaRef.current?.focus();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  textareaRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  // Tekan Enter untuk submit langsung tanpa perlu klik tombol mouse
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleNextSoal();
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoFocus
                rows={3}
                wrap="soft"
                spellCheck={false}
                className={`w-full min-h-[6.5rem] bg-white border-[3px] resize-none cursor-default ${
                  inputError
                    ? "border-rose-400 ring-4 ring-rose-100 animate-shake"
                    : "border-indigo-200 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100"
                } p-3.5 rounded-xl text-lg leading-relaxed text-indigo-700 font-mono font-bold tracking-wide outline-none transition break-words whitespace-pre-wrap`}
              />

              {inputError && (
                <p className="text-rose-500 text-xs font-extrabold flex items-center gap-1">
                  😅 Belum tepat nih, coba periksa lagi ya!
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400 active:scale-95 text-white font-display font-extrabold py-4 rounded-2xl transition shadow-[0_5px_0_0_#6d28d9] hover:shadow-[0_3px_0_0_#6d28d9] hover:translate-y-0.5 text-base mt-4"
            >
              {currentIndex + 1 === soalList.length
                ? "🏁 Selesaikan Kuis!"
                : "✅ Lanjut Soal Berikutnya (Enter)"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}