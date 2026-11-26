import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPost, apiPut, refreshApi } from "../api";
import { Btn, Card, Input, Label } from "../ui";
import { QuizScores } from "./QuizScores";

export type Question = {
  q: string;
  o: string[];
  a: number;
  type: "multiple" | "truefalse" | "identification";
  answer?: string;
};

interface AssessmentSummary {
  id: string;
  assessmentCode: string;
  title: string;
  passingPercent: number;
  allowsRetakes: boolean;
  questionCount: number;
  isPublished: boolean;
  attemptsCount: number;
  editLocked: boolean;
}

interface AssessmentDetails extends AssessmentSummary {
  shuffleOrder: boolean;
  questions: Question[];
}

interface QuizProps {
  classId?: string;
  className: string;
  assessmentId: string;
  onAssessmentChange: (assessmentId: string) => void;
}

type QuizSubtab = "create" | "edit" | "scores";

const emptyQuestion = (): Question => ({
  q: "",
  o: [],
  a: 0,
  type: "multiple",
});

export function Quiz({
  classId,
  className,
  assessmentId,
  onAssessmentChange,
}: QuizProps) {
  const [activeSubtab, setActiveSubtab] = useState<QuizSubtab>(
    assessmentId ? "edit" : "create",
  );
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);
  const [assessmentCode, setAssessmentCode] = useState("");
  const [qs, setQs] = useState<Question[]>([emptyQuestion()]);
  const [title, setTitle] = useState("");
  const [passingPercent, setPassingPercent] = useState(70);
  const [allowsRetakes, setAllowsRetakes] = useState(true);
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [editLocked, setEditLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetAssessmentForm = () => {
    setAssessmentCode("");
    setTitle("");
    setPassingPercent(70);
    setAllowsRetakes(true);
    setShuffleOrder(false);
    setIsPublished(false);
    setEditLocked(false);
    setQs([emptyQuestion()]);
  };

  useEffect(() => {
    if (!classId) {
      setAssessments([]);
      setAssessmentsLoaded(false);
      setAssessmentCode("");
      setTitle("");
      setPassingPercent(70);
      setAllowsRetakes(true);
      setShuffleOrder(false);
      setIsPublished(false);
      setEditLocked(false);
      setQs([emptyQuestion()]);
      return;
    }

    let active = true;
    setLoading(true);
    setAssessmentsLoaded(false);
    void apiGet<{ data: AssessmentSummary[] }>(
      `/classes/${classId}/assessments`,
    )
      .then(({ data }) => {
        if (!active) return;
        setAssessments(data);
        setAssessmentsLoaded(true);
        const nextAssessmentId = data.some((item) => item.id === assessmentId)
          ? assessmentId
          : "";
        if (nextAssessmentId !== assessmentId) {
          onAssessmentChange(nextAssessmentId);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load class quizzes:", error);
        if (active) toast.error("Could not load quizzes for this class.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classId]);

  useEffect(() => {
    if (!assessmentsLoaded || !assessmentId) {
      if (assessmentsLoaded && !assessmentId) resetAssessmentForm();
      return;
    }
    let active = true;
    setLoading(true);
    void apiGet<{ assessment: AssessmentDetails }>(
      `/assessments/${assessmentId}`,
    )
      .then(({ assessment }) => {
        if (!active) return;
        setAssessmentCode(assessment.assessmentCode);
        setTitle(assessment.title);
        setPassingPercent(assessment.passingPercent);
        setAllowsRetakes(assessment.allowsRetakes ?? true);
        setShuffleOrder(assessment.shuffleOrder ?? false);
        setIsPublished(assessment.isPublished ?? true);
        setEditLocked(assessment.editLocked ?? false);
        setQs(
          assessment.questions.length
            ? assessment.questions.map((question) => ({
                ...question,
                a: question.a ?? 0,
              }))
            : [emptyQuestion()],
        );
      })
      .catch((error: unknown) => {
        console.error("Could not load assessment:", error);
        if (active) toast.error("Could not load the selected assessment.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assessmentId, assessmentsLoaded]);

  const startNewAssessment = () => {
    setActiveSubtab("create");
    onAssessmentChange("");
    resetAssessmentForm();
  };

  const selectSubtab = (subtab: QuizSubtab) => {
    setActiveSubtab(subtab);
    if (subtab === "create") {
      onAssessmentChange("");
      resetAssessmentForm();
    } else if (subtab === "edit" && !assessmentId) {
      onAssessmentChange(assessments[0]?.id || "");
    }
  };

  const updateQuestion = (index: number, changes: Partial<Question>) => {
    setQs((current) =>
      current.map((question, position) =>
        position === index ? { ...question, ...changes } : question,
      ),
    );
  };

  const publishAssessment = async () => {
    if (!classId) {
      toast.warning(
        "Choose an assigned class before publishing an assessment.",
      );
      return;
    }
    if (
      !title.trim() ||
      qs.some(
        (question) =>
          !question.q.trim() ||
          (question.type === "identification" && !question.answer?.trim()) ||
          (question.type !== "identification" &&
            (question.o.length === 0 ||
              question.o.some((option) => !option.trim()) ||
              question.a >= question.o.length)),
      )
    ) {
      toast.warning(
        "Complete every question and correct answer before publishing.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        questions: qs,
        passingPercent,
        allowsRetakes,
        shuffleOrder,
        isPublished,
      };
      const response = assessmentId
        ? await apiPut<{ assessment: AssessmentDetails }>(
            `/assessments/${assessmentId}`,
            { ...payload, assessmentCode },
          )
        : await apiPost<{ assessment: AssessmentDetails }>(
            `/classes/${classId}/assessments`,
            payload,
          );
      const { assessment } = response;
      setAssessmentCode(assessment.assessmentCode);
      onAssessmentChange(assessment.id);
      setTitle(assessment.title);
      setPassingPercent(assessment.passingPercent);
      setAllowsRetakes(assessment.allowsRetakes ?? true);
      setShuffleOrder(assessment.shuffleOrder ?? false);
      setIsPublished(assessment.isPublished ?? true);
      setEditLocked(assessment.editLocked ?? false);
      setQs(
        assessment.questions.map((question) => ({
          ...question,
          a: question.a ?? 0,
        })),
      );
      setAssessments((current) => {
        const existing = current.some((item) => item.id === assessment.id);
        const summary = {
          id: assessment.id,
          assessmentCode: assessment.assessmentCode,
          title: assessment.title,
          passingPercent: assessment.passingPercent,
          allowsRetakes: assessment.allowsRetakes,
          questionCount: assessment.questions.length,
          isPublished: assessment.isPublished,
          attemptsCount: assessment.attemptsCount,
          editLocked: assessment.editLocked,
        };
        return existing
          ? current.map((item) => (item.id === assessment.id ? summary : item))
          : [...current, summary];
      });
      refreshApi(`/classes/${classId}/assessments`);
      toast.success("Quiz saved to the class.");
    } catch (error) {
      console.error("Could not save class assessment:", error);
      const problem = error as { message?: string };
      toast.error(
        `Could not save quiz: ${problem.message || "Please check your connection and try again."}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="mb-5 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label="Quiz tools"
      >
        <div className="flex min-w-max gap-1">
          {(
            [
              ["create", "Create New Quiz"],
              ["edit", "Edit Quiz"],
              ["scores", "Quiz Scores"],
            ] as const
          ).map(([subtab, label]) => (
            <button
              key={subtab}
              type="button"
              role="tab"
              aria-selected={activeSubtab === subtab}
              onClick={() => selectSubtab(subtab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeSubtab === subtab
                  ? "border-[var(--p1)] text-p1"
                  : "border-transparent text-mute hover:border-line hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {activeSubtab === "scores" ? (
        <QuizScores
          classId={classId || ""}
          className={className}
          assessments={assessments}
        />
      ) : (
        <div className="grid max-w-3xl gap-4">
          {activeSubtab === "edit" && (
            <Card className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-56 flex-1 gap-1 text-sm font-semibold">
                Class quizzes
                <select
                  value={assessmentId}
                  onChange={(event) => onAssessmentChange(event.target.value)}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
                >
                  {!assessmentId && <option value="">New quiz</option>}
                  {assessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.assessmentCode} · {assessment.title}
                    </option>
                  ))}
                </select>
              </label>
              <Btn variant="soft" onClick={startNewAssessment}>
                + New Quiz
              </Btn>
            </Card>
          )}

          <fieldset
            disabled={editLocked}
            className="grid gap-4 disabled:opacity-70"
          >
            <Card className="grid gap-3">
              <Label>
                Quiz details
                {assessmentCode ? ` · ${assessmentCode}` : " · New quiz"}
              </Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Quiz title"
                maxLength={255}
              />
              <label className="grid gap-1 text-sm font-semibold">
                Passing score: {passingPercent}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={passingPercent}
                  onChange={(event) =>
                    setPassingPercent(Number(event.target.value))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allowsRetakes}
                  onChange={(event) => setAllowsRetakes(event.target.checked)}
                />
                Allow students to retake this assessment
              </label>
              <div className="grid gap-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={shuffleOrder}
                    disabled={saving || loading}
                    onChange={(event) => setShuffleOrder(event.target.checked)}
                  />
                  Shuffle questions and answers
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(event) => setIsPublished(event.target.checked)}
                />
                Publish quizzes for students
              </label>
            </Card>

            {qs.map((question, index) => (
              <Card key={index}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-xs text-p2">Q{index + 1}</p>
                  <select
                    value={question.type}
                    onChange={(event) => {
                      const type = event.target.value as Question["type"];
                      updateQuestion(index, {
                        type,
                        o:
                          type === "truefalse"
                            ? ["True", "False"]
                            : type === "identification"
                              ? []
                              : question.o,
                      });
                    }}
                    className="rounded border border-line px-2 py-1 text-xs"
                  >
                    <option value="multiple">Multiple Choice</option>
                    <option value="truefalse">True/False</option>
                    <option value="identification">Identification</option>
                  </select>
                </div>
                <Input
                  className="mt-2"
                  value={question.q}
                  onChange={(event) =>
                    updateQuestion(index, { q: event.target.value })
                  }
                  placeholder="Question prompt"
                />
                {question.type === "identification" ? (
                  <div className="mt-3">
                    <Input
                      placeholder="Enter correct exact answer here"
                      value={question.answer || ""}
                      onChange={(event) =>
                        updateQuestion(index, { answer: event.target.value })
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {question.o.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(index, { a: optionIndex })
                          }
                          aria-label="Mark correct"
                          aria-pressed={question.a === optionIndex}
                          className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                            question.a === optionIndex
                              ? "border-[var(--p1)] grad"
                              : "border-line"
                          }`}
                        />
                        <Input
                          value={option}
                          disabled={question.type === "truefalse"}
                          onChange={(event) =>
                            updateQuestion(index, {
                              o: question.o.map((current, position) =>
                                position === optionIndex
                                  ? event.target.value
                                  : current,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    {question.type === "multiple" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(index, {
                            o: [...question.o, ""],
                          })
                        }
                        className="mt-2 text-left text-sm font-semibold text-p1"
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
                  setQs((current) => [...current, emptyQuestion()])
                }
              >
                + Add question
              </Btn>
              <Btn
                onClick={() => void publishAssessment()}
                disabled={saving || loading || !classId || editLocked}
              >
                {saving ? "Saving…" : isPublished ? "Save quiz" : "Save draft"}
              </Btn>
            </div>
          </fieldset>
          {editLocked && (
            <p className="text-sm font-medium text-mute">
              This quiz is locked because a student has already submitted an
              attempt.
            </p>
          )}
        </div>
      )}
    </>
  );
}
