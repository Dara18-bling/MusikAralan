import { useState } from "react";
import { Music } from "lucide-react";
import type { ClassCatalogItem } from "../classCatalog";
import { Card, Pill, Title } from "../ui";
import { Meet } from "./Meet";
import { Quiz } from "./Quiz";
import { StudentList } from "./StudentList";
import { TeacherMaterials } from "./TeacherMaterials";
import { Upload } from "./Upload";

type ClassTab = "overview" | "materials" | "upload" | "assessments" | "live" | "students";

const CLASS_TABS: { id: ClassTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Learning Materials" },
  { id: "upload", label: "Upload Content" },
  { id: "assessments", label: "Assessment Builder" },
  { id: "live", label: "Live Sessions" },
  { id: "students", label: "My Students" },
];

interface TeacherClassesProps {
  classes: ClassCatalogItem[];
  teacherName: string;
  savingCertificateClassId: string | null;
  onToggleCertificates: (classId: string, unlocked: boolean) => Promise<void>;
}

export function TeacherClasses({
  classes,
  teacherName,
  savingCertificateClassId,
  onToggleCertificates,
}: TeacherClassesProps) {
  const [openedClassId, setOpenedClassId] = useState("");
  const [activeTab, setActiveTab] = useState<ClassTab>("overview");
  const [assessmentId, setAssessmentId] = useState("");
  const openedClass = classes.find((item) => item.id === openedClassId);

  if (openedClass) {
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => { setOpenedClassId(""); setActiveTab("overview"); setAssessmentId(""); }}
          className="mb-4 text-sm font-semibold text-p1 hover:underline"
        >
          ← Back to classes
        </button>
        <div className="min-w-0">
          <Title
            kicker="Class workspace"
            title={openedClass.name}
            sub={`${openedClass.teacher || teacherName} · ${openedClass.description || "Manage this class and its learning activities."}`}
          />
        </div>
        <div className="mb-6 overflow-x-auto border-b border-line">
          <div className="flex w-max min-w-full gap-1" role="tablist" aria-label={`${openedClass.name} teacher tools`}>
            {CLASS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-[var(--p1)] text-p1" : "border-transparent text-mute hover:border-line hover:text-ink"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Card>
              <p className="text-sm text-mute">Age group</p>
              <p className="mt-1 font-display text-xl capitalize">{openedClass.age === "all" ? "All ages" : openedClass.age}</p>
              <p className="mt-4 text-sm text-mute">Enrollment</p>
              <Pill tone={openedClass.availableForEnrollment ? "p1" : "p2"}>
                {openedClass.availableForEnrollment ? "Open" : "Closed"}
              </Pill>
              <p className="mt-4 text-sm text-mute">Students enrolled</p>
              <p className="mt-1 font-display text-3xl">{openedClass.enrolledStudentIds?.length || 0}</p>
            </Card>
            <Card>
              <p className="font-semibold">Certificate access</p>
              <p className="mt-2 text-sm text-mute">
                Certificates are {openedClass.certificatesUnlocked === false ? "locked" : "unlocked"} for this class.
              </p>
              <button
                type="button"
                disabled={savingCertificateClassId === openedClass.id}
                onClick={() => void onToggleCertificates(openedClass.id, openedClass.certificatesUnlocked === false)}
                className="mt-4 rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-p1-soft disabled:opacity-50"
              >
                {savingCertificateClassId === openedClass.id
                  ? "Saving…"
                  : openedClass.certificatesUnlocked === false
                    ? "Unlock certificates"
                    : "Lock certificates"}
              </button>
            </Card>
          </div>
        )}
        <div className="min-w-0">
          {activeTab === "materials" && <TeacherMaterials classId={openedClass.id} className={openedClass.name} />}
          {activeTab === "upload" && <Upload classId={openedClass.id} className={openedClass.name} teacherName={teacherName} />}
          {activeTab === "assessments" && <Quiz classId={openedClass.id} className={openedClass.name} assessmentId={assessmentId} onAssessmentChange={setAssessmentId} />}
          {activeTab === "live" && <Meet classes={[openedClass]} embedded />}
          {activeTab === "students" && <StudentList classId={openedClass.id} className={openedClass.name} studentIds={openedClass.enrolledStudentIds || []} />}
        </div>
      </div>
    );
  }

  return (
    <>
      <Title kicker="Class Management" title="My Classes" sub="Open a class to manage its materials, assessments, live sessions, and students." />
      {classes.length === 0 ? (
        <Card className="mt-5 py-8 text-center text-mute">No classes are currently assigned to you.</Card>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((item) => (
            <Card key={item.id} className="flex min-w-0 flex-col">
              <div className="grad grid h-28 place-items-center rounded-xl text-white">
                <Music className="h-12 w-12" strokeWidth={1.4} />
              </div>
              <h2 className="mt-4 font-display text-xl">{item.name}</h2>
              <p className="mt-2 text-sm text-mute">Age group: {item.age === "all" ? "All ages" : item.age === "adults" ? "Adults (26+)" : item.age === "kids" ? "Kids (5–12)" : "Youth (13–25)"}</p>
              {item.description && <p className="mt-2 break-words text-sm text-mute">{item.description}</p>}
              <p className="mt-2 text-sm text-mute">{item.enrolledStudentIds?.length || 0} enrolled students</p>
              <button
                type="button"
                onClick={() => { setOpenedClassId(item.id); setActiveTab("overview"); setAssessmentId(""); }}
                className="mt-auto w-full rounded-full border border-[var(--p1)] px-4 py-2.5 text-sm font-semibold text-p1 transition hover:bg-p1-soft"
              >
                Open
              </button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
