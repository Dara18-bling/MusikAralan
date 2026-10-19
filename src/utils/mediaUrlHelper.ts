export interface ProcessedMedia {
  mediaUrl: string;
  streamUrl: string;
  provider: "google_drive" | "youtube" | "google_docs" | "direct" | "data_url";
  type: "audio" | "video" | "pdf" | "spreadsheet" | "document" | "generic";
}

/**
 * Ensures a URL starts with https:// if it is a domain without protocol,
 * preventing browser relative route navigation within single-page apps.
 */
export function ensureAbsoluteUrl(url?: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // If it's a domain-like string (e.g. drive.google.com/..., youtube.com/...)
  if (trimmed.includes(".") && !trimmed.startsWith("/")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isDataUrl(url?: string): boolean {
  return typeof url === "string" && url.trim().startsWith("data:");
}

export function getDriveFileId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  return match ? match[1] : null;
}

export function getDriveDownloadUrl(url?: string): string | null {
  const fileId = getDriveFileId(url);
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null;
}

/**
 * Triggers a native browser file download for a Base64 data URL.
 */
export function downloadDataUrl(dataUrl: string, defaultFilename: string) {
  if (!isDataUrl(dataUrl)) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  
  // Detect extension from mime type if not present
  let filename = defaultFilename || "learning-module";
  if (!filename.includes(".")) {
    if (dataUrl.startsWith("data:application/pdf")) filename += ".pdf";
    else if (dataUrl.startsWith("data:audio/mpeg")) filename += ".mp3";
    else if (dataUrl.startsWith("data:image/png")) filename += ".png";
    else if (dataUrl.startsWith("data:image/jpeg")) filename += ".jpg";
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function parseAndConvertMediaUrl(inputUrl: string, kind?: string): ProcessedMedia {
  const url = ensureAbsoluteUrl(inputUrl);
  if (!url) {
    return { mediaUrl: "", streamUrl: "", provider: "direct", type: "generic" };
  }

  // 1. YouTube links
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      mediaUrl: url,
      streamUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      provider: "youtube",
      type: "video",
    };
  }

  // 2. Google Drive links (Audio or Document/Video)
  const driveFileMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (driveFileMatch) {
    const fileId = driveFileMatch[1];
    const isAudio = kind === "Vocal Guide" || /\.(mp3|wav|m4a|aac|ogg)$/i.test(url);
    return {
      mediaUrl: url,
      streamUrl: isAudio
        ? `https://drive.google.com/uc?export=download&id=${fileId}`
        : `https://drive.google.com/file/d/${fileId}/preview`,
      provider: "google_drive",
      type: isAudio ? "audio" : "generic",
    };
  }

  // 3. Google Docs / Sheets / Slides
  const docsMatch = url.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
  if (docsMatch) {
    const docType = docsMatch[1];
    const docId = docsMatch[2];
    let streamUrl = url;
    if (docType === "presentation") streamUrl = `https://docs.google.com/presentation/d/${docId}/embed`;
    else if (docType === "spreadsheets") streamUrl = `https://docs.google.com/spreadsheets/d/${docId}/preview`;
    else streamUrl = `https://docs.google.com/document/d/${docId}/preview`;

    return {
      mediaUrl: url,
      streamUrl,
      provider: "google_docs",
      type: docType === "spreadsheets" ? "spreadsheet" : "document",
    };
  }

  // 4. Data URL (Base64)
  if (url.startsWith("data:")) {
    const isAudio = url.startsWith("data:audio/");
    const isVideo = url.startsWith("data:video/");
    const isPdf = url.startsWith("data:application/pdf");
    return {
      mediaUrl: url,
      streamUrl: url,
      provider: "data_url",
      type: isAudio ? "audio" : isVideo ? "video" : isPdf ? "pdf" : "generic",
    };
  }

  // 5. Direct URLs
  const isAudio = kind === "Vocal Guide" || /\.(mp3|wav|m4a|aac|ogg)$/i.test(url);
  const isVideo = kind === "Video Guide" || /\.(mp4|webm|ogv)$/i.test(url);
  const isPdf = /\.(pdf)$/i.test(url);

  return {
    mediaUrl: url,
    streamUrl: url,
    provider: "direct",
    type: isAudio ? "audio" : isVideo ? "video" : isPdf ? "pdf" : "generic",
  };
}
