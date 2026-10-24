import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Music2,
  Presentation,
  Video,
} from "lucide-react";
import type { UploadKind } from "./types";

export const UPLOAD_KINDS: UploadKind[] = [
  "Module",
  "Vocal Guide",
  "Video Guide",
  "Others",
];

export function getLinkPlaceholder(kind: UploadKind) {
  switch (kind) {
    case "Vocal Guide":
      return "Paste Google Drive audio link (e.g. choir guide track MP3) or direct audio URL";
    case "Video Guide":
      return "Paste YouTube video link or Google Drive rehearsal link";
    case "Module":
      return "Paste Google Drive PDF, Google Docs, Slides, or public link";
    case "Others":
      return "Paste Google Sheets, Google Drive, or resource link";
  }
}

export function getFileIcon(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.startsWith("video/")) return Video;
  if (file.type.startsWith("audio/")) return Music2;
  if (["xls", "xlsx", "csv", "ods"].includes(extension || "")) {
    return FileSpreadsheet;
  }
  if (extension === "ppt" || extension === "pptx") return Presentation;
  return FileText;
}
