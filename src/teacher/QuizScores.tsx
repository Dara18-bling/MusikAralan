import { useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../api";
import { Btn, Card, Pill, TableScrollHint, Title } from "../ui";

export interface QuizScoreAssessment {
  id: string;
  assessmentCode: string;
  title: string;
}

interface QuizScore {
  studentId: string;
  studentName: string;
  score: number;
  passed: boolean;
  retakes: number;
  reopens: number;
}

interface QuizScoresProps {
  className: string;
  assessments: QuizScoreAssessment[];
}

export function QuizScores({ className, assessments }: QuizScoresProps) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [reopeningStudentId, setReopeningStudentId] = useState("");

  const viewScores = async (assessment: QuizScoreAssessment) => {
    setSelectedAssessmentId(assessment.id);
    setLoading(true);
    try {
      const { data } = await apiGet<{ data: QuizScore[] }>(
        `/assessments/${assessment.id}/scores`,
      );
      setScores(data);
    } catch (error) {
      console.error("Could not load quiz scores:", error);
      toast.error("Could not load scores for this quiz.");
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const reopenQuiz = async (score: QuizScore) => {
    if (!selectedAssessment) return;
    setReopeningStudentId(score.studentId);
    try {
      const { reopens } = await apiPost<{ reopens: number }>(
        `/assessments/${selectedAssessment.id}/students/${score.studentId}/reopen`,
        {},
      );
      setScores((current) =>
        current.map((item) =>
          item.studentId === score.studentId ? { ...item, reopens } : item,
        ),
      );
      toast.success(`${score.studentName} can retake this quiz.`);
    } catch (error) {
      console.error("Could not reopen quiz:", error);
      toast.error("Could not reopen this quiz for the student.");
    } finally {
      setReopeningStudentId("");
    }
  };

  const selectedAssessment = assessments.find(
    (assessment) => assessment.id === selectedAssessmentId,
  );

  if (selectedAssessment) {
    return (
      <div className="grid gap-5">
        <Btn
          variant="ghost"
          onClick={() => {
            setSelectedAssessmentId("");
            setScores([]);
          }}
          className="w-fit"
        >
          Back to Quiz List
        </Btn>
        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-p1">
                {selectedAssessment.assessmentCode}
              </p>
              <h2 className="font-display text-2xl font-bold">
                {selectedAssessment.title} scores
              </h2>
            </div>
            <p className="text-sm text-mute">
              {scores.length} student{scores.length === 1 ? "" : "s"}
            </p>
          </div>
          {loading ? (
            <p className="text-sm text-mute">Loading scores…</p>
          ) : scores.length === 0 ? (
            <p className="text-sm text-mute">
              No students have submitted this quiz yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                    <th className="px-3 py-3">Student Name</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Evaluation</th>
                    <th className="px-3 py-3">Retakes</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr
                      key={score.studentId}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-3 py-3 font-semibold">
                        {score.studentName}
                      </td>
                      <td className="px-3 py-3">{score.score}%</td>
                      <td className="px-3 py-3">
                        <Pill tone={score.passed ? "p1" : "p2"}>
                          {score.passed ? "Passed" : "Failed"}
                        </Pill>
                      </td>
                      <td className="px-3 py-3">{score.retakes}</td>
                      <td className="px-3 py-3 text-right">
                        <Btn
                          variant="soft"
                          onClick={() => void reopenQuiz(score)}
                          disabled={reopeningStudentId === score.studentId}
                        >
                          {reopeningStudentId === score.studentId
                            ? "Reopening…"
                            : "Reopen Quiz"}
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <TableScrollHint />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                <th className="px-3 py-3">Quiz</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr
                  key={assessment.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-3 py-3">
                    <p className="font-semibold">{assessment.title}</p>
                    <p className="text-xs text-mute">
                      {assessment.assessmentCode}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Btn
                      variant="soft"
                      onClick={() => void viewScores(assessment)}
                      disabled={
                        loading && selectedAssessmentId === assessment.id
                      }
                    >
                      {loading && selectedAssessmentId === assessment.id
                        ? "Loading…"
                        : "View Scores"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assessments.length === 0 && (
          <p className="py-4 text-sm text-mute">
            No quizzes have been created yet.
          </p>
        )}
      </Card>
    </div>
  );
}
