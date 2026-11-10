import { useEffect, useState } from "react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card, Pill, Title } from "../ui";

interface QuizAttempt {
  id: string;
  quizTitle: string;
  className: string | null;
  score: number;
  passed: boolean;
  submittedAt: string | null;
}

export function StudentExams() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [error, setError] = useState("");

  useEffect(() => watchApi<{ data: QuizAttempt[] }>("/quiz-attempts", ({ data }) => {
    setAttempts(data);
    setError("");
  }, (listenerError) => {
    console.error("Could not load quiz attempts:", listenerError);
    setError("Assessment history is unavailable right now.");
  }, POLL_INTERVAL_TWO_MINUTES), []);

  return (
    <>
      <Title kicker="Testing & achievements" title="Assessments" sub="Your saved quiz results." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Card>
        {attempts.length ? (
          <ul className="divide-y divide-line">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center gap-3 py-4">
                <div className="flex-1">
                  <p className="font-semibold">{attempt.quizTitle}</p>
                  <p className="text-sm text-mute">
                    {[attempt.className, attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="font-display text-2xl font-bold">{attempt.score}%</span>
                <Pill tone={attempt.passed ? "p1" : "p2"}>{attempt.passed ? "Passed" : "Try again"}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-mute">No quiz attempts have been recorded yet.</p>
        )}
      </Card>
    </>
  );
}
