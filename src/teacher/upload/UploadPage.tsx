import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiPost, POLL_INTERVAL_TWO_MINUTES, refreshApi, watchApi } from "../../api";
import { Title } from "../../ui";
import {
  ensureAbsoluteUrl,
  parseAndConvertMediaUrl,
} from "../../utils/mediaUrlHelper";
import { RecentMaterials } from "./RecentMaterials";
import { getPhilippineDateInputValue } from "../../utils/dateTime";
import { StudentPreview } from "./StudentPreview";
import type { RecentMaterial, UploadKind, UploadProps } from "./types";
import { UploadForm } from "./UploadForm";
import { getUploadKindFromResource, isSheetMusicFile, isSpreadsheetFile, } from "./uploadUtils";

function initialDeadlineTime() {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(future).map((part) => [part.type, part.value]));
  const hour24 = Number(parts.hour);
  return {
    date: getPhilippineDateInputValue(future),
    hour: String(hour24 % 12 || 12),
    minute: parts.minute,
    period: (hour24 >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
}

export function UploadPage({ className, classId, teacherName }: UploadProps) {
  const [kind, setKind] = useState<UploadKind>("Module");
  const [titlesByKind, setTitlesByKind] = useState<Record<string, string>>({
    Module: "",
  });
  const [descriptionsByKind, setDescriptionsByKind] = useState<
    Record<string, string>
  >({});
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [recent, setRecent] = useState<RecentMaterial[]>([]);
  const [deadlineMode, setDeadlineMode] = useState<"none" | "set">("none");
  const [deadlineTime, setDeadlineTime] = useState(initialDeadlineTime);
  const [submissionMode, setSubmissionMode] = useState<"review" | "submit">("review");
  const [maxGrade, setMaxGrade] = useState("100");

  const title = titlesByKind[kind] || "";
  const description = descriptionsByKind[kind] || "";
  const processedMedia = parseAndConvertMediaUrl(mediaUrlInput, kind);
  const activeStreamUrl = fileDataUrl || processedMedia.streamUrl;
  const isExcelFile = Boolean(selectedFile && isSpreadsheetFile(selectedFile.name));
  const [deadlineYear, deadlineMonth, deadlineDay] = deadlineTime.date.split("-").map(Number);
  const deadlineHour12 = Number(deadlineTime.hour);
  const deadlineMinute = Number(deadlineTime.minute);
  const deadlineHour24 = (deadlineHour12 % 12) + (deadlineTime.period === "PM" ? 12 : 0);
  const selectedDeadline = new Date(`${deadlineTime.date}T${String(deadlineHour24).padStart(2, "0")}:${String(deadlineMinute).padStart(2, "0")}:00+08:00`);
  const deadlineIsPast = deadlineMode === "set" && selectedDeadline.getTime() <= Date.now();

  useEffect(() => {
    if (!classId) {
      setRecent([]);
      return;
    }
    if (submissionMode === "submit" && (!Number.isInteger(Number(maxGrade)) || Number(maxGrade) < 1 || Number(maxGrade) > 1000)) {
      toast.warning("Set a maximum grade from 1 to 1000 points.");
      return;
    }
    return watchApi<{ data: RecentMaterial[] }>(
      `/classes/${classId}/materials`,
      ({ data }) => setRecent(data),
      (error) =>
        console.error("Could not load published class materials:", error),
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId]);

  const handleFileChange = (files: FileList | null) => {
  const file = files?.[0];
    if (!file) return;

    setFileError("");

    if (kind === "Sheet Music" && !isSheetMusicFile(file.name)) {
      setFileError("Sheet Music only accepts PDF, PNG, JPG, and JPEG files.");
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }

    if (file.size > 800 * 1024) {
      setFileError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Files must be 800 KB or smaller.`,
      );
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }

    setSelectedFile(file);

    // Preserve the teacher's explicit Sheet Music selection.
    if (kind !== "Sheet Music") {
      setKind(getUploadKindFromResource(file.name));
    }

    setMediaUrlInput("");
    setFileDataUrl("");

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFileDataUrl(reader.result);
      }
    };

    reader.onerror = () => {
      setFileError("Could not read file. Please try selecting it again.");
      setFileDataUrl("");
    };

    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileDataUrl("");
    setFileError("");
  };

  const handleMediaUrlInput = (value: string) => {
    if (!value.trim()) {
      setMediaUrlInput("");
      return;
    }

    if (kind === "Sheet Music") {
      toast.warning(
        "Please upload a sheet music PDF or image directly. External links cannot be processed by Audiveris.",
      );
      return;
    }

    const detectedKind = getUploadKindFromResource(value);

    setKind(detectedKind);
    setMediaUrlInput(value);
    setSelectedFile(null);
    setFileDataUrl("");
    setFileError("");
  };

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      toast.warning("Enter a title and description before publishing.");
      return;
    }
    if (!classId) {
      toast.warning("Choose an assigned class before publishing materials.");
      return;
    }

    if (kind === "Sheet Music") {
      if (!selectedFile || !fileDataUrl) {
        toast.warning(
          "Please attach a valid sheet music PDF or image before publishing.",
        );
        return;
      }

      if (!isSheetMusicFile(selectedFile.name)) {
        toast.warning("Only PDF, PNG, JPG, and JPEG files are supported.");
        return;
      }
    }

    const finalMediaUrl = ensureAbsoluteUrl(mediaUrlInput) || fileDataUrl;
    const finalStreamUrl = fileDataUrl || processedMedia.streamUrl;
    if (!finalMediaUrl && !finalStreamUrl) {
      toast.warning(
        "Please provide a media link (Google Drive, YouTube, Docs) or select a file before publishing.",
      );
      return;
    }

    let deadline: string | null = null;
    if (deadlineMode === "set") {
      if (!deadlineYear || !deadlineMonth || !deadlineDay || deadlineHour12 < 1 || deadlineHour12 > 12 || deadlineMinute < 0 || deadlineMinute > 59) {
        toast.warning("Choose a valid deadline date and time.");
        return;
      }
      if (selectedDeadline.getTime() <= Date.now()) {
        toast.warning("That date and time has already passed. Choose a future deadline.");
        return;
      }
      deadline = selectedDeadline.toISOString();
    }

    setPublishing(true);
    try {
      await apiPost(`/classes/${classId}/materials`, {
        title: title.trim(),
        description: description.trim(),
        kind,
        mediaUrl: finalMediaUrl,
        streamUrl: finalStreamUrl,
        deadline,
        requiresSubmission: submissionMode === "submit",
        maxGrade: submissionMode === "submit" ? Number(maxGrade) : null,
        teacherName: teacherName || localStorage.getItem("name") || "Teacher",
      });
      refreshApi(`/classes/${classId}/materials`);
      refreshApi("/dashboard");
      setMediaUrlInput("");
      removeFile();
      setDeadlineMode("none");
      setDeadlineTime(initialDeadlineTime());
      setSubmissionMode("review");
      setMaxGrade("100");
      toast.success("Material published successfully to class.");
    } catch (error) {
      console.error("Could not publish class material:", error);
      const problem = error as { code?: string; message?: string };
      toast.error(
        `Could not publish material: ${problem.message || "Please check your connection and try again."}`,
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Title
        kicker="Content uploader"
        title="Add learning material"
        sub={
          className
            ? `Adding content for ${className}.`
            : "Choose an assigned class before adding content."
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <UploadForm
          kind={kind}
          setKind={setKind}
          title={title}
          setTitle={(value) =>
            setTitlesByKind((current) => ({ ...current, [kind]: value }))
          }
          description={description}
          setDescription={(value) =>
            setDescriptionsByKind((current) => ({ ...current, [kind]: value }))
          }
          mediaUrlInput={mediaUrlInput}
          onMediaUrlInput={handleMediaUrlInput}
          deadlineMode={deadlineMode}
          setDeadlineMode={setDeadlineMode}
          deadlineDate={deadlineTime.date}
          setDeadlineDate={(date) => setDeadlineTime((current) => ({ ...current, date }))}
          deadlineHour={deadlineTime.hour}
          setDeadlineHour={(hour) => setDeadlineTime((current) => ({ ...current, hour }))}
          deadlineMinute={deadlineTime.minute}
          setDeadlineMinute={(minute) => setDeadlineTime((current) => ({ ...current, minute }))}
          deadlinePeriod={deadlineTime.period}
          setDeadlinePeriod={(period) => setDeadlineTime((current) => ({ ...current, period }))}
          minimumDeadlineDate={getPhilippineDateInputValue()}
          deadlineIsPast={deadlineIsPast}
          submissionMode={submissionMode}
          setSubmissionMode={setSubmissionMode}
          maxGrade={maxGrade}
          setMaxGrade={setMaxGrade}
          selectedFile={selectedFile}
          fileError={fileError}
          processedMedia={processedMedia}
          publishing={publishing}
          onFileChange={handleFileChange}
          onRemoveFile={removeFile}
          onPublish={handlePublish}
        />
        <div className="grid content-start gap-5">
          <StudentPreview
            kind={kind}
            processedMedia={processedMedia}
            activeStreamUrl={activeStreamUrl}
            fileDataUrl={fileDataUrl}
            selectedFile={selectedFile}
            isExcelFile={isExcelFile}
          />
          <RecentMaterials materials={recent} />
        </div>
      </div>
    </>
  );
}
