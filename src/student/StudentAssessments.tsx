import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../api";
import { Card, Title } from "../ui";

interface AssessmentSummary {
  id: string;
  assessmentCode: string;
  title: string;
  passingPercent: number;
  questionCount: number;
  latestAttempt: { score: number; passed: boolean; submittedAt: string } | null;
}

interface AssessmentQuestion {
  id: string;
  q: string;
  o: string[];
  type: "multiple" | "truefalse" | "identification";
}

interface AssessmentDetails extends AssessmentSummary {
  questions: AssessmentQuestion[];
}

interface StudentAssessmentsProps {
  classId: string;
  className: string;
  onBack: () => void;
}

export function StudentAssessments({
  classId,
  className,
  onBack,
}: StudentAssessmentsProps) {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentDetails | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void apiGet<{ data: AssessmentSummary[] }>(
      `/classes/${classId}/assessments`,
    )
      .then(({ data }) => {
        if (active) setAssessments(data);
      })
      .catch((error: unknown) => {
        console.error("Could not load class assessments:", error);
        if (active) toast.error("Could not load assessments for this class.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);

  const openAssessment = async (assessmentId: string) => {
    setLoading(true);
    try {
      const { assessment } = await apiGet<{ assessment: AssessmentDetails }>(
        `/assessments/${assessmentId}`,
      );
      setSelectedAssessment(assessment);
      setAnswers({});
    } catch (error) {
      console.error("Could not load assessment questions:", error);
      toast.error("Could not open this assessment.");
    } finally {
      setLoading(false);
    }
  };

  const submitAssessment = async () => {
    if (!selectedAssessment) return;
    if (
      selectedAssessment.questions.some(
        (_, index) => answers[index] === undefined || answers[index] === "",
      )
    ) {
      toast.warning("Answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const { attempt } = await apiPost<{
        attempt: {
          id: string;
          score: number;
          passed: boolean;
          submittedAt: string;
        };
      }>(`/assessments/${selectedAssessment.id}/attempts`, {
        answers: selectedAssessment.questions.map((_, index) => answers[index]),
      });
      const latestAttempt = {
        score: attempt.score,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
      };
      setAssessments((current) =>
        current.map((item) =>
          item.id === selectedAssessment.id ? { ...item, latestAttempt } : item,
        ),
      );
      toast[attempt.passed ? "success" : "warning"](
        attempt.passed
          ? `Assessment passed: ${attempt.score}%.`
          : `Assessment score: ${attempt.score}%. Review the materials and try again.`,
      );
      setSelectedAssessment(null);
      setAnswers({});
    } catch (error) {
      console.error("Could not submit assessment:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save your assessment result.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedAssessment) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedAssessment(null)}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-p1"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to assessments
        </button>
        <Title
          kicker={`${className} · ${selectedAssessment.assessmentCode}`}
          title={selectedAssessment.title}
          sub={`Passing score: ${selectedAssessment.passingPercent}%`}
        />
        <div className="mt-5 grid gap-4">
          {selectedAssessment.questions.map((question, index) => (
            <Card key={question.id}>
              <fieldset>
                <legend className="font-semibold">
                  {index + 1}. {question.q}
                </legend>
                {question.type === "identification" ? (
                  <input
                    value={answers[index] || ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [index]: event.target.value,
                      }))
                    }
                    placeholder="Your answer"
                    className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                  />
                ) : (
                  <div className="mt-3 grid gap-2">
                    {question.o.map((option, optionIndex) => (
                      <label
                        key={optionIndex}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`assessment-${selectedAssessment.id}-question-${index}`}
                          checked={answers[index] === String(optionIndex)}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [index]: String(optionIndex),
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => void submitAssessment()}
            disabled={submitting}
            className="grad w-fit rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit assessment"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-p1"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to classes
      </button>
      <Title
        kicker={className}
        title="Assessments"
        sub="Choose an assessment to view its questions and submit your answers."
      />
      <div className="mt-5 grid gap-3">
        {assessments.map((assessment) => (
          <Card
            key={assessment.id}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <ClipboardCheck
                className="mt-1 h-5 w-5 shrink-0 text-p1"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-p1">
                  {assessment.assessmentCode}
                </p>
                <h2 className="font-display text-xl font-bold">
                  {assessment.title}
                </h2>
                <p className="mt-1 text-sm text-mute">
                  {assessment.questionCount} questions · Pass at{" "}
                  {assessment.passingPercent}%
                  {assessment.latestAttempt &&
                    ` · Latest score ${assessment.latestAttempt.score}% (${assessment.latestAttempt.passed ? "Passed" : "Retry needed"})`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openAssessment(assessment.id)}
              className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
            >
              Open assessment
            </button>
          </Card>
        ))}
        {!loading && assessments.length === 0 && (
          <Card className="text-sm text-mute">
            No assessments have been published for this class yet.
          </Card>
        )}
        {loading && <p className="text-sm text-mute">Loading assessments…</p>}
      </div>
    </>
  );
}
