import { Feather, Flame, Music, Piano, Star, Trophy } from "lucide-react";
import { Card, Label, Pill, Title } from "../ui";
import { Gospel } from "./Gospel";
import type { StudentView } from "./studentTypes";

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

interface StudentHomeProps {
  go: (v: StudentView) => void;
  age: string;
  userName: string;
}

export function StudentHome({ go, age, userName }: StudentHomeProps) {
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