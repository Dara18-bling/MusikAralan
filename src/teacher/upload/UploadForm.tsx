import {
  Check,
  Link as LinkIcon,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Btn, Card, Input } from "../../ui";
import type { ProcessedMedia, UploadKind } from "./types";
import { getFileIcon, getLinkPlaceholder, UPLOAD_KINDS } from "./uploadUtils";

interface UploadFormProps {
  kind: UploadKind;
  setKind: (kind: UploadKind) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  mediaUrlInput: string;
  setMediaUrlInput: (value: string) => void;
  selectedFile: File | null;
  fileError: string;
  processedMedia: ProcessedMedia;
  publishing: boolean;
  onFileChange: (files: FileList | null) => void;
  onRemoveFile: () => void;
  onPublish: () => void;
  onKindChange: () => void;
}

export function UploadForm({
  kind,
  setKind,
  title,
  setTitle,
  description,
  setDescription,
  mediaUrlInput,
  setMediaUrlInput,
  selectedFile,
  fileError,
  processedMedia,
  publishing,
  onFileChange,
  onRemoveFile,
  onPublish,
  onKindChange,
}: UploadFormProps) {
  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        {UPLOAD_KINDS.map((uploadKind) => (
          <button
            key={uploadKind}
            type="button"
            onClick={() => {
              setKind(uploadKind);
              onKindChange();
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              kind === uploadKind
                ? "grad text-white"
                : "bg-p1-soft text-p1 hover:bg-p1-soft/70"
            }`}
          >
            {uploadKind}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">
          Title
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter a title"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={`Describe this ${kind.toLowerCase()}`}
            className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[var(--p1)]"
          />
        </label>

        <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LinkIcon className="h-4 w-4 text-p1" />
            Media / Streaming Link (Google Drive, YouTube, Docs, Sheets)
          </label>
          <p className="mt-1 text-xs text-mute">
            Paste any shared link. The system automatically converts it into a
            direct stream for students.
          </p>
          <div className="mt-2">
            <Input
              type="url"
              value={mediaUrlInput}
              onChange={(event) => setMediaUrlInput(event.target.value)}
              placeholder={getLinkPlaceholder(kind)}
              className="bg-white"
            />
          </div>
          {processedMedia.provider !== "direct" && mediaUrlInput && (
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Recognized {processedMedia.provider.replace("_", " ")} (
              {processedMedia.type}) stream ready
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-ink">
            Or attach small file directly (&lt; 800 KB)
          </label>
          {!selectedFile ? (
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onFileChange(event.dataTransfer.files);
              }}
              className="staff grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--p1)]/30 bg-p1-soft/30 px-6 py-4 text-center transition hover:bg-p1-soft/50"
            >
              <input
                type="file"
                onChange={(event) => onFileChange(event.target.files)}
                className="hidden"
              />
              <UploadCloud className="h-8 w-8 text-p1" strokeWidth={1.5} />
              <span className="mt-1 text-sm font-semibold text-ink">
                Drop score or worksheet here or browse
              </span>
              <span className="text-xs text-mute">
                PDF, image, audio, or document (max 800 KB). For larger
                rehearsal tracks, paste a Google Drive link above.
              </span>
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-p1 bg-p1-soft/30 px-4 py-2.5">
              <div className="flex items-center gap-3">
                {(() => {
                  const FileIcon = getFileIcon(selectedFile);
                  return <FileIcon className="h-5 w-5 text-p1" />;
                })()}
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-mute">
                    {(selectedFile.size / 1024).toFixed(0)} KB · Ready to save
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRemoveFile}
                className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50"
                title="Remove file"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          {fileError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {fileError}
            </p>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <Btn onClick={onPublish} disabled={publishing}>
            {publishing ? "Publishing to class…" : "Publish to class"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
