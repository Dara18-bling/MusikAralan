import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Bell, Megaphone } from "lucide-react";
import { Card, Label, Title } from "./ui";
import { db } from "./firebase";

type Notice = {
  id: string;
  title: string;
  detail: string;
  source: string;
  createdAt: number;
};

function timestampMillis(value: any): number {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  return 0;
}

export default function Notifications({ role, age = "all" }: { role: "student" | "teacher"; age?: string }) {
  const [announcements, setAnnouncements] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [channels, setChannels] = useState({ SMS: true, Gmail: true, Messenger: true });
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Notice | null>(null);

  useEffect(() => {
    const unsubscribeAnnouncements = onSnapshot(collection(db, "announcements"), (snapshot) => {
      setAnnouncements(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: `announcement-${item.id}`,
          title: data.title || "New announcement",
          detail: data.content || "",
          source: "Admin announcement",
          createdAt: timestampMillis(data.createdAt),
        };
      }));
      setError("");
    }, (listenerError) => {
      console.error("Could not load announcements:", listenerError);
      setError("Announcements are unavailable right now.");
    });

    if (role === "teacher") return () => unsubscribeAnnouncements();

    const unsubscribeClasses = onSnapshot(collection(db, "classes"), (snapshot) => {
      setClasses(snapshot.docs.flatMap((item) => {
        const data = item.data();
        const classAge = data.age || "all";
        const ageMatches = classAge === "all" || classAge === age || (classAge === "adults" && age === "adult");
        const isOpen = data.availableForEnrollment === true;
        const statusChangedAt = timestampMillis(data.enrollmentUpdatedAt);
        if (data.deleted === true || !ageMatches || (!isOpen && statusChangedAt === 0)) return [];
        return [{
          id: `class-${item.id}`,
          title: isOpen
            ? `Enrollment open: ${data.name || "Class"}`
            : `Enrollment closed: ${data.name || "Class"}`,
          detail: [
            isOpen ? data.description : "Enrollment for this class has closed.",
            `Age group: ${classAge === "all" ? "All ages" : classAge}`,
          ].filter(Boolean).join(" · "),
          source: "Class enrollment",
          createdAt: statusChangedAt || timestampMillis(data.createdAt),
        }];
      }));
      setError("");
    }, (listenerError) => {
      console.error("Could not load class notifications:", listenerError);
      setError("Class updates are unavailable right now.");
    });
    return () => {
      unsubscribeAnnouncements();
      unsubscribeClasses();
    };
  }, [role, age]);

  const notices = [...announcements, ...classes].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <Title kicker="Notification center" title="Notifications" sub="Announcements and class updates." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          {notices.length === 0 ? (
            <p className="py-8 text-center text-mute">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notices.map((notice) => (
                <li key={notice.id} className="flex items-start gap-3 py-3">
                  {notice.source === "Admin announcement"
                    ? <Megaphone className="mt-1 h-4 w-4 shrink-0 text-p1" />
                    : <Bell className="mt-1 h-4 w-4 shrink-0 text-p1" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{notice.title}</p>
                    <Label>{notice.source}</Label>
                    {notice.detail && <p className={`mt-1 text-sm text-mute ${notice.source === "Admin announcement" ? "line-clamp-2" : "line-clamp-1"}`}>{notice.detail}</p>}
                    {notice.createdAt > 0 && <time className="mt-1 block text-xs text-mute">{new Date(notice.createdAt).toLocaleString()}</time>}
                  </div>
                  {notice.source === "Admin announcement" && (
                    <button type="button" onClick={() => setPreviewAnnouncement(notice)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-p1 hover:bg-p1-soft">Preview</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <Label>Notification channels</Label>
          <p className="mt-1 text-sm text-mute">Turn social and messaging notifications on or off.</p>
          {(Object.keys(channels) as (keyof typeof channels)[]).map((channel) => (
            <label key={channel} className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-line px-4 py-3">
              <span className="font-semibold">{channel}</span>
              <button
                type="button"
                role="switch"
                aria-checked={channels[channel]}
                aria-label={`${channel} notifications`}
                onClick={() => setChannels((current) => ({ ...current, [channel]: !current[channel] }))}
                className={`h-6 w-11 rounded-full p-0.5 transition ${channels[channel] ? "grad" : "bg-slate-200"}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-white transition ${channels[channel] ? "translate-x-5" : ""}`} />
              </button>
            </label>
          ))}
        </Card>
      </div>
      {previewAnnouncement && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewAnnouncement(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="student-announcement-preview-title" className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <Label>Announcement preview</Label>
            <h2 id="student-announcement-preview-title" className="mt-2 font-display text-2xl font-bold">{previewAnnouncement.title}</h2>
            <p className="mt-4 whitespace-pre-wrap text-ink">{previewAnnouncement.detail}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setPreviewAnnouncement(null)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-p1-soft">Close</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
