import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiDownloadFile, apiPut, POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card } from "../ui";
import { formatPhilippineDateTime } from "../utils/dateTime";

interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  fileName: string;
  fileSize: number;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

interface MaterialSubmissionsProps {
  classId: string;
  materialId: string;
  maxGrade: number;
}

export function MaterialSubmissions({ classId, materialId, maxGrade }: MaterialSubmissionsProps) {
  const endpoint = `/classes/${classId}/materials/${materialId}/submissions`;
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  useEffect(() => watchApi<{ data: Submission[] }>(
    endpoint,
    ({ data }) => {
      setSubmissions(data);
      setGrades((current) => Object.fromEntries(data.map((item) => [item.id, current[item.id] ?? (item.grade === null ? "" : String(item.grade))])));
      setFeedback((current) => Object.fromEntries(data.map((item) => [item.id, current[item.id] ?? item.feedback ?? ""])));
      setLoaded(true);
    },
    (error) => { console.error("Could not load material submissions:", error); setLoaded(true); },
    POLL_INTERVAL_TWO_MINUTES,
  ), [endpoint]);

  const gradeSubmission = async (submission: Submission) => {
    const grade = Number(grades[submission.id]);
    if (!Number.isInteger(grade) || grade < 0 || grade > maxGrade) {
      toast.warning(`Enter a grade from 0 to ${maxGrade}.`);
      return;
    }
    setSaving(submission.id);
    try {
      await apiPut(`${endpoint}/${submission.id}`, { grade, feedback: feedback[submission.id] || null });
      setSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, grade, feedback: feedback[submission.id] || null, gradedAt: new Date().toISOString() } : item));
      toast.success(`Saved grade for ${submission.studentName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this grade.");
    } finally {
      setSaving("");
    }
  };

  const downloadSubmission = async (submission: Submission) => {
    try {
      await apiDownloadFile(`${endpoint}/${submission.id}/file`, submission.fileName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download this submission.");
    }
  };

  if (!loaded) return <p className="py-3 text-sm text-mute">Loading student submissions…</p>;
  if (!submissions.length) return <p className="py-3 text-sm text-mute">No student files have been submitted yet.</p>;

  return <div className="grid gap-3">
    {submissions.map((submission) => <Card key={submission.id} className="grid min-w-0 gap-3 bg-p1-soft/20 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{submission.studentName}</p>
          <p className="mt-1 break-all text-sm text-mute">{submission.fileName} · {(submission.fileSize / 1024 / 1024).toFixed(1)} MB</p>
          <p className="mt-1 text-xs text-mute">Submitted {formatPhilippineDateTime(submission.submittedAt)}</p>
        </div>
        <button type="button" onClick={() => void downloadSubmission(submission)} className="shrink-0 rounded-full border border-[var(--p1)] px-4 py-2 text-sm font-semibold text-p1 hover:bg-p1-soft">Download file</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <label className="grid gap-1 text-sm font-semibold">Grade (0–{maxGrade})
          <input type="number" min={0} max={maxGrade} step={1} value={grades[submission.id] ?? ""} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: event.target.value }))} className="min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Feedback (optional)
          <textarea rows={2} maxLength={5000} value={feedback[submission.id] ?? ""} onChange={(event) => setFeedback((current) => ({ ...current, [submission.id]: event.target.value }))} className="min-w-0 resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {submission.grade !== null && <p className="text-sm text-mute">Current grade: <span className="font-semibold text-ink">{submission.grade}/100</span></p>}
        <button type="button" disabled={saving === submission.id} onClick={() => void gradeSubmission(submission)} className="rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving === submission.id ? "Saving…" : "Save grade"}</button>
      </div>
    </Card>)}
  </div>;
}
