import { useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Pencil, Users } from "lucide-react";
import { toast } from "react-toastify";
import { apiGet, apiPut, apiRequest, refreshApi } from "../api";
import { Card, Label } from "../ui";
import type { AssignmentSubmission, Material } from "./StudentClassWorkspace";
import { AssignmentSubmissionModal } from "./AssignmentSubmissionModal";
import {
  downloadDataUrl,
  ensureAbsoluteUrl,
  getDriveDownloadUrl,
  getDriveFileId,
  isDataUrl,
} from "../utils/mediaUrlHelper";

interface StudentMaterialViewerProps {
  className: string;
  classId?: string;
  material: Material;
  onBack: () => void;
  teacherMode?: boolean;
  onMaterialUpdated?: (material: Material) => void;
  completed?: boolean;
  onMarkComplete?: () => Promise<boolean>;
}

function getFileExtension(url: string) {
  return url.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "";
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function StudentMaterialViewer({
  className,
  classId,
  material,
  onBack,
  teacherMode = false,
  onMaterialUpdated,
  completed = false,
  onMarkComplete,
}: StudentMaterialViewerProps) {
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(
    material.submission || null,
  );
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [studentViewerTab, setStudentViewerTab] = useState<
    "material" | "submissions"
  >("material");
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [availableFrom, setAvailableFrom] = useState(
    toDateTimeLocal(material.availableFrom),
  );
  const [dueAt, setDueAt] = useState(toDateTimeLocal(material.dueAt));
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(
    material.allowLateSubmissions || false,
  );
  const submissionItems = teacherMode ? submissions : submission ? [submission] : [];
  const selectedSubmission = submissionItems.find(
    (item) => item.id === selectedSubmissionId,
  );
  const isStudentSubmissionView =
    !teacherMode &&
    material.isAssignment &&
    studentViewerTab === "submissions";
  const source = selectedSubmission
    ? selectedSubmission.driveUrl || selectedSubmission.fileUrl || ""
    : material.streamUrl || material.mediaUrl || "";
  const driveSubmission = Boolean(selectedSubmission?.driveUrl);
  const dataSource = selectedSubmission
    ? undefined
    : [material.streamUrl, material.mediaUrl].find(
        (url): url is string => typeof url === "string" && isDataUrl(url),
      );
  const safeSource = ensureAbsoluteUrl(source);
  const driveFileId = getDriveFileId(source);
  const drivePreviewUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : "";
  const extension = getFileExtension(source);
  const mimeType = dataSource?.slice(5).split(/[;,]/, 1)[0].toLowerCase() || "";
  const isAudio =
    (!selectedSubmission && material.kind === "Vocal Guide") ||
    mimeType.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "aac", "ogg"].includes(extension);
  const isVideo =
    (!selectedSubmission && material.kind === "Video Guide") ||
    mimeType.startsWith("video/") ||
    ["mp4", "webm", "ogv"].includes(extension);
  const isPdf = mimeType === "application/pdf" || extension === "pdf";
  const isImage =
    mimeType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp"].includes(extension);
  const useEmbed = Boolean(drivePreviewUrl || (!dataSource && safeSource));
  const playerSource = drivePreviewUrl || safeSource;
  const driveDownloadUrl = getDriveDownloadUrl(source);
  const maxPoints = material.maxPoints || 100;
  const assignmentOpen =
    !material.availableFrom ||
    Date.now() >= new Date(material.availableFrom).getTime();
  const assignmentPastDue = Boolean(
    material.dueAt && Date.now() > new Date(material.dueAt).getTime(),
  );
  const submissionDisabled =
    !assignmentOpen || (assignmentPastDue && !material.allowLateSubmissions);
  const unsupportedSubmissionFile =
    Boolean(selectedSubmission) &&
    !driveSubmission &&
    !isAudio &&
    !isVideo &&
    !isPdf &&
    !isImage;

  useEffect(() => {
    setSubmission(material.submission || null);
    setAvailableFrom(toDateTimeLocal(material.availableFrom));
    setDueAt(toDateTimeLocal(material.dueAt));
    setAllowLateSubmissions(material.allowLateSubmissions || false);
  }, [material]);

  useEffect(() => {
    setSelectedSubmissionId("");
    setStudentViewerTab("material");
  }, [material.id]);

  useEffect(() => {
    if (!teacherMode || !material.isAssignment || !classId) {
      setSubmissions([]);
      return;
    }
    let active = true;
    setSelectedSubmissionId("");
    setLoadingSubmissions(true);
    apiGet<{ data: AssignmentSubmission[] }>(
      `/classes/${classId}/materials/${material.id}/submissions`,
    )
      .then(({ data }) => {
        if (active) setSubmissions(data);
      })
      .catch((error) => {
        console.error("Could not load assignment submissions:", error);
        if (active) toast.error("Could not load assignment submissions.");
      })
      .finally(() => {
        if (active) setLoadingSubmissions(false);
      });
    return () => {
      active = false;
    };
  }, [classId, material.id, material.isAssignment, teacherMode]);

  useEffect(() => {
    setGrade(
      selectedSubmission?.grade == null ? "" : String(selectedSubmission.grade),
    );
    setFeedback(selectedSubmission?.feedback || "");
  }, [selectedSubmission]);

  async function submitAssignment(file: File | null, driveUrl: string) {
    if (!classId) return;
    const formData = new FormData();
    if (file) formData.append("file", file);
    else formData.append("driveUrl", driveUrl);
    setSubmitting(true);
    try {
      const response = await apiRequest<{ submission: AssignmentSubmission }>(
        `/classes/${classId}/materials/${material.id}/submissions`,
        { method: "POST", body: formData },
      );
      setSubmission(response.submission);
      setSelectedSubmissionId(response.submission.id);
      setStudentViewerTab("submissions");
      setSubmissionOpen(false);
      refreshApi(`/classes/${classId}/materials`);
      toast.success("Assignment submitted.");
    } catch (error) {
      console.error("Could not submit assignment:", error);
      const details = error as { message?: string };
      toast.error(details.message || "Could not submit your assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveGrade() {
    if (!classId || !selectedSubmission || grade === "") return;
    setSavingGrade(true);
    try {
      const response = await apiPut<{ submission: AssignmentSubmission }>(
        `/classes/${classId}/materials/${material.id}/submissions/${selectedSubmission.id}`,
        { grade: Number(grade), feedback },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === response.submission.id ? response.submission : item,
        ),
      );
      toast.success("Grade saved.");
    } catch (error) {
      console.error("Could not save assignment grade:", error);
      const details = error as { message?: string };
      toast.error(details.message || "Could not save the grade.");
    } finally {
      setSavingGrade(false);
    }
  }

  async function saveAssignmentSettings() {
    if (!classId || !availableFrom || !dueAt) {
      toast.warning("Set both the assignment start and due date.");
      return;
    }
    if (new Date(dueAt) < new Date(availableFrom)) {
      toast.warning("The due date must be on or after the start date.");
      return;
    }
    setSavingAssignment(true);
    try {
      const response = await apiPut<{ material: Material }>(
        `/classes/${classId}/materials/${material.id}`,
        {
          availableFrom: new Date(availableFrom).toISOString(),
          dueAt: new Date(dueAt).toISOString(),
          allowLateSubmissions,
        },
      );
      onMaterialUpdated?.(response.material);
      refreshApi(`/classes/${classId}/materials`);
      setEditingAssignment(false);
      toast.success("Assignment settings updated.");
    } catch (error) {
      console.error("Could not update assignment settings:", error);
      const details = error as { message?: string };
      toast.error(details.message || "Could not update the assignment.");
    } finally {
      setSavingAssignment(false);
    }
  }

  const handleMarkComplete = async () => {
    if (!onMarkComplete) return;
    setSaving(true);
    await onMarkComplete();
    setSaving(false);
  };

  const renderResource = () => {
    if (driveSubmission && selectedSubmission?.driveUrl) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center">
          <div>
            <p className="text-sm text-mute">
              Google Drive submissions are shown as links so you can open them
              with your Google account.
            </p>
            <a
              href={ensureAbsoluteUrl(selectedSubmission.driveUrl)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 break-all rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 underline"
            >
              Open student&apos;s Google submission{" "}
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          </div>
        </div>
      );
    }
    if (!source) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center">
          <p className="text-mute">
            This material does not have a document or media file attached.
          </p>
        </div>
      );
    }

    if (unsupportedSubmissionFile && selectedSubmission) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center">
          <div>
            <p className="text-mute">
              This file type cannot be previewed in the browser.
            </p>
            <a
              href={safeSource}
              download={selectedSubmission.fileName || undefined}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
            >
              <Download className="h-4 w-4" /> Download submission
            </a>
          </div>
        </div>
      );
    }

    if (isAudio && !drivePreviewUrl) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-line bg-slate-50 p-6">
          <div className="w-full max-w-2xl">
            <p className="mb-4 text-center text-sm font-medium text-mute">
              Audio player
            </p>
            <audio controls className="w-full" src={safeSource}>
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      );
    }

    if (isVideo && !drivePreviewUrl) {
      return (
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {material.kind === "Video Guide" &&
          !mimeType.startsWith("video/") &&
          !["mp4", "webm", "ogv"].includes(extension) ? (
            <iframe
              className="aspect-video w-full"
              src={safeSource}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={material.title}
            />
          ) : (
            <video controls className="max-h-[70vh] w-full" src={safeSource}>
              Your browser does not support video playback.
            </video>
          )}
        </div>
      );
    }

    if (isImage && dataSource) {
      return (
        <div className="grid min-h-64 place-items-center overflow-hidden rounded-xl border border-line bg-slate-50 p-4">
          <img
            src={dataSource}
            alt={material.title}
            className="max-h-[70vh] max-w-full object-contain"
          />
        </div>
      );
    }

    if (isPdf || useEmbed) {
      return (
        <div className="h-[65vh] min-h-96 overflow-hidden rounded-xl border border-line bg-slate-50">
          <iframe
            src={isPdf && drivePreviewUrl ? drivePreviewUrl : safeSource}
            title={`${material.title} viewer`}
            className="h-full w-full"
            allow="autoplay"
          />
        </div>
      );
    }

    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center">
        <div>
          <p className="text-mute">
            This file type cannot be previewed in the browser.
          </p>
          {dataSource && (
            <button
              type="button"
              onClick={() =>
                downloadDataUrl(
                  dataSource,
                  material.title || "learning-material",
                )
              }
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
            >
              <Download className="h-4 w-4" /> Download file
            </button>
          )}
          {safeSource && !dataSource && (
            <a
              href={safeSource}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
            >
              <ExternalLink className="h-4 w-4" /> Open file
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-p1 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Go Back to {className}
      </button>
      <div className="mb-4">
        <p className="text-xs font-medium text-mute">
          {className} · {selectedSubmission ? "Submission" : material.kind}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mt-1 text-xl font-semibold text-ink">
            {selectedSubmission
              ? teacherMode
                ? `${selectedSubmission.studentName || "Student"}’s submission`
                : "Your submission"
              : material.title}
          </h1>
          {material.isAssignment && (
            <span className="rounded-full bg-p1-soft px-2.5 py-1 text-xs font-semibold text-p1">
              Assignment
            </span>
          )}
        </div>
      </div>
      {!teacherMode && material.isAssignment && (
        <div
          className="mb-4 flex gap-1 border-b border-line"
          role="tablist"
          aria-label="Assignment material views"
        >
          {(
            [
              ["material", "Material"],
              ["submissions", "My submissions"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={studentViewerTab === tab}
              onClick={() => {
                setStudentViewerTab(tab);
                if (tab === "material") setSelectedSubmissionId("");
              }}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${
                studentViewerTab === tab
                  ? "border-[var(--p1)] text-p1"
                  : "border-transparent text-mute hover:border-line hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className={
          (teacherMode && material.isAssignment) || isStudentSubmissionView
            ? "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
            : "grid"
        }
      >
        <Card className="grid min-w-0 gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>
              {selectedSubmission
                  ? teacherMode
                    ? "Student submission"
                    : "Your submission"
                  : isAudio
                  ? "Audio player"
                  : isVideo
                    ? "Media player"
                    : "Document viewer"}
            </Label>
            <div className="flex items-center gap-3">
              {teacherMode && material.isAssignment && (
                <button
                  type="button"
                  onClick={() => setEditingAssignment(true)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-p1 hover:underline"
                >
                  <Pencil className="h-4 w-4" /> Edit assignment
                </button>
              )}
              {driveDownloadUrl && !driveSubmission && (
                <a
                  href={driveDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-p1 underline"
                >
                  <Download className="h-4 w-4" /> Download from Drive
                </a>
              )}
            </div>
          </div>
          {renderResource()}
          {selectedSubmission && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold">
                {selectedSubmission.studentName || "Student"}
              </p>
              <p className="mt-1 text-mute">
                Submitted{" "}
                {selectedSubmission.submittedAt
                  ? new Date(selectedSubmission.submittedAt).toLocaleString()
                  : "—"}
                {selectedSubmission.fileName
                  ? ` · ${selectedSubmission.fileName}`
                  : ""}
              </p>
            </div>
          )}
          {Array.isArray(material.files) &&
            material.files.map((file) => (
              <a
                key={file.url}
                href={ensureAbsoluteUrl(file.url)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-p1 underline"
              >
                Open {file.name}
              </a>
            ))}
          {Array.isArray(material.links) &&
            material.links.map((link) => (
              <a
                key={link.url}
                href={ensureAbsoluteUrl(link.url)}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-semibold text-p1 underline"
              >
                Open attached link
              </a>
            ))}
          {material.isAssignment && (
            <div className="grid gap-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Assignment</p>
                  <p className="mt-1 text-sm text-mute">
                    Opens:{" "}
                    {material.availableFrom
                      ? new Date(material.availableFrom).toLocaleString()
                      : "Immediately"}
                    {" · "}Due:{" "}
                    {material.dueAt
                      ? new Date(material.dueAt).toLocaleString()
                      : "No due date"}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    {material.allowLateSubmissions
                      ? "Late submissions are allowed"
                      : "Late submissions are not allowed"}
                  </p>
                </div>
                {!teacherMode && (
                  <button
                    type="button"
                    onClick={() => setSubmissionOpen(true)}
                    disabled={submissionDisabled || !classId}
                    className="rounded-full bg-p1 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submission ? "Resubmit" : "Turn in"}
                  </button>
                )}
              </div>
              {!teacherMode && submissionDisabled && (
                <p className="text-sm text-amber-700">
                  {!assignmentOpen
                    ? "This assignment is not open yet."
                    : "The due date has passed and late submissions are disabled."}
                </p>
              )}
              {!teacherMode && submission && (
                <div className="rounded-xl bg-p1-soft/30 p-3 text-sm">
                  <p className="font-semibold">
                    Submitted{" "}
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleString()
                      : ""}
                    {submission.grade != null &&
                      ` · Grade: ${submission.grade}/${maxPoints}`}
                  </p>
                  {submission.feedback && (
                    <p className="mt-1 whitespace-pre-wrap text-mute">
                      {submission.feedback}
                    </p>
                  )}
                  {submission.driveUrl && (
                    <a
                      href={ensureAbsoluteUrl(submission.driveUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 break-all font-semibold text-p1 underline"
                    >
                      View your Google submission{" "}
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
          {onMarkComplete && !material.isAssignment && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm text-mute">
                {completed
                  ? "You have marked this material as complete."
                  : "Finish reviewing this material, then mark it complete."}
              </p>
              <button
                type="button"
                onClick={() => void handleMarkComplete()}
                disabled={completed || saving}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${completed ? "bg-emerald-600" : "bg-p1"}`}
              >
                {saving
                  ? "Saving…"
                  : completed
                    ? "Completed"
                    : "Mark as Complete"}
              </button>
            </div>
          )}
        </Card>
        {((teacherMode && material.isAssignment) ||
          isStudentSubmissionView) && (
          <Card className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />{" "}
                  {teacherMode ? "Submissions" : "Your submissions"}
                </span>
              </Label>
              <span className="rounded-full bg-p1-soft px-2.5 py-1 text-xs font-semibold text-p1">
                {submissionItems.length}
              </span>
            </div>
            {teacherMode && loadingSubmissions ? (
              <p className="text-sm text-mute">Loading submissions…</p>
            ) : submissionItems.length === 0 ? (
              <p className="text-sm text-mute">
                {teacherMode
                  ? "No students have turned this in yet."
                  : "You have not submitted this assignment yet."}
              </p>
            ) : (
              <div className="grid max-h-80 gap-2 overflow-y-auto">
                {submissionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedSubmissionId((current) =>
                        current === item.id ? "" : item.id,
                      )
                    }
                    aria-pressed={selectedSubmissionId === item.id}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedSubmissionId === item.id
                        ? "border-[var(--p1)] bg-p1-soft/40"
                        : "border-line hover:border-p1/50"
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold">
                      {teacherMode
                        ? item.studentName || "Student"
                        : "Current submission"}
                    </span>
                    <span className="mt-1 block text-xs text-mute">
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleString()
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-p1">
                      {item.grade == null
                        ? "Not graded"
                        : `Grade: ${item.grade}/${maxPoints}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {teacherMode && selectedSubmission && (
              <div className="grid gap-3 border-t border-line pt-4">
                <p className="text-sm font-semibold">
                  Grade {selectedSubmission.studentName}
                </p>
                <label className="grid gap-1 text-sm font-medium">
                  Score (out of {maxPoints})
                  <input
                    type="number"
                    min="0"
                    max={maxPoints}
                    step="1"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-[var(--p1)]"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Feedback
                  <textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    rows={3}
                    maxLength={5000}
                    className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-[var(--p1)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveGrade()}
                  disabled={
                    savingGrade || grade === "" || Number(grade) > maxPoints
                  }
                  className="rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingGrade ? "Saving grade…" : "Save grade"}
                </button>
              </div>
            )}
          </Card>
        )}
      </div>
      {material.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-mute">
          {material.description}
        </p>
      )}
      {submissionOpen && (
        <AssignmentSubmissionModal
          title={material.title}
          maxFileSizeMb={material.maxUploadSizeMb || 8}
          submitting={submitting}
          onClose={() => setSubmissionOpen(false)}
          onSubmit={submitAssignment}
        />
      )}
      {editingAssignment && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-assignment-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <h2 id="edit-assignment-title" className="font-display text-2xl">
              Edit assignment
            </h2>
            <p className="mt-1 text-sm text-mute">
              Changes apply immediately to this posted assignment.
            </p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold">
                Opens
                <input
                  type="datetime-local"
                  value={availableFrom}
                  onChange={(event) => setAvailableFrom(event.target.value)}
                  required
                  className="rounded-xl border border-line px-3 py-2.5 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Due
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  required
                  className="rounded-xl border border-line px-3 py-2.5 font-normal"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allowLateSubmissions}
                  onChange={(event) =>
                    setAllowLateSubmissions(event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--p1)]"
                />
                Allow late submissions
              </label>
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(false)}
                  disabled={savingAssignment}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveAssignmentSettings()}
                  disabled={savingAssignment}
                  className="rounded-full bg-p1 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingAssignment ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
