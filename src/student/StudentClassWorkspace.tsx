import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Users, Video } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "react-toastify";
import {
  apiPost,
  POLL_INTERVAL_TWO_MINUTES,
  watchApi,
} from "../api";
import { Card, Label, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";
import { StudentAssessments } from "./StudentAssessments";
import { StudentMaterialViewer } from "./StudentMaterialViewer";

export type Material = {
  id: string;
  title: string;
  description: string;
  kind: string;
  mediaUrl?: string | null;
  streamUrl?: string | null;
  teacherName?: string | null;
  files?: { name: string; url: string }[];
  links?: { url: string }[];
};

type AssessmentSummary = {
  id: string;
  assessmentCode: string;
  title: string;
  passingPercent: number;
  questionCount: number;
  allowsRetakes: boolean;
  latestAttempt: { score: number; passed: boolean; submittedAt: string } | null;
  recentAttempts: {
    id: string;
    score: number;
    passed: boolean;
    submittedAt: string;
  }[];
};

type Schedule = {
  id: string;
  classId: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  joinUrl: string | null;
};

type Progress = {
  completedMaterialIds: string[];
};

export type WorkspaceTab =
  | "dashboard"
  | "materials"
  | "live"
  | "assessments"
  | "completion";

interface StudentClassWorkspaceProps {
  classInfo: ClassCatalogItem;
  userName: string;
  activeTab: WorkspaceTab;
  selectedMaterialId: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenMaterial: (materialId: string) => void;
  onBack: () => void;
}

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "materials", label: "Materials" },
  { id: "live", label: "Live Sessions" },
  { id: "assessments", label: "Assessments" },
  { id: "completion", label: "Completion Requirements" },
];

