import { useState, useEffect, useCallback } from "react";

const PIANO_KEYS = [
  { note: "C4", label: "C4", solfege: "do", color: "white", freq: 261.63, kb: "A" },
  { note: "C#4", label: "C#4", color: "black", freq: 277.18, kb: "W" },
  { note: "D4", label: "D4", solfege: "re", color: "white", freq: 293.66, kb: "S" },
  { note: "D#4", label: "D#4", color: "black", freq: 311.13, kb: "E" },
  { note: "E4", label: "E4", solfege: "mi", color: "white", freq: 329.63, kb: "D" },
  { note: "F4", label: "F4", solfege: "fa", color: "white", freq: 349.23, kb: "F" },
  { note: "F#4", label: "F#4", color: "black", freq: 369.99, kb: "T" },
  { note: "G4", label: "G4", solfege: "sol", color: "white", freq: 392.0, kb: "G" },
  { note: "G#4", label: "G#4", color: "black", freq: 415.3, kb: "Y" },
  { note: "A4", label: "A4", solfege: "la", color: "white", freq: 440, kb: "H" },
  { note: "A#4", label: "A#4", color: "black", freq: 466.16, kb: "U" },
  { note: "B4", label: "B4", solfege: "ti", color: "white", freq: 493.88, kb: "J" },
  { note: "C5", label: "C5", solfege: "do", color: "white", freq: 523.25, kb: "K" },
];

export default function PianoQuiz() {
  const [targetKey, setTargetKey] = useState(PIANO_KEYS[4]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [activeNote, setActiveNote] = useState<string | null>(null);

  const playGrandPianoSound = (frequency: number) => {
    const audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 1.5,
    );

    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 1.5);
    osc2.stop(audioCtx.currentTime + 1.5);
  };

  const handleKeyClick = useCallback(
    (key: (typeof PIANO_KEYS)[0]) => {
      setActiveNote(key.note);
      playGrandPianoSound(key.freq);
      if (key.note === targetKey.note) {
        setFeedback("Correct! Galing! 🎵");
        setScore((prev) => prev + 1);

        setTimeout(() => {
          const whiteKeys = PIANO_KEYS.filter((k) => k.color === "white");
          const randomKey =
            whiteKeys[Math.floor(Math.random() * whiteKeys.length)];
          setTargetKey(randomKey);
          setFeedback(null);
        }, 1500);
      } else {
        const displayNote = key.label ? key.label : key.note;
        setFeedback(
          `Oops! Mali. Ang pinindot mo ay ${displayNote}. Try again!`,
        );
      }
    },
    [targetKey],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const pressedKey = e.key.toUpperCase();
      const matchedPianoKey = PIANO_KEYS.find((pk) => pk.kb === pressedKey);
      if (matchedPianoKey) handleKeyClick(matchedPianoKey);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyClick]);

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-white p-8 shadow-xl">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-ink">
          Solfeggio Exercise
        </h2>
        <p className="mt-2 text-mute">
          Makinig at hanapin ang tamang nota sa piano gamit ang iyong mouse o
          keyboard.
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm text-ink">
          <p className="font-semibold">Play with your computer keyboard</p>
          <p className="mt-1">Click anywhere outside a text field, then press a key below to play its matching piano note. You can also click a piano key.</p>
          <p className="mt-2"><span className="font-semibold">White keys:</span> A = C4 (Do), S = D4 (Re), D = E4 (Mi), F = F4 (Fa), G = G4 (Sol), H = A4 (La), J = B4 (Ti), K = C5 (Do).</p>
          <p className="mt-1"><span className="font-semibold">Black keys:</span> W = C♯4, E = D♯4, T = F♯4, Y = G♯4, U = A♯4.</p>
          <p className="mt-1 text-mute">The piano keys display note names; use the mappings above to find their computer keys.</p>
        </div>
        <div className="my-6 rounded-2xl bg-p1-soft p-6">
          <p className="text-lg font-semibold">Hanapin ang note na ito (C4–C5):</p>
          <span className="mt-2 inline-block rounded-full bg-[var(--p1)] px-8 py-2 text-3xl font-bold text-white shadow-lg uppercase tracking-widest">
            {targetKey.label}
          </span>
        </div>

        <div className="relative isolate z-0 mx-auto mt-6 mb-4 flex w-fit select-none justify-center">
          {PIANO_KEYS.map((key) => {
            const isBlack = key.color === "black";
            return (
              <button
                key={key.note}
                onClick={() => handleKeyClick(key)}
                className={`relative transition-all active:translate-y-1 ${isBlack
                  ? `piano-black-key ${activeNote === key.note ? "is-active ring-2 ring-p1/50" : "bg-gray-900 hover:bg-gray-800"} h-32 w-10 -mx-5 z-10 rounded-b-md text-white shadow-md`
                  : `piano-white-key ${activeNote === key.note ? "is-active ring-2 ring-p1" : "bg-white hover:bg-slate-50"} h-48 w-14 z-0 rounded-b-lg border-2 border-slate-300 text-slate-700 shadow-sm`}`}
              >
                {!isBlack && (
                  <span className={`piano-solfege-label absolute bottom-8 left-1/2 -translate-x-1/2 font-semibold text-xs ${activeNote === key.note ? "text-white" : "text-p2"}`}>
                    {key.solfege}
                  </span>
                )}
                <span
                    className={`absolute bottom-2 left-1/2 -translate-x-1/2 font-bold text-xs ${activeNote === key.note ? "text-white" : isBlack ? "text-gray-400" : "text-slate-400"}`}
                >
                  {key.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[40px]">
          {feedback && (
            <p
              className={`text-lg font-bold ${feedback.includes("Correct") ? "text-green-600" : "text-red-500"}`}
            >
              {feedback}
            </p>
          )}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xl font-bold">
            Score: <span className="text-[var(--p1)]">{score}</span>
          </p>
          <button
            type="button"
            onClick={() => setScore(0)}
            className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-semibold text-mute transition hover:bg-p1-soft hover:text-p1"
          >
            Reset score
          </button>
        </div>
      </div>
    </div>
  );
}
