import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";
import { Btn, Card, Input, Label, Pill, Title } from "../ui";

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
  const [qs, setQs] = useState<Question[]>([{ q: "", o: [], a: 0, type: "multiple" }]);
  const [title, setTitle] = useState("");
  const [passingPercent, setPassingPercent] = useState(70);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId) {
      setTitle("");
      setQs([{ q: "", o: [], a: 0, type: "multiple" }]);
      return;
    }

    let active = true;
    setLoading(true);
    void apiGet<{ assessment: { title: string; passingPercent: number; questions: Question[] } | null }>(
      `/classes/${classId}/assessment`,
    ).then(({ assessment }) => {
      if (!active) return;
      setTitle(assessment?.title || "");
      setPassingPercent(assessment?.passingPercent ?? 70);
      setQs(assessment?.questions?.length
        ? assessment.questions.map((question) => ({ ...question, a: question.a ?? 0 }))
        : [{ q: "", o: [], a: 0, type: "multiple" }]);
    }).catch((error) => {
      console.error("Could not load class assessment:", error);
      if (active) alert("Could not load the current assessment for this class.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [classId]);

  const upd = (i: number, p: Partial<Question>) => {
    setQs((current) => current.map((x, j) => (j === i ? { ...x, ...p } : x)));
  };

  const publishAssessment = async () => {
    if (!classId) return alert("Choose an assigned class before publishing an assessment.");
    if (!title.trim() || qs.some((question) => !question.q.trim() || (question.type === "identification" && !question.answer?.trim()))) {
      return alert("Complete every question and correct answer before publishing.");
    }
    try {
      const { assessment } = await apiPut<{ assessment: { title: string; passingPercent: number; questions: Question[] } }>(`/classes/${classId}/assessment`, {
        title: title.trim(),
        questions: qs,
        passingPercent,
      });
      setTitle(assessment.title);
      setPassingPercent(assessment.passingPercent);
      setQs(assessment.questions.map((question) => ({ ...question, a: question.a ?? 0 })));
      alert("Assessment published to the class.");
    } catch (error) {
      console.error("Could not publish class assessment:", error);
      const problem = error as { message?: string };
      alert(`Could not publish assessment: ${problem.message || "Please check your connection and try again."}`);
    }
  };

  return (
    <>
      <Title
        kicker="Assessment builder"
        title={title || "Assessment Builder"}
        sub={className ? `Creating an assessment for ${className}.` : "Choose an assigned class before creating an assessment."}
        right={
          <div className="flex gap-2">
            <Pill>Auto-graded</Pill>
            <Pill tone="p2">Passing {passingPercent}%</Pill>
          </div>
        }
      />
      <div className="grid max-w-3xl gap-4">
        {loading && <p className="text-sm text-mute">Loading saved assessment…</p>}
        <Card className="grid gap-3">
          <Label>Assessment details</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Assessment title" maxLength={255} />
          <label className="grid gap-1 text-sm font-semibold">
            Passing score: {passingPercent}%
            <input type="range" min={0} max={100} value={passingPercent} onChange={(event) => setPassingPercent(Number(event.target.value))} />
          </label>
        </Card>
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
                    onClick={() => upd(i, { o: [...x.o, ""] })}
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
              setQs((current) => [
                ...current,
                { q: "", o: [], a: 0, type: "multiple" },
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