import { useEffect, useState } from "react";
import { UploadCloud, FileText, FileSpreadsheet, Image as ImageIcon, Music2, Presentation, Video, Edit2, Trash2, Check } from "lucide-react";
import { Btn, Card, Input, Label, Pill, Title } from "./ui";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { ClassCatalogItem } from "./classCatalog";
import * as XLSX from "xlsx";

export type TeacherView = "dash" | "classes" | "upload" | "quiz" | "meet" | "students";

export function ExpiryBanner({
  teacherName = "Teacher",
  userId,
}: {
  teacherName?: string;
  userId: string;
}) {
  const [accessUntil, setAccessUntil] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, "users", userId), (snapshot) => {
      setAccessUntil(String(snapshot.data()?.accessUntil || ""));
    }, (error) => console.error("Could not load teacher access end date:", error));
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateParts = accessUntil.split("-").map(Number);
  const expiryDate = dateParts.length === 3 && dateParts.every(Number.isFinite)
    ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59)
    : null;
  const remainingMs = expiryDate ? expiryDate.getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const remainingMinutes = remainingMs !== null && remainingMs > 0
    ? Math.ceil(remainingMs / 60_000)
    : 0;
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const expiryLabel = expiryDate?.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const progress = remainingMs === null
    ? 0
    : Math.max(0, Math.min(100, (remainingMs / (30 * 24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-p2/30 bg-p2-soft px-4 py-3 text-sm">
      <span className="font-mono text-xs uppercase tracking-widest text-p2">
        Guest access
      </span>
      <span className="flex-1">
        {expiryDate ? expired
          ? <>{teacherName}, your guest access expired on <b>{expiryLabel}</b>.</>
          : <>{teacherName}, your guest access ends in <b>{days} d {hours} h {minutes} m</b> ({expiryLabel}).</>
          : <>No guest access end date has been set for {teacherName}.</>}
      </span>
      {expiryDate && !expired && (
        <div
          role="progressbar"
          aria-label="Time remaining before guest access ends"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-1.5 w-32 overflow-hidden rounded-full bg-white"
        >
          <div className="h-full grad transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <Title
        kicker="Overview"
        title="Teacher Dashboard"
        sub="Welcome to your class portal."
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <Label>Total Students</Label>
          <p className="mt-2 font-display text-4xl grad-text">24</p>
        </Card>
        <Card>
          <Label>Active Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">12</p>
        </Card>
        <Card>
          <Label>Pending Assessments</Label>
          <p className="mt-2 font-display text-4xl grad-text">5</p>
        </Card>
      </div>
    </>
  );
}

function StudentList({ className }: { className?: string }) {
  const students = [
    { name: "Juan Dela Cruz", age: 14, status: "Active" },
    { name: "Maria Clara", age: 12, status: "Active" },
    { name: "Pedro Penduko", age: 26, status: "Inactive" },
  ];
  return (
    <>
      <Title
        kicker="Class Roster"
        title="My Students"
        sub={className ? `Students enrolled in ${className}.` : "List of students assigned to your class."}
      />
      <Card className="mt-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-mute">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Age Group</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((s, i) => (
              <tr key={i}>
                <td className="py-4 font-semibold">{s.name}</td>
                <td className="py-4">
                  {s.age <= 12 ? "Kids" : s.age <= 25 ? "Youth" : "Adults"}
                </td>
                <td className="py-4 text-right">
                  <Pill tone={s.status === "Active" ? "p1" : "p2"}>
                    {s.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function TeacherClasses({ classes, onChooseAction }: { classes: ClassCatalogItem[]; onChooseAction: (classId: string, view: "upload" | "quiz" | "students") => void }) {
  return (
    <>
      <Title kicker="Class Management" title="My Classes" sub="All classes assigned to your teacher account." />
      {classes.length === 0 ? (
        <Card className="mt-5 py-8 text-center text-mute">No classes are currently assigned to you.</Card>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {classes.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{item.name}</h2>
                  <p className="mt-1 text-sm text-mute">{item.age === "all" ? "All ages" : `${item.age} age group`}</p>
                </div>
                <Pill tone={item.availableForEnrollment ? "p1" : "p2"}>
                  {item.availableForEnrollment ? "Enrollment open" : "Enrollment closed"}
                </Pill>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{item.description || "No class description provided."}</p>
              <p className="mt-4 text-sm text-mute">{item.enrolledStudentIds?.length || 0} enrolled students</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => onChooseAction(item.id, "upload")} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white">Upload Content</button>
                <button type="button" onClick={() => onChooseAction(item.id, "quiz")} className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Assessment Builder</button>
                <button type="button" onClick={() => onChooseAction(item.id, "students")} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50">My Students</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Upload({ className }: { className?: string }) {
  type AttachedLink = { url: string; previewUrl: string };
  const [kind, setKind] = useState("Module");
  const [filesByKind, setFilesByKind] = useState<Record<string, File[]>>({});
  const [previewIndexByKind, setPreviewIndexByKind] = useState<Record<string, number | null>>({});
  const [fileErrorsByKind, setFileErrorsByKind] = useState<Record<string, string>>({});
  const selectedFiles = filesByKind[kind] || [];
  const previewFileIndex = previewIndexByKind[kind] ?? null;
  const fileError = fileErrorsByKind[kind] || "";
  const setSelectedFiles = (update: File[] | ((current: File[]) => File[])) => {
    setFilesByKind((current) => ({
      ...current,
      [kind]: typeof update === "function" ? update(current[kind] || []) : update,
    }));
  };
  const setPreviewFileIndex = (index: number | null) => {
    setPreviewIndexByKind((current) => ({ ...current, [kind]: index }));
    if (index !== null) setSelectedLinkIndexByKind((current) => ({ ...current, [kind]: null }));
  };
  const setFileError = (error: string) => {
    setFileErrorsByKind((current) => ({ ...current, [kind]: error }));
  };
  const [googleLink, setGoogleLink] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [attachedLinksByKind, setAttachedLinksByKind] = useState<Record<string, AttachedLink[]>>({});
  const [selectedLinkIndexByKind, setSelectedLinkIndexByKind] = useState<Record<string, number | null>>({});
  const attachedLinks = attachedLinksByKind[kind] || [];
  const selectedLinkIndex = selectedLinkIndexByKind[kind] ?? null;
  const selectedLink = selectedLinkIndex === null ? undefined : attachedLinks[selectedLinkIndex];
  const addAttachedLink = (url: string, previewUrl: string) => {
    const alreadyAttached = attachedLinks.some((link) => link.url === url);
    if (alreadyAttached) {
      alert("This link is already attached.");
      return;
    }
    setAttachedLinksByKind((current) => ({ ...current, [kind]: [...(current[kind] || []), { url, previewUrl }] }));
    setPreviewFileIndex(null);
  };
  const removeAttachedLink = (index: number) => {
    setAttachedLinksByKind((current) => ({ ...current, [kind]: (current[kind] || []).filter((_, linkIndex) => linkIndex !== index) }));
    setSelectedLinkIndexByKind((current) => {
      const selected = current[kind] ?? null;
      return { ...current, [kind]: selected === index ? null : selected !== null && selected > index ? selected - 1 : selected };
    });
  };
  const [filePreviewUrls, setFilePreviewUrls] = useState<string[]>([]);
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<{ file: File; sheets: { name: string; rows: unknown[][] }[] } | null>(null);
  const [spreadsheetLoading, setSpreadsheetLoading] = useState(false);
  const [activeSpreadsheetSheet, setActiveSpreadsheetSheet] = useState("");
  const [titlesByKind, setTitlesByKind] = useState<Record<string, string>>({
    Module: "Psalm 95 â€” Kung marinig n'yo ang Kanyang tinig",
  });
  const [descriptionsByKind, setDescriptionsByKind] = useState<Record<string, string>>({});
  const title = titlesByKind[kind] || "";
  const description = descriptionsByKind[kind] || "";
  const setTitle = (value: string) => setTitlesByKind((current) => ({ ...current, [kind]: value }));
  const setDescription = (value: string) => setDescriptionsByKind((current) => ({ ...current, [kind]: value }));  const [recent, setRecent] = useState([
    { id: 1, title: "Ledger Lines Worksheet", kind: "PDF", date: "Yesterday" },
  ]);

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setFilePreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedFiles]);

  const googlePreviewUrl = kind === "Others" ? selectedLink?.previewUrl || "" : "";
  const youtubePreviewUrl = kind === "Video Guide" ? selectedLink?.previewUrl || "" : "";

  const selectedFile = previewFileIndex === null ? undefined : selectedFiles[previewFileIndex];
  const filePreviewUrl = previewFileIndex === null ? "" : filePreviewUrls[previewFileIndex] || "";
  const isImageFile = selectedFile?.type.startsWith("image/") || false;
  const isPdfFile = selectedFile?.type === "application/pdf" || selectedFile?.name.toLowerCase().endsWith(".pdf");
  const isVideoFile = selectedFile?.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|ogv|avi|mkv)$/i.test(selectedFile?.name || "");
  const isAudioFile = selectedFile?.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma)$/i.test(selectedFile?.name || "");
  const isExcelFile = kind === "Others" && /\.xlsx?$/i.test(selectedFile?.name || "");
  const acceptedFileTypes = kind === "Module"
    ? ".doc,.docx,.ppt,.pptx,.pdf,image/*"
    : kind === "Others"
      ? ".xls,.xlsx,.csv,.ods"
      : kind === "Vocal Guide"
        ? "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.wma"
        : "video/*,.mp4,.m4v,.mov,.webm,.ogv,.avi,.mkv";

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
      const sheets = workbook.SheetNames.map((name) => ({
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

  const getFileIcon = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (file.type.startsWith("image/")) return ImageIcon;
    if (file.type.startsWith("video/")) return Video;
    if (file.type.startsWith("audio/")) return Music2;
    if (extension === "xls" || extension === "xlsx" || extension === "csv" || extension === "ods") return FileSpreadsheet;
    if (extension === "ppt" || extension === "pptx") return Presentation;
    return FileText;
  };

  const chooseFiles = (files: FileList | File[], append = false) => {
    const incomingFiles = Array.from(files);
    if (incomingFiles.length === 0) return;
    const allowedFiles = incomingFiles.filter((file) => {
      const name = file.name.toLowerCase();
      if (kind === "Module") return /\.(docx?|pptx?|pdf)$/i.test(name) || file.type.startsWith("image/");
      if (kind === "Others") return /\.(xlsx?|csv|ods)$/i.test(name);
      if (kind === "Vocal Guide") return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma)$/i.test(name);
      if (kind === "Video Guide") return (file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|ogv|avi|mkv)$/i.test(name)) && file.size <= 1024 * 1024 * 1024;
      return true;
    });
    if (allowedFiles.length !== incomingFiles.length) {
      const errorMessages: Record<string, string> = {
        Module: "Choose a Word, PowerPoint, PDF, or image file for a Module.",
        Others: "Choose an Excel, CSV, or OpenDocument spreadsheet file for Others.",
        "Vocal Guide": "Choose audio files only for Vocal Guide.",
        "Video Guide": "Choose video files only, up to 1 GB each, for Video Guide. You can also add a YouTube link.",
      };
      setFileError(errorMessages[kind] || "One or more files are not supported.");
    } else {
      setFileError("");
    }
    if (allowedFiles.length > 0) {
      const existingFiles = append ? selectedFiles : [];
      const seenFileKeys = new Set(existingFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const uniqueFiles = allowedFiles.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seenFileKeys.has(key)) return false;
        seenFileKeys.add(key);
        return true;
      });
      const duplicateCount = allowedFiles.length - uniqueFiles.length;
      if (duplicateCount > 0) {
        alert(duplicateCount === 1 ? "This file is already attached." : "One or more files are already attached.");
      }
      if (uniqueFiles.length > 0) {
        setSelectedFiles((current) => append ? [...current, ...uniqueFiles] : uniqueFiles);
      }
      if (!append) setPreviewFileIndex(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setPreviewFileIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
  };

  const handlePublish = () => {
    if (!title.trim() || !description.trim()) {
      alert("Enter a title and description before publishing.");
      return;
    }
    const hasLinkAttachment = attachedLinks.length > 0;
    if (selectedFiles.length === 0 && !hasLinkAttachment) {
      alert("Attach at least one file or add a valid supported link before publishing.");
      return;
    }
    setRecent([{ id: Date.now(), title, kind, date: "Just now" }, ...recent]);
    alert("Material successfully uploaded and synced to your assigned class!");
    setTitle("");
  };

  const handleEdit = (id: number) => {
    alert(
      "Edit modal opening for item ID: " +
        id +
        ". You can re-upload or rename files here.",
    );
  };

  return (
    <>
      <Title kicker="Content uploader" title="Add learning material" sub={className ? `Adding content for ${className}.` : "Choose an assigned class before adding content."} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex flex-wrap gap-2">
            {["Module", "Vocal Guide", "Video Guide", "Others"].map(
              (k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${kind === k ? "grad text-white" : "bg-p1-soft text-p1"}`}
                >
                  {k}
                </button>
              ),
            )}
          </div>
          <div className="mt-5 grid gap-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              Title
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={`Describe this ${kind.toLowerCase()}`}
                className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal"
              />
            </label>
            {kind === "Others" && (
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={googleLink}
                  onChange={(event) => setGoogleLink(event.target.value)}
                  placeholder="Paste a Google Docs, Drive, Slides, or Sheets link"
                  aria-label="Google Docs, Drive, Slides, or Sheets link"
                />
                <button type="button" onClick={() => {
                  try {
                    const url = new URL(googleLink);
                    const supported = (url.hostname === "docs.google.com" && /\/(document|presentation|spreadsheets)\/d\/[^/]+/.test(url.pathname))
                      || (url.hostname === "drive.google.com" && Boolean(url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id")));
                    if (!supported) throw new Error("Unsupported link");
                    const match = url.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
                    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
                    const previewUrl = match
                      ? match[1] === "presentation"
                        ? `https://docs.google.com/presentation/d/${match[2]}/embed`
                        : match[1] === "spreadsheets"
                          ? `https://docs.google.com/spreadsheets/d/${match[2]}/preview`
                          : `https://docs.google.com/document/d/${match[2]}/preview`
                      : `https://drive.google.com/file/d/${fileId}/preview`;
                    addAttachedLink(googleLink, previewUrl);
                    setGoogleLink("");
                  } catch {
                    alert("Enter a valid Google Docs, Drive, Slides, or Sheets link, then attach it.");
                  }
                }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--p1)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]">
                  <Check className="h-4 w-4" />
                  {attachedLinks.some((link) => link.url === googleLink) ? "Attached" : "Attach link"}
                </button>
              </div>
            )}
            {kind === "Video Guide" && (
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={youtubeLink}
                  onChange={(event) => setYoutubeLink(event.target.value)}
                  placeholder="Paste a YouTube video link"
                  aria-label="YouTube video link"
                />
                <button type="button" onClick={() => {
                  try {
                    const url = new URL(youtubeLink);
                    const videoId = url.hostname === "youtu.be"
                      ? url.pathname.slice(1).split("/")[0]
                      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
                        ? (url.pathname === "/watch" ? url.searchParams.get("v") || "" : url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "")
                        : "";
                    if (!/^[\w-]{11}$/.test(videoId)) throw new Error("Unsupported link");
                    addAttachedLink(youtubeLink, `https://www.youtube-nocookie.com/embed/${videoId}`);
                    setYoutubeLink("");
                  } catch {
                    alert("Enter a valid YouTube video link, then attach it.");
                  }
                }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--p1)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p1)]">
                  <Check className="h-4 w-4" />
                  {attachedLinks.some((link) => link.url === youtubeLink) ? "Attached" : "Attach link"}
                </button>
              </div>
            )}
            {attachedLinks.length > 0 && (
              <ul className="grid gap-2">
                {attachedLinks.map((link, index) => (
                  <li key={`${link.url}-${index}`} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${selectedLinkIndex === index ? "border-p1 bg-white" : "border-line bg-white"}`}>
                    <button type="button" onClick={() => { setSelectedLinkIndexByKind((current) => ({ ...current, [kind]: index })); setPreviewFileIndex(null); }} onKeyDown={(event) => {
                      if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
                        removeAttachedLink(index);
                      }
                    }} aria-label={`Preview link ${link.url}. Press Backspace or Delete to remove it.`} aria-pressed={selectedLinkIndex === index} className={`min-w-0 flex-1 self-stretch rounded-lg px-3 py-2 text-left text-sm font-medium underline ${selectedLinkIndex === index ? "bg-blue-800 text-white dark:bg-blue-600" : "text-p1 hover:bg-p1-soft"}`}>
                      <span className="block w-full break-all">{link.url}</span>
                    </button>
                    <button type="button" aria-label="Remove attached link" onClick={() => removeAttachedLink(index)} className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                chooseFiles(event.dataTransfer.files, selectedFiles.length > 0);
              }}
              className="staff grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--p1)]/30 bg-p1-soft/40 px-6 py-4 text-center"
            >
              <input
                type="file"
                multiple
                accept={acceptedFileTypes}
                onChange={(event) => chooseFiles(event.target.files || [], selectedFiles.length > 0)}
                className="hidden"
              />
              <UploadCloud className="h-9 w-9 text-p1" strokeWidth={1.5} />
              <span className="mt-2 font-semibold">
                {selectedFiles.length ? "Drop more files here or browse to add to this batch" : "Drop files here or browse"}
              </span>
              <span className="text-sm text-mute">
                {kind === "Module"
                  ? "Word, PowerPoint, PDF, and image files (up to 200 MB each)"
                  : kind === "Others"
                    ? "Excel, CSV, and OpenDocument spreadsheet files"
                    : kind === "Vocal Guide"
                      ? "Audio files only"
                      : "Video files only (up to 1 GB each), or add a YouTube link"}
              </span>
            </label>
            {selectedFiles.length > 0 && (
              <>
                <ul className="grid gap-2">
                  {selectedFiles.map((file, index) => {
                    const FileIcon = getFileIcon(file);
                    return (
                      <li key={`${file.name}-${file.lastModified}-${index}`} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${previewFileIndex === index ? "border-p1 bg-p1-soft/60" : "border-line"}`}>
                        <button
                          type="button"
                          onClick={() => setPreviewFileIndex(index)}
                          aria-pressed={previewFileIndex === index}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <FileIcon className="h-5 w-5 shrink-0 text-p1" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
                          <span className="text-xs text-mute">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                        </button>
                        <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)} className="rounded-md p-1 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 hover:bg-p1-soft/70">
                    Add another
                    <input
                      type="file"
                      multiple
                      accept={acceptedFileTypes}
                      onChange={(event) => chooseFiles(event.target.files || [], true)}
                      className="hidden"
                    />
                  </label>
                </div>
              </>
            )}
            {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}
            <div className="flex gap-2">
              <Btn onClick={handlePublish}>Publish to class</Btn>
            </div>
          </div>
        </Card>
        <div className="grid content-start gap-5">
          <Card>
            <Label>Student preview</Label>
            <div className="mt-3 min-h-56 overflow-hidden rounded-xl bg-p1-soft">
              {kind === "Video Guide" && selectedLink && youtubePreviewUrl ? (
                <iframe className="h-80 w-full" src={youtubePreviewUrl} title="YouTube video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              ) : kind === "Others" && selectedLink && googlePreviewUrl ? (
                <iframe className="h-80 w-full" src={googlePreviewUrl} title="Google file preview" allow="autoplay" />
              ) : filePreviewUrl && isVideoFile ? (
                <video className="max-h-96 w-full" src={filePreviewUrl} controls />
              ) : filePreviewUrl && isAudioFile ? (
                <div className="grid min-h-56 place-items-center p-5">
                  <audio className="w-full" src={filePreviewUrl} controls />
                </div>
              ) : filePreviewUrl && isImageFile ? (
                <img className="max-h-96 w-full object-contain" src={filePreviewUrl} alt={`Preview of ${selectedFile?.name}`} />
              ) : filePreviewUrl && isPdfFile ? (
                <iframe className="h-80 w-full" src={filePreviewUrl} title="PDF preview" />
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
                          <button key={item.name} type="button" onClick={() => setActiveSpreadsheetSheet(item.name)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${item.name === sheet.name ? "bg-[var(--p1)] text-white" : "bg-white text-p1"}`}>
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
                                  <td key={columnIndex} className="max-w-64 border-b border-r border-line px-2 py-1.5 align-top">{String(row[columnIndex] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sheet.rows.length > rows.length && <p className="mt-2 text-xs text-mute">Showing the first 100 rows.</p>}
                    </div>
                  );
                })()
              ) : selectedFile ? (
                <div className="grid min-h-56 place-items-center p-5 text-center text-sm text-mute">
                  <div>
                    <p className="font-semibold text-ink">{selectedFile.name}</p>
                    <p className="mt-1">{kind === "Others"
                      ? "Add a Google Docs, Drive, Slides, or Sheets link above to preview this file here."
                      : "This file type does not support an inline preview. You can open the attached file to view it."}</p>
                    {filePreviewUrl && <a href={filePreviewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-p1 underline">Open selected file</a>}
                  </div>
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center p-5 text-center text-mute">
                  {selectedFiles.length > 0 || attachedLinks.length > 0 ? "Choose an attached file or link above to preview it." : "Preview appears here"}
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-mute">
              Files stream inside the platform Ã¢â‚¬â€ learners never leave MML.
            </p>
          </Card>
          <Card>
            <Label>Recently Published</Label>
            <ul className="mt-3 divide-y divide-line">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-p1-soft p-2 text-p1">
                      {m.kind === "Video Guide" || m.kind === "Vocal Guide" ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-xs text-mute">
                        {m.kind} Ã‚Â· {m.date}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(m.id)}
                    className="text-blue-500 hover:text-blue-700"
                  >
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

type Q = {
  q: string;
  o: string[];
  a: number;
  type: "multiple" | "truefalse" | "identification";
};
function Quiz({ className }: { className?: string }) {
  const [qs, setQs] = useState<Q[]>([
    {
      q: "What is the time signature of a waltz?",
      o: ["2/4", "3/4", "4/4"],
      a: 1,
      type: "multiple",
    },
  ]);
  const upd = (i: number, p: Partial<Q>) =>
    setQs(qs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <>
      <Title
        kicker="Assessment builder"
        title="Note Reading Quiz 5"
        sub={className ? `Creating an assessment for ${className}.` : "Choose an assigned class before creating an assessment."}
        right={
          <div className="flex gap-2">
            <Pill>Auto-graded</Pill>
            <Pill tone="p2">Passing 70%</Pill>
          </div>
        }
      />
      <div className="grid max-w-3xl gap-4">
        {qs.map((x, i) => (
          <Card key={i}>
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono text-xs text-p2">Q{i + 1}</p>
              <select
                value={x.type}
                onChange={(e) =>
                  upd(i, {
                    type: e.target.value as any,
                    o: e.target.value === "truefalse" ? ["True", "False"] : x.o,
                  })
                }
                className="text-xs border border-line rounded px-2 py-1"
              >
                <option value="multiple">Multiple Choice</option>
                <option value="truefalse">True/False</option>
                <option value="identification">Identification</option>
              </select>
            </div>
            <Input
              className="mt-2"
              value={x.q}
              onChange={(e) => upd(i, { q: e.target.value })}
            />
            {x.type === "identification" ? (
              <div className="mt-3">
                <Input placeholder="Enter correct exact answer here" />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {x.o.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button
                      onClick={() => upd(i, { a: j })}
                      aria-label="Mark correct"
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${x.a === j ? "border-[var(--p1)] grad" : "border-line"}`}
                    />
                    <Input
                      value={o}
                      disabled={x.type === "truefalse"}
                      onChange={(e) =>
                        upd(i, {
                          o: x.o.map((y, k) => (k === j ? e.target.value : y)),
                        })
                      }
                    />
                  </div>
                ))}
                {x.type === "multiple" && (
                  <button
                    onClick={() => upd(i, { o: [...x.o, "New option"] })}
                    className="mt-2 text-sm font-semibold text-p1 text-left"
                  >
                    + Option
                  </button>
                )}
              </div>
            )}
          </Card>
        ))}
        <div className="flex gap-2">
          <Btn
            variant="soft"
            onClick={() =>
              setQs([
                ...qs,
                { q: "New question", o: ["A", "B"], a: 0, type: "multiple" },
              ])
            }
          >
            + Add question
          </Btn>
          <Btn>Publish & Link to Class</Btn>
        </div>
      </div>
    </>
  );
}

