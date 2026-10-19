import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
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
  const loggedInTeacherName = localStorage.getItem("name") || "Teacher User";
  const [teacherIdentity, setTeacherIdentity] = useState(loggedInTeacherName);
  const [assignedClasses, setAssignedClasses] = useState<ClassCatalogItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const profile = snapshot.data();
        setTeacherIdentity(String(profile.name || profile.email || loggedInTeacherName).trim());
      },
      (error) => console.error("Could not load teacher profile:", error)
    );
  }, [userId, loggedInTeacherName]);

  useEffect(() => {
    return onSnapshot(
      collection(db, "classes"),
      (snapshot) => {
        const teacherClasses = snapshot.docs
          .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() } as ClassCatalogItem))
          .filter(
            (item) =>
              !item.deleted &&
              String(item.teacher || "").trim().toLowerCase() === teacherIdentity.toLowerCase()
          );
        setAssignedClasses(teacherClasses);
        setSelectedClassId((current) =>
          teacherClasses.some((item) => item.id === current) ? current : teacherClasses[0]?.id || ""
        );
      },
      (error) => console.error("Could not load assigned classes:", error)
    );
  }, [teacherIdentity]);

  const selectedClass = assignedClasses.find((item) => item.id === selectedClassId);

  return (
    <>
      {(view === "dash" || view === "classes") && (
        <ExpiryBanner teacherName={loggedInTeacherName} userId={userId} />
      )}
      {view === "meet" && (
        <Card className="mb-5 flex flex-wrap items-center gap-3">
          <label htmlFor="teacher-class-selector" className="text-sm font-semibold">
            Accessing class
          </label>
          <select
            id="teacher-class-selector"
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            disabled={assignedClasses.length === 0}
            className="min-w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {assignedClasses.length === 0 ? (
              <option value="">No classes assigned</option>
            ) : (
              assignedClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
          {selectedClass && <span className="text-sm text-mute">{selectedClass.description}</span>}
        </Card>
      )}
      {view === "dash" ? (
        <Dashboard />
      ) : view === "classes" ? (
        <TeacherClasses
          classes={assignedClasses}
          onChooseAction={(classId, nextView) => {
            setSelectedClassId(classId);
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
        <Quiz className={selectedClass?.name} classId={selectedClass?.id} />
      ) : view === "meet" ? (
        <Meet />
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