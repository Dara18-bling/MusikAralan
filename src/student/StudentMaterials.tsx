import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Music } from "lucide-react";
import { toast } from "react-toastify";
import { apiPost, POLL_INTERVAL_DAY, watchApi } from "../api";
import { Card, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";
import { StudentClassWorkspace, type WorkspaceTab } from "./StudentClassWorkspace";

interface StudentMaterialsProps {
  userId: string;
  userName: string;
}

const WORKSPACE_TABS: WorkspaceTab[] = [
  "dashboard",
  "materials",
  "live",
  "assessments",
  "completion",
];

export function StudentMaterials({ userId, userName }: StudentMaterialsProps) {
  const [section, setSection] = useState<"enrolled" | "available">("enrolled");
  const [classCatalog, setClassCatalog] = useState<ClassCatalogItem[]>([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split("/");
  const classId = pathParts[2] === "classes" ? pathParts[3] : "";
  const selectedMaterialId =
    pathParts[4] === "materials" ? pathParts[5] || "" : "";
  const requestedTab = pathParts[4] as WorkspaceTab | undefined;
  const activeTab = selectedMaterialId
    ? "materials"
    : WORKSPACE_TABS.includes(requestedTab || "dashboard")
    ? requestedTab || "dashboard"
    : "dashboard";

  useEffect(
    () =>
      watchApi<{ data: ClassCatalogItem[] }>(
        "/classes",
        ({ data }) => {
          setClassCatalog(data);
          setEnrolledClassIds(
            data
              .filter((item) => item.enrolledStudentIds?.includes(userId))
              .map((item) => item.id),
          );
          setClassesLoaded(true);
        },
        (error) => {
          console.error("Could not load classes:", error);
          setClassesLoaded(true);
          toast.error("Could not load your classes.");
        },
        POLL_INTERVAL_DAY,
      ),
    [userId],
  );

  const enrolledClasses = useMemo(
    () =>
      classCatalog.filter(
        (item) =>
          !item.deleted &&
          userId &&
          (enrolledClassIds.includes(item.id) ||
            item.enrolledStudentIds?.includes(userId)),
      ),
    [classCatalog, enrolledClassIds, userId],
  );
  const availableClasses = useMemo(
    () =>
      classCatalog.filter(
        (item) =>
          !item.deleted &&
          item.availableForEnrollment &&
          !enrolledClassIds.includes(item.id) &&
          !item.enrolledStudentIds?.includes(userId),
      ),
    [classCatalog, enrolledClassIds, userId],
  );
  const selectedClass = enrolledClasses.find((item) => item.id === classId);

  const openClass = (item: ClassCatalogItem) => {
    navigate(`/student/classes/${item.id}/dashboard`);
  };

  const joinClass = async (item: ClassCatalogItem) => {
    if (!userId || item.deleted || !item.availableForEnrollment) return;
    try {
      await apiPost(`/classes/${item.id}/enroll`);
      setEnrolledClassIds((current) => [...new Set([...current, item.id])]);
      setClassCatalog((current) =>
        current.map((classItem) =>
          classItem.id === item.id
            ? {
                ...classItem,
                enrolledStudentIds: [
                  ...new Set([...(classItem.enrolledStudentIds || []), userId]),
                ],
              }
            : classItem,
        ),
      );
      toast.success(`Enrolled in ${item.name}.`);
    } catch (error) {
      console.error("Could not enroll in class:", error);
      const details = error as { message?: string };
      toast.error(
        `Could not enroll in this class: ${details.message || "Please check your connection and try again."}`,
      );
    }
  };

  if (classId && selectedClass) {
    return (
      <StudentClassWorkspace
        classInfo={selectedClass}
        userName={userName}
        activeTab={activeTab}
        selectedMaterialId={selectedMaterialId}
        onSelectTab={(tab) =>
          navigate(`/student/classes/${selectedClass.id}/${tab}`)
        }
        onOpenMaterial={(materialId) =>
          navigate(
            materialId
              ? `/student/classes/${selectedClass.id}/materials/${materialId}`
              : `/student/classes/${selectedClass.id}/materials`,
          )
        }
        onBack={() => navigate("/student/materials")}
      />
    );
  }

  if (classId && classesLoaded && !selectedClass) {
    return (
      <Card className="text-center">
        <p className="text-mute">This class is not available in your enrolled classes.</p>
        <button
          type="button"
          onClick={() => navigate("/student/materials")}
          className="mt-4 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
        >
          Return to classes
        </button>
      </Card>
    );
  }

  if (classId) {
    return <Card className="animate-pulse py-12 text-center text-mute">Loading class workspace…</Card>;
  }

  const visibleClasses = section === "enrolled" ? enrolledClasses : availableClasses;
  return (
    <>
      <Title
        kicker="Learning & Enrollment"
        title="Classes"
        sub="Open a class to view its dashboard, materials, live sessions, assessments, and completion requirements."
        right={
          <div className="flex rounded-full border border-line bg-white p-1 text-sm">
            {([
              ["enrolled", "My Classes"],
              ["available", "Available"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                aria-pressed={section === key}
                className={`rounded-full px-4 py-1.5 font-semibold ${section === key ? "grad text-white" : "text-mute"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {!classesLoaded ? (
        <Card className="animate-pulse py-12 text-center text-mute">Loading classes…</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleClasses.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <div className="grad grid h-28 place-items-center rounded-xl text-white">
                <Music className="h-12 w-12" strokeWidth={1.4} />
              </div>
              <h2 className="mt-4 font-display text-xl">{item.name}</h2>
              <p className="mt-2"><span className="font-semibold">Teacher:</span> {item.teacher}</p>
              <p className="text-sm text-mute">
                Age group: {item.age === "all" ? "All ages" : item.age === "adults" ? "Adults (26+)" : item.age === "kids" ? "Kids (5–12)" : "Youth (13–25)"}
              </p>
              {item.description && <p className="mt-2 text-sm text-mute">{item.description}</p>}
              <div className="mt-auto flex gap-2 pt-4">
                {section === "available" ? (
                  <button
                    type="button"
                    onClick={() => void joinClass(item)}
                    disabled={!userId}
                    className="flex-1 rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Enroll
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openClass(item)}
                    className="flex-1 rounded-full border border-[var(--p1)] px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-p1-soft"
                  >
                    Open class
                  </button>
                )}
              </div>
            </Card>
          ))}
          {visibleClasses.length === 0 && (
            <Card className="text-center text-mute md:col-span-2 xl:col-span-3">
              {section === "enrolled"
                ? "You haven't enrolled in any classes yet."
                : "No classes are currently open for enrollment."}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
