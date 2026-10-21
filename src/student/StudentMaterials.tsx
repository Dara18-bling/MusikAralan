import { useEffect, useState } from "react";
import { Download, MessageCircle, Music, PenLine } from "lucide-react";
import { jsPDF } from "jspdf";
import { apiPost, watchApi } from "../api";
import { Btn, Card, Label, Pill, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";
import { isDataUrl, downloadDataUrl, ensureAbsoluteUrl, getDriveDownloadUrl } from "../utils/mediaUrlHelper";

const materials = [
  {
    k: "Psalmody",
    t: "Pointing the Psalm Tone",
    type: "Video",
    meta: "YouTube · 12 min",
    due: "Oct 09",
    yt: "kt5Yh3ucEdA",
  },
  {
    k: "Note Reading",
    t: "Ledger Lines Worksheet",
    type: "PDF",
    meta: "2.4 MB · 4 pages",
    due: "Oct 06",
  },
  {
    k: "Choir",
    t: "Pananagutan — Alto vocal guide",
    type: "Audio",
    meta: "MP3 · 3:41",
    due: "Oct 12",
  },
];

interface StudentMaterialsProps {
  userId: string;
  userName: string;
}

export function StudentMaterials({ userId, userName }: StudentMaterialsProps) {
  const [section, setSection] = useState<"lessons" | "enrolled" | "available">("enrolled");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [open, setOpen] = useState<number | null>(0);
  const [classCatalog, setClassCatalog] = useState<ClassCatalogItem[]>([]);
  const [openClass, setOpenClass] = useState<ClassCatalogItem | null>(null);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [classProgress, setClassProgress] = useState<Record<string, any>>({});
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  const [classAssessment, setClassAssessment] = useState<any | null>(null);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!userId) {
      setEnrolledClassIds([]);
      return;
    }
  }, [userId]);

  useEffect(() => {
    if (!openClass) {
      setClassMaterials([]);
      setClassAssessment(null);
      setClassmates([]);
      setAssessmentAnswers({});
      return;
    }
    const classPath = `/classes/${openClass.id}`;
    const stopMaterials = watchApi<{ data: any[] }>(`${classPath}/materials`, ({ data }) => {
      setClassMaterials(data);
    }, (error) => console.error("Could not load class materials:", error));
    const stopAssessment = watchApi<{ assessment: any | null }>(`${classPath}/assessment`, ({ assessment }) => {
      setClassAssessment(assessment);
    }, (error) => console.error("Could not load class assessment:", error));
    const stopClassmates = watchApi<{ data: any[] }>(`${classPath}/students`, ({ data }) => {
      setClassmates(data);
    }, (error) => console.error("Could not load classmates:", error));
    const stopProgress = watchApi<{ progress: Record<string, any> }>(`${classPath}/progress`, ({ progress }) => {
      setClassProgress({ [openClass.id]: progress });
    }, (error) => console.error("Could not load class progress:", error));
    return () => {
      stopMaterials();
      stopAssessment();
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
      alert(`Could not enroll in this class: ${details.message || "Please check your connection and try again."}`);
    }
  };

  const currentClassProgress = openClass ? classProgress[openClass.id] || {} : {};
  const completedMaterialIds: string[] = Array.isArray(currentClassProgress.completedMaterialIds)
    ? currentClassProgress.completedMaterialIds
    : [];
  const assessmentPassed = currentClassProgress.assessmentPassed === true;
  const classFinished = classMaterials.length > 0
    && classMaterials.every((material) => completedMaterialIds.includes(material.id))
    && (!classAssessment || assessmentPassed);

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
      alert("Could not save your progress. Please try again.");
    }
  };

  const submitAssessment = async () => {
    if (!openClass || !classAssessment || !userId) return;
    const questions = Array.isArray(classAssessment.questions) ? classAssessment.questions : [];
    if (questions.some((question: any, index: number) => assessmentAnswers[index] === undefined || assessmentAnswers[index] === "")) {
      alert("Answer every question before submitting.");
      return;
    }
    try {
      const { attempt } = await apiPost<{ attempt: { score: number; passed: boolean } }>(
        `/classes/${openClass.id}/assessment/attempts`,
        { answers: questions.map((_: unknown, index: number) => assessmentAnswers[index]) },
      );
      setClassProgress((current) => ({
        ...current,
        [openClass.id]: {
          ...current[openClass.id],
          assessmentScore: attempt.score,
          assessmentPassed: attempt.passed,
        },
      }));
      alert(attempt.passed
        ? `Assessment passed: ${attempt.score}%.`
        : `Assessment score: ${attempt.score}%. Review the materials and try again.`);
    } catch (error) {
      console.error("Could not save assessment result:", error);
      alert("Could not save your assessment result. Please try again.");
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
      {section === "lessons" ? (
        <>
          <div className="mb-4 flex w-fit rounded-full border border-line bg-white p-1 text-sm">
            {(["active", "completed"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 font-semibold capitalize ${tab === t ? "grad text-white" : "text-mute"}`}>
                {t === "active" ? "Active lessons" : "Completed"}
              </button>
            ))}
          </div>
          {tab === "active" ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
              <div className="grid content-start gap-3">
                {materials.map((m, i) => (
                  <button
                    key={m.t}
                    onClick={() => setOpen(i)}
                    className={`rounded-2xl border p-4 text-left transition cursor-pointer ${open === i ? "border-[var(--p1)] bg-p1-soft" : "border-line bg-white hover:bg-p1-soft/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <Pill tone="p2">{m.type}</Pill>
                      <span className="font-mono text-xs text-mute">
                        Due {m.due}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold">{m.t}</p>
                    <p className="text-sm text-mute">
                      {m.k} · {m.meta}
                    </p>
                  </button>
                ))}
              </div>
              {open !== null && (
                <Card>
                  <div className="flex justify-between items-start">
                    <div>
                      <Label>{materials[open].k}</Label>
                      <h2 className="mt-1 font-display text-2xl">
                        {materials[open].t}
                      </h2>
                    </div>
                    <Btn variant="ghost" className="text-sm">
                      <MessageCircle className="h-4 w-4" /> Message Teacher
                    </Btn>
                  </div>
                  <div className="mt-4 mb-2">
                    <div className="flex justify-between text-xs font-semibold text-mute mb-1">
                      <span>Class Progress</span>
                      <span>1 of 4 Tasks Completed (25%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--p1)] w-[25%] rounded-full transition-all duration-500"></div>
                    </div>
                    <p className="text-xs text-mute mt-1 italic">
                      Complete all tasks in this class to unlock your badge.
                    </p>
                  </div>
                  {materials[open].yt ? (
                    <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-p1-soft">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${materials[open].yt}`}
                        title="Lesson video"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="staff mt-4 grid aspect-video place-items-center rounded-xl bg-p1-soft/60 text-p1/40">
                      <Music className="h-16 w-16" strokeWidth={1.25} />
                      <p className="text-sm font-semibold mt-2">
                        File Ready (PDF/Audio/Docx)
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn className="cursor-pointer">Mark as done</Btn>
                    <Btn variant="ghost" className="cursor-pointer">
                      <Download className="h-4 w-4" /> Download
                    </Btn>
                    <Btn variant="ghost" className="cursor-pointer">
                      <PenLine className="h-4 w-4" /> Answer activity
                    </Btn>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <div className="text-center py-10 text-mute">
                No completed classes yet.
              </div>
            </Card>
          )}
        </>
      ) : (
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
                    <span className="block w-full rounded-full bg-[var(--p1)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                      Enroll
                    </span>
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
      )}
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

            {classAssessment && (
              <div className="mt-6 rounded-2xl border border-line p-4">
                <h3 className="font-display text-lg font-bold">{classAssessment.title || "Class assessment"}</h3>
                <p className="mt-1 text-sm text-mute">Passing score: {classAssessment.passingPercent || 70}%{currentClassProgress.assessmentScore !== undefined ? ` · Your latest score: ${currentClassProgress.assessmentScore}%` : ""}</p>
                <div className="mt-4 grid gap-4">
                  {(classAssessment.questions || []).map((question: any, index: number) => (
                    <fieldset key={index} className="rounded-xl bg-p1-soft/40 p-3">
                      <legend className="font-semibold">{index + 1}. {question.q}</legend>
                      {question.type === "identification" ? (
                        <input value={assessmentAnswers[index] || ""} onChange={(event) => setAssessmentAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Your answer" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {(question.o || []).map((option: string, optionIndex: number) => (
                            <label key={optionIndex} className="flex items-center gap-2 text-sm">
                              <input type="radio" name={`assessment-question-${index}`} checked={assessmentAnswers[index] === String(optionIndex)} onChange={() => setAssessmentAnswers((current) => ({ ...current, [index]: String(optionIndex) }))} />
                              {option}
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  ))}
                </div>
                <button type="button" onClick={() => void submitAssessment()} className="mt-4 rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white">Submit assessment</button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-sm text-mute">{classFinished ? "You completed all class requirements." : "Complete every learning material and pass the assessment to earn your certificate."}</p>
              <button type="button" onClick={downloadCertificate} disabled={!classFinished} className="rounded-full bg-p1 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Download certificate</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}