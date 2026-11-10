import { Check, X, Link as LinkIcon, Trash2, UploadCloud } from "lucide-react";
import { Btn, Card, Input } from "../../ui";
import type { ProcessedMedia, UploadKind } from "./types";
import { getFileIcon, getLinkPlaceholder, isSheetMusicFile, UPLOAD_KINDS } from "./uploadUtils";

interface UploadFormProps {
  kind: UploadKind;
  setKind: (kind: UploadKind) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  deadlineMode: "none" | "set";
  setDeadlineMode: (value: "none" | "set") => void;
  deadlineDate: string;
  setDeadlineDate: (value: string) => void;
  deadlineHour: string;
  setDeadlineHour: (value: string) => void;
  deadlineMinute: string;
  setDeadlineMinute: (value: string) => void;
  deadlinePeriod: "AM" | "PM";
  setDeadlinePeriod: (value: "AM" | "PM") => void;
  minimumDeadlineDate: string;
  deadlineIsPast: boolean;
  submissionMode: "review" | "submit";
  setSubmissionMode: (value: "review" | "submit") => void;
  maxGrade: string;
  setMaxGrade: (value: string) => void;
  mediaUrlInput: string;
  onMediaUrlInput: (value: string) => void;
  selectedFile: File | null;
  fileError: string;
  processedMedia: ProcessedMedia;
  publishing: boolean;
  onFileChange: (files: FileList | null) => void;
  onRemoveFile: () => void;
  onPublish: () => void;
}

