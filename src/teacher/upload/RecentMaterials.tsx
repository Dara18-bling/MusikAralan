import { FileText, Video } from "lucide-react";
import { Card, Label } from "../../ui";
import type { RecentMaterial } from "./types";

interface RecentMaterialsProps {
  materials: RecentMaterial[];
}

export function RecentMaterials({ materials }: RecentMaterialsProps) {
  return (
    <Card>
      <Label>Recently Published</Label>
      <ul className="mt-3 divide-y divide-line">
        {materials.map((material) => (
          <li
            key={material.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-p1-soft p-2 text-p1">
                {material.kind === "Video Guide" ||
                material.kind === "Vocal Guide" ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">{material.title}</p>
                <p className="text-xs text-mute">
                  {material.kind} ·{" "}
                  {material.createdAt
                    ? new Date(material.createdAt).toLocaleDateString()
                    : "Date unavailable"}
                </p>
              </div>
            </div>
          </li>
        ))}
        {!materials.length && (
          <li className="py-4 text-sm text-mute">
            No materials have been published to this class yet.
          </li>
        )}
      </ul>
    </Card>
  );
}
