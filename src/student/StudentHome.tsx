import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, Music, Trophy } from "lucide-react";
import { Card, Label, Title } from "../ui";
import { watchApi } from "../api";
import type { StudentView } from "./studentTypes";
import { Gospel } from "./Gospel";

interface StudentDashboard {
  classes: number;
  modules: number;
  completedModules: number;
  averageQuizScore: number;
  quizAttempts: number;
  upcomingSchedule: null | {
    title: string;
    className: string | null;
    startsAt: string;
    joinUrl: string | null;
  };
}

interface ScheduleItem {
  id: string;
  title: string;
  className: string | null;
  startsAt: string;
  joinUrl: string | null;
}

interface StudentHomeProps {
  go: (v: StudentView) => void;
  age: string;
  userName: string;
}

export function StudentHome({ go, age, userName }: StudentHomeProps) {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [error, setError] = useState("");
  const firstName = userName.split(" ")[0];

  useEffect(() => {
    const stopDashboard = watchApi<{ dashboard: StudentDashboard }>("/dashboard", ({ dashboard: data }) => {
      setDashboard(data);
      setError("");
    }, (listenerError) => {
      console.error("Could not load student dashboard:", listenerError);
      setError("Dashboard data is unavailable right now.");
    });
    const stopSchedules = watchApi<{ data: ScheduleItem[] }>("/schedules", ({ data }) => {
      setSchedules(data.filter((item) => new Date(item.startsAt).getTime() >= Date.now()));
      setSchedulesLoaded(true);
    }, (listenerError) => {
      console.error("Could not load upcoming sessions:", listenerError);
      setError("Upcoming sessions are unavailable right now.");
    });
    return () => {
      stopDashboard();
      stopSchedules();
    };
  }, []);

  const kid = age === "kids";
  const stats = [
    { label: "Enrolled classes", value: dashboard?.classes ?? "—", detail: "from your current enrollments", icon: BookOpen },
    { label: "Average quiz score", value: dashboard ? `${dashboard.averageQuizScore}%` : "—", detail: `${dashboard?.quizAttempts ?? 0} saved attempts`, icon: Music },
    { label: "Modules completed", value: dashboard ? `${dashboard.completedModules}/${dashboard.modules}` : "—", detail: "based on recorded progress", icon: Trophy },
  ];

  return (
    <>
      <Title
        kicker="Learning overview"
        title={kid ? `Hi ${firstName}! Ready to learn?` : `Welcome, ${firstName}`}
        sub="Your classes, assessment results, and upcoming learning sessions."
      />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-5">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Upcoming session</Label>
                {dashboard?.upcomingSchedule ? (
                  <>
                    <h2 className="mt-2 font-display text-2xl">{dashboard.upcomingSchedule.title}</h2>
                    <p className="mt-1 text-sm text-mute">
                      {[dashboard.upcomingSchedule.className, new Date(dashboard.upcomingSchedule.startsAt).toLocaleString()].filter(Boolean).join(" · ")}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-mute">
                    {dashboard ? "No upcoming sessions are scheduled for your enrolled classes." : "Loading your schedule…"}
                  </p>
                )}
              </div>
              <CalendarDays className="h-10 w-10 shrink-0 text-p1" />
            </div>
            {dashboard?.upcomingSchedule?.joinUrl && (
              <a href={dashboard.upcomingSchedule.joinUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-p1 px-5 py-2 text-sm font-semibold text-white">
                Open session
              </a>
            )}
            <button type="button" onClick={() => go("live")} className="mt-4 block text-sm font-semibold text-p1">View all sessions</button>
          </Card>
          <div className="grid gap-5 sm:grid-cols-3">
            {stats.map(({ label, value, detail, icon: Icon }) => (
              <Card key={label}>
                <div className="flex items-center justify-between gap-2">
                  <Label>{label}</Label>
                  <Icon className="h-4 w-4 text-p1" />
                </div>
                <p className="mt-2 font-display text-4xl grad-text">{value}</p>
                <p className="text-sm text-mute">{detail}</p>
              </Card>
            ))}
          </div>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <Label>Upcoming sessions</Label>
              <button type="button" onClick={() => go("live")} className="text-sm font-semibold text-p1">View all</button>
            </div>
            {schedules.length ? (
              <ul className="mt-3 divide-y divide-line">
                {schedules.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                    <CalendarDays className="h-4 w-4 text-p2" />
                    <span className="flex-1 font-medium">{item.title}</span>
                    <span className="text-sm text-mute">{new Date(item.startsAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : !schedulesLoaded ? (
              <p className="mt-3 text-sm text-mute">Loading upcoming sessions…</p>
            ) : (
              <p className="mt-3 text-sm text-mute">No upcoming sessions.</p>
            )}
          </Card>
          <Gospel />
        </div>
        <Card className="h-fit">
          <Label>Learning progress</Label>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span>Completed modules</span>
              <span>{dashboard?.completedModules ?? 0} / {dashboard?.modules ?? 0}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--p1)] transition-all"
                style={{ width: `${dashboard?.modules ? Math.round((dashboard.completedModules / dashboard.modules) * 100) : 0}%` }}
              />
            </div>
          </div>
          <button type="button" onClick={() => go("materials")} className="mt-5 rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1">
            Browse my classes
          </button>
        </Card>
      </div>
    </>
  );
}
