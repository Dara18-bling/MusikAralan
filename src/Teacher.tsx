import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { POLL_INTERVAL_DAY, watchApi } from "./api";
import { Card } from "./ui";
import type { ClassCatalogItem } from "./classCatalog";
import Notifications from "./Notifications";

import { TeacherView } from "./teacher/types";
import { ExpiryBanner } from "./teacher/ExpiryBanner";
import { Dashboard } from "./teacher/Dashboard";
import { StudentList } from "./teacher/StudentList";
import { TeacherClasses } from "./teacher/TeacherClasses";
import { Upload } from "./teacher/Upload";
import { Quiz } from "./teacher/Quiz";
import { Meet } from "./teacher/Meet";

export type { TeacherView };

interface TeacherProps {
  view: TeacherView;
  userId: string;
  go: (view: string) => void;
}

export default function Teacher({ view, userId, go }: TeacherProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const loggedInTeacherName = localStorage.getItem("name") || "Teacher User";
  const [teacherIdentity, setTeacherIdentity] = useState(loggedInTeacherName);
  const [teacherAccessUntil, setTeacherAccessUntil] = useState<string | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<ClassCatalogItem[]>(
    [],
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const requestedClassId = searchParams.get("classId") || "";
  const assessmentId = searchParams.get("assessmentId") || "";

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
      POLL_INTERVAL_DAY,
    );
  }, [userId, loggedInTeacherName]);

  useEffect(() => {
    if (!userId) return;
    return watchApi<{ data: ClassCatalogItem[] }>(
      "/classes",
      ({ data }) => {
        setAssignedClasses(data.filter((item) => !item.deleted));
      },
      (error) => console.error("Could not load assigned classes:", error),
      POLL_INTERVAL_DAY,
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
    if (view === "quiz" && requestedClassId !== nextClassId) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("classId", nextClassId);
          next.delete("assessmentId");
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
          onChooseAction={(classId, nextView) => {
            setSelectedClassId(classId);
            if (nextView === "quiz") {
              go(`quiz?classId=${encodeURIComponent(classId)}`);
              return;
            }
            go(nextView);
          }}
        />
      ) : view === "students" ? (
        <StudentList
          className={selectedClass?.name}
          classId={selectedClass?.id}
          studentIds={selectedClass?.enrolledStudentIds || []}
        />
      ) : view === "quiz" ? (
        <Quiz
          className={selectedClass?.name}
          classId={selectedClass?.id}
          assessmentId={assessmentId}
          onAssessmentChange={updateAssessmentId}
        />
      ) : view === "meet" ? (
        <Meet classes={assignedClasses} />
      ) : view === "alerts" ? (
        <Notifications role="teacher" />
      ) : (
        <Upload
          className={selectedClass?.name}
          classId={selectedClass?.id}
          teacherName={teacherIdentity}
        />
      )}
    </>
  );
}