export function StudentClassWorkspace({
  classInfo,
  userName,
  activeTab,
  selectedMaterialId,
  onSelectTab,
  onOpenMaterial,
  onBack,
}: StudentClassWorkspaceProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [classmateCount, setClassmateCount] = useState(0);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [progress, setProgress] = useState<Progress>({
    completedMaterialIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const reportError = (label: string) => (requestError: unknown) => {
      console.error(label, requestError);
      if (active) setError("Some class information could not be refreshed.");
    };
    const classPath = `/classes/${classInfo.id}`;
    setLoading(true);
    setError("");

    const stopMaterials = watchApi<{ data: Material[] }>(
      `${classPath}/materials`,
      ({ data }) => {
        setMaterials(data);
        setLoading(false);
      },
      reportError("Could not load class materials:"),
      POLL_INTERVAL_TWO_MINUTES,
    );
    const stopAssessments = watchApi<{ data: AssessmentSummary[] }>(
      `${classPath}/assessments`,
      ({ data }) => {
        setAssessments(data);
        setLoading(false);
      },
      reportError("Could not load class assessments:"),
      POLL_INTERVAL_TWO_MINUTES,
    );
    const stopClassmates = watchApi<{ count: number }>(
      `${classPath}/students`,
      ({ count }) => {
        setClassmateCount(count);
        setLoading(false);
      },
      reportError("Could not load classmates:"),
      POLL_INTERVAL_TWO_MINUTES,
    );
    const stopProgress = watchApi<{ progress: Progress }>(
      `${classPath}/progress`,
      ({ progress: currentProgress }) => {
        setProgress(currentProgress);
        setLoading(false);
      },
      reportError("Could not load class progress:"),
      POLL_INTERVAL_TWO_MINUTES,
    );
    const stopSchedules = watchApi<{ data: Schedule[] }>(
      "/schedules",
      ({ data }) => {
        setSchedules(data.filter((schedule) => schedule.classId === classInfo.id));
        setLoading(false);
      },
      reportError("Could not load class sessions:"),
      POLL_INTERVAL_TWO_MINUTES,
    );

    return () => {
      active = false;
      stopMaterials();
      stopAssessments();
      stopClassmates();
      stopProgress();
      stopSchedules();
    };
  }, [classInfo.id]);

  const completedMaterialIds = progress.completedMaterialIds || [];
  const incompleteMaterials = materials.filter(
    (material) => !completedMaterialIds.includes(material.id),
  );
  const unpassedAssessments = assessments.filter(
    (assessment) => !assessment.latestAttempt?.passed,
  );
  const completedMaterialCount = materials.length - incompleteMaterials.length;
  const completedRequirements =
    completedMaterialCount +
    assessments.length - unpassedAssessments.length;
  const requirementCount = materials.length + assessments.length;
  const progressTotal = materials.length || assessments.length;
  const completionPercent = progressTotal
    ? Math.round(
        ((materials.length
          ? completedMaterialCount
          : assessments.length - unpassedAssessments.length) /
          progressTotal) *
          100,
      )
    : 0;
  const classFinished = requirementCount > 0 && completedRequirements === requirementCount;
  const upcomingSessions = useMemo(
    () =>
      schedules
        .filter((schedule) => new Date(schedule.startsAt).getTime() >= Date.now())
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
        ),
    [schedules],
  );
  const nextSession = upcomingSessions[0];
  const selectedMaterial = materials.find(
    (material) => material.id === selectedMaterialId,
  );

  const markMaterialComplete = async (materialId: string): Promise<boolean> => {
    try {
      await apiPost(`/classes/${classInfo.id}/materials/${materialId}/complete`);
      setProgress((current) => ({
        ...current,
        completedMaterialIds: [
          ...new Set([...current.completedMaterialIds, materialId]),
        ],
      }));
      toast.success("Material marked as complete.");
      return true;
    } catch (requestError) {
      console.error("Could not save material progress:", requestError);
      toast.error("Could not save your progress. Please try again.");
      return false;
    }
  };

  const downloadCertificate = () => {
    if (!classFinished) return;
    const certificate = new jsPDF({ orientation: "landscape" });
    certificate.setFontSize(30);
    certificate.text("Certificate of Completion", 148, 55, { align: "center" });
    certificate.setFontSize(16);
    certificate.text("This certifies that", 148, 82, { align: "center" });
    certificate.setFontSize(25);
    certificate.text(userName || "Student", 148, 101, { align: "center" });
    certificate.setFontSize(16);
    certificate.text(`has completed ${classInfo.name}`, 148, 121, { align: "center" });
    certificate.setFontSize(12);
    certificate.text(`Issued ${new Date().toLocaleDateString()}`, 148, 145, { align: "center" });
    certificate.save(`${classInfo.name.replace(/[^a-z0-9]+/gi, "-")}-certificate.pdf`);
  };

  if (selectedMaterialId) {
    if (loading && !selectedMaterial) {
      return <Card className="animate-pulse py-12 text-center text-mute">Loading material…</Card>;
    }
    if (!selectedMaterial) {
      return (
        <Card className="text-center">
          <p className="text-mute">This material is no longer available.</p>
          <button
            type="button"
            onClick={() => onOpenMaterial("")}
            className="mt-4 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
          >
            Go back to {classInfo.name}
          </button>
        </Card>
      );
    }
    return (
      <StudentMaterialViewer
        className={classInfo.name}
        material={selectedMaterial}
        completed={completedMaterialIds.includes(selectedMaterial.id)}
        onBack={() => onOpenMaterial("")}
        onMarkComplete={() => markMaterialComplete(selectedMaterial.id)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm font-semibold text-p1 hover:underline"
      >
        ← Back to classes
      </button>
      <Title
        kicker="Class workspace"
        title={classInfo.name}
        sub={`${classInfo.teacher || "Class teacher"} · ${classInfo.description || "Your class dashboard and learning requirements."}`}
      />

      <div className="mb-6 overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-1" role="tablist" aria-label={`${classInfo.name} sections`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`class-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="class-tab-panel"
              onClick={() => onSelectTab(tab.id)}
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
        id="class-tab-panel"
        role="tabpanel"
        aria-labelledby={`class-tab-${activeTab}`}
        className="grid gap-5"
      >
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {activeTab === "dashboard" && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <Label>Learning materials</Label>
                <p className="mt-2 font-display text-3xl">{materials.length}</p>
                <p className="text-sm text-mute">{completedMaterialIds.length} completed</p>
              </Card>
              <Card>
                <Label>Assessments</Label>
                <p className="mt-2 font-display text-3xl">{assessments.length}</p>
                <p className="text-sm text-mute">
                  {assessments.filter((item) => item.latestAttempt?.passed).length} passed
                </p>
              </Card>
              <Card>
                <Label>Classmates</Label>
                <p className="mt-2 flex items-center gap-2 font-display text-3xl">
                  <Users className="h-6 w-6 text-p1" /> {classmateCount}
                </p>
              </Card>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <Label>Next live session</Label>
                {nextSession ? (
                  <>
                    <h2 className="mt-2 font-display text-2xl">{nextSession.title}</h2>
                    <p className="mt-1 text-sm text-mute">{new Date(nextSession.startsAt).toLocaleString()}</p>
                    {nextSession.joinUrl && (
                      <a href={nextSession.joinUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white">
                        <Video className="h-4 w-4" /> Join session
                      </a>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-mute">No upcoming sessions are scheduled for this class.</p>
                )}
              </Card>
              <Card>
                <Label>Materials completed</Label>
                <p className="mt-2 font-display text-4xl">{completionPercent}%</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Class completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
                  <div className="h-full grad transition-all" style={{ width: `${completionPercent}%` }} />
                </div>
                <p className="mt-2 text-sm text-mute">
                  {completedMaterialCount} of {materials.length} materials complete
                  {unpassedAssessments.length > 0 && ` · ${unpassedAssessments.length} assessment${unpassedAssessments.length === 1 ? "" : "s"} still need passing`}
                </p>
              </Card>
            </div>
          </>
        )}

        {activeTab === "materials" && (
          <div className="grid gap-4">
            {materials.map((material) => {
              return (
                <Card key={material.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Label>{material.kind}</Label>
                      <h2 className="mt-1 font-display text-xl">{material.title}</h2>
                      {material.description && <p className="mt-1 whitespace-pre-wrap text-sm text-mute">{material.description}</p>}
                      {material.teacherName && <p className="mt-1 text-xs text-mute">Uploaded by {material.teacherName}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenMaterial(material.id)}
                      className="shrink-0 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-p1 hover:text-white"
                    >
                      Open material
                    </button>
                  </div>
                </Card>
              );
            })}
            {!loading && materials.length === 0 && (
              <Card className="text-center text-mute">No materials have been published for this class yet.</Card>
            )}
          </div>
        )}

        {activeTab === "live" && (
          <div className="grid gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="flex flex-wrap items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-p1-soft text-p1">
                  <Video className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl">{schedule.title}</h2>
                  <p className="text-sm text-mute">{new Date(schedule.startsAt).toLocaleString()}</p>
                  {schedule.description && <p className="mt-1 text-sm text-mute">{schedule.description}</p>}
                </div>
                {schedule.joinUrl?.trim() ? (
                  <a
                    href={schedule.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center justify-center rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Join session
                  </a>
                ) : (
                  <p className="shrink-0 text-sm text-mute">
                    Contact your teacher for the meeting link.
                  </p>
                )}
              </Card>
            ))}
            {!loading && schedules.length === 0 && (
              <Card className="text-center text-mute">No sessions have been scheduled for this class.</Card>
            )}
          </div>
        )}

        {activeTab === "assessments" && (
          <StudentAssessments classId={classInfo.id} className={classInfo.name} />
        )}

        {activeTab === "completion" && (
          <>
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <Label>Material completion progress</Label>
                  <p className="mt-2 font-display text-4xl">{completionPercent}%</p>
                </div>
                <p className="text-sm text-mute">
                  {completedMaterialCount} of {materials.length} materials complete
                </p>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Material completion progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
                {completedMaterialCount > 0 && (
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${materials.length ? completedMaterialCount / materials.length * 100 : completionPercent}%` }}
                  />
                )}
                {materials.length > 0 && incompleteMaterials.length > 0 && (
                  <div
                    className="bg-amber-400 transition-all"
                    style={{ width: `${incompleteMaterials.length / materials.length * 100}%` }}
                  />
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500" />Completed: {completedMaterialCount} materials</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-amber-400" />Haven't done yet: {incompleteMaterials.length} materials</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-p1" />To be graded: {unpassedAssessments.length} assessments</span>
              </div>
              <p className="mt-3 text-xs text-mute">
                Assessment attempts are automatically graded when submitted. This count includes assessments still needing a passing attempt.
              </p>
            </Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <Label>Haven't done yet</Label>
                {incompleteMaterials.length ? (
                  <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
                    {incompleteMaterials.map((material) => <li key={material.id}>{material.title}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-mute">All learning materials are complete.</p>
                )}
              </Card>
              <Card>
                <Label>To be graded</Label>
                {unpassedAssessments.length ? (
                  <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
                    {unpassedAssessments.map((assessment) => (
                      <li key={assessment.id}>
                        {assessment.assessmentCode} · {assessment.title}
                        {assessment.latestAttempt && ` · Latest score ${assessment.latestAttempt.score}%`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-mute">All assessment requirements have been passed.</p>
                )}
              </Card>
            </div>
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Label>Certificate of completion</Label>
                <p className="mt-1 text-sm text-mute">
                  {classFinished
                    ? "You have completed all class requirements."
                    : "Complete all materials and pass all assessments to unlock your certificate."}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCertificate}
                disabled={!classFinished}
                className="inline-flex items-center gap-2 rounded-full bg-p1 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GraduationCap className="h-4 w-4" /> Download certificate
              </button>
            </Card>
          </>
        )}
      </section>
    </>
  );
}
