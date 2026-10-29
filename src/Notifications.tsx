import { useEffect, useState, type FormEvent } from "react";
import { Bell, Megaphone } from "lucide-react";
import { Card, Label, Title } from "./ui";
import {
  apiPatch,
  apiPost,
  POLL_INTERVAL_DAY,
  POLL_INTERVAL_TEN_MINUTES,
  watchApi,
} from "./api";

type Notice = {
  id: string;
  title: string;
  detail: string;
  source: string;
  createdAt: number;
  notificationId?: string;
  readAt?: string | null;
  announcementId?: string | null;
};

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") return new Date(value).getTime() || 0;
  return 0;
}

export default function Notifications({ role, age = "all" }: { role: "student" | "teacher"; age?: string }) {
  const [announcements, setAnnouncements] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<Notice[]>([]);
  const [savedNotifications, setSavedNotifications] = useState<Notice[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Notice | null>(null);

  useEffect(() => {
    const unsubscribeAnnouncements = watchApi<{ data: any[] }>("/announcements", ({ data }) => {
      setAnnouncements(data.map((item) => {
        return {
          id: `announcement-${item.id}`,
          title: item.title || "New announcement",
          detail: item.content || "",
          source: "Admin announcement",
          createdAt: timestampMillis(item.createdAt),
        };
      }));
      setError("");
    }, (listenerError) => {
      console.error("Could not load announcements:", listenerError);
      setError("Announcements are unavailable right now.");
    }, POLL_INTERVAL_TEN_MINUTES);

    const unsubscribeSavedNotifications = watchApi<{ data: any[] }>("/notifications", ({ data }) => {
      setSavedNotifications(data.map((item) => ({
        id: `notification-${item.id}`,
        notificationId: item.id,
        announcementId: item.announcementId == null ? null : String(item.announcementId),
        title: item.title || "New notification",
        detail: item.content || "",
        source: item.kind === "announcement"
          ? "Admin announcement"
          : item.kind === "schedule"
            ? "Scheduled session"
            : "Class notification",
        createdAt: timestampMillis(item.createdAt),
        readAt: item.readAt,
      })));
    }, (listenerError) => {
      console.error("Could not load saved notifications:", listenerError);
      setError("Saved notifications are unavailable right now.");
    }, POLL_INTERVAL_TEN_MINUTES);

    const unsubscribeClasses = watchApi<{ data: any[] }>("/classes", ({ data }) => {
      if (role === "teacher") {
        const handled = data.map((item) => ({ id: String(item.id), name: item.name || "Class" }));
        setTeacherClasses(handled);
        setSelectedClassId((current) => current || handled[0]?.id || "");
        return;
      }
      setClasses(data.flatMap((item) => {
        const classAge = item.age || "all";
        const ageMatches = classAge === "all" || classAge === age || (classAge === "adults" && age === "adult");
        const isOpen = item.availableForEnrollment === true;
        const statusChangedAt = timestampMillis(item.enrollmentUpdatedAt);
        if (item.deleted === true || !ageMatches || (!isOpen && statusChangedAt === 0)) return [];
        return [{
          id: `class-${item.id}`,
          title: isOpen
            ? `Enrollment open: ${item.name || "Class"}`
            : `Enrollment closed: ${item.name || "Class"}`,
          detail: [
            isOpen ? item.description : "Enrollment for this class has closed.",
            `Age group: ${classAge === "all" ? "All ages" : classAge}`,
          ].filter(Boolean).join(" · "),
          source: "Class enrollment",
          createdAt: statusChangedAt || timestampMillis(item.createdAt),
        }];
      }));
      setError("");
    }, (listenerError) => {
      console.error("Could not load class notifications:", listenerError);
      setError("Class updates are unavailable right now.");
    }, POLL_INTERVAL_DAY);
    return () => {
      unsubscribeAnnouncements();
      unsubscribeSavedNotifications();
      unsubscribeClasses();
    };
  }, [role, age]);

  const notifiedAnnouncementIds = new Set(savedNotifications.map((notice) => notice.announcementId).filter(Boolean));
  const notices = [
    ...savedNotifications,
    ...announcements.filter((notice) => !notifiedAnnouncementIds.has(notice.id.replace("announcement-", ""))),
    ...classes,
  ].sort((a, b) => b.createdAt - a.createdAt);

  async function markRead(notice: Notice) {
    if (!notice.notificationId || notice.readAt) return;
    try {
      await apiPatch(`/notifications/${encodeURIComponent(notice.notificationId)}/read`, {});
      setSavedNotifications((current) => current.map((item) =>
        item.notificationId === notice.notificationId ? { ...item, readAt: new Date().toISOString() } : item,
      ));
    } catch (markError) {
      console.error("Could not mark notification as read:", markError);
      setError("This notification could not be marked as read.");
    }
  }

  async function sendClassNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClassId) return;
    setSending(true);
    setSentMessage("");
    setError("");
    try {
      const result = await apiPost<{ notified: number }>(
        `/classes/${encodeURIComponent(selectedClassId)}/notifications`,
        { title: messageTitle, content: messageContent },
      );
      setSentMessage(`Notification sent to ${result.notified} student${result.notified === 1 ? "" : "s"}.`);
      setMessageTitle("");
      setMessageContent("");
    } catch (sendError) {
      console.error("Could not send class notification:", sendError);
      setError(sendError instanceof Error ? sendError.message : "The notification could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Title kicker="Notification center" title="Notifications" sub="Announcements and class updates." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className={role === "teacher" ? "grid gap-5 lg:grid-cols-[1.5fr_1fr]" : "block"}>
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
                  <button type="button" onClick={() => { void markRead(notice); setPreviewAnnouncement(notice); }} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-p1 hover:bg-p1-soft">Preview</button>
                  )}
                  {notice.notificationId && !notice.readAt && (
                  <button type="button" onClick={() => void markRead(notice)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-p1 hover:bg-p1-soft">Mark read</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {role === "teacher" && (
          <Card>
            <Label>Notify a handled class</Label>
            <p className="mt-1 text-sm text-mute">Only approved students enrolled in your selected class will receive this message.</p>
            <form className="mt-4 space-y-3" onSubmit={(event) => void sendClassNotification(event)}>
              <label className="block text-sm font-semibold">
                Class
                <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} required className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2">
                  {teacherClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Title
                <input value={messageTitle} onChange={(event) => setMessageTitle(event.target.value)} required maxLength={255} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
              </label>
              <label className="block text-sm font-semibold">
                Message
                <textarea value={messageContent} onChange={(event) => setMessageContent(event.target.value)} required maxLength={10000} rows={4} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
              </label>
              {sentMessage && <p role="status" className="text-sm text-green-700">{sentMessage}</p>}
              <button type="submit" disabled={sending || !selectedClassId} className="rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? "Sending…" : "Send notification"}
              </button>
            </form>
          </Card>
        )}
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
