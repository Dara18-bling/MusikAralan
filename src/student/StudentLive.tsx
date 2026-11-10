import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Btn, Card, Title } from "../ui";
import { watchApi } from "../api";

interface ScheduleItem {
  id: string;
  title: string;
  className: string | null;
  description: string | null;
  startsAt: string;
  joinUrl: string | null;
}

export function StudentLive() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => watchApi<{ data: ScheduleItem[] }>("/schedules", ({ data }) => {
    setSchedules(data);
    setError("");
  }, (listenerError) => {
    console.error("Could not load scheduled sessions:", listenerError);
    setError("Scheduled sessions are unavailable right now.");
  }), []);

  return (
    <>
      <Title kicker="Virtual classroom" title="Live Sessions" sub="Sessions scheduled for your enrolled classes." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4">
        {schedules.map((session) => (
          <Card key={session.id} className="flex flex-wrap items-center gap-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-p1-soft text-p1">
              <Video className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-display text-xl">{session.title}</p>
              <p className="text-mute">
                {[session.className, new Date(session.startsAt).toLocaleString()].filter(Boolean).join(" · ")}
              </p>
              {session.description && <p className="mt-1 text-sm text-mute">{session.description}</p>}
            </div>
            {session.joinUrl ? (
              <a href={session.joinUrl} target="_blank" rel="noreferrer">
                <Btn className="px-8 py-3 text-base">Open meeting link</Btn>
              </a>
            ) : (
              <span className="text-sm text-mute">Meeting link not provided</span>
            )}
          </Card>
        ))}
        {!schedules.length && !error && <Card className="py-8 text-center text-mute">No sessions have been scheduled for your classes.</Card>}
      </div>
    </>
  );
}
