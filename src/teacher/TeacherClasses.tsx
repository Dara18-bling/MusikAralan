import type { ClassCatalogItem } from "../classCatalog";
import { Card, Pill, Title } from "../ui";

interface TeacherClassesProps {
  classes: ClassCatalogItem[];
  onChooseAction: (classId: string, view: "upload" | "quiz" | "students") => void;
}

export function TeacherClasses({ classes, onChooseAction }: TeacherClassesProps) {
  return (
    <>
      <Title kicker="Class Management" title="My Classes" sub="All classes assigned to your teacher account." />
      {classes.length === 0 ? (
        <Card className="mt-5 py-8 text-center text-mute">No classes are currently assigned to you.</Card>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {classes.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{item.name}</h2>
                  <p className="mt-1 text-sm text-mute">{item.age === "all" ? "All ages" : `${item.age} age group`}</p>
                </div>
                <Pill tone={item.availableForEnrollment ? "p1" : "p2"}>
                  {item.availableForEnrollment ? "Enrollment open" : "Enrollment closed"}
                </Pill>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{item.description || "No class description provided."}</p>
              <p className="mt-4 text-sm text-mute">{item.enrolledStudentIds?.length || 0} enrolled students</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => onChooseAction(item.id, "upload")} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white">Upload Content</button>
                <button type="button" onClick={() => onChooseAction(item.id, "quiz")} className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Assessment Builder</button>
                <button type="button" onClick={() => onChooseAction(item.id, "students")} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50">My Students</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}