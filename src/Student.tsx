import PianoQuiz from "./PianoQuiz";
import Notifications from "./Notifications";
import type { StudentView } from "./student/studentTypes";
import { Gospel } from "./student/Gospel";
import { StudentHome } from "./student/StudentHome";
import { StudentMaterials } from "./student/StudentMaterials";
import { StudentLive } from "./student/StudentLive";
import { StudentExams } from "./student/StudentExams";
import { StudentHelp } from "./student/StudentHelp";

export type { StudentView };
export { Gospel };

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
  if (view === "live") return <StudentLive />;
  if (view === "exams") return <StudentExams userName={userName} />;
  if (view === "help") return <StudentHelp />;
  if (view === "alerts") return <Notifications role="student" age={age} />;
  return <StudentHome go={go} age={age} userName={userName} />;
}