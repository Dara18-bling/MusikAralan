import { useEffect, useState } from "react";
import { Check, Edit2, FileSpreadsheet, FileText, Image as ImageIcon, Music2, Presentation, Trash2, UploadCloud, Video, Link as LinkIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { apiPost } from "../api";
import { Btn, Card, Input, Label, Title } from "../ui";
import { parseAndConvertMediaUrl, ensureAbsoluteUrl } from "../utils/mediaUrlHelper";

interface UploadProps {
  className?: string;
  classId?: string;
  teacherName?: string;
}

export function Upload({ className, classId, teacherName }: UploadProps) {
  const [kind, setKind] = useState("Module");
  const [titlesByKind, setTitlesByKind] = useState<Record<string, string>>({
    Module: "Psalm 95 — Kung marinig n'yo ang Kanyang tinig",
  });
  const [descriptionsByKind, setDescriptionsByKind] = useState<Record<string, string>>({});
  const [mediaUrlsByKind, setMediaUrlsByKind] = useState<Record<string, string>>({});

  const title = titlesByKind[kind] || "";
  const description = descriptionsByKind[kind] || "";
  const mediaUrlInput = mediaUrlsByKind[kind] || "";

  const setTitle = (value: string) => setTitlesByKind((current) => ({ ...current, [kind]: value }));
  const setDescription = (value: string) => setDescriptionsByKind((current) => ({ ...current, [kind]: value }));
  const setMediaUrlInput = (value: string) => setMediaUrlsByKind((current) => ({ ...current, [kind]: value }));

  // Attached files and local base64/data previews
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>("");
  const [fileError, setFileError] = useState("");

  // Spreadsheet preview state
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{ file: File; sheets: { name: string; rows: unknown[][] }[] } | null>(null);
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);
  const [activeSpreadsheetSheet, setActiveSpreadsheetSheet] = useState("");

  const [publishing, setPublishing] = useState(false);
  const [recent, setRecent] = useState([
    { id: 1, title: "Ledger Lines Worksheet", kind: "Module", date: "Yesterday" },
  ]);

  // Derived media preview using our parser utility
  const processedMedia = parseAndConvertMediaUrl(mediaUrlInput, kind);
  const activeStreamUrl = fileDataUrl || processedMedia.streamUrl;

  const isExcelFile = kind === "Others" && /\.xlsx?$/i.test(selectedFile?.name || "");

  // Spreadsheet parser for local Excel preview
  useEffect(() => {
    if (!selectedFile || !isExcelFile) {
      setSpreadsheetPreview(null);
      setSpreadsheetLoading(false);
      setActiveSpreadsheetSheet("");
      return;
    }
    let active = true;
    setSpreadsheetLoading(true);
    void selectedFile.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheets = workbook.SheetNames.map((name: string) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "" }),
      }));
      if (active) {
        setSpreadsheetPreview({ file: selectedFile, sheets });
        setActiveSpreadsheetSheet(sheets[0]?.name || "");
      }
    }).catch((error) => {
      console.error("Could not preview spreadsheet:", error);
      if (active) setSpreadsheetPreview({ file: selectedFile, sheets: [] });
    }).finally(() => {
      if (active) setSpreadsheetLoading(false);
    });
    return () => { active = false; };
  }, [selectedFile, isExcelFile]);

  // Handle local file selection
  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileError("");

    // Keep data URLs small enough for a single API request.
    if (file.size > 800 * 1024) {
      setFileError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Files must be 800 KB or smaller; for larger files, paste a share link below.`
      );
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }

    setSelectedFile(file);

    // Read small file into Data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFileDataUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setFileError("Could not read file. Please try pasting a link instead.");
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileDataUrl("");
    setFileError("");
  };

  // Get helpful placeholder depending on kind
  const getLinkPlaceholder = () => {
    switch (kind) {
      case "Vocal Guide":
        return "Paste Google Drive audio link (e.g. choir guide track MP3) or direct audio URL";
      case "Video Guide":
        return "Paste YouTube video link or Google Drive rehearsal link";
      case "Module":
        return "Paste Google Drive PDF, Google Docs, Slides, or public link";
      case "Others":
        return "Paste Google Sheets, Google Drive, or resource link";
      default:
        return "Paste Google Drive, YouTube, or web link";
    }
  };

  const getFileIcon = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (file.type.startsWith("image/")) return ImageIcon;
    if (file.type.startsWith("video/")) return Video;
    if (file.type.startsWith("audio/")) return Music2;
    if (extension === "xls" || extension === "xlsx" || extension === "csv" || extension === "ods") return FileSpreadsheet;
    if (extension === "ppt" || extension === "pptx") return Presentation;
    return FileText;
  };

  // Publish through the authenticated backend API.
  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Enter a title and description before publishing.");
      return;
    }
    if (!classId) {
      alert("Choose an assigned class before publishing materials.");
      return;
    }

    let finalMediaUrl = ensureAbsoluteUrl(mediaUrlInput);
    if (!finalMediaUrl && fileDataUrl) {
      finalMediaUrl = fileDataUrl;
    }
    const finalStreamUrl = fileDataUrl || processedMedia.streamUrl;

    if (!finalMediaUrl && !finalStreamUrl) {
      alert("Please provide a media link (Google Drive, YouTube, Docs) or select a file before publishing.");
      return;
    }

    setPublishing(true);
    try {
      const resolvedTeacher = teacherName || localStorage.getItem("name") || "Teacher";
      
      await apiPost(`/classes/${classId}/materials`, {
        title: title.trim(),
        description: description.trim(),
        kind,
        mediaUrl: finalMediaUrl,
        streamUrl: finalStreamUrl,
        teacherName: resolvedTeacher,
      });

      setRecent((current) => [{ id: Date.now(), title, kind, date: "Just now" }, ...current]);
      setMediaUrlInput("");
      removeFile();
      alert("Material published successfully to class.");
    } catch (error) {
      console.error("Could not publish class material:", error);
      const problem = error as { code?: string; message?: string };
      alert(`Could not publish material: ${problem.message || "Please check your connection and try again."}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleEdit = (id: number) => {
    alert("Edit modal opening for item ID: " + id + ". You can re-upload or rename files here.");
  };

  return (
    <>
      <Title
        kicker="Content uploader"
        title="Add learning material"
        sub={className ? `Adding content for ${className}.` : "Choose an assigned class before adding content."}
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          {/* Material Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {["Module", "Vocal Guide", "Video Guide", "Others"].map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setFileError("");
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  kind === k ? "grad text-white" : "bg-p1-soft text-p1 hover:bg-p1-soft/70"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            {/* Title */}
            <label className="grid gap-1.5 text-sm font-semibold">
              Title
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title"
              />
            </label>

            {/* Description */}
            <label className="grid gap-1.5 text-sm font-semibold">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={`Describe this ${kind.toLowerCase()}`}
                className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[var(--p1)]"
              />
            </label>

            {/* Primary Media / Stream Link Input (Cloud Storage Replacement) */}
            <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LinkIcon className="h-4 w-4 text-p1" />
                Media / Streaming Link (Google Drive, YouTube, Docs, Sheets)
              </label>
              <p className="mt-1 text-xs text-mute">
                Paste any shared link. The system automatically converts it into a direct stream for students.
              </p>
              <div className="mt-2">
                <Input
                  type="url"
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  placeholder={getLinkPlaceholder()}
                  className="bg-white"
                />
              </div>
              {processedMedia.provider !== "direct" && mediaUrlInput && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Recognized {processedMedia.provider.replace("_", " ")} ({processedMedia.type}) stream ready
                </div>
              )}
            </div>

            {/* Optional Small Local File (< 800 KB) */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-ink">
                Or attach small file directly (&lt; 800 KB)
              </label>
              {!selectedFile ? (
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleFileChange(event.dataTransfer.files);
                  }}
                  className="staff grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--p1)]/30 bg-p1-soft/30 px-6 py-4 text-center hover:bg-p1-soft/50 transition"
                >
                  <input
                    type="file"
                    onChange={(event) => handleFileChange(event.target.files)}
                    className="hidden"
                  />
                  <UploadCloud className="h-8 w-8 text-p1" strokeWidth={1.5} />
                  <span className="mt-1 text-sm font-semibold text-ink">
                    Drop score or worksheet here or browse
                  </span>
                  <span className="text-xs text-mute">
                    PDF, image, audio, or document (max 800 KB). For larger rehearsal tracks, paste a Google Drive link above.
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
                      <p className="text-sm font-semibold text-ink">{selectedFile.name}</p>
                      <p className="text-xs text-mute">
                        {(selectedFile.size / 1024).toFixed(0)} KB · Ready to save
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50 transition"
                    title="Remove file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              {fileError && <p role="alert" className="text-xs font-medium text-red-600">{fileError}</p>}
            </div>

            {/* Publish Button */}
            <div className="mt-2 flex gap-2">
              <Btn onClick={handlePublish} disabled={publishing}>
                {publishing ? "Publishing to class…" : "Publish to class"}
              </Btn>
            </div>
          </div>
        </Card>

        {/* Live Preview Panel */}
        <div className="grid content-start gap-5">
          <Card>
            <Label>Student preview</Label>
            <div className="mt-3 min-h-56 overflow-hidden rounded-xl bg-p1-soft">
              {/* YouTube video preview */}
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
              ) : (kind === "Vocal Guide" || processedMedia.type === "audio") && activeStreamUrl ? (
                <div className="grid min-h-56 place-items-center p-5 text-center">
                  <div className="w-full">
                    <Music2 className="mx-auto h-12 w-12 text-p1 mb-2" />
                    <p className="font-semibold text-sm mb-3">Vocal Guide Audio Stream</p>
                    <audio className="w-full" src={activeStreamUrl} controls />
                  </div>
                </div>
              ) : (kind === "Video Guide" || processedMedia.type === "video") && activeStreamUrl ? (
                <div className="grid min-h-56 place-items-center p-2">
                  <iframe
                    className="h-80 w-full rounded-lg"
                    src={activeStreamUrl}
                    title="Video preview"
                    allowFullScreen
                  />
                </div>
              ) : fileDataUrl && selectedFile?.type.startsWith("image/") ? (
                <img className="max-h-96 w-full object-contain" src={fileDataUrl} alt={`Preview of ${selectedFile?.name}`} />
              ) : fileDataUrl && selectedFile?.type === "application/pdf" ? (
                <iframe className="h-80 w-full" src={fileDataUrl} title="PDF preview" />
              ) : selectedFile && isExcelFile ? (
                spreadsheetLoading || spreadsheetPreview?.file !== selectedFile ? (
                  <div className="grid min-h-56 place-items-center p-5 text-mute">Preparing spreadsheet preview…</div>
                ) : spreadsheetPreview.sheets.length === 0 ? (
                  <div className="grid min-h-56 place-items-center p-5 text-center text-mute">Could not read this spreadsheet. Try another Excel file.</div>
                ) : (() => {
                  const sheet = spreadsheetPreview.sheets.find((item) => item.name === activeSpreadsheetSheet) || spreadsheetPreview.sheets[0];
                  const rows = sheet.rows.slice(0, 100);
                  const columnCount = Math.min(30, Math.max(0, ...rows.map((row) => row.length)));
                  return (
                    <div className="p-3">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {spreadsheetPreview.sheets.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setActiveSpreadsheetSheet(item.name)}
                            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                              item.name === sheet.name ? "bg-[var(--p1)] text-white" : "bg-white text-p1"
                            }`}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-80 overflow-auto rounded-lg border border-line bg-white">
                        <table className="min-w-full border-collapse text-left text-xs">
                          <tbody>
                            {rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className={rowIndex === 0 ? "bg-p1-soft font-semibold" : "odd:bg-white even:bg-slate-50"}>
                                {Array.from({ length: columnCount }, (_, columnIndex) => (
                                  <td key={columnIndex} className="max-w-64 border-b border-r border-line px-2 py-1.5 align-top">
                                    {String(row[columnIndex] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : activeStreamUrl ? (
                <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-mute">
                  <div>
                    <FileText className="mx-auto h-10 w-10 text-p1 mb-2" />
                    <p className="font-semibold text-ink">External Media Ready</p>
                    <a href={activeStreamUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-p1 underline">
                      Open stream / preview ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center p-5 text-center text-mute text-sm">
                  Paste a link or select a file to preview it here.
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-mute">
              Media streams directly inside MusikAralan without requiring dedicated cloud storage buckets.
            </p>
          </Card>

          {/* Recently Published */}
          <Card>
            <Label>Recently Published</Label>
            <ul className="mt-3 divide-y divide-line">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-p1-soft p-2 text-p1">
                      {m.kind === "Video Guide" || m.kind === "Vocal Guide" ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{m.title}</p>
                      <p className="text-xs text-mute">{m.kind} · {m.date}</p>
                    </div>
                  </div>
                  <button onClick={() => handleEdit(m.id)} className="text-blue-500 hover:text-blue-700">
                    <Edit2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}