function Meet() {
  const [list, setList] = useState([
    {
      t: "Virtual Rehearsal Ã¢â‚¬â€ 27th Sunday",
      w: "2026-10-10T20:00",
      l: "meet.google.com/mml-rhsl-027",
    },
  ]);
  const [t, setT] = useState("Note Reading Class");
  const [w, setW] = useState("2026-10-05T19:00");
  return (
    <>
      <Title kicker="Live sessions" title="Schedule a Google Meet" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="grid content-start gap-3">
          <Input value={t} onChange={(e) => setT(e.target.value)} />
          <Input
            type="datetime-local"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
          <Btn
            onClick={() => {
              setList([
                ...list,
                {
                  t,
                  w,
                  l: `meet.google.com/mml-${Math.random().toString(36).slice(2, 6)}-${list.length + 1}`,
                },
              ]);
              alert(
                "Meeting scheduled! Notifications sent to connected student accounts.",
              );
            }}
          >
            Generate Meet link & notify
          </Btn>
          <p className="text-xs text-mute">
            Members are notified via app, SMS, Gmail and Messenger.
          </p>
        </Card>
        <Card>
          <Label>Scheduled</Label>
          <ul className="mt-2 divide-y divide-line">
            {list.map((x) => (
              <li key={x.l} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1">
                  <b>{x.t}</b>
                  <br />
                  <span className="font-mono text-xs text-mute">
                    {new Date(x.w).toLocaleString()} Ã‚Â· {x.l}
                  </span>
                </span>
                <Btn
                  variant="ghost"
                  onClick={() =>
                    navigator.clipboard?.writeText("https://" + x.l)
                  }
                >
                  Copy link
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function Teacher({ view, userId, go }: { view: TeacherView; userId: string; go: (view: string) => void }) {
  const loggedInTeacherName = localStorage.getItem("name") || "Teacher User";
  const [teacherIdentity, setTeacherIdentity] = useState(loggedInTeacherName);
  const [assignedClasses, setAssignedClasses] = useState<ClassCatalogItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, "users", userId), (snapshot) => {
      if (!snapshot.exists()) return;
      const profile = snapshot.data();
      setTeacherIdentity(String(profile.name || profile.email || loggedInTeacherName).trim());
    }, (error) => console.error("Could not load teacher profile:", error));
  }, [userId, loggedInTeacherName]);

  useEffect(() => onSnapshot(collection(db, "classes"), (snapshot) => {
    const teacherClasses = snapshot.docs
      .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() } as ClassCatalogItem))
      .filter((item) => !item.deleted && String(item.teacher || "").trim().toLowerCase() === teacherIdentity.toLowerCase());
    setAssignedClasses(teacherClasses);
    setSelectedClassId((current) => teacherClasses.some((item) => item.id === current)
      ? current
      : teacherClasses[0]?.id || "");
  }, (error) => console.error("Could not load assigned classes:", error)), [teacherIdentity]);

  const selectedClass = assignedClasses.find((item) => item.id === selectedClassId);

  return (
    <>
      {(view === "dash" || view === "classes") && <ExpiryBanner teacherName={loggedInTeacherName} userId={userId} />}
      {(view === "dash" || view === "meet") && <Card className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor="teacher-class-selector" className="text-sm font-semibold">Accessing class</label>
        <select
          id="teacher-class-selector"
          value={selectedClassId}
          onChange={(event) => setSelectedClassId(event.target.value)}
          disabled={assignedClasses.length === 0}
          className="min-w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {assignedClasses.length === 0 ? (
            <option value="">No classes assigned</option>
          ) : assignedClasses.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {selectedClass && <span className="text-sm text-mute">{selectedClass.description}</span>}
      </Card>}
      {view !== "classes" && (
        <button
          type="button"
          onClick={() => go("classes")}
          className="mb-4 rounded-full border border-line px-4 py-2 text-sm font-semibold text-p1 hover:bg-p1-soft"
        >
          ← Back to Classes
        </button>
      )}
      {view === "dash" ? (
        <Dashboard />
      ) : view === "classes" ? (
        <TeacherClasses classes={assignedClasses} onChooseAction={(classId, nextView) => {
          setSelectedClassId(classId);
          go(nextView);
        }} />
      ) : view === "students" ? (
        <StudentList className={selectedClass?.name} />
      ) : view === "quiz" ? (
        <Quiz className={selectedClass?.name} />
      ) : view === "meet" ? (
        <Meet />
      ) : (
        <Upload className={selectedClass?.name} />
      )}
    </>
  );
}

