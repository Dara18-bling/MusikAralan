import PianoQuiz from "./PianoQuiz";
import { Navigate } from "react-router-dom";
import Notifications from "./Notifications";
import type { StudentView } from "./student/studentTypes";
import { StudentHome } from "./student/StudentHome";
import { StudentMaterials } from "./student/StudentMaterials";
import { StudentHelp } from "./student/StudentHelp";

export type { StudentView };

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
  if (view === "notes") return <PianoQuiz />;
  if (view === "materials") return <StudentMaterials userId={userId} userName={userName} />;
  if (view === "class-assessments" || view === "live" || view === "exams") {
    return <Navigate to="/student/materials" replace />;
  }
  if (view === "help") return <StudentHelp />;
  if (view === "alerts") return <Notifications role="student" age={age} />;
  return <StudentHome go={go} age={age} userName={userName} />;
}