import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { apiGet, apiPost, POLL_INTERVAL_HOUR, watchApi } from "../api";
import { Btn, Card, Pill, TableScrollHint, Title } from "../ui";

ChartJS.register(
  BarElement,
  CategoryScale,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
);

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

interface QuizScoreDistribution {
  score: number;
  studentCount: number;
  students: string[];
  noAttemptCount: number;
  noAttemptStudents: string[];
}

interface QuizAverage {
  assessmentId: string;
  assessmentCode: string;
  title: string;
  averageScore: number | null;
  studentCount: number;
}

interface QuizScoresProps {
  classId: string;
  className: string;
  assessments: QuizScoreAssessment[];
}

const chartOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items) => `${items[0]?.label ?? ""} score`,
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: { callback: (value) => `${value}%` },
      title: { display: true, text: "Score" },
    },
    x: { title: { display: true, text: "Top 10 class score slots (lowest to highest)" } },
  },
};

const progressionOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `Average: ${context.parsed.y}%`,
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: { callback: (value) => `${value}%` },
      title: { display: true, text: "Average score" },
    },
    x: { title: { display: true, text: "Quiz code" } },
  },
};

export function QuizScores({ classId, className, assessments }: QuizScoresProps) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<
    QuizScoreDistribution[]
  >([]);
  const [quizAverages, setQuizAverages] = useState<QuizAverage[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reopeningStudentId, setReopeningStudentId] = useState("");

  useEffect(() => {
    setSummaryLoading(true);
    return watchApi<{ data: QuizAverage[] }>(
      `/classes/${classId}/assessment-score-summary`,
      ({ data }) => {
        setQuizAverages(data);
        setSummaryLoading(false);
      },
      (error) => {
        console.error("Could not load quiz score progression:", error);
        toast.error("Could not load quiz score progression.");
        setSummaryLoading(false);
      },
      POLL_INTERVAL_HOUR,
    );
  }, [classId]);

  const viewScores = async (assessment: QuizScoreAssessment) => {
    setSelectedAssessmentId(assessment.id);
    setLoading(true);
    try {
      const { data, scoreDistribution } = await apiGet<{
        data: QuizScore[];
        scoreDistribution: QuizScoreDistribution[];
      }>(
        `/assessments/${assessment.id}/scores`,
      );
      setScores(data);
      setScoreDistribution(scoreDistribution);
    } catch (error) {
      console.error("Could not load quiz scores:", error);
      toast.error("Could not load scores for this quiz.");
      setScores([]);
      setScoreDistribution([]);
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
  const noAttemptStudents = scoreDistribution.flatMap(
    (group) => group.noAttemptStudents,
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
          ) : scoreDistribution.length === 0 ? (
            <p className="text-sm text-mute">
              No enrolled students are available for this quiz.
            </p>
          ) : (
            <>
            <section aria-label="Top quiz score distribution" className="mb-5">
              <p className="mb-3 text-sm text-mute">
                Highest 10 score slots among all enrolled students. Tied scores share a slot; students without an attempt appear at 0%.
              </p>
              {noAttemptStudents.length > 0 && (
                <p className="mb-3 text-sm text-mute">
                  No submitted attempt: {noAttemptStudents.join(", ")}
                </p>
              )}
              <div className="h-72">
                <Bar
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      tooltip: {
                        callbacks: {
                          title: (items) => `${items[0]?.label ?? ""} score`,
                          label: (item) => {
                            const group = scoreDistribution[item.dataIndex];
                            const scoredCount = group?.studentCount ?? 0;
                            const noAttemptCount = group?.noAttemptCount ?? 0;
                            return `${scoredCount} student${scoredCount === 1 ? "" : "s"} scored${noAttemptCount ? `; ${noAttemptCount} without an attempt` : ""}`;
                          },
                          afterBody: (items) => {
                            const group = scoreDistribution[items[0]?.dataIndex ?? 0];
                            return [
                              ...(group?.students ?? []),
                              ...(group?.noAttemptStudents?.length
                                ? [`No submitted attempt: ${group.noAttemptStudents.join(", ")}`]
                                : []),
                            ];
                          },
                        },
                      },
                    },
                  }}
                  data={{
                    labels: scoreDistribution.map((group) => `${group.score}%`),
                    datasets: [
                      {
                        data: scoreDistribution.map((group) => group.score),
                        backgroundColor: "rgba(110, 82, 190, 0.72)",
                        borderColor: "rgb(110, 82, 190)",
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                    ],
                  }}
                />
              </div>
            </section>
            {scores.length === 0 ? (
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
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="mb-1 font-display text-xl font-bold">
          Average quiz scores
        </h2>
        <p className="mb-4 text-sm text-mute">
          Class average of each student’s highest score, shown in quiz order.
        </p>
        {summaryLoading ? (
          <p className="text-sm text-mute">Loading quiz progression…</p>
        ) : quizAverages.some((quiz) => quiz.averageScore !== null) ? (
          <div className="h-72">
            <Line
              options={progressionOptions}
              data={{
                labels: quizAverages.map((quiz) => quiz.assessmentCode),
                datasets: [
                  {
                    label: "Average score",
                    data: quizAverages.map((quiz) => quiz.averageScore),
                    borderColor: "rgb(110, 82, 190)",
                    backgroundColor: "rgba(110, 82, 190, 0.15)",
                    pointBackgroundColor: "rgb(110, 82, 190)",
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.25,
                  },
                ],
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-mute">
            No quiz scores are available to chart yet.
          </p>
        )}
      </Card>
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
