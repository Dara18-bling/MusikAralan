import type { parseAndConvertMediaUrl } from "../../utils/mediaUrlHelper";

export type UploadKind = "Module" | "Vocal Guide" | "Video Guide" | "Others" | "Assignment";

export interface UploadProps {
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