export function UploadForm({
  kind,
  setKind,
  title,
  setTitle,
  description,
  setDescription,
  deadlineMode,
  setDeadlineMode,
  deadlineDate,
  setDeadlineDate,
  deadlineHour,
  setDeadlineHour,
  deadlineMinute,
  setDeadlineMinute,
  deadlinePeriod,
  setDeadlinePeriod,
  minimumDeadlineDate,
  deadlineIsPast,
  submissionMode,
  setSubmissionMode,
  maxGrade,
  setMaxGrade,
  mediaUrlInput,
  onMediaUrlInput,
  selectedFile,
  fileError,
  processedMedia,
  publishing,
  onFileChange,
  onRemoveFile,
  onPublish,
}: UploadFormProps) {
  const hasAttachedResource = Boolean(selectedFile || mediaUrlInput.trim());
  const canSelectSheetMusic = Boolean(
    selectedFile &&
      !mediaUrlInput.trim() &&
      isSheetMusicFile(selectedFile.name),
  );

  return (
    <Card>
      <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <LinkIcon className="h-4 w-4 text-p1" />
          Media / Streaming Link (Google Drive, YouTube, Docs, Sheets)
        </label>
        <p className="mt-1 text-xs text-mute">
          Paste any shared link. The system converts it into a direct stream for
          students.
        </p>
        <div className="mt-2">
          <Input
            type="url"
            value={mediaUrlInput}
            onChange={(event) => onMediaUrlInput(event.target.value)}
            placeholder={getLinkPlaceholder(kind)}
            className="bg-white"
          />
          {mediaUrlInput && (
            <button
              type="button"
              onClick={() => onMediaUrlInput("")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-p1"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Remove link
            </button>
          )}
        </div>
        {processedMedia.provider !== "direct" && mediaUrlInput && (
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Recognized {processedMedia.provider.replace("_", " ")} (
            {processedMedia.type}) stream ready
          </div>
        )}
      </div>

      <div className="grid gap-2 my-4">
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
              accept={
                kind === "Sheet Music"
                  ? ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  : undefined
              }
              onChange={(event) => onFileChange(event.target.files)}
              className="hidden"
            />
            <UploadCloud className="h-8 w-8 text-p1" strokeWidth={1.5} />
            <span className="mt-1 text-sm font-semibold text-ink">
              Drop score or worksheet here or browse
            </span>
            <span className="text-xs text-mute">
              PDF, image, audio, or document (max 800 KB). For larger rehearsal
              tracks, paste a Google Drive link above.
            </span>
          </label>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-p1 bg-p1-soft/30 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              {(() => {
                const FileIcon = getFileIcon(selectedFile);
                return <FileIcon className="h-5 w-5 text-p1" />;
              })()}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  <span className="break-all">{selectedFile.name}</span>
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

      <div className="flex flex-wrap gap-2">
        {UPLOAD_KINDS.map((uploadKind) => (
          <button
            key={uploadKind}
            type="button"
            onClick={() => setKind(uploadKind)}
            disabled={
              hasAttachedResource &&
              uploadKind !== kind &&
              !(uploadKind === "Sheet Music" && canSelectSheetMusic)
            }
            aria-pressed={kind === uploadKind}
            title={
              hasAttachedResource &&
              uploadKind !== kind &&
              !(uploadKind === "Sheet Music" && canSelectSheetMusic)
                ? "Remove the attached file or link before changing its category."
                : undefined
            }
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              kind === uploadKind
                ? "grad text-white"
                : "bg-p1-soft text-p1 hover:bg-p1-soft/70 disabled:cursor-not-allowed disabled:opacity-50"
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

        <fieldset className="grid min-w-0 gap-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Material deadline</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Material deadline option">
            {([ ["none", "No deadline"], ["set", "Set deadline"] ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={deadlineMode === mode}
                onClick={() => setDeadlineMode(mode)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${deadlineMode === mode ? "grad text-white" : "border border-line hover:bg-p1-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {deadlineMode === "set" && (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
                Date
                <Input type="date" required min={minimumDeadlineDate} value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} className="min-w-0 text-base sm:text-sm" />
              </label>
              <div className="grid min-w-0 gap-1.5 text-sm font-semibold">
                <span>Time</span>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <select aria-label="Deadline hour" value={deadlineHour} onChange={(event) => setDeadlineHour(event.target.value)} className="min-w-0 rounded-xl border border-line bg-white px-2 py-2.5 text-base sm:text-sm">
                    {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                  </select>
                  <select aria-label="Deadline minute" value={deadlineMinute} onChange={(event) => setDeadlineMinute(event.target.value)} className="min-w-0 rounded-xl border border-line bg-white px-2 py-2.5 text-base sm:text-sm">
                    {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                  </select>
                  <select aria-label="AM or PM" value={deadlinePeriod} onChange={(event) => setDeadlinePeriod(event.target.value as "AM" | "PM")} className="min-w-0 rounded-xl border border-line bg-white px-2 py-2.5 text-base sm:text-sm">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          {deadlineMode === "set" && (
            <p className={`text-xs ${deadlineIsPast ? "font-semibold text-red-600" : "text-mute"}`} role={deadlineIsPast ? "alert" : undefined}>
              {deadlineIsPast
                ? "This time has already passed. Choose a future date and time; past deadlines cannot be set."
                : "Choose today or a future date and time. If the selected time has already passed, you cannot set it as a deadline."}
            </p>
          )}
        </fieldset>

        <fieldset className="grid min-w-0 gap-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Student requirement</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Choose how students should use this material">
            {([ ["review", "Review only"], ["submit", "Submit requirements"] ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={submissionMode === mode}
                onClick={() => setSubmissionMode(mode)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${submissionMode === mode ? "border-[var(--p1)] bg-p1-soft text-p1" : "border-line hover:bg-p1-soft/60"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-mute">
            {submissionMode === "submit"
              ? "Students must attach a file before they can mark this material complete. Teachers can download and grade each submission."
              : "Students review this material without submitting an assignment."}
          </p>
          {submissionMode === "submit" && (
            <label className="grid max-w-xs gap-1.5 text-sm font-semibold">
              Maximum grade (points)
              <Input type="number" min={1} max={1000} step={1} required value={maxGrade} onChange={(event) => setMaxGrade(event.target.value)} className="text-base sm:text-sm" />
              <span className="text-xs font-normal text-mute">Teachers will grade each submission from 0 to {maxGrade || "…"} points.</span>
            </label>
          )}
        </fieldset>

        <div className="mt-2 flex gap-2">
          <Btn onClick={onPublish} disabled={publishing}>
            {publishing ? "Publishing to class…" : "Publish to class"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
