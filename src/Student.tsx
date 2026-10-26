import PianoQuiz from "./PianoQuiz";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import Notifications from "./Notifications";
import type { StudentView } from "./student/studentTypes";
import { StudentHome } from "./student/StudentHome";
import { StudentMaterials } from "./student/StudentMaterials";
import { StudentLive } from "./student/StudentLive";
import { StudentExams } from "./student/StudentExams";
import { StudentHelp } from "./student/StudentHelp";
import { StudentAssessments } from "./student/StudentAssessments";

export type { StudentView };

interface AssessmentClass {
  id: string;
  name: string;
}

interface StudentProps {
  view: StudentView;
  go: (v: StudentView) => void;
  age: string;
  userName: string;
  userId: string;
}

export default function Student({
  view,
  go,
  age,
  userName,
  userId,
}: StudentProps) {
  const [assessmentClass, setAssessmentClass] = useState<AssessmentClass | null>(null);

  if (view === "notes") return <PianoQuiz />;
  if (view === "materials") {
    return (
      <StudentMaterials
        userId={userId}
        userName={userName}
        onViewAssessments={(classId, className) => {
          setAssessmentClass({ id: classId, name: className });
          go("class-assessments");
        }}
      />
    );
  }
  if (view === "class-assessments") {
    if (!assessmentClass) {
      return <Navigate to="/student/materials" replace />;
    }
    return (
      <StudentAssessments
        classId={assessmentClass.id}
        className={assessmentClass.name}
        onBack={() => go("materials")}
      />
    );
  }
  if (view === "live") return <StudentLive />;
  if (view === "exams") return <StudentExams />;
  if (view === "help") return <StudentHelp />;
  if (view === "alerts") return <Notifications role="student" age={age} />;
  return <StudentHome go={go} age={age} userName={userName} />;
}