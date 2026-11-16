import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  Video,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "react-toastify";
import { Breadcrumbs } from "../app/Breadcrumbs";
import {
  apiDelete,
  apiPost,
  POLL_INTERVAL_HOUR,
  refreshApi,
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
  canDelete?: boolean;
  files?: { name: string; url: string }[];
  links?: { url: string }[];
  isAssignment?: boolean;
  availableFrom?: string | null;
  dueAt?: string | null;
  allowLateSubmissions?: boolean;
  maxPoints?: number;
  maxUploadSizeMb?: number;
  submission?: AssignmentSubmission | null;
};

export type AssignmentSubmission = {
  id: string;
  studentId: string;
  studentName?: string | null;
  studentEmail?: string | null;
  fileName: string | null;
  fileUrl: string | null;
  driveUrl: string | null;
  fileSize: number | null;
  submittedAt: string | null;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
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

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

type Progress = {
  completedMaterialIds: string[];
  deletedCompletedMaterials?: {
    id: string;
    title: string;
    completedAt: string | null;
  }[];
};

export type WorkspaceTab =
  | "dashboard"
  | "materials"
  | "calendar"
  | "live"
  | "assessments"
  | "completion"
  | "leave";

interface StudentClassWorkspaceProps {
  classInfo: ClassCatalogItem;
  userName: string;
  activeTab: WorkspaceTab;
  selectedMaterialId: string;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenMaterial: (materialId: string) => void;
  onLeaveClass: () => void;
}

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "materials", label: "Materials" },
  { id: "calendar", label: "Important dates" },
  { id: "live", label: "Live Sessions" },
  { id: "assessments", label: "Assessments" },
  { id: "completion", label: "Completion Requirements" },
  { id: "leave", label: "Leave class" },
];

