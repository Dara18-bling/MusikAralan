import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  apiPatch,
  refreshApi,
  watchApi,
} from "./api";
import { Card } from "./ui";
import type { ClassCatalogItem } from "./classCatalog";
import Notifications from "./Notifications";

import { TeacherView } from "./teacher/types";
import { ExpiryBanner } from "./teacher/ExpiryBanner";
import { Dashboard } from "./teacher/Dashboard";
import { TeacherClasses } from "./teacher/TeacherClasses";
import { TeacherClassWorkspace } from "./teacher/TeacherClassWorkspace";
import type { TeacherWorkspaceTab } from "./teacher/types";

export type { TeacherView };

const LEGACY_WORKSPACE_TABS: Partial<Record<TeacherView, TeacherWorkspaceTab>> = {
  upload: "upload",
  materials: "materials",
  quiz: "assessments",
  students: "students",
};

interface TeacherProps {
  view: TeacherView;
  userId: string;
  go: (view: string) => void;
}

export default function Teacher({ view, userId, go }: TeacherProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const loggedInTeacherName = localStorage.getItem("name") || "Teacher User";
  const [teacherIdentity, setTeacherIdentity] = useState(loggedInTeacherName);
  const [teacherAccessUntil, setTeacherAccessUntil] = useState<string | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<ClassCatalogItem[]>(
    [],
  );
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [savingCertificateClassId, setSavingCertificateClassId] = useState<string | null>(null);
  const requestedClassId = searchParams.get("classId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";
  const legacyWorkspaceTab = LEGACY_WORKSPACE_TABS[view];

  useEffect(() => {
    if (!userId) return;
    return watchApi<{ user: { name?: string; email?: string; accessUntil?: string | null } }>(
      "/me",
      ({ user }) => {
        setTeacherIdentity(
          String(user.name || user.email || loggedInTeacherName).trim(),
        );
        setTeacherAccessUntil(user.accessUntil || null);
      },
      (error) => console.error("Could not load teacher profile:", error),
    );
  }, [userId, loggedInTeacherName]);

  useEffect(() => {
    if (!userId) return;
    return watchApi<{ data: ClassCatalogItem[] }>(
      "/classes",
      ({ data }) => {
        setAssignedClasses(data.filter((item) => !item.deleted));
        setClassesLoaded(true);
      },
      (error) => {
        console.error("Could not load assigned classes:", error);
        setClassesLoaded(true);
      },
    );
  }, [userId]);

  useEffect(() => {
    if (assignedClasses.length === 0) {
      setSelectedClassId("");
      return;
    }
    const nextClassId = assignedClasses.some(
      (item) => item.id === requestedClassId,
    )
      ? requestedClassId
      : assignedClasses.some((item) => item.id === selectedClassId)
        ? selectedClassId
        : assignedClasses[0].id;

    setSelectedClassId(nextClassId);
    if (view === "workspace" && requestedClassId !== nextClassId) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("classId", nextClassId);
          next.set("tab", "dashboard");
          next.delete("assessmentId");
          next.delete("materialId");
          return next;
        },
        { replace: true },
      );
    }
  }, [
    assignedClasses,
    requestedClassId,
    selectedClassId,
    setSearchParams,
    view,
  ]);

  useEffect(() => {
    if (!legacyWorkspaceTab || !classesLoaded) return;
    const targetClass = assignedClasses.find(
      (item) => item.id === requestedClassId,
    ) || assignedClasses[0];
    if (!targetClass) {
      navigate("/teacher/classes", { replace: true });
      return;
    }

    navigate(
      `/teacher/workspace?classId=${encodeURIComponent(targetClass.id)}&tab=${legacyWorkspaceTab}`,
      { replace: true },
    );
  }, [
    assignedClasses,
    classesLoaded,
    legacyWorkspaceTab,
    navigate,
    requestedClassId,
  ]);

  const updateAssessmentId = useCallback(
    (nextAssessmentId: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (selectedClassId) next.set("classId", selectedClassId);
          if (nextAssessmentId) next.set("assessmentId", nextAssessmentId);
          else next.delete("assessmentId");
          return next;
        },
        { replace: true },
      );
    },
    [selectedClassId, setSearchParams],
  );

  const selectedClass = assignedClasses.find(
    (item) => item.id === selectedClassId,
  );

  const toggleClassCertificates = async (
    classId: string,
    certificatesUnlocked: boolean,
  ) => {
    setSavingCertificateClassId(classId);
    try {
      const { class: updatedClass } = await apiPatch<{
        class: ClassCatalogItem;
      }>(`/classes/${encodeURIComponent(classId)}/certificate-access`, {
        certificatesUnlocked,
      });
      setAssignedClasses((current) =>
        current.map((item) => item.id === classId ? updatedClass : item),
      );
      refreshApi("/classes");
      toast.success(
        certificatesUnlocked
          ? `Certificates unlocked for ${updatedClass.name}.`
          : `Certificates locked for ${updatedClass.name}.`,
      );
    } catch (error) {
      console.error("Could not update class certificate access:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update certificate access for this class.",
      );
    } finally {
      setSavingCertificateClassId(null);
    }
  };

  if (view === "meet") return <Navigate to="/teacher/classes" replace />;
  if (legacyWorkspaceTab) {
    return <Card className="animate-pulse py-12 text-center text-mute">Opening class workspace…</Card>;
  }

  return (
    <>
      {(view === "dash" || view === "classes") && (
        <ExpiryBanner teacherName={teacherIdentity} accessUntil={teacherAccessUntil} />
      )}
      {view === "dash" ? (
        <Dashboard />
      ) : view === "classes" ? (
        <TeacherClasses
          classes={assignedClasses}
          onOpenClass={(classId) => {
            go(`workspace?classId=${encodeURIComponent(classId)}&tab=dashboard`);
          }}
        />
      ) : view === "workspace" ? (
        selectedClass ? (
          <TeacherClassWorkspace
            classInfo={selectedClass}
            teacherName={teacherIdentity}
            savingCertificate={savingCertificateClassId === selectedClass.id}
            onToggleCertificates={(unlocked) =>
              toggleClassCertificates(selectedClass.id, unlocked)
            }
            onAssessmentChange={updateAssessmentId}
          />
        ) : classesLoaded ? (
          <Card className="text-center text-mute">
            No class is currently assigned to your account.
          </Card>
        ) : (
          <Card className="animate-pulse py-12 text-center text-mute">
            Loading class workspace…
          </Card>
        )
      ) : view === "alerts" ? (
        <Notifications role="teacher" />
      ) : null}
    </>
  );
}
