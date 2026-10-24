import type { parseAndConvertMediaUrl } from "../../utils/mediaUrlHelper";

export type UploadKind = "Module" | "Vocal Guide" | "Video Guide" | "Others";

export interface UploadProps {
  className?: string;
  classId?: string;
  teacherName?: string;
}

export interface RecentMaterial {
  id: string;
  title: string;
  kind: string;
  createdAt: string | null;
}

export type ProcessedMedia = ReturnType<typeof parseAndConvertMediaUrl>;
