import { useSearchParams } from "react-router-dom";
import { Breadcrumbs } from "../app/Breadcrumbs";
import type { ClassCatalogItem } from "../classCatalog";
import { Card, Label, Pill, Title } from "../ui";
import { StudentList } from "./StudentList";
import { TeacherMaterials } from "./TeacherMaterials";
import { Upload } from "./Upload";
import { Quiz } from "./Quiz";
import { Meet } from "./Meet";
import type { TeacherWorkspaceTab } from "./types";

const TABS: { id: TeacherWorkspaceTab; label: string }[] = [
  { id: "dashboard", label: "Class Dashboard" },
  { id: "live", label: "Live Sessions" },
  { id: "upload", label: "Upload Content" },
  { id: "materials", label: "View Content" },
  { id: "assessments", label: "Assessment Builder" },
  { id: "students", label: "My Students" },
  { id: "certifications", label: "Certifications" },
];

interface TeacherClassWorkspaceProps {
  classInfo: ClassCatalogItem;
  teacherName: string;
  savingCertificate: boolean;
  onToggleCertificates: (unlocked: boolean) => Promise<void>;
  onAssessmentChange: (assessmentId: string) => void;
}

export function TeacherClassWorkspace({
  classInfo,
  teacherName,
  savingCertificate,
  onToggleCertificates,
  onAssessmentChange,
}: TeacherClassWorkspaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as TeacherWorkspaceTab | null;
  const activeTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab!
    : "dashboard";
  const assessmentId = searchParams.get("assessmentId") || "";
  const certificatesUnlocked = classInfo.certificatesUnlocked !== false;

  const selectTab = (tab: TeacherWorkspaceTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("classId", classInfo.id);
      next.set("tab", tab);
      if (tab !== "assessments") next.delete("assessmentId");
      if (tab !== "materials") next.delete("materialId");
      return next;
    });
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "My Classes", href: "/teacher/classes" },
          { label: classInfo.name },
          ...(activeTab === "dashboard"
            ? []
            : [{ label: TABS.find((tab) => tab.id === activeTab)?.label || "" }]),
        ]}
      />
      <Title
        kicker="Class workspace"
        title={classInfo.name}
        sub={`${classInfo.age === "all" ? "All ages" : `${classInfo.age} age group`} · ${classInfo.enrolledStudentIds?.length || 0} enrolled students`}
      />
      <div
        className="mb-6 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label={`${classInfo.name} workspace sections`}
      >
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`teacher-class-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="teacher-class-tab-panel"
              onClick={() => selectTab(tab.id)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-[var(--p1)] text-p1"
                  : "border-transparent text-mute hover:border-line hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section
        id="teacher-class-tab-panel"
        role="tabpanel"
        aria-labelledby={`teacher-class-tab-${activeTab}`}
      >
        {activeTab === "dashboard" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <Label>Class overview</Label>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink">
                {classInfo.description || "No class description provided."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill tone={classInfo.availableForEnrollment ? "p1" : "p2"}>
                  {classInfo.availableForEnrollment
                    ? "Enrollment open"
                    : "Enrollment closed"}
                </Pill>
                <Pill tone={certificatesUnlocked ? "p1" : "p2"}>
                  Certificates {certificatesUnlocked ? "unlocked" : "locked"}
                </Pill>
              </div>
            </Card>
            <Card>
              <Label>Workspace sections</Label>
              <p className="mt-3 text-sm text-mute">
                Use the tabs above to manage sessions, learning content,
                assessments, students, and certificate access for this class.
              </p>
            </Card>
          </div>
        )}
        {activeTab === "live" && (
          <Meet classes={[classInfo]} fixedClassId={classInfo.id} />
        )}
        {activeTab === "upload" && (
          <Upload
            classId={classInfo.id}
            teacherName={teacherName}
          />
        )}
        {activeTab === "materials" && (
          <TeacherMaterials
            classId={classInfo.id}
            className={classInfo.name}
          />
        )}
        {activeTab === "assessments" && (
          <Quiz
            classId={classInfo.id}
            assessmentId={assessmentId}
            onAssessmentChange={onAssessmentChange}
          />
        )}
        {activeTab === "students" && (
          <StudentList
            classId={classInfo.id}
            studentIds={classInfo.enrolledStudentIds || []}
          />
        )}
        {activeTab === "certifications" && (
          <Card className="max-w-2xl">
            <Label>Certificate access</Label>
            <h2 className="mt-2 font-display text-2xl">
              Certificates are {certificatesUnlocked ? "unlocked" : "locked"}
            </h2>
            <p className="mt-2 text-sm text-mute">
              {certificatesUnlocked
                ? "Students who complete this class can download their certificates."
                : "Certificate downloads are disabled for students in this class."}
            </p>
            <button
              type="button"
              disabled={savingCertificate}
              onClick={() => void onToggleCertificates(!certificatesUnlocked)}
              className="mt-5 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white disabled:opacity-50"
            >
              {savingCertificate
                ? "Saving…"
                : certificatesUnlocked
                  ? "Lock certificates"
                  : "Unlock certificates"}
            </button>
          </Card>
        )}
      </section>
    </>
  );
}