export function StudentClassWorkspace({
  classInfo,
  userName,
  activeTab,
  selectedMaterialId,
  onSelectTab,
  onOpenMaterial,
  onLeaveClass,
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
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

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
      POLL_INTERVAL_HOUR,
    );
    const stopAssessments = watchApi<{ data: AssessmentSummary[] }>(
      `${classPath}/assessments`,
      ({ data }) => {
        setAssessments(data);
        setLoading(false);
      },
      reportError("Could not load class assessments:"),
      POLL_INTERVAL_HOUR,
    );
    const stopClassmates = watchApi<{ count: number }>(
      `${classPath}/students`,
      ({ count }) => {
        setClassmateCount(count);
        setLoading(false);
      },
      reportError("Could not load classmates:"),
      POLL_INTERVAL_HOUR,
    );
    const stopProgress = watchApi<{ progress: Progress }>(
      `${classPath}/progress`,
      ({ progress: currentProgress }) => {
        setProgress(currentProgress);
        setLoading(false);
      },
      reportError("Could not load class progress:"),
      POLL_INTERVAL_HOUR,
    );
    const stopSchedules = watchApi<{ data: Schedule[] }>(
      "/schedules",
      ({ data }) => {
        setSchedules(data.filter((schedule) => schedule.classId === classInfo.id));
        setLoading(false);
      },
      reportError("Could not load class sessions:"),
      POLL_INTERVAL_HOUR,
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
  const deletedCompletedMaterials = progress.deletedCompletedMaterials || [];
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
  const certificateAvailable =
    classFinished && classInfo.certificatesUnlocked !== false;
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
  const calendarEvents = useMemo(() => {
    const events: {
      id: string;
      date: string;
      title: string;
      type: "deadline" | "opening" | "session";
      time: string;
      materialId?: string;
      joinUrl?: string | null;
    }[] = schedules.map((schedule) => {
      const date = new Date(schedule.startsAt);
      return {
        id: `session-${schedule.id}`,
        date: dateKey(date),
        title: schedule.title,
        type: "session",
        time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        joinUrl: schedule.joinUrl,
      };
    });

    materials.forEach((material) => {
      if (!material.isAssignment) return;
      if (material.availableFrom) {
        const date = new Date(material.availableFrom);
        events.push({
          id: `${material.id}-opening`,
          date: dateKey(date),
          title: material.title,
          type: "opening",
          time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          materialId: material.id,
        });
      }
      if (material.dueAt) {
        const date = new Date(material.dueAt);
        events.push({
          id: `${material.id}-deadline`,
          date: dateKey(date),
          title: material.title,
          type: "deadline",
          time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          materialId: material.id,
        });
      }
    });

    return events.sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
  }, [materials, schedules]);
  const calendarEventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof calendarEvents>();
    calendarEvents.forEach((event) => {
      const events = grouped.get(event.date) || [];
      events.push(event);
      grouped.set(event.date, events);
    });
    return grouped;
  }, [calendarEvents]);
  const calendarCells = useMemo(() => {
    const firstDay = calendarMonth.getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    ).getDate();
    return Array.from({ length: firstDay + daysInMonth }, (_, index) =>
      index < firstDay ? null : index - firstDay + 1,
    );
  }, [calendarMonth]);
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
      refreshApi(`/classes/${classInfo.id}/progress`);
      refreshApi(`/classes/${classInfo.id}/students`);
      refreshApi("/dashboard");
      toast.success("Material marked as complete.");
      return true;
    } catch (requestError) {
      console.error("Could not save material progress:", requestError);
      toast.error("Could not save your progress. Please try again.");
      return false;
    }
  };

  const leaveClass = async () => {
    if (
      !window.confirm(
        `Leave ${classInfo.name}? You will lose access to this class and its materials.`,
      )
    ) {
      return;
    }

    try {
      await apiDelete(`/classes/${classInfo.id}/enroll`);
      toast.success(`You left ${classInfo.name}.`);
      onLeaveClass();
    } catch (requestError) {
      console.error("Could not leave class:", requestError);
      toast.error(
        `Could not leave this class: ${requestError instanceof Error ? requestError.message : "Please check your connection and try again."}`,
      );
    }
  };

  const downloadCertificate = () => {
    if (!certificateAvailable) return;
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
      return (
        <>
          <Breadcrumbs
            items={[
              { label: "Classes", href: "/student/materials" },
              { label: classInfo.name, href: `/student/classes/${classInfo.id}/dashboard` },
              { label: "Materials", href: `/student/classes/${classInfo.id}/materials` },
              { label: "Material" },
            ]}
          />
          <Card className="animate-pulse py-12 text-center text-mute">Loading material…</Card>
        </>
      );
    }
    if (!selectedMaterial) {
      return (
        <>
          <Breadcrumbs
            items={[
              { label: "Classes", href: "/student/materials" },
              { label: classInfo.name, href: `/student/classes/${classInfo.id}/dashboard` },
              { label: "Materials", href: `/student/classes/${classInfo.id}/materials` },
              { label: "Material" },
            ]}
          />
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
        </>
      );
    }
    return (
      <>
        <Breadcrumbs
          items={[
            { label: "Classes", href: "/student/materials" },
            { label: classInfo.name, href: `/student/classes/${classInfo.id}/dashboard` },
            { label: "Materials", href: `/student/classes/${classInfo.id}/materials` },
            { label: selectedMaterial.title },
          ]}
        />
        <StudentMaterialViewer
          className={classInfo.name}
          classId={classInfo.id}
          material={selectedMaterial}
          completed={completedMaterialIds.includes(selectedMaterial.id)}
          onBack={() => onOpenMaterial("")}
          onMarkComplete={() => markMaterialComplete(selectedMaterial.id)}
        />
      </>
    );
  }

  return (
    <>
      {activeTab === "dashboard" ? (
        <Breadcrumbs
          items={[
            { label: "Classes", href: "/student/materials" },
            { label: classInfo.name },
          ]}
        />
      ) : (
        <Breadcrumbs
          items={[
            { label: "Classes", href: "/student/materials" },
            { label: classInfo.name, href: `/student/classes/${classInfo.id}/dashboard` },
            { label: TABS.find((tab) => tab.id === activeTab)?.label || "Dashboard" },
          ]}
        />
      )}
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
                  ? tab.id === "leave"
                    ? "border-red-600 text-red-700"
                    : "border-[var(--p1)] text-p1"
                  : tab.id === "leave"
                    ? "border-transparent text-red-600 hover:border-red-300 hover:text-red-700"
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Label>{material.kind}</Label>
                        {material.isAssignment && (
                          <span className="rounded-full bg-p1-soft px-2.5 py-1 text-xs font-semibold text-p1">
                            Assignment
                          </span>
                        )}
                      </div>
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

        {activeTab === "calendar" && (
          <div className="grid gap-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>Important dates</Label>
                  <h2 className="mt-1 font-display text-2xl">
                    {calendarMonth.toLocaleDateString([], {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                    className="rounded-full border border-line p-2 text-mute transition hover:border-p1 hover:text-p1"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                      )
                    }
                    className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                    className="rounded-full border border-line p-2 text-mute transition hover:border-p1 hover:text-p1"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <div className="grid min-w-[42rem] grid-cols-7 border-l border-t border-line text-sm">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="border-b border-r border-line bg-slate-50 p-2 text-center font-semibold text-mute">
                      {day}
                    </div>
                  ))}
                  {calendarCells.map((day, index) => {
                    const date = day
                      ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                      : null;
                    const events = date ? calendarEventsByDate.get(dateKey(date)) || [] : [];
                    return (
                      <div
                        key={date ? dateKey(date) : `empty-${index}`}
                        className="min-h-28 border-b border-r border-line p-2"
                      >
                        {date && (
                          <>
                            <p className={`mb-2 text-right font-semibold ${dateKey(date) === dateKey(new Date()) ? "text-p1" : "text-mute"}`}>
                              {day}
                            </p>
                            <div className="grid gap-1">
                              {events.map((event) => {
                              const eventClass =
                                event.type === "deadline"
                                  ? "bg-red-50 text-red-700"
                                  : event.type === "opening"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-p1-soft text-p1";
                              const content = (
                                <>
                                  <span className="block truncate font-semibold">
                                    {event.type === "deadline"
                                      ? "Due: "
                                      : event.type === "opening"
                                        ? "Opens: "
                                        : ""}
                                    {event.title}
                                  </span>
                                  <span className="block truncate text-[11px] opacity-80">
                                    {event.time}
                                  </span>
                                </>
                              );
                                return event.materialId ? (
                                  <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => onOpenMaterial(event.materialId!)}
                                    className={`w-full rounded-md px-2 py-1 text-left text-xs ${eventClass}`}
                                  >
                                    {content}
                                  </button>
                                ) : event.joinUrl ? (
                                  <a
                                    key={event.id}
                                    href={event.joinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`block rounded-md px-2 py-1 text-xs ${eventClass}`}
                                  >
                                    {content}
                                  </a>
                                ) : (
                                  <div key={event.id} className={`rounded-md px-2 py-1 text-xs ${eventClass}`}>
                                    {content}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
            <div className="flex flex-wrap gap-3 text-sm text-mute">
              <span className="rounded-full bg-p1-soft px-3 py-1 text-p1">Sessions</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Assignment openings</span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">Assignment deadlines</span>
            </div>
            {!loading && calendarEvents.length === 0 && (
              <Card className="text-center text-mute">No important dates have been scheduled for this class.</Card>
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
              {deletedCompletedMaterials.length > 0 && (
                <Card>
                  <Label>Historical completion records</Label>
                  <ul className="mt-3 space-y-3 text-sm">
                    {deletedCompletedMaterials.map((material) => (
                      <li key={material.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="font-semibold">{material.title}</p>
                        <p className="mt-1 text-mute">This material has been deleted</p>
                        {material.completedAt && (
                          <p className="mt-1 text-xs text-mute">
                            Completed {new Date(material.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
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
                  {classInfo.certificatesUnlocked === false
                    ? "Your teacher has locked certificates for this class."
                    : classFinished
                      ? "You have completed all class requirements."
                      : "Complete all materials and pass all assessments to unlock your certificate."}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCertificate}
                disabled={!certificateAvailable}
                className="inline-flex items-center gap-2 rounded-full bg-p1 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GraduationCap className="h-4 w-4" /> Download certificate
              </button>
            </Card>
          </>
        )}

        {activeTab === "leave" && (
          <Card className="border-red-300 bg-red-50">
            <Label>Danger zone</Label>
            <h2 className="mt-2 font-display text-2xl text-red-800">
              Leave this class
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-red-700">
              Leaving removes your enrollment and access to this class&apos;s
              materials, assessments, sessions, and completion progress.
            </p>
            <button
              type="button"
              onClick={() => void leaveClass()}
              className="mt-5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Leave {classInfo.name}
            </button>
          </Card>
        )}
      </section>
    </>
  );
}
