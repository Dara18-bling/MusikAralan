import {
  FileSpreadsheet,
  FileText,
  Music2,
} from "lucide-react";
import { Card, Label } from "../../ui";
import type { ProcessedMedia, UploadKind } from "./types";

interface StudentPreviewProps {
  kind: UploadKind;
  processedMedia: ProcessedMedia;
  activeStreamUrl: string;
  fileDataUrl: string;
  selectedFile: File | null;
  isExcelFile: boolean;
}

export function StudentPreview({
  kind,
  processedMedia,
  activeStreamUrl,
  fileDataUrl,
  selectedFile,
  isExcelFile,
}: StudentPreviewProps) {
  return (
    <Card>
      <Label>Student preview</Label>
      <div className="mt-3 min-h-56 overflow-hidden rounded-xl bg-p1-soft">
        {processedMedia.provider === "youtube" && activeStreamUrl ? (
          <iframe
            className="h-80 w-full"
            src={activeStreamUrl}
            title="YouTube video preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : processedMedia.provider === "google_docs" && activeStreamUrl ? (
          <iframe
            className="h-80 w-full"
            src={activeStreamUrl}
            title="Google file preview"
            allow="autoplay"
          />
        ) : (kind === "Vocal Guide" || processedMedia.type === "audio") &&
          activeStreamUrl ? (
          <div className="grid min-h-56 place-items-center p-5 text-center">
            <div className="w-full">
              <Music2 className="mx-auto mb-2 h-12 w-12 text-p1" />
              <p className="mb-3 text-sm font-semibold">Vocal Guide Audio Stream</p>
              <audio className="w-full" src={activeStreamUrl} controls />
            </div>
          </div>
        ) : (kind === "Video Guide" || processedMedia.type === "video") &&
          activeStreamUrl ? (
          <div className="grid min-h-56 place-items-center p-2">
            <iframe
              className="h-80 w-full rounded-lg"
              src={activeStreamUrl}
              title="Video preview"
              allowFullScreen
            />
          </div>
        ) : fileDataUrl && selectedFile?.type.startsWith("image/") ? (
          <img
            className="max-h-96 w-full object-contain"
            src={fileDataUrl}
            alt={`Preview of ${selectedFile.name}`}
          />
        ) : fileDataUrl && selectedFile?.type === "application/pdf" ? (
          <iframe
            className="h-80 w-full"
            src={fileDataUrl}
            title="PDF preview"
          />
        ) : selectedFile && isExcelFile ? (
          <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-mute">
            <div>
              <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-p1" />
              <p className="font-semibold text-ink">
                Spreadsheet preview is unavailable
              </p>
              <p className="mt-1">
                The file can still be published and downloaded by students.
              </p>
            </div>
          </div>
        ) : activeStreamUrl ? (
          <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-mute">
            <div>
              <FileText className="mx-auto mb-2 h-10 w-10 text-p1" />
              <p className="font-semibold text-ink">External Media Ready</p>
              <a
                href={activeStreamUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block font-semibold text-p1 underline"
              >
                Open stream / preview ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-mute">
            Paste a link or select a file to preview it here.
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-mute">
        Media streams directly inside MusikAralan without requiring dedicated
        cloud storage buckets.
      </p>
    </Card>
  );
}
