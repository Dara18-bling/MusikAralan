import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Video } from "lucide-react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card, Title } from "../ui";
import { StudentMaterialViewer } from "../student/StudentMaterialViewer";
import type { Material } from "../student/StudentClassWorkspace";

interface TeacherMaterialsProps {
  classId: string;
  className: string;
}

export function TeacherMaterials({ classId, className }: TeacherMaterialsProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMaterialId = searchParams.get("materialId") || "";

  useEffect(() => {
    setMaterials([]);
    setLoaded(false);
    setLoadError(false);
    return watchApi<{ data: Material[] }>(
      `/classes/${classId}/materials`,
      ({ data }) => {
        setMaterials(data);
        setLoadError(false);
        setLoaded(true);
      },
      (error) => {
        console.error("Could not load teacher class materials:", error);
        setLoadError(true);
        setLoaded(true);
      },
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId),
    [materials, selectedMaterialId],
  );

  const selectMaterial = (materialId: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (materialId) next.set("materialId", materialId);
        else next.delete("materialId");
        return next;
      },
      { replace: true },
    );
  };

  if (selectedMaterialId) {
    if (!loaded && !selectedMaterial) {
      return <Card className="animate-pulse py-12 text-center text-mute">Loading material…</Card>;
    }
    if (!selectedMaterial) {
      return (
        <Card className="text-center">
          <p className="text-mute">
            {loadError ? "Could not load this material." : "This material is no longer available."}
          </p>
          <button
            type="button"
            onClick={() => selectMaterial("")}
            className="mt-4 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
          >
            Back to {className} materials
          </button>
        </Card>
      );
    }
    return (
      <StudentMaterialViewer
        className={className}
        material={selectedMaterial}
        onBack={() => selectMaterial("")}
      />
    );
  }

  return (
    <>
      <Title
        kicker="Class materials"
        title={`${className} Materials`}
        sub="Browse and open all materials shared with this class."
      />
      {loadError ? (
        <Card className="mt-5 text-center text-mute">
          Could not load class materials. Please try again later.
        </Card>
      ) : !loaded ? (
        <Card className="mt-5 animate-pulse py-12 text-center text-mute">
          Loading class materials…
        </Card>
      ) : materials.length === 0 ? (
        <Card className="mt-5 text-center text-mute">
          No materials have been published to this class yet.
        </Card>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => (
            <Card key={material.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-p1-soft p-2 text-p1">
                  {material.kind === "Video Guide" || material.kind === "Vocal Guide" ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{material.title}</p>
                  <p className="mt-1 text-xs text-mute">{material.kind}</p>
                </div>
              </div>
              {material.description && (
                <p className="mt-3 line-clamp-3 text-sm text-mute">{material.description}</p>
              )}
              {material.teacherName && (
                <p className="mt-3 text-xs text-mute">Shared by {material.teacherName}</p>
              )}
              <button
                type="button"
                onClick={() => selectMaterial(material.id)}
                className="mt-auto rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-[var(--p1)] hover:text-white"
              >
                View material
              </button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
