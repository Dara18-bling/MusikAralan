import { useState } from "react";
import { Quiz } from "../teacher/Quiz";
import { StudentList } from "../teacher/StudentList";
import { TeacherMaterials } from "../teacher/TeacherMaterials";
import { Upload } from "../teacher/Upload";
import { Breadcrumbs } from "../app/Breadcrumbs";
import type { ClassCatalogItem } from "../classCatalog";
import { Title } from "../ui";

type ContentTab = "materials" | "upload" | "assessments" | "students";

const TABS: { id: ContentTab; label: string }[] = [
  { id: "materials", label: "Materials & links" },
  { id: "upload", label: "Add material" },
  { id: "assessments", label: "Assessments" },
  { id: "students", label: "Student progress" },
];

interface AdminClassContentProps {
  classInfo: ClassCatalogItem;
  onBack: () => void;
}

export function AdminClassContent({
  classInfo,
  onBack,
}: AdminClassContentProps) {
  const [activeTab, setActiveTab] = useState<ContentTab>("materials");
  const [assessmentId, setAssessmentId] = useState("");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Manage Classes", onClick: onBack },
          { label: classInfo.name },
          { label: TABS.find((tab) => tab.id === activeTab)?.label || "" },
        ]}
      />
      <Title
        kicker="Class content"
        title={classInfo.name}
        sub={`${classInfo.teacher || "Unassigned"} · Manage class materials, links, assessments, and student progress.`}
      />
      <div
        className="mt-5 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label={`${classInfo.name} content sections`}
      >
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`admin-class-content-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="admin-class-content-panel"
              onClick={() => setActiveTab(tab.id)}
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
        id="admin-class-content-panel"
        role="tabpanel"
        aria-labelledby={`admin-class-content-tab-${activeTab}`}
        className="mt-5"
      >
        {activeTab === "materials" && (
          <TeacherMaterials classId={classInfo.id} className={classInfo.name} />
        )}
        {activeTab === "upload" && <Upload classId={classInfo.id} />}
        {activeTab === "assessments" && (
          <Quiz
            key={classInfo.id}
            classId={classInfo.id}
            assessmentId={assessmentId}
            onAssessmentChange={setAssessmentId}
          />
        )}
        {activeTab === "students" && (
          <StudentList
            classId={classInfo.id}
            studentIds={classInfo.enrolledStudentIds || []}
          />
        )}
      </section>
    </>
  );
}
