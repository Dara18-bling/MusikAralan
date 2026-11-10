import { useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Music2, UploadCloud } from "lucide-react";
import { Card, Label, Title } from "../ui";
import { apiGet, apiRequest } from "../api";
import { formatPhilippineDateTime } from "../utils/dateTime";
import { PianoTester } from "./PianoTester";
import SheetMusicNotation from "./SheetMusicNotation";
import SheetMusicPlayback from "./SheetMusicPlayback";
import type { Material } from "./StudentClassWorkspace";
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
  completed?: boolean;
  onMarkComplete?: () => Promise<boolean>;
}

function getFileExtension(url: string) {
  return url.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "";
}

export function StudentMaterialViewer({
  className,
  classId,
  material,
  onBack,
  completed = false,
  onMarkComplete,
}: StudentMaterialViewerProps) {
  const [saving, setSaving] = useState(false);
  const [showPiano, setShowPiano] = useState(false);
  const [submission, setSubmission] = useState<{ fileName: string; submittedAt: string; grade: number | null; feedback: string | null } | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const canSubmitAssignment = Boolean(onMarkComplete);
  const source = material.streamUrl || material.mediaUrl || "";
  const dataSource = [material.streamUrl, material.mediaUrl].find(
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
    material.kind === "Vocal Guide" ||
    mimeType.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "aac", "ogg"].includes(extension);
  const isVideo =
    material.kind === "Video Guide" ||
    mimeType.startsWith("video/") ||
    ["mp4", "webm", "ogv"].includes(extension);
  const isPdf = mimeType === "application/pdf" || extension === "pdf";
  const isImage = mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(extension);
  const useEmbed = Boolean(drivePreviewUrl || (!dataSource && safeSource));
  const playerSource = drivePreviewUrl || safeSource;
  const driveDownloadUrl = getDriveDownloadUrl(source);

  useEffect(() => {
    if (!classId || !material.requiresSubmission || !canSubmitAssignment) return;
    let active = true;
    setSubmission(null);
    setSubmissionError("");
    void apiGet<{ data: { fileName: string; submittedAt: string; grade: number | null; feedback: string | null }[] }>(
      `/classes/${classId}/materials/${material.id}/submissions`,
    ).then(({ data }) => {
      if (active) setSubmission(data[0] || null);
    }).catch((error: unknown) => {
      console.error("Could not load assignment submission:", error);
      if (active) setSubmissionError("Could not load your submission status.");
    });
    return () => { active = false; };
  }, [classId, material.id, material.requiresSubmission, canSubmitAssignment]);

  const handleMarkComplete = async () => {
    if (!onMarkComplete) return;
    setSaving(true);
    await onMarkComplete();
    setSaving(false);
  };

  const submitAssignment = async () => {
    if (!classId || !submissionFile) return;
    setSubmissionBusy(true);
    setSubmissionError("");
    const formData = new FormData();
    formData.append("file", submissionFile);
    try {
      const { submission: saved } = await apiRequest<{ submission: { fileName: string; submittedAt: string; grade: number | null; feedback: string | null } }>(
        `/classes/${classId}/materials/${material.id}/submissions`,
        { method: "POST", body: formData },
      );
      setSubmission(saved);
      setSubmissionFile(null);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not submit this file.");
    } finally {
      setSubmissionBusy(false);
    }
  };

  const renderResource = () => {
    // Display recognized musical notation for sheet music.
    // The original uploaded file remains available below.
    if (material.kind === "Sheet Music" && classId) {
      return (
        <div className="grid gap-5">
          <section className="grid gap-3">
            <h2 className="font-semibold text-ink">
              Recognized Sheet Music
            </h2>

            <SheetMusicNotation
              classId={classId}
              materialId={material.id}
              notationStatus={material.notationStatus}
            />
            <SheetMusicPlayback
              classId={classId}
              materialId={material.id}
              notationStatus={material.notationStatus}
            />
          </section>

          {source && (
            <details className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-semibold text-p1">
                View original uploaded file
              </summary>

              <div className="mt-4">
                {isPdf || useEmbed ? (
                  <div className="h-[65vh] min-h-96 overflow-hidden rounded-xl border border-line bg-slate-50">
                    <iframe
                      src={drivePreviewUrl || safeSource}
                      title={`${material.title} original file`}
                      className="h-full w-full"
                      allow="autoplay"
                    />
                  </div>
                ) : (
                  <a
                    href={safeSource}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-p1 underline"
                  >
                    Open original uploaded file
                  </a>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }
    if (!source) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-slate-50 p-8 text-center">
          <p className="text-mute">This material does not have a document or media file attached.</p>
        </div>
      );
    }

    if (isAudio && !drivePreviewUrl) {
      return (
        <div className="grid min-h-64 place-items-center rounded-xl border border-line bg-slate-50 p-6">
          <div className="w-full max-w-2xl">
            <p className="mb-4 text-center text-sm font-medium text-mute">Audio player</p>
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
          {material.kind === "Video Guide" && !mimeType.startsWith("video/") && !["mp4", "webm", "ogv"].includes(extension) ? (
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
          <img src={dataSource} alt={material.title} className="max-h-[70vh] max-w-full object-contain" />
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
          <p className="text-mute">This file type cannot be previewed in the browser.</p>
          {dataSource && (
            <button
              type="button"
              onClick={() => downloadDataUrl(dataSource, material.title || "learning-material")}
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
      <Title
        kicker={`${className} · ${material.kind}`}
        title={material.title}
        sub={material.description}
      />
      {material.teacherName && (
        <p className="-mt-3 mb-5 text-sm text-mute">Uploaded by {material.teacherName}</p>
      )}
      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>{isAudio ? "Audio player" : isVideo ? "Media player" : "Document viewer"}</Label>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              aria-expanded={showPiano}
              onClick={() => setShowPiano((visible) => !visible)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--p1)] px-3 py-1.5 text-sm font-semibold text-p1 transition hover:bg-p1-soft"
            >
              <Music2 className="h-4 w-4" aria-hidden="true" />
              {showPiano ? "Close piano" : "Open piano"}
            </button>
            {driveDownloadUrl && (
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
        {showPiano ? (
          <div className="grid min-w-0 gap-5">
            <div className="min-w-0">{renderResource()}</div>
            <PianoTester />
          </div>
        ) : renderResource()}
        {Array.isArray(material.files) && material.files.map((file) => (
          <a key={file.url} href={ensureAbsoluteUrl(file.url)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-p1 underline">
            Open {file.name}
          </a>
        ))}
        {Array.isArray(material.links) && material.links.map((link) => (
          <a key={link.url} href={ensureAbsoluteUrl(link.url)} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-p1 underline">
            Open attached link
          </a>
        ))}
        {material.requiresSubmission && onMarkComplete && classId && (
          <section className="grid gap-3 rounded-2xl border border-p1/30 bg-p1-soft/30 p-4" aria-labelledby="assignment-submission-title">
            <div>
              <h2 id="assignment-submission-title" className="font-semibold">Assignment submission required</h2>
              <p className="mt-1 text-sm text-mute">Attach your completed work in any file format. Maximum file size: 50 MB. This assignment is worth {material.maxGrade || 100} points.</p>
            </div>
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
              Choose a file
              <input key={submission?.submittedAt || "new-submission"} type="file" onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)} className="block w-full min-w-0 rounded-xl border border-line bg-white p-2 text-sm" />
            </label>
            {submissionFile && <p className="break-all text-sm text-mute">Selected: {submissionFile.name} ({(submissionFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
            <button type="button" onClick={() => void submitAssignment()} disabled={!submissionFile || submissionBusy || submissionFile.size > 50 * 1024 * 1024} className="inline-flex w-fit items-center gap-2 rounded-full bg-p1 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              {submissionBusy ? "Submitting…" : submission ? "Replace submitted file" : "Submit assignment"}
            </button>
            {submissionFile && submissionFile.size > 50 * 1024 * 1024 && <p role="alert" className="text-sm text-red-600">Files must be 50 MB or smaller.</p>}
            {submission && <div className="rounded-xl bg-white/70 p-3 text-sm">
              <p className="break-all font-semibold">Submitted: {submission.fileName}</p>
              <p className="mt-1 text-mute">{formatPhilippineDateTime(submission.submittedAt)}</p>
              {submission.grade !== null && <p className="mt-2 font-semibold">Grade: {submission.grade}/{material.maxGrade || 100}</p>}
              {submission.feedback && <p className="mt-1 whitespace-pre-wrap">Teacher feedback: {submission.feedback}</p>}
            </div>}
            {submissionError && <p role="alert" className="text-sm text-red-600">{submissionError}</p>}
          </section>
        )}
        {onMarkComplete && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-mute">
              {completed ? "You have marked this material as complete." : material.requiresSubmission && !submission ? "Submit your assignment before marking this material complete." : "Finish reviewing this material, then mark it complete."}
            </p>
            <button
              type="button"
              onClick={() => void handleMarkComplete()}
              disabled={completed || saving || Boolean(material.requiresSubmission && !submission)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${completed ? "bg-emerald-600" : "bg-p1"}`}
            >
              {saving ? "Saving…" : completed ? "Completed" : "Mark as Complete"}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
