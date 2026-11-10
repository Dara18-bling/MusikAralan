import { useState } from "react";
import PianoQuiz from "./PianoQuiz";
import NoteMatcher from "./NoteMatcher";
import StaffQuiz from "./StaffQuiz";

type Exercise = "piano" | "note" | "staff";

export default function ExerciseTools() {
  const [exercise, setExercise] = useState<Exercise>("piano");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Exercise Tools</h1>
        <p className="mt-2 text-mute">Choose an exercise to get started.</p>
        <div className="mx-auto mt-5 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-2xl border border-line bg-white p-1 shadow-sm" role="group" aria-label="Choose exercise">
          <button type="button" aria-pressed={exercise === "piano"} onClick={() => setExercise("piano")} className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${exercise === "piano" ? "bg-[var(--p1)] text-white" : "text-mute hover:bg-p1-soft hover:text-p1"}`}>
            Piano Quiz
          </button>
          <button type="button" aria-pressed={exercise === "note"} onClick={() => setExercise("note")} className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${exercise === "note" ? "bg-[var(--p1)] text-white" : "text-mute hover:bg-p1-soft hover:text-p1"}`}>
            Note Matcher
          </button>
          <button type="button" aria-pressed={exercise === "staff"} onClick={() => setExercise("staff")} className={`rounded-full px-3 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${exercise === "staff" ? "bg-[var(--p1)] text-white" : "text-mute hover:bg-p1-soft hover:text-p1"}`}>
            Staff Quiz
          </button>
        </div>
      </div>
      {exercise === "piano" ? <PianoQuiz /> : exercise === "note" ? <NoteMatcher /> : <StaffQuiz />}
    </main>
  );
}
