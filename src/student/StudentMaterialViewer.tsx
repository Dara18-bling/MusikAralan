import { useState } from "react";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { Card, Label, Title } from "../ui";
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
  material: Material;
  completed: boolean;
  onBack: () => void;
  onMarkComplete: () => Promise<boolean>;
}

function getFileExtension(url: string) {
  return url.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "";
}

export function StudentMaterialViewer({
  className,
  material,
  completed,
  onBack,
  onMarkComplete,
}: StudentMaterialViewerProps) {
  const [saving, setSaving] = useState(false);
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

  const handleMarkComplete = async () => {
    setSaving(true);
    await onMarkComplete();
    setSaving(false);
  };

  const renderResource = () => {
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
        {renderResource()}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-mute">
            {completed ? "You have marked this material as complete." : "Finish reviewing this material, then mark it complete."}
          </p>
          <button
            type="button"
            onClick={() => void handleMarkComplete()}
            disabled={completed || saving}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${completed ? "bg-emerald-600" : "bg-p1"}`}
          >
            {saving ? "Saving…" : completed ? "Completed" : "Mark as Complete"}
          </button>
        </div>
      </Card>
    </>
  );
}
