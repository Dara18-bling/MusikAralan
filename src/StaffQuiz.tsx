import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

const staffNotes = [
  { note: "C4", name: "C", solfege: "Do", frequency: 261.63, y: 180, ledger: true },
  { note: "D4", name: "D", solfege: "Re", frequency: 293.66, y: 170, ledger: false },
  { note: "E4", name: "E", solfege: "Mi", frequency: 329.63, y: 160, ledger: false },
  { note: "F4", name: "F", solfege: "Fa", frequency: 349.23, y: 150, ledger: false },
  { note: "G4", name: "G", solfege: "Sol", frequency: 392, y: 140, ledger: false },
  { note: "A4", name: "A", solfege: "La", frequency: 440, y: 130, ledger: false },
  { note: "B4", name: "B", solfege: "Ti", frequency: 493.88, y: 120, ledger: false },
  { note: "C5", name: "C", solfege: "Do", frequency: 523.25, y: 110, ledger: false },
];

const pianoKeyMap = ["A", "S", "D", "F", "G", "H", "J", "K"];
const randomNoteIndex = () => Math.floor(Math.random() * staffNotes.length);

export default function StaffQuiz() {
  const [targetIndex, setTargetIndex] = useState(randomNoteIndex);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const target = staffNotes[targetIndex];

  const playNote = useCallback((frequency: number) => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const harmonic = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    harmonic.type = "sine";
    oscillator.frequency.value = frequency;
    harmonic.frequency.value = frequency * 2;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    oscillator.connect(gain);
    harmonic.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    harmonic.start(now);
    oscillator.stop(now + 0.92);
    harmonic.stop(now + 0.92);
  }, []);

  const chooseKey = useCallback((index: number) => {
    const key = staffNotes[index];
    setActiveNote(key.note);
    playNote(key.frequency);
    if (key.note === target.note) {
      setFeedback("correct");
      setScore((current) => current + 1);
    } else {
      setFeedback("wrong");
    }
  }, [playNote, target.note]);

  const nextNote = useCallback(() => {
    setTargetIndex((current) => {
      if (staffNotes.length < 2) return current;
      let next = randomNoteIndex();
      while (next === current) next = randomNoteIndex();
      return next;
    });
    setActiveNote(null);
    setFeedback(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
      const keyIndex = pianoKeyMap.indexOf(event.key.toUpperCase());
      if (keyIndex >= 0 && feedback !== "correct") chooseKey(keyIndex);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseKey, feedback]);

  useEffect(() => () => { void audioRef.current?.close(); }, []);

  const stemUp = target.y >= 130;

  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-line bg-white p-6 shadow-xl sm:p-8" aria-label="Staff Quiz">
      <header className="text-center">
        <h2 className="font-display text-2xl font-bold text-ink">Staff Quiz</h2>
        <p className="mt-2 text-mute">Read the note on the treble staff, then play it on the piano.</p>
      </header>

      <div className="my-6 rounded-2xl bg-p1-soft p-4 sm:p-6">
        <svg viewBox="0 0 480 230" className="mx-auto w-full max-w-xl text-ink" role="img" aria-label="One note on a treble clef staff">
          {[80, 100, 120, 140, 160].map((y) => <line key={y} x1="48" x2="432" y1={y} y2={y} stroke="currentColor" strokeWidth="2" opacity="0.72" />)}
          <text x="60" y="153" fontSize="84" fontFamily="serif" fill="var(--p1)">𝄞</text>
          {target.ledger && <line x1="242" x2="304" y1={target.y} y2={target.y} stroke="currentColor" strokeWidth="2" opacity="0.72" />}
          <line x1={stemUp ? 287 : 255} x2={stemUp ? 287 : 255} y1={target.y} y2={stemUp ? target.y - 58 : target.y + 58} stroke="var(--p1)" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="270" cy={target.y} rx="17" ry="12" transform={`rotate(-20 270 ${target.y})`} fill="var(--p1)" />
        </svg>
      </div>

      <div className="mx-auto flex w-fit select-none justify-center" aria-label="Piano keyboard">
        {staffNotes.map((key, index) => <button key={key.note} type="button" onClick={() => feedback !== "correct" && chooseKey(index)} aria-label={`Play ${key.note}`} aria-pressed={activeNote === key.note} className={`piano-white-key relative h-44 w-11 rounded-b-lg border-2 border-slate-300 shadow-sm transition active:translate-y-1 sm:w-14 ${activeNote === key.note ? "is-active ring-2 ring-p1" : "bg-white hover:bg-slate-50"}`}>
          <span className={`absolute bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold ${activeNote === key.note ? "text-white" : "text-p2"}`}>{key.solfege}</span>
          <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold sm:text-xs ${activeNote === key.note ? "text-white" : "text-slate-500"}`}>{key.note}</span>
        </button>)}
      </div>
      <p className="mt-2 text-center text-xs text-mute">Or use keyboard keys A S D F G H J K</p>

      <div className="mt-5 min-h-12 text-center" aria-live="polite">
        {feedback === "correct" && <p className="font-semibold text-green-600">Correct! That note is {target.note}.</p>}
        {feedback === "wrong" && <p className="font-semibold text-red-500">Not quite. Try another piano key.</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <p className="font-semibold text-ink">Score: <span className="text-p1">{score}</span></p>
        {feedback === "correct" && <button type="button" onClick={nextNote} className="inline-flex items-center gap-2 rounded-full bg-[var(--p1)] px-5 py-2.5 font-semibold text-white transition hover:opacity-90">Next note</button>}
        <button type="button" onClick={() => setScore(0)} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-mute transition hover:bg-p1-soft hover:text-p1"><RotateCcw size={15} /> Reset score</button>
      </div>
    </section>
  );
}
