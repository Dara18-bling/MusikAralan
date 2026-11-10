import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Card, Label } from "../ui";

type PianoNote = {
  label: string;
  frequency: number;
  color: "white" | "black";
  afterWhite?: number;
};

const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK_KEY_AFTER_WHITE: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

function createPianoNotes(): PianoNote[] {
  const notes: PianoNote[] = [];
  for (let midi = 36; midi <= 108; midi += 1) {
    const pitchClass = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const color = [1, 3, 6, 8, 10].includes(pitchClass) ? "black" : "white";
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    notes.push({
      label: `${PITCH_NAMES[pitchClass]}${octave}`,
      frequency,
      color,
      ...(color === "black" ? { afterWhite: Math.floor((midi - 36) / 12) * 7 + BLACK_KEY_AFTER_WHITE[pitchClass] } : {}),
    });
  }
  return notes;
}

export function PianoTester() {
  const keyboardRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [activeNote, setActiveNote] = useState("");
  const [keyWidth, setKeyWidth] = useState(48);
  const notes = useMemo(createPianoNotes, []);
  const whiteNotes = notes.filter((note) => note.color === "white");
  const blackNotes = notes.filter((note) => note.color === "black");
  const keyboardWidth = whiteNotes.length * keyWidth;
  const blackKeyWidth = Math.max(18, Math.round(keyWidth * 0.62));

  useEffect(() => () => {
    void audioContext.current?.close();
    audioContext.current = null;
  }, []);

  const playNote = useCallback(async (label: string, frequency: number) => {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    if (context.state === "suspended") await context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    setActiveNote(label);
    window.setTimeout(() => setActiveNote((current) => current === label ? "" : current), 180);
  }, []);

  const scrollKeyboard = (direction: -1 | 1) => {
    const keyboard = keyboardRef.current;
    if (!keyboard) return;
    keyboard.scrollBy({ left: direction * keyboard.clientWidth * 0.75, behavior: "smooth" });
  };

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label>Practice piano</Label>
          <p className="mt-2 text-sm text-mute">Play notes while listening to the learning material. Full range: C2–C8.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-mute">Key width</span>
          <button
            type="button"
            onClick={() => setKeyWidth((width) => Math.max(32, width - 4))}
            disabled={keyWidth <= 32}
            aria-label="Make piano keys narrower"
            title="Make keys narrower"
            className="grid h-9 w-9 place-items-center rounded-full border border-line transition hover:bg-p1-soft disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setKeyWidth((width) => Math.min(64, width + 4))}
            disabled={keyWidth >= 64}
            aria-label="Make piano keys wider"
            title="Make keys wider"
            className="grid h-9 w-9 place-items-center rounded-full border border-line transition hover:bg-p1-soft disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => scrollKeyboard(-1)}
          aria-label="Scroll piano keys left"
          title="Scroll left"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line transition hover:bg-p1-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center text-xs text-mute">Scroll through the keys from left to right</div>
        <button
          type="button"
          onClick={() => scrollKeyboard(1)}
          aria-label="Scroll piano keys right"
          title="Scroll right"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line transition hover:bg-p1-soft"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div ref={keyboardRef} className="mt-3 overflow-x-auto overscroll-x-contain rounded-lg pb-2" aria-label="Piano keys from C2 to C8">
        <div className="relative h-40 select-none" style={{ width: `${keyboardWidth}px`, minWidth: `${keyboardWidth}px` }}>
          <div className="absolute inset-0 flex">
            {whiteNotes.map((note) => (
              <button
                key={note.label}
                type="button"
                onClick={() => void playNote(note.label, note.frequency)}
                aria-label={`Play ${note.label}`}
                style={{ width: `${keyWidth}px` }}
                className={`relative h-40 shrink-0 rounded-b-lg border border-slate-300 shadow-sm transition active:translate-y-0.5 ${activeNote === note.label ? "bg-p1-soft" : "bg-white hover:bg-slate-50"}`}
              >
                <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-semibold text-slate-500">{note.label}</span>
              </button>
            ))}
          </div>
          {blackNotes.map((note) => (
            <button
              key={note.label}
              type="button"
              onClick={() => void playNote(note.label, note.frequency)}
              aria-label={`Play ${note.label.replace("♯", " sharp ")}`}
              style={{ left: `${(note.afterWhite! + 1) * keyWidth}px`, width: `${blackKeyWidth}px` }}
              className={`absolute top-0 z-10 h-24 -translate-x-1/2 rounded-b-md shadow-md transition active:translate-y-0.5 ${activeNote === note.label ? "bg-p1" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-semibold text-white">{note.label.replace("♯", "#")}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-mute" aria-live="polite">
        {activeNote ? `Playing ${activeNote}` : "Select a key to play its note. Use the width and arrow buttons to adjust the keyboard."}
      </p>
    </Card>
  );
}
