import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Btn, Card, Input, Pill, Title } from "../ui";

export type Question = {
  q: string;
  o: string[];
  a: number;
  type: "multiple" | "truefalse" | "identification";
  answer?: string;
};

interface QuizProps {
  className?: string;
  classId?: string;
}

export function Quiz({ className, classId }: QuizProps) {
  const [qs, setQs] = useState<Question[]>([
    {
      q: "What is the time signature of a waltz?",
      o: ["2/4", "3/4", "4/4"],
      a: 1,
      type: "multiple",
    },
  ]);

  const upd = (i: number, p: Partial<Question>) =>
    setQs(qs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const publishAssessment = async () => {
    if (!classId) return alert("Choose an assigned class before publishing an assessment.");
    if (qs.some((question) => !question.q.trim() || (question.type === "identification" && !question.answer?.trim()))) {
      return alert("Complete every question and correct answer before publishing.");
    }
    try {
      await setDoc(doc(db, "classes", classId, "assessments", "published"), {
        title: "Note Reading Quiz 5",
        questions: qs,
        passingPercent: 70,
        updatedAt: new Date(),
      });
      alert("Assessment published to the class.");
    } catch (error) {
      console.error("Could not publish class assessment:", error);
      const problem = error as { code?: string; message?: string };
      alert(`Could not publish assessment${problem.code ? ` (${problem.code})` : ""}: ${problem.message || "Check Firestore permissions."}`);
    }
  };

  return (
    <>
      <Title
        kicker="Assessment builder"
        title="Note Reading Quiz 5"
        sub={className ? `Creating an assessment for ${className}.` : "Choose an assigned class before creating an assessment."}
        right={
          <div className="flex gap-2">
            <Pill>Auto-graded</Pill>
            <Pill tone="p2">Passing 70%</Pill>
          </div>
        }
      />
      <div className="grid max-w-3xl gap-4">
        {qs.map((x, i) => (
          <Card key={i}>
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono text-xs text-p2">Q{i + 1}</p>
              <select
                value={x.type}
                onChange={(e) =>
                  upd(i, {
                    type: e.target.value as any,
                    o: e.target.value === "truefalse" ? ["True", "False"] : x.o,
                  })
                }
                className="text-xs border border-line rounded px-2 py-1"
              >
                <option value="multiple">Multiple Choice</option>
                <option value="truefalse">True/False</option>
                <option value="identification">Identification</option>
              </select>
            </div>
            <Input
              className="mt-2"
              value={x.q}
              onChange={(e) => upd(i, { q: e.target.value })}
            />
            {x.type === "identification" ? (
              <div className="mt-3">
                <Input
                  placeholder="Enter correct exact answer here"
                  value={x.answer || ""}
                  onChange={(e) => upd(i, { answer: e.target.value })}
                />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {x.o.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button
                      onClick={() => upd(i, { a: j })}
                      aria-label="Mark correct"
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${x.a === j ? "border-[var(--p1)] grad" : "border-line"}`}
                    />
                    <Input
                      value={o}
                      disabled={x.type === "truefalse"}
                      onChange={(e) =>
                        upd(i, {
                          o: x.o.map((y, k) => (k === j ? e.target.value : y)),
                        })
                      }
                    />
                  </div>
                ))}
                {x.type === "multiple" && (
                  <button
                    onClick={() => upd(i, { o: [...x.o, "New option"] })}
                    className="mt-2 text-sm font-semibold text-p1 text-left"
                  >
                    + Option
                  </button>
                )}
              </div>
            )}
          </Card>
        ))}
        <div className="flex gap-2">
          <Btn
            variant="soft"
            onClick={() =>
              setQs([
                ...qs,
                { q: "New question", o: ["A", "B"], a: 0, type: "multiple" },
              ])
            }
          >
            + Add question
          </Btn>
          <Btn onClick={() => void publishAssessment()}>Publish & Link to Class</Btn>
        </div>
      </div>
    </>
  );
}