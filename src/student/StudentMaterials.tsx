import { useEffect, useState } from "react";
import { Download, Music } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "react-toastify";
import { apiPost, watchApi } from "../api";
import { Card, Label, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";
import { isDataUrl, downloadDataUrl, ensureAbsoluteUrl, getDriveDownloadUrl } from "../utils/mediaUrlHelper";

interface StudentMaterialsProps {
  userId: string;
  userName: string;
  onViewAssessments: (classId: string, className: string) => void;
}

interface AssessmentSummary {
  id: string;
  assessmentCode: string;
  title: string;
  latestAttempt: { passed: boolean; score: number } | null;
}

export function StudentMaterials({ userId, userName, onViewAssessments }: StudentMaterialsProps) {
  const [section, setSection] = useState<"enrolled" | "available">("enrolled");
  const [classCatalog, setClassCatalog] = useState<ClassCatalogItem[]>([]);
  const [openClass, setOpenClass] = useState<ClassCatalogItem | null>(null);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [classProgress, setClassProgress] = useState<Record<string, any>>({});
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  const [classAssessments, setClassAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);
  const [classmates, setClassmates] = useState<any[]>([]);

  useEffect(() => {
    if (!openClass) {
      setClassMaterials([]);
      setClassAssessments([]);
      setAssessmentsLoaded(false);
      setClassmates([]);
      return;
    }
    const classPath = `/classes/${openClass.id}`;
    setClassMaterials([]);
    setClassAssessments([]);
    setAssessmentsLoaded(false);
    const stopMaterials = watchApi<{ data: any[] }>(`${classPath}/materials`, ({ data }) => {
      setClassMaterials(data);
    }, (error) => console.error("Could not load class materials:", error));
    const stopAssessments = watchApi<{ data: AssessmentSummary[] }>(`${classPath}/assessments`, ({ data }) => {
      setClassAssessments(data);
      setAssessmentsLoaded(true);
    }, (error) => console.error("Could not load class assessments:", error));
    const stopClassmates = watchApi<{ data: any[] }>(`${classPath}/students`, ({ data }) => {
      setClassmates(data);
    }, (error) => console.error("Could not load classmates:", error));
    const stopProgress = watchApi<{ progress: Record<string, any> }>(`${classPath}/progress`, ({ progress }) => {
      setClassProgress({ [openClass.id]: progress });
    }, (error) => console.error("Could not load class progress:", error));
    return () => {
      stopMaterials();
      stopAssessments();
      stopClassmates();
      stopProgress();
    };
  }, [openClass?.id, userId]);

  useEffect(() => watchApi<{ data: ClassCatalogItem[] }>("/classes", ({ data }) => {
    setClassCatalog(data);
    setEnrolledClassIds(data.filter((item) => item.enrolledStudentIds?.includes(userId)).map((item) => item.id));
  }, (error) => console.error("Could not load classes:", error)), [userId]);

  const enrolledClasses = classCatalog.filter((item) => !item.deleted && userId && (
    enrolledClassIds.includes(item.id) || item.enrolledStudentIds?.includes(userId)
  ));
  const availableClasses = classCatalog.filter((item) =>
    !item.deleted
    && item.availableForEnrollment
    && !enrolledClassIds.includes(item.id)
    && !item.enrolledStudentIds?.includes(userId),
  );

  const joinClass = async (item: ClassCatalogItem) => {
    if (!userId || item.deleted || !item.availableForEnrollment) return;
    try {
      await apiPost(`/classes/${item.id}/enroll`);
      setEnrolledClassIds((current) => [...new Set([...current, item.id])]);
      setClassCatalog((current) => current.map((classItem) =>
        classItem.id === item.id
          ? { ...classItem, enrolledStudentIds: [...new Set([...(classItem.enrolledStudentIds || []), userId])] }
          : classItem,
      ));
    } catch (error) {
      console.error("Could not enroll in class:", error);
      const details = error as { message?: string };
      toast.error(`Could not enroll in this class: ${details.message || "Please check your connection and try again."}`);
    }
  };

  const currentClassProgress = openClass ? classProgress[openClass.id] || {} : {};
  const completedMaterialIds: string[] = Array.isArray(currentClassProgress.completedMaterialIds)
    ? currentClassProgress.completedMaterialIds
    : [];
  const classFinished = classMaterials.length > 0
    && assessmentsLoaded
    && classMaterials.every((material) => completedMaterialIds.includes(material.id))
    && classAssessments.every((assessment) => assessment.latestAttempt?.passed === true);

  const markMaterialComplete = async (materialId: string) => {
    if (!openClass || !userId) return;
    try {
      await apiPost(`/classes/${openClass.id}/materials/${materialId}/complete`);
      setClassProgress((current) => ({
        ...current,
        [openClass.id]: {
          ...current[openClass.id],
          completedMaterialIds: [...new Set([...(current[openClass.id]?.completedMaterialIds || []), materialId])],
        },
      }));
    } catch (error) {
      console.error("Could not save material progress:", error);
      toast.error("Could not save your progress. Please try again.");
    }
  };

  const downloadCertificate = () => {
    if (!openClass || !classFinished) return;
    const certificate = new jsPDF({ orientation: "landscape" });
    certificate.setFontSize(30);
    certificate.text("Certificate of Completion", 148, 55, { align: "center" });
    certificate.setFontSize(16);
    certificate.text("This certifies that", 148, 82, { align: "center" });
    certificate.setFontSize(25);
    certificate.text(userName || "Student", 148, 101, { align: "center" });
    certificate.setFontSize(16);
    certificate.text(`has completed ${openClass.name}`, 148, 121, { align: "center" });
    certificate.setFontSize(12);
    certificate.text(`Issued ${new Date().toLocaleDateString()}`, 148, 145, { align: "center" });
    certificate.save(`${openClass.name.replace(/[^a-z0-9]+/gi, "-")}-certificate.pdf`);
  };

  return (
    <>
      <Title
        kicker="Learning & Enrollment"
        title="Classes"
        sub="Enroll in open classes to access their learning materials, assessments, classmates, and completion certificates."
        right={
          <div className="flex rounded-full border border-line bg-white p-1 text-sm">
            {([
              ["enrolled", "My Classes"],
              ["available", "Available"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`rounded-full px-4 py-1.5 font-semibold cursor-pointer ${section === key ? "grad text-white" : "text-mute"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(section === "enrolled" ? enrolledClasses : availableClasses).map((item) => (
          <Card key={item.id} className="flex flex-col">
            <div className="grad grid h-28 place-items-center rounded-xl text-white">
              <Music className="h-12 w-12" strokeWidth={1.4} />
            </div>
            <h2 className="mt-4 font-display text-xl">{item.name}</h2>
            <p className="mt-2"><span className="font-semibold">Teacher:</span> {item.teacher}</p>
            <p className="text-sm text-mute">Age group: {item.age === "all" ? "All ages" : item.age === "adults" ? "Adults (26+)" : item.age === "kids" ? "Kids (5–12)" : "Youth (13–25)"}</p>
            {item.description && <p className="mt-2 text-sm text-mute">{item.description}</p>}
            <div className="mt-auto flex gap-2 pt-4">
              {section === "available" && (
                <button type="button" onClick={() => void joinClass(item)} disabled={!userId} className="flex-1 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="block w-full rounded-full bg-[var(--p1)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Enroll</span>
                </button>
              )}
              {section === "enrolled" && (
                <>
                  <span className="flex-1 rounded-full bg-emerald-100 px-4 py-2 text-center text-sm font-semibold text-emerald-800">Enrolled</span>
                  <button type="button" onClick={() => setOpenClass(item)} className="flex-1 rounded-full border border-[var(--p1)] px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-p1-soft">Open</button>
                </>
              )}
            </div>
          </Card>
        ))}
        {(section === "enrolled" ? enrolledClasses : availableClasses).length === 0 && (
          <Card className="text-center text-mute md:col-span-2 xl:col-span-3">
            {section === "enrolled" ? "You haven't enrolled in any classes yet." : "No classes are currently open for enrollment."}
          </Card>
        )}
      </div>
      {openClass && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenClass(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="open-class-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="open-class-title" className="font-display text-2xl font-bold">{openClass.name}</h2>
                <p className="mt-1 text-sm text-mute">Teacher: {openClass.teacher}</p>
                {openClass.description && <p className="mt-2 whitespace-pre-wrap text-sm text-mute">{openClass.description}</p>}
              </div>
              <button type="button" onClick={() => setOpenClass(null)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Close</button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-p1-soft/40 p-4">
                  <div>
                    <h3 className="font-display text-lg font-bold">Assessments</h3>
                    <p className="mt-1 text-sm text-mute">
                      {classAssessments.length
                        ? `${classAssessments.length} assessment${classAssessments.length === 1 ? "" : "s"} available`
                        : "No assessments have been published yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewAssessments(openClass.id, openClass.name)}
                    className="rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white"
                  >
                    View assessments
                  </button>
                </div>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Learning materials</h3>
                {classMaterials.length === 0 ? <p className="mt-2 text-sm text-mute">No learning materials have been published yet.</p> : (
                  <ul className="mt-3 grid gap-3">
                    {classMaterials.map((material) => {
                      const completed = completedMaterialIds.includes(material.id);
                      return (
                        <li key={material.id} className="rounded-xl border border-line p-3">
                          <p className="font-semibold">{material.title}</p>
                          <p className="mt-1 text-sm text-mute">{material.kind}{material.description ? ` · ${material.description}` : ""}</p>
                          {material.teacherName && (
                            <p className="mt-0.5 text-xs text-mute">Uploaded by: {material.teacherName}</p>
                          )}
                          {/* Audio Player for Vocal Guides */}
                          {material.streamUrl && material.kind === "Vocal Guide" && (
                            <div className="mt-2.5">
                              <audio controls className="w-full h-9" src={material.streamUrl} />
                              {getDriveDownloadUrl(material.mediaUrl || material.streamUrl) && (
                                <a
                                  href={getDriveDownloadUrl(material.mediaUrl || material.streamUrl)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-p1 underline"
                                >
                                  <Download className="h-3 w-3" /> Download audio track
                                </a>
                              )}
                            </div>
                          )}
                          {/* Video Player for Video Guides */}
                          {material.streamUrl && material.kind === "Video Guide" && (
                            <div className="mt-2.5 aspect-video w-full overflow-hidden rounded-lg bg-black/5">
                              <iframe className="h-full w-full" src={material.streamUrl} allowFullScreen title={material.title} />
                            </div>
                          )}
                          {/* Open / Download for Modules, Sheets, or direct files */}
                          {(material.mediaUrl || material.streamUrl) && material.kind !== "Vocal Guide" && material.kind !== "Video Guide" && (() => {
                            const rawUrl = material.streamUrl || material.mediaUrl || "";
                            const hasDataUrl = isDataUrl(material.streamUrl) || isDataUrl(material.mediaUrl);
                            const driveDownloadUrl = getDriveDownloadUrl(rawUrl);
                            const safeWebUrl = ensureAbsoluteUrl(rawUrl);

                            return (
                              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                {/* If it's an embedded Base64 Data URL, download it directly without navigating */}
                                {hasDataUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const data = isDataUrl(material.streamUrl) ? material.streamUrl : material.mediaUrl;
                                      downloadDataUrl(data, material.title || "learning-module");
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p1)] bg-p1-soft px-3 py-1.5 text-xs font-semibold text-p1 hover:bg-p1-soft/80 transition"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download {material.kind === "Module" ? "module file" : "file"}
                                  </button>
                                )}

                                {/* If it's a Google Drive link, provide direct download + Drive link */}
                                {driveDownloadUrl && (
                                  <a
                                    href={driveDownloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p1)] bg-p1-soft px-3 py-1.5 text-xs font-semibold text-p1 hover:bg-p1-soft/80 transition"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download from Drive
                                  </a>
                                )}

                                {/* If it's a safe absolute web URL, open in a new tab */}
                                {safeWebUrl && !hasDataUrl && (
                                  <a
                                    href={safeWebUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-p1 underline hover:opacity-80"
                                  >
                                    Open {material.kind === "Module" ? "module" : "resource"} ↗
                                  </a>
                                )}

                                {/* Fallback if it was an older test file without a URL */}
                                {!safeWebUrl && !hasDataUrl && material.mediaUrl && (
                                  <span className="text-xs text-mute">
                                    File: {material.mediaUrl}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {/* Backwards compatibility for legacy array structures if any */}
                          {Array.isArray(material.files) && material.files.map((file: any) => (
                            <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-p1 underline">Open {file.name}</a>
                          ))}
                          {Array.isArray(material.links) && material.links.map((link: any) => (
                            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-p1 underline">Open attached link</a>
                          ))}
                          <div className="mt-3">
                            <button type="button" onClick={() => void markMaterialComplete(material.id)} disabled={completed} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${completed ? "bg-emerald-100 text-emerald-800" : "bg-p1-soft text-p1"}`}>
                              {completed ? "Completed" : "Mark complete"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-display text-lg font-bold">Classmates</h3>
                {classmates.length === 0 ? <p className="mt-2 text-sm text-mute">You are the only enrolled student so far.</p> : (
                  <ul className="mt-3 divide-y divide-line rounded-xl border border-line px-3">
                    {classmates.map((student) => <li key={student.id} className="py-2 text-sm">{student.name || student.email || "Student"}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm text-mute">{classFinished ? "You completed all class requirements." : "Complete every learning material and pass all assessments to earn your certificate."}</p>
              <button type="button" onClick={downloadCertificate} disabled={!classFinished} className="rounded-full bg-p1 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Download certificate</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}