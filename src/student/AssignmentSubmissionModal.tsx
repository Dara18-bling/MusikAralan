import { useState } from "react";
import { ExternalLink, UploadCloud, X } from "lucide-react";
import { ensureAbsoluteUrl, parseAndConvertMediaUrl } from "../utils/mediaUrlHelper";

interface AssignmentSubmissionModalProps {
  title: string;
  maxFileSizeMb: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (file: File | null, driveUrl: string) => Promise<void>;
}

function isGoogleLink(value: string) {
  try {
    const url = new URL(ensureAbsoluteUrl(value));
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "google.com" || host.endsWith(".google.com"))
    );
  } catch {
    return false;
  }
}

export function AssignmentSubmissionModal({
  title,
  maxFileSizeMb,
  submitting,
  onClose,
  onSubmit,
}: AssignmentSubmissionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [error, setError] = useState("");
  const normalizedDriveUrl = ensureAbsoluteUrl(driveUrl);
  const googleLink = Boolean(normalizedDriveUrl && isGoogleLink(normalizedDriveUrl));
  const preview = googleLink
    ? parseAndConvertMediaUrl(normalizedDriveUrl, "Module")
    : null;

  const chooseFile = (selected: File | null) => {
    setError("");
    if (selected && selected.size > maxFileSizeMb * 1024 * 1024) {
      setError(`Files must be ${maxFileSizeMb} MB or smaller. Use Google Drive for larger files.`);
      return;
    }
    setFile(selected);
    if (selected) setDriveUrl("");
  };

  const handleSubmit = async () => {
    if (!file && !normalizedDriveUrl) {
      setError("Choose a file or add a Google link.");
      return;
    }
    if (normalizedDriveUrl && !googleLink) {
      setError("Enter a Google Drive, Docs, Sheets, or Slides link.");
      return;
    }
    await onSubmit(file, normalizedDriveUrl);
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-submit-title"
        className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-p1">Assignment</p>
            <h2 id="assignment-submit-title" className="mt-1 font-display text-2xl">
              Turn in {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-full p-2 text-mute hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Upload a file</p>
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files[0] || null);
              }}
              className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--p1)]/30 bg-p1-soft/20 px-5 py-7 text-center hover:bg-p1-soft/40"
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,.odt,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.mov,.webm"
                onChange={(event) => chooseFile(event.target.files?.[0] || null)}
                className="sr-only"
              />
              <UploadCloud className="h-8 w-8 text-p1" />
              <span className="mt-2 text-sm font-semibold">
                {file ? file.name : "Drop your file here or browse"}
              </span>
              <span className="mt-1 text-xs text-mute">
                Maximum file size: {maxFileSizeMb} MB. Use Google Drive for larger files.
              </span>
            </label>
            {file && (
              <button
                type="button"
                onClick={() => chooseFile(null)}
                className="mt-2 text-xs font-semibold text-red-600 hover:underline"
              >
                Remove selected file
              </button>
            )}
          </div>

          <div>
            <label htmlFor="assignment-drive-url" className="text-sm font-semibold">
              Or submit a Google Drive link
            </label>
            <input
              id="assignment-drive-url"
              type="url"
              value={driveUrl}
              onChange={(event) => {
                setDriveUrl(event.target.value);
                if (event.target.value) setFile(null);
                setError("");
              }}
              placeholder="https://drive.google.com/..."
              className="mt-2 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-[var(--p1)]"
            />
            {googleLink && (
              <div className="mt-3 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold">Link preview</p>
                <p className="mt-1 text-xs text-mute">
                  Check that your teacher can access this link. Google does not expose
                  reliable public information about private or organization-restricted
                  sharing, so a preview here cannot verify every permission setting.
                </p>
                {preview?.provider !== "direct" ? (
                  <iframe
                    title="Google link preview"
                    src={preview?.streamUrl}
                    className="mt-3 h-64 w-full rounded-lg border border-line"
                    loading="lazy"
                  />
                ) : (
                  <a
                    href={normalizedDriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-p1 underline"
                  >
                    Preview in Google <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="rounded-full bg-p1 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit assignment"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
