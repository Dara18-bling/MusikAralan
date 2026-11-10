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
  "Sheet Music"
];

const EXTENSION_KIND: Record<string, UploadKind> = {
  aac: "Vocal Guide",
  aif: "Vocal Guide",
  aiff: "Vocal Guide",
  flac: "Vocal Guide",
  m4a: "Vocal Guide",
  mp3: "Vocal Guide",
  oga: "Vocal Guide",
  ogg: "Vocal Guide",
  wav: "Vocal Guide",
  wma: "Vocal Guide",
  mov: "Video Guide",
  mp4: "Video Guide",
  mpeg: "Video Guide",
  mpg: "Video Guide",
  ogv: "Video Guide",
  webm: "Video Guide",
  "3gp": "Video Guide",
  "3g2": "Video Guide",
  doc: "Module",
  docx: "Module",
  odt: "Module",
  ppt: "Module",
  pptx: "Module",
  rtf: "Module",
  txt: "Module",
  xls: "Module",
  xlsx: "Module",
  ods: "Module",
  csv: "Module",
};

export function isSheetMusicFile(fileName: string) {
  return ["pdf", "png", "jpg", "jpeg"].includes(getExtension(fileName));
}

function getExtension(resource: string) {
  let path = resource.trim();

  // Extract the pathname only when the resource is a URL.
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = path.split(/[?#]/, 1)[0];
    }
  } else {
    // Handle ordinary filenames and local file paths.
    path = path.split(/[?#]/, 1)[0];
  }

  const fileName = path.split(/[\\/]/).pop() || "";
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];

  return extension?.toLowerCase() || "";
}

export function getUploadKindFromResource(resource: string): UploadKind {
  const normalized = resource.trim();
  const extension = getExtension(normalized);
  if (EXTENSION_KIND[extension]) return EXTENSION_KIND[extension];

  if (/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(normalized)) {
    return "Video Guide";
  }
  if (/docs\.google\.com\/(document|presentation)\//i.test(normalized)) {
    return "Module";
  }
  return "Module";
}

export function isSpreadsheetFile(fileName: string) {
  return ["xls", "xlsx", "csv", "ods"].includes(getExtension(fileName));
}

export function getLinkPlaceholder(kind: UploadKind) {
  switch (kind) {
    case "Vocal Guide":
      return "Paste Google Drive audio link (e.g. choir guide track MP3) or direct audio URL";
    case "Video Guide":
      return "Paste YouTube video link or Google Drive rehearsal link";
    case "Module":
      return "Paste Google Drive PDF, Google Docs, Slides, or public link";
    case "Sheet Music":
      return "Paste a sheet music PDF or image link";
  }
}

export function getFileIcon(file: File) {
  const extension = getExtension(file.name);
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.startsWith("video/")) return Video;
  if (file.type.startsWith("audio/")) return Music2;
  if (isSpreadsheetFile(file.name)) {
    return FileSpreadsheet;
  }
  if (extension === "ppt" || extension === "pptx") return Presentation;
  return FileText;
}
