import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiPost, apiRequest, POLL_INTERVAL_TWO_MINUTES, refreshApi, watchApi } from "../../api";
import {
  ensureAbsoluteUrl,
  parseAndConvertMediaUrl,
} from "../../utils/mediaUrlHelper";
import { RecentMaterials } from "./RecentMaterials";
import { StudentPreview } from "./StudentPreview";
import type { RecentMaterial, UploadKind, UploadProps } from "./types";
import { UploadForm } from "./UploadForm";
import { getUploadKindFromResource, isSpreadsheetFile } from "./uploadUtils";

function todayAt(time: "00:00" | "23:59") {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return `${date}T${time}`;
}

export function UploadPage({ classId, teacherName }: UploadProps) {
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
  const [availableFrom, setAvailableFrom] = useState(() => todayAt("00:00"));
  const [dueAt, setDueAt] = useState(() => todayAt("23:59"));
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(false);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(8);

  const title = titlesByKind[kind] || "";
  const description = descriptionsByKind[kind] || "";
  const processedMedia = parseAndConvertMediaUrl(mediaUrlInput, kind);
  const activeStreamUrl = fileDataUrl || processedMedia.streamUrl;
  const isExcelFile =
    kind === "Others" &&
    Boolean(selectedFile && isSpreadsheetFile(selectedFile.name));

  useEffect(() => {
    if (!classId) {
      setRecent([]);
      return;
    }
    return watchApi<{ data: RecentMaterial[]; maxUploadSizeMb?: number }>(
      `/classes/${classId}/materials`,
      ({ data, maxUploadSizeMb: configuredLimit }) => {
        setRecent(data);
        if (configuredLimit && configuredLimit > 0) setMaxUploadSizeMb(configuredLimit);
      },
      (error) =>
        console.error("Could not load published class materials:", error),
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId]);

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileError("");

    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      setFileError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Files must be ${maxUploadSizeMb} MB or smaller; use Google Drive for larger files.`,
      );
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }

    setSelectedFile(file);
    setKind((current) =>
      current === "Assignment" ? current : getUploadKindFromResource(file.name),
    );
    setMediaUrlInput("");
    setFileDataUrl("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setFileDataUrl(reader.result);
    };
    reader.onerror = () => {
      setFileError("Could not read file. Please try pasting a link instead.");
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

    const detectedKind = getUploadKindFromResource(value);
    setKind((current) =>
      current === "Assignment" ? current : detectedKind,
    );
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
    if (kind === "Assignment") {
      if (!availableFrom || !dueAt) {
        toast.warning("Set both the assignment start and due date.");
        return;
      }
      if (new Date(dueAt) < new Date(availableFrom)) {
        toast.warning("The due date must be on or after the start date.");
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

    setPublishing(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        kind,
        mediaUrl: selectedFile ? "" : finalMediaUrl,
        streamUrl: selectedFile ? "" : finalStreamUrl,
        teacherName: teacherName || localStorage.getItem("name") || "Teacher",
        isAssignment: kind === "Assignment",
        availableFrom: kind === "Assignment" ? new Date(availableFrom).toISOString() : null,
        dueAt: kind === "Assignment" ? new Date(dueAt).toISOString() : null,
        allowLateSubmissions: kind === "Assignment" && allowLateSubmissions,
      };
      if (selectedFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(
            key,
            typeof value === "boolean" ? (value ? "1" : "0") : value == null ? "" : String(value),
          );
        });
        formData.append("file", selectedFile);
        await apiRequest(`/classes/${classId}/materials`, {
          method: "POST",
          body: formData,
        });
      } else {
        await apiPost(`/classes/${classId}/materials`, payload);
      }
      refreshApi(`/classes/${classId}/materials`);
      refreshApi("/dashboard");
      setMediaUrlInput("");
      removeFile();
      setAvailableFrom(todayAt("00:00"));
      setDueAt(todayAt("23:59"));
      setAllowLateSubmissions(false);
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
          selectedFile={selectedFile}
          fileError={fileError}
          processedMedia={processedMedia}
          publishing={publishing}
          maxUploadSizeMb={maxUploadSizeMb}
          availableFrom={availableFrom}
          setAvailableFrom={setAvailableFrom}
          dueAt={dueAt}
          setDueAt={setDueAt}
          allowLateSubmissions={allowLateSubmissions}
          setAllowLateSubmissions={setAllowLateSubmissions}
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
