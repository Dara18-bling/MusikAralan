import { useEffect, useState } from "react";
import {
  CircleCheck,
  Download,
  Feather,
  Flame,
  Music,
  PenLine,
  Piano,
  Smartphone,
  Star,
  Trophy,
  Type,
  Video,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Btn, Card, Input, Label, Pill, Title } from "./ui";
import PianoQuiz from "./PianoQuiz";
import { arrayUnion, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { ClassCatalogItem } from "./classCatalog";
import Notifications from "./Notifications";

export type StudentView =
  | "notes"
  | "home"
  | "materials"
  | "live"
  | "exams"
  | "help"
  | "alerts";

const deadlines = [
  { d: "Oct 06", t: "Note Reading Quiz 4 — Ledger Lines", c: "Note Reading" },
  { d: "Oct 09", t: "Record Responsorial Psalm 27th Sunday", c: "Psalmody" },
  { d: "Oct 12", t: 'Submit Alto line — "Pananagutan"', c: "Choir" },
];
const badges = [
  { e: Music, n: "First Clef", got: true },
  { e: Flame, n: "7-day Streak", got: true },
  { e: Piano, n: "Keys Explorer", got: true },
  { e: Feather, n: "Psalmist", got: false },
  { e: Star, n: "Perfect Pitch", got: false },
  { e: Trophy, n: "Grand Choir", got: false },
];

export function Gospel() {
  return (
    <Card className="bg-white">
      <div className="relative">
        <Label>Daily Gospel · Awit at Papuri</Label>
        <p className="mt-3 font-display text-lg leading-snug">
          "Increase our faith." — Luke 17:5–10
        </p>
        <p className="mt-2 text-sm text-mute">
          Faith the size of a mustard seed is enough. Today, sing not to be
          heard, but so that others may pray.
        </p>
        <a
          href="https://www.awitatpapuri.com"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-p1 hover:underline cursor-pointer"
        >
          Read full reflection →
        </a>
      </div>
    </Card>
  );
}

function Home({
  go,
  age,
  userName,
}: {
  go: (v: StudentView) => void;
  age: string;
  userName: string;
}) {
  const kid = age === "kids";
  const firstName = userName.split(" ")[0];

  return (
    <>
      <Title
        kicker="Linggo XXVII · Ordinary Time"
        title={
          kid
            ? `Hi ${firstName}! Ready to sing?`
            : `Magandang umaga, ${firstName}`
        }
        sub="Soprano · Aspirant, Youth Choir"
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-5">
          {/* Fixed onClick on Card by using a standard div */}
          <div
            onClick={() => go("materials")}
            className="rounded-3xl border border-line p-6 grad relative overflow-hidden text-white cursor-pointer hover:opacity-95 shadow-sm"
          >
            <Music
              className="absolute -right-4 -top-4 h-40 w-40 opacity-15"
              strokeWidth={1.25}
            />
            <Label>
              <span className="text-white/80">Continue learning</span>
            </Label>
            <h2 className="mt-2 font-display text-2xl">
              Psalmody II · Pointing the Psalm Tone
            </h2>
            <p className="mt-1 text-sm text-white/85">
              Lesson 7 of 10 · Vocal guide + 12-min video
            </p>
            <div className="mt-4 h-2 rounded-full bg-white/25">
              <div className="h-full w-[70%] rounded-full bg-white" />
            </div>
            <button className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-p1 cursor-pointer">
              Resume class
            </button>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              ["Active Classes", "4", "in progress"],
              ["Avg. score", "91%", "last 5 quizzes"],
              ["Streak", "12", "days practicing"],
            ].map(([a, b, c]) => (
              <Card key={a}>
                <Label>{a}</Label>
                <p className="mt-2 font-display text-4xl grad-text">{b}</p>
                <p className="text-sm text-mute">{c}</p>
              </Card>
            ))}
          </div>
          <Card>
            <div className="flex items-center justify-between">
              <Label>Upcoming deadlines</Label>
              <button
                onClick={() => go("materials")}
                className="text-sm font-semibold text-p1 cursor-pointer"
              >
                View all
              </button>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {deadlines.map((x) => (
                <li key={x.t} className="flex items-center gap-4 py-3">
                  <span className="w-14 font-mono text-xs text-p2">{x.d}</span>
                  <span className="flex-1 font-medium">{x.t}</span>
                  <Pill>{x.c}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="grid content-start gap-5">
          <Card>
            <div className="flex items-center justify-between">
              <Label>Badges</Label>
              <span className="font-mono text-xs text-mute">3/6</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {badges.map((b) => (
                <div
                  key={b.n}
                  className={`rounded-xl p-3 text-center ${b.got ? "bg-p2-soft" : "bg-slate-50 opacity-50 grayscale"}`}
                >
                  <b.e
                    className={`mx-auto text-p2 ${kid ? "h-8 w-8" : "h-6 w-6"}`}
                    strokeWidth={1.75}
                  />
                  <p className="mt-1 text-[11px] font-semibold leading-tight">
                    {b.n}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-mute italic text-center">
              Complete all tasks in a class to unlock its badge.
            </p>
          </Card>
          <Gospel />
        </div>
      </div>
    </>
  );
}

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

function Materials({ userId, userName }: { userId: string; userName: string }) {
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
    return onSnapshot(doc(db, "users", userId), (snapshot) => {
      const enrolled = snapshot.data()?.enrolledClassIds;
      setEnrolledClassIds(Array.isArray(enrolled) ? enrolled : []);
      setClassProgress(snapshot.data()?.classProgress || {});
    }, (error) => console.error("Could not load student enrollments:", error));
  }, [userId]);

  useEffect(() => {
    if (!openClass) {
      setClassMaterials([]);
      setClassAssessment(null);
      setClassmates([]);
      setAssessmentAnswers({});
      return;
    }
    const stopMaterials = onSnapshot(collection(db, "classes", openClass.id, "materials"), (snapshot) => {
      setClassMaterials(snapshot.docs.map((materialDoc) => ({ id: materialDoc.id, ...materialDoc.data() })));
    }, (error) => console.error("Could not load class materials:", error));
    const stopAssessment = onSnapshot(doc(db, "classes", openClass.id, "assessments", "published"), (snapshot) => {
      setClassAssessment(snapshot.exists() ? snapshot.data() : null);
    }, (error) => console.error("Could not load class assessment:", error));
    const stopClassmates = onSnapshot(collection(db, "users"), (snapshot) => {
      setClassmates(snapshot.docs
        .filter((studentDoc) => studentDoc.id !== userId && Array.isArray(studentDoc.data().enrolledClassIds)
          && studentDoc.data().enrolledClassIds.includes(openClass.id))
        .map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() })));
    }, (error) => console.error("Could not load classmates:", error));
    return () => { stopMaterials(); stopAssessment(); stopClassmates(); };
  }, [openClass?.id, userId]);

  useEffect(() => onSnapshot(collection(db, "classes"), (snapshot) => {
    setClassCatalog(snapshot.docs.map((classDoc) => {
      const data = classDoc.data();
      return {
        id: classDoc.id,
        name: data.name ?? "Unnamed class",
        teacher: data.teacher ?? "Unassigned",
        age: data.age ?? "all",
        description: data.description ?? "",
        availableForEnrollment: data.availableForEnrollment === true,
        deleted: data.deleted === true,
        enrolledStudentIds: Array.isArray(data.enrolledStudentIds) ? data.enrolledStudentIds : [],
      } as ClassCatalogItem;
    }));
  }, (error) => console.error("Could not load classes:", error)), []);

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
      await updateDoc(doc(db, "users", userId), { enrolledClassIds: arrayUnion(item.id) });
    } catch (error) {
      console.error("Could not enroll in class:", error);
      const firestoreError = error as { code?: string; message?: string };
      const reason = firestoreError.code === "permission-denied"
        ? "Firestore security rules are blocking student enrollment."
        : firestoreError.message || "Please check your connection and try again.";
      alert(`Could not enroll in this class${firestoreError.code ? ` (${firestoreError.code})` : ""}: ${reason}`);
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
      await updateDoc(doc(db, "users", userId), {
        [`classProgress.${openClass.id}.completedMaterialIds`]: arrayUnion(materialId),
      });
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
    const correct = questions.filter((question: any, index: number) => {
      if (question.type === "identification") {
        return assessmentAnswers[index].trim().toLowerCase() === String(question.answer || "").trim().toLowerCase();
      }
      return Number(assessmentAnswers[index]) === Number(question.a);
    }).length;
    const percent = questions.length ? Math.round(correct / questions.length * 100) : 0;
    const passed = percent >= Number(classAssessment.passingPercent || 70);
    try {
      await updateDoc(doc(db, "users", userId), {
        [`classProgress.${openClass.id}.assessmentScore`]: percent,
        [`classProgress.${openClass.id}.assessmentPassed`]: passed,
      });
      alert(passed ? `Assessment passed: ${percent}%.` : `Assessment score: ${percent}%. Review the materials and try again.`);
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
          
      {(section === "enrolled" ? enrolledClasses : availableClasses).map((item) => {
            return (
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
            );
          })}
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
                          {Array.isArray(material.files) && material.files.map((file: any) => (
                            <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-p1 underline">Open {file.name}</a>
                          ))}
                          {Array.isArray(material.links) && material.links.map((link: any) => (
                            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-p1 underline">Open attached link</a>
                          ))}
                          <button type="button" onClick={() => void markMaterialComplete(material.id)} disabled={completed} className={`mt-3 rounded-full px-4 py-1.5 text-sm font-semibold ${completed ? "bg-emerald-100 text-emerald-800" : "bg-p1-soft text-p1"}`}>
                            {completed ? "Completed" : "Mark complete"}
                          </button>
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

function Live() {
  const s = [
    {
      t: "Note Reading Class",
      w: "Today · 7:00 PM",
      by: "Sis. Ethyl",
      live: true,
    },
    {
      t: "Virtual Rehearsal — 27th Sunday",
      w: "Fri, Oct 10 · 8:00 PM",
      by: "Bro. Jet",
    },
  ];
  return (
    <>
      <Title kicker="Virtual classroom" title="Live Sessions" />
      <div className="grid gap-4">
        {s.map((x) => (
          <Card key={x.t} className="flex flex-wrap items-center gap-5">
            <div
              className={`grid h-14 w-14 place-items-center rounded-2xl ${x.live ? "grad text-white" : "bg-p1-soft text-p1"}`}
            >
              <Video className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-xl">{x.t}</p>
              <p className="text-mute">
                {x.w} · {x.by}
              </p>
            </div>
            {x.live ? (
              <a
                href="https://meet.google.com"
                target="_blank"
                rel="noreferrer"
              >
                <Btn className="px-8 py-3 text-base cursor-pointer">
                  Join on Google Meet
                </Btn>
              </a>
            ) : (
              <Btn variant="ghost" className="cursor-pointer">
                Add to calendar
              </Btn>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function Exams({ userName }: { userName: string }) {
  return (
    <>
      <Title kicker="Testing & achievements" title="Assessments" />
      <Card>
        <p>Assessment module placeholder.</p>
      </Card>
    </>
  );
}

function Help() {
  const guides: [typeof Video, string, string][] = [
    [Smartphone, "How to log in", "2-min video, step by step"],
    [Video, "Joining a Google Meet class", "One tap — we show you where"],
    [Download, "Downloading a song sheet", "Save it for offline use"],
    [Type, "Making text bigger", "Use the A+ button at the top"],
    [MessageCircle, "Using the Chatbot", "Ask our AI helper for quick answers"],
  ];
  return (
    <>
      <Title kicker="Tulong · Help" title="Help Guides & Tutorials" />
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map(([E, t, s]) => (
          <button
            key={t}
            className="flex items-center gap-4 rounded-2xl border border-line bg-white p-6 text-left transition hover:border-[var(--p1)] cursor-pointer"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-p1-soft text-p1">
              <E className="h-8 w-8" strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-xl font-semibold">{t}</span>
              <span className="text-mute">{s}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Alerts() {
  const [ch, setCh] = useState({ SMS: true, Gmail: true, Messenger: true });
  const [expanded, setExpanded] = useState<number | null>(null);
  const n = [
    [
      "Rehearsal moved to 7:30 PM Friday",
      "2h",
      "Admin",
      "Please be informed that due to the upcoming parish event, our rehearsal is moved. See you!",
    ],
    [
      "New PDF: Ledger Lines Worksheet",
      "5h",
      "Sis. Ethyl",
      "I have uploaded the new worksheet under your Note Reading Class. Deadline is on Friday.",
    ],
    [
      "You earned the 7-day Streak!",
      "1d",
      "System",
      "Great job practicing for 7 days straight! Keep it up.",
    ],
  ];
  return (
    <>
      <Title kicker="Notification center" title="Updates" />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <ul className="divide-y divide-line">
            {n.map(([t, w, f, detail], index) => (
              <li
                key={t}
                className="py-3 flex flex-col gap-2 cursor-pointer"
                onClick={() => setExpanded(expanded === index ? null : index)}
              >
                <div className="flex gap-3 items-center">
                  <span className="mt-0.5 h-2 w-2 rounded-full grad" />
                  <span className="flex-1">
                    <b className="font-semibold">{t}</b>
                    <span className="text-sm text-mute block">{f}</span>
                  </span>
                  <span className="font-mono text-xs text-mute flex items-center gap-2">
                    {w}{" "}
                    {expanded === index ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </div>
                {expanded === index && (
                  <div className="ml-5 p-3 bg-p1-soft/30 rounded-lg text-sm text-gray-700">
                    {detail}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <Label>Connected Accounts (Cross-Platform Sync)</Label>
          {(Object.keys(ch) as (keyof typeof ch)[]).map((k) => (
            <label
              key={k}
              className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-line px-4 py-3"
            >
              <span className="font-semibold">{k}</span>
              <button
                onClick={() => setCh({ ...ch, [k]: !ch[k] })}
                className={`h-6 w-11 rounded-full p-0.5 transition ${ch[k] ? "grad" : "bg-slate-200"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition ${ch[k] ? "translate-x-5" : ""}`}
                />
              </button>
            </label>
          ))}
        </Card>
      </div>
    </>
  );
}

export default function Student({
  view,
  go,
  age,
  userName,
  userId,
}: {
  view: StudentView;
  go: (v: StudentView) => void;
  age: string;
  userName: string;
  userId: string;
}) {
  if (view === "notes") return <PianoQuiz />;
  if (view === "materials") return <Materials userId={userId} userName={userName} />;
  if (view === "live") return <Live />;
  if (view === "exams") return <Exams userName={userName} />;
  if (view === "help") return <Help />;
  if (view === "alerts") return <Notifications role="student" age={age} />;
  return <Home go={go} age={age} userName={userName} />;
}
