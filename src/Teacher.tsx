import { useEffect, useState } from "react";
import { UploadCloud, FileText, Video, Edit2 } from "lucide-react";
import { Btn, Card, Input, Label, Pill, Title } from "./ui";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { ClassCatalogItem } from "./classCatalog";

export type TeacherView = "dash" | "classes" | "upload" | "quiz" | "meet" | "students";

export function ExpiryBanner({
  teacherName = "Teacher",
  userId,
}: {
  teacherName?: string;
  userId: string;
}) {
  const [accessUntil, setAccessUntil] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, "users", userId), (snapshot) => {
      setAccessUntil(String(snapshot.data()?.accessUntil || ""));
    }, (error) => console.error("Could not load teacher access end date:", error));
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateParts = accessUntil.split("-").map(Number);
  const expiryDate = dateParts.length === 3 && dateParts.every(Number.isFinite)
    ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59)
    : null;
  const remainingMs = expiryDate ? expiryDate.getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const remainingMinutes = remainingMs !== null && remainingMs > 0
    ? Math.ceil(remainingMs / 60_000)
    : 0;
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const expiryLabel = expiryDate?.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const progress = remainingMs === null
    ? 0
    : Math.max(0, Math.min(100, (remainingMs / (30 * 24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-p2/30 bg-p2-soft px-4 py-3 text-sm">
      <span className="font-mono text-xs uppercase tracking-widest text-p2">
        Guest access
      </span>
      <span className="flex-1">
        {expiryDate ? expired
          ? <>{teacherName}, your guest access expired on <b>{expiryLabel}</b>.</>
          : <>{teacherName}, your guest access ends in <b>{days} d {hours} h {minutes} m</b> ({expiryLabel}).</>
          : <>No guest access end date has been set for {teacherName}.</>}
      </span>
      {expiryDate && !expired && (
        <div
          role="progressbar"
          aria-label="Time remaining before guest access ends"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-1.5 w-32 overflow-hidden rounded-full bg-white"
        >
          <div className="h-full grad transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <Title
        kicker="Overview"
        title="Teacher Dashboard"
        sub="Welcome to your class portal."
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <Label>Total Students</Label>
          <p className="mt-2 font-display text-4xl grad-text">24</p>
        </Card>
        <Card>
          <Label>Active Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">12</p>
        </Card>
        <Card>
          <Label>Pending Assessments</Label>
          <p className="mt-2 font-display text-4xl grad-text">5</p>
        </Card>
      </div>
    </>
  );
}

function StudentList() {
  const students = [
    { name: "Juan Dela Cruz", age: 14, status: "Active" },
    { name: "Maria Clara", age: 12, status: "Active" },
    { name: "Pedro Penduko", age: 26, status: "Inactive" },
  ];
  return (
    <>
      <Title
        kicker="Class Roster"
        title="My Students"
        sub="List of students assigned to your class."
      />
      <Card className="mt-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-mute">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Age Group</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((s, i) => (
              <tr key={i}>
                <td className="py-4 font-semibold">{s.name}</td>
                <td className="py-4">
                  {s.age <= 12 ? "Kids" : s.age <= 25 ? "Youth" : "Adults"}
                </td>
                <td className="py-4 text-right">
                  <Pill tone={s.status === "Active" ? "p1" : "p2"}>
                    {s.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function TeacherClasses({ classes, onChooseAction }: { classes: ClassCatalogItem[]; onChooseAction: (classId: string, view: "upload" | "quiz") => void }) {
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Upload({ className }: { className?: string }) {
  const [kind, setKind] = useState("Module");
  const [yt, setYt] = useState("https://youtu.be/kt5Yh3ucEdA");
  const [title, setTitle] = useState(
    "Psalm 95 — Kung marinig n'yo ang Kanyang tinig",
  );
  const [recent, setRecent] = useState([
    { id: 1, title: "Ledger Lines Worksheet", kind: "PDF", date: "Yesterday" },
  ]);

  const id = yt.match(/(?:youtu\.be\/|v=)([\w-]{11})/)?.[1];

  const handlePublish = () => {
    if (!title) return;
    setRecent([{ id: Date.now(), title, kind, date: "Just now" }, ...recent]);
    alert("Material successfully uploaded and synced to your assigned class!");
    setTitle("");
  };

  const handleEdit = (id: number) => {
    alert(
      "Edit modal opening for item ID: " +
        id +
        ". You can re-upload or rename files here.",
    );
  };

  return (
    <>
      <Title kicker="Content uploader" title="Add learning material" sub={className ? `Adding content for ${className}.` : "Choose an assigned class before adding content."} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex flex-wrap gap-2">
            {["Module", "Vocal guide", "PDF", "Video File", "YouTube"].map(
              (k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${kind === k ? "grad text-white" : "bg-p1-soft text-p1"}`}
                >
                  {k}
                </button>
              ),
            )}
          </div>
          <div className="mt-5 grid gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
            <div className="grid grid-cols-1 gap-3">
              <select className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
                <option>All ages (Auto-assigned computation)</option>
                <option>Kids 5–12</option>
                <option>Youth 13–25</option>
                <option>Adults 26+</option>
              </select>
            </div>
            {kind === "YouTube" ? (
              <Input
                value={yt}
                onChange={(e) => setYt(e.target.value)}
                placeholder="Paste YouTube link"
              />
            ) : (
              <label className="staff grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--p1)]/30 bg-p1-soft/40 px-6 py-12 text-center">
                <input type="file" accept="*/*" className="hidden" />
                <UploadCloud className="h-10 w-10 text-p1" strokeWidth={1.5} />
                <span className="mt-2 font-semibold">
                  Drop files here or browse
                </span>
                <span className="text-sm text-mute">
                  Accepts Documents, Audio, and Video formats (Up to 200 MB)
                </span>
              </label>
            )}
            <div className="flex gap-2">
              <Btn onClick={handlePublish}>Publish to class</Btn>
              <Btn variant="ghost">Save draft</Btn>
            </div>
          </div>
        </Card>
        <div className="grid content-start gap-5">
          <Card>
            <Label>Student preview</Label>
            {kind === "YouTube" && id ? (
              <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-p1-soft">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${id}`}
                  title="Preview"
                />
              </div>
            ) : (
              <div className="mt-3 grid aspect-video place-items-center rounded-xl bg-p1-soft text-mute">
                Preview appears here
              </div>
            )}
            <p className="mt-3 text-sm text-mute">
              Files stream inside the platform — learners never leave MML.
            </p>
          </Card>
          <Card>
            <Label>Recently Published</Label>
            <ul className="mt-3 divide-y divide-line">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-p1-soft p-2 text-p1">
                      {m.kind === "YouTube" ||
                      m.kind === "Video File" ||
                      m.kind === "Vocal guide" ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <p className="text-xs text-mute">
                        {m.kind} · {m.date}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(m.id)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

type Q = {
  q: string;
  o: string[];
  a: number;
  type: "multiple" | "truefalse" | "identification";
};
function Quiz({ className }: { className?: string }) {
  const [qs, setQs] = useState<Q[]>([
    {
      q: "What is the time signature of a waltz?",
      o: ["2/4", "3/4", "4/4"],
      a: 1,
      type: "multiple",
    },
  ]);
  const upd = (i: number, p: Partial<Q>) =>
    setQs(qs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <>
      <Title
        kicker="Assessment builder"
        title="Note Reading Quiz 5"
        sub={className ? `Creating an assessment for ${className}.` : "Choose an assigned class before creating an assessment."}
        right={
          <div className="flex gap-2">
            <Pill>Auto-graded</Pill>
            <Pill tone="p2">Passing 70%</Pill>
          </div>
        }
      />
      <div className="grid max-w-3xl gap-4">
        {qs.map((x, i) => (
          <Card key={i}>
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono text-xs text-p2">Q{i + 1}</p>
              <select
                value={x.type}
                onChange={(e) =>
                  upd(i, {
                    type: e.target.value as any,
                    o: e.target.value === "truefalse" ? ["True", "False"] : x.o,
                  })
                }
                className="text-xs border border-line rounded px-2 py-1"
              >
                <option value="multiple">Multiple Choice</option>
                <option value="truefalse">True/False</option>
                <option value="identification">Identification</option>
              </select>
            </div>
            <Input
              className="mt-2"
              value={x.q}
              onChange={(e) => upd(i, { q: e.target.value })}
            />
            {x.type === "identification" ? (
              <div className="mt-3">
                <Input placeholder="Enter correct exact answer here" />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {x.o.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button
                      onClick={() => upd(i, { a: j })}
                      aria-label="Mark correct"
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${x.a === j ? "border-[var(--p1)] grad" : "border-line"}`}
                    />
                    <Input
                      value={o}
                      disabled={x.type === "truefalse"}
                      onChange={(e) =>
                        upd(i, {
                          o: x.o.map((y, k) => (k === j ? e.target.value : y)),
                        })
                      }
                    />
                  </div>
                ))}
                {x.type === "multiple" && (
                  <button
                    onClick={() => upd(i, { o: [...x.o, "New option"] })}
                    className="mt-2 text-sm font-semibold text-p1 text-left"
                  >
                    + Option
                  </button>
                )}
              </div>
            )}
          </Card>
        ))}
        <div className="flex gap-2">
          <Btn
            variant="soft"
            onClick={() =>
              setQs([
                ...qs,
                { q: "New question", o: ["A", "B"], a: 0, type: "multiple" },
              ])
            }
          >
            + Add question
          </Btn>
          <Btn>Publish & Link to Class</Btn>
        </div>
      </div>
    </>
  );
}

function Meet() {
  const [list, setList] = useState([
    {
      t: "Virtual Rehearsal — 27th Sunday",
      w: "2026-10-10T20:00",
      l: "meet.google.com/mml-rhsl-027",
    },
  ]);
  const [t, setT] = useState("Note Reading Class");
  const [w, setW] = useState("2026-10-05T19:00");
  return (
    <>
      <Title kicker="Live sessions" title="Schedule a Google Meet" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="grid content-start gap-3">
          <Input value={t} onChange={(e) => setT(e.target.value)} />
          <Input
            type="datetime-local"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
          <Btn
            onClick={() => {
              setList([
                ...list,
                {
                  t,
                  w,
                  l: `meet.google.com/mml-${Math.random().toString(36).slice(2, 6)}-${list.length + 1}`,
                },
              ]);
              alert(
                "Meeting scheduled! Notifications sent to connected student accounts.",
              );
            }}
          >
            Generate Meet link & notify
          </Btn>
          <p className="text-xs text-mute">
            Members are notified via app, SMS, Gmail and Messenger.
          </p>
        </Card>
        <Card>
          <Label>Scheduled</Label>
          <ul className="mt-2 divide-y divide-line">
            {list.map((x) => (
              <li key={x.l} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1">
                  <b>{x.t}</b>
                  <br />
                  <span className="font-mono text-xs text-mute">
                    {new Date(x.w).toLocaleString()} · {x.l}
                  </span>
                </span>
                <Btn
                  variant="ghost"
                  onClick={() =>
                    navigator.clipboard?.writeText("https://" + x.l)
                  }
                >
                  Copy link
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function Teacher({ view, userId, go }: { view: TeacherView; userId: string; go: (view: string) => void }) {
  const loggedInTeacherName = localStorage.getItem("name") || "Teacher User";
  const [teacherIdentity, setTeacherIdentity] = useState(loggedInTeacherName);
  const [assignedClasses, setAssignedClasses] = useState<ClassCatalogItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, "users", userId), (snapshot) => {
      if (!snapshot.exists()) return;
      const profile = snapshot.data();
      setTeacherIdentity(String(profile.name || profile.email || loggedInTeacherName).trim());
    }, (error) => console.error("Could not load teacher profile:", error));
  }, [userId, loggedInTeacherName]);

  useEffect(() => onSnapshot(collection(db, "classes"), (snapshot) => {
    const teacherClasses = snapshot.docs
      .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() } as ClassCatalogItem))
      .filter((item) => !item.deleted && String(item.teacher || "").trim().toLowerCase() === teacherIdentity.toLowerCase());
    setAssignedClasses(teacherClasses);
    setSelectedClassId((current) => teacherClasses.some((item) => item.id === current)
      ? current
      : teacherClasses[0]?.id || "");
  }, (error) => console.error("Could not load assigned classes:", error)), [teacherIdentity]);

  const selectedClass = assignedClasses.find((item) => item.id === selectedClassId);

  return (
    <>
      {view === "dash" && <ExpiryBanner teacherName={loggedInTeacherName} userId={userId} />}
      <Card className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor="teacher-class-selector" className="text-sm font-semibold">Accessing class</label>
        <select
          id="teacher-class-selector"
          value={selectedClassId}
          onChange={(event) => setSelectedClassId(event.target.value)}
          disabled={assignedClasses.length === 0}
          className="min-w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {assignedClasses.length === 0 ? (
            <option value="">No classes assigned</option>
          ) : assignedClasses.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {selectedClass && <span className="text-sm text-mute">{selectedClass.description}</span>}
      </Card>
      {view === "dash" ? (
        <Dashboard />
      ) : view === "classes" ? (
        <TeacherClasses classes={assignedClasses} onChooseAction={(classId, nextView) => {
          setSelectedClassId(classId);
          go(nextView);
        }} />
      ) : view === "students" ? (
        <StudentList />
      ) : view === "quiz" ? (
        <Quiz className={selectedClass?.name} />
      ) : view === "meet" ? (
        <Meet />
      ) : (
        <Upload className={selectedClass?.name} />
      )}
    </>
  );
}
