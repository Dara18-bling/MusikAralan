import { useState } from "react";
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

export type StudentView =
  | "notes"
  | "home"
  | "materials"
  | "live"
  | "exams"
  | "store"
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
          <Card className="border-p2/30">
            <Label>Live now · Google Meet</Label>
            <p className="mt-2 font-display text-xl">Note Reading Class</p>
            <p className="text-sm text-mute">Sis. Ethyl · started 4 min ago</p>
            <Btn
              className="mt-4 w-full py-3 text-base cursor-pointer"
              onClick={() => go("live")}
            >
              <Video className="h-5 w-5" /> Join class
            </Btn>
          </Card>
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

function Materials() {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <Title
        kicker="My Classes"
        title="Enrolled Classes & Activities"
        sub="View lessons, download files, and answer activities for your classes."
        right={
          <div className="flex rounded-full border border-line bg-white p-1 text-sm">
            {(["active", "completed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 font-semibold capitalize cursor-pointer ${tab === t ? "grad text-white" : "text-mute"}`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
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

const availableClasses = [
  { t: "Basic Keyboard Lessons", d: "8 weeks · 16 lessons", e: Piano },
  { t: "Psalmody Masterclass", d: "6 weeks · live coaching", e: Feather },
  { t: "Advanced Choir Repertoire", d: "For tenors and sopranos", e: Music },
];
function Store({ userName }: { userName: string }) {
  const [enrolled, setEnrolled] = useState<number[]>([]);
  return (
    <>
      <Title
        kicker="Available Classes"
        title="Enroll in New Classes"
        sub="Browse and join classes to expand your learning."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {availableClasses.map((c, i) => (
          <Card key={c.t}>
            <div className="grad grid h-36 place-items-center rounded-xl text-white">
              <c.e className="h-14 w-14" strokeWidth={1.25} />
            </div>
            <p className="mt-4 font-display text-xl leading-tight">{c.t}</p>
            <p className="text-mute mt-1 text-sm">{c.d}</p>
            <div className="mt-4 flex items-center justify-between">
              {/* Fixed disabled prop issue by using native button */}
              <button
                onClick={() => setEnrolled([...enrolled, i])}
                disabled={enrolled.includes(i)}
                className="w-full rounded-full bg-[var(--p1)] py-2 px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {enrolled.includes(i) ? "Enrolled" : "Join Class"}
              </button>
            </div>
          </Card>
        ))}
      </div>
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
}: {
  view: StudentView;
  go: (v: StudentView) => void;
  age: string;
  userName: string;
}) {
  if (view === "notes") return <PianoQuiz />;
  if (view === "materials") return <Materials />;
  if (view === "live") return <Live />;
  if (view === "exams") return <Exams userName={userName} />;
  if (view === "store") return <Store userName={userName} />;
  if (view === "help") return <Help />;
  if (view === "alerts") return <Alerts />;
  return <Home go={go} age={age} userName={userName} />;
}
