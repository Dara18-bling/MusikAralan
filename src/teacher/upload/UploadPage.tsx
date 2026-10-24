import { useEffect, useState } from "react";
import { apiPost, watchApi } from "../../api";
import { Title } from "../../ui";
import {
  ensureAbsoluteUrl,
  parseAndConvertMediaUrl,
} from "../../utils/mediaUrlHelper";
import { RecentMaterials } from "./RecentMaterials";
import { StudentPreview } from "./StudentPreview";
import type { RecentMaterial, UploadKind, UploadProps } from "./types";
import { UploadForm } from "./UploadForm";

export function UploadPage({ className, classId, teacherName }: UploadProps) {
  const [kind, setKind] = useState<UploadKind>("Module");
  const [titlesByKind, setTitlesByKind] = useState<Record<string, string>>({
    Module: "",
  });
  const [descriptionsByKind, setDescriptionsByKind] = useState<
    Record<string, string>
  >({});
  const [mediaUrlsByKind, setMediaUrlsByKind] = useState<
    Record<string, string>
  >({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [recent, setRecent] = useState<RecentMaterial[]>([]);

  const title = titlesByKind[kind] || "";
  const description = descriptionsByKind[kind] || "";
  const mediaUrlInput = mediaUrlsByKind[kind] || "";
  const processedMedia = parseAndConvertMediaUrl(mediaUrlInput, kind);
  const activeStreamUrl = fileDataUrl || processedMedia.streamUrl;
  const isExcelFile =
    kind === "Others" && /\.xlsx?$/i.test(selectedFile?.name || "");

  useEffect(() => {
    if (!classId) {
      setRecent([]);
      return;
    }
    return watchApi<{ data: RecentMaterial[] }>(
      `/classes/${classId}/materials`,
      ({ data }) => setRecent(data),
      (error) =>
        console.error("Could not load published class materials:", error),
    );
  }, [classId]);

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileError("");

    if (file.size > 800 * 1024) {
      setFileError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Files must be 800 KB or smaller; for larger files, paste a share link below.`,
      );
      setSelectedFile(null);
      setFileDataUrl("");
      return;
    }

    setSelectedFile(file);
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

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Enter a title and description before publishing.");
      return;
    }
    if (!classId) {
      alert("Choose an assigned class before publishing materials.");
      return;
    }

    const finalMediaUrl =
      ensureAbsoluteUrl(mediaUrlInput) || fileDataUrl;
    const finalStreamUrl = fileDataUrl || processedMedia.streamUrl;
    if (!finalMediaUrl && !finalStreamUrl) {
      alert(
        "Please provide a media link (Google Drive, YouTube, Docs) or select a file before publishing.",
      );
      return;
    }

    setPublishing(true);
    try {
      await apiPost(`/classes/${classId}/materials`, {
        title: title.trim(),
        description: description.trim(),
        kind,
        mediaUrl: finalMediaUrl,
        streamUrl: finalStreamUrl,
        teacherName: teacherName || localStorage.getItem("name") || "Teacher",
      });
      setMediaUrlsByKind((current) => ({ ...current, [kind]: "" }));
      removeFile();
      alert("Material published successfully to class.");
    } catch (error) {
      console.error("Could not publish class material:", error);
      const problem = error as { code?: string; message?: string };
      alert(
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
          setMediaUrlInput={(value) =>
            setMediaUrlsByKind((current) => ({ ...current, [kind]: value }))
          }
          selectedFile={selectedFile}
          fileError={fileError}
          processedMedia={processedMedia}
          publishing={publishing}
          onFileChange={handleFileChange}
          onRemoveFile={removeFile}
          onPublish={handlePublish}
          onKindChange={() => setFileError("")}
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
