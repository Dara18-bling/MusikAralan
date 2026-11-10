import { useEffect, useState, type FormEvent } from "react";
import { Bell, ChevronDown, ChevronRight, Megaphone } from "lucide-react";
import { Card, Label, Title } from "./ui";
import {
  apiPatch,
  apiPost,
  refreshApi,
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
  classId?: string | null;
  className?: string | null;
};

type NotificationTab = "announcements" | "notifications";
type AnnouncementTab = "admin" | "classes";

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
  const [activeTab, setActiveTab] = useState<NotificationTab>("announcements");
  const [activeAnnouncementTab, setActiveAnnouncementTab] =
    useState<AnnouncementTab>("admin");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [collapsedClassIds, setCollapsedClassIds] = useState<Set<string>>(
    () => new Set(),
  );

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
    });

    const unsubscribeSavedNotifications = watchApi<{ data: any[] }>("/notifications", ({ data }) => {
      setSavedNotifications(data.map((item) => ({
        id: `notification-${item.id}`,
        notificationId: item.id,
        announcementId: item.announcementId == null ? null : String(item.announcementId),
        title: item.title || "New notification",
        detail: item.content || "",
        source:
          item.kind === "announcement"
            ? "Admin announcement"
            : item.kind === "class"
              ? "Class announcement"
              : item.kind === "schedule"
                ? "Scheduled session"
                : "Class notification",
        createdAt: timestampMillis(item.createdAt),
        readAt: item.readAt,
        classId: item.classId == null ? null : String(item.classId),
        className: item.className || null,
      })));
    }, (listenerError) => {
      console.error("Could not load saved notifications:", listenerError);
      setError("Saved notifications are unavailable right now.");
    });

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
    });
    return () => {
      unsubscribeAnnouncements();
      unsubscribeSavedNotifications();
      unsubscribeClasses();
    };
  }, [role, age]);

  const notifiedAnnouncementIds = new Set(
    savedNotifications.map((notice) => notice.announcementId).filter(Boolean),
  );
  const adminAnnouncements = [
    ...savedNotifications.filter((notice) => notice.source === "Admin announcement"),
    ...announcements.filter(
      (notice) =>
        !notifiedAnnouncementIds.has(notice.id.replace("announcement-", "")),
    ),
  ].sort((a, b) => b.createdAt - a.createdAt);
  const groupedClassAnnouncements = Array.from(
    savedNotifications
      .filter(
        (notice) =>
          notice.source === "Class announcement" && notice.classId,
      )
      .reduce((groups, notice) => {
        const classId = notice.classId!;
        const className = notice.className || `Class ${classId}`;
        const group = groups.get(classId) || { classId, className, notices: [] };
        group.notices.push(notice);
        groups.set(classId, group);
        return groups;
      }, new Map<string, { classId: string; className: string; notices: Notice[] }>())
      .values(),
  ).sort((a, b) => a.className.localeCompare(b.className));
  groupedClassAnnouncements.forEach((group) =>
    group.notices.sort((a, b) => b.createdAt - a.createdAt),
  );
  const otherNotifications = [
    ...savedNotifications.filter(
      (notice) =>
        notice.source !== "Admin announcement" &&
        notice.source !== "Class announcement",
    ),
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

  function openNotice(notice: Notice) {
    setSelectedNotice(notice);
    void markRead(notice);
  }

  function toggleClassAnnouncements(classId: string) {
    setCollapsedClassIds((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
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
      refreshApi("/notifications");
      setSentMessage(
        `Announcement posted for ${result.notified} student${result.notified === 1 ? "" : "s"}.`,
      );
      setMessageTitle("");
      setMessageContent("");
    } catch (sendError) {
      console.error("Could not send class notification:", sendError);
      setError(sendError instanceof Error ? sendError.message : "The notification could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const renderNoticeList = (items: Notice[]) => (
    <ul className="divide-y divide-line">
      {items.map((notice) => (
        <li key={notice.id}>
          <button
            type="button"
            onClick={() => openNotice(notice)}
            className="flex w-full items-start gap-3 py-3 text-left hover:bg-p1-soft/40"
          >
            {notice.source === "Admin announcement" ||
            notice.source === "Class announcement" ? (
              <Megaphone className="mt-1 h-4 w-4 shrink-0 text-p1" />
            ) : (
              <Bell className="mt-1 h-4 w-4 shrink-0 text-p1" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{notice.title}</span>
              <span className="mt-0.5 block text-xs text-mute">
                {notice.createdAt > 0
                  ? new Date(notice.createdAt).toLocaleString()
                  : notice.source}
              </span>
            </span>
            {notice.notificationId && !notice.readAt && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-p1" aria-label="Unread" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Title kicker="Notification center" title="Notifications" sub="Announcements and class updates." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className={role === "teacher" ? "grid gap-5 lg:grid-cols-[1.5fr_1fr]" : "block"}>
        <Card>
          <div className="mb-4 flex gap-2 border-b border-line" role="tablist" aria-label="Message categories">
            {(["announcements", "notifications"] as const).map((tab) => (
              <button
                key={tab}
                id={`${tab}-tab`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`${tab}-panel`}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-4 py-2 text-sm font-semibold capitalize ${
                  activeTab === tab
                    ? "border-p1 text-p1"
                    : "border-transparent text-mute hover:text-ink"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            id="announcements-panel"
            role="tabpanel"
            aria-labelledby="announcements-tab"
            hidden={activeTab !== "announcements"}
          >
            <div className="mb-3 flex gap-2 border-b border-line" role="tablist" aria-label="Announcement types">
              {(["admin", "classes"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`announcement-${tab}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={activeAnnouncementTab === tab}
                  aria-controls={`announcement-${tab}-panel`}
                  onClick={() => setActiveAnnouncementTab(tab)}
                  className={`border-b-2 px-4 py-2 text-sm font-semibold ${
                    activeAnnouncementTab === tab
                      ? "border-p1 text-p1"
                      : "border-transparent text-mute hover:text-ink"
                  }`}
                >
                  {tab === "admin" ? "Admin Announcements" : "Class-specific"}
                </button>
              ))}
            </div>
            <div
              id="announcement-admin-panel"
              role="tabpanel"
              aria-labelledby="announcement-admin-tab"
              hidden={activeAnnouncementTab !== "admin"}
            >
              {adminAnnouncements.length === 0 ? (
                <p className="py-8 text-center text-mute">No admin announcements yet.</p>
              ) : (
                renderNoticeList(adminAnnouncements)
              )}
            </div>
            <div
              id="announcement-classes-panel"
              role="tabpanel"
              aria-labelledby="announcement-classes-tab"
              hidden={activeAnnouncementTab !== "classes"}
            >
              {groupedClassAnnouncements.length === 0 ? (
                <p className="py-8 text-center text-mute">No class announcements yet.</p>
              ) : (
                <div className="divide-y divide-line">
                  {groupedClassAnnouncements.map((group) => (
                    <section key={group.classId} className="py-2">
                      <button
                        type="button"
                        id={`class-announcements-${group.classId}-toggle`}
                        aria-expanded={!collapsedClassIds.has(group.classId)}
                        aria-controls={`class-announcements-${group.classId}-content`}
                        onClick={() => toggleClassAnnouncements(group.classId)}
                        className="flex w-full items-center gap-2 py-2 text-left font-semibold hover:text-p1"
                      >
                        {collapsedClassIds.has(group.classId) ? (
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        {group.className} Announcement
                        <span className="ml-auto text-xs font-normal text-mute">
                          {group.notices.length}
                        </span>
                      </button>
                      <div
                        id={`class-announcements-${group.classId}-content`}
                        aria-labelledby={`class-announcements-${group.classId}-toggle`}
                        hidden={collapsedClassIds.has(group.classId)}
                      >
                        {renderNoticeList(group.notices)}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            id="notifications-panel"
            role="tabpanel"
            aria-labelledby="notifications-tab"
            hidden={activeTab !== "notifications"}
          >
            {otherNotifications.length === 0 ? (
              <p className="py-8 text-center text-mute">No notifications yet.</p>
            ) : (
              renderNoticeList(otherNotifications)
            )}
          </div>
        </Card>
        {role === "teacher" && (
          <Card>
            <Label>Class announcement</Label>
            <p className="mt-1 text-sm text-mute">Your announcement appears here and is sent to approved students in the selected class.</p>
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
                {sending ? "Posting…" : "Post announcement"}
              </button>
            </form>
          </Card>
        )}
      </div>
      {selectedNotice && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedNotice(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="notice-title" className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <Label>{selectedNotice.source}</Label>
            <h2 id="notice-title" className="mt-2 font-display text-2xl font-bold">{selectedNotice.title}</h2>
            {selectedNotice.createdAt > 0 && (
              <time className="mt-1 block text-xs text-mute">
                {new Date(selectedNotice.createdAt).toLocaleString()}
              </time>
            )}
            <p className="mt-4 whitespace-pre-wrap text-ink">{selectedNotice.detail || "There is no additional message."}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setSelectedNotice(null)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-p1-soft">Close</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
