import { useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiPost, apiPut, POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Btn, Card, Input, Label, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";

interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  classId: string | null;
  className: string | null;
  startsAt: string;
  joinUrl: string | null;
  canManage: boolean;
}

interface MeetProps {
  classes: ClassCatalogItem[];
}

export function Meet({ classes }: MeetProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const stopSchedules = watchApi<{ data: ScheduleItem[] }>("/schedules", ({ data }) => {
      setSchedules(data);
    }, (listenerError) => {
      console.error("Could not load scheduled meetings:", listenerError);
      setError("Scheduled sessions could not be loaded.");
    }, POLL_INTERVAL_TWO_MINUTES);
    return () => {
      stopSchedules();
    };
  }, []);

  useEffect(() => {
    setClassId((current) =>
      classes.some((item) => item.id === current)
        ? current
        : classes[0]?.id || "",
    );
  }, [classes]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setJoinUrl("");
  }

  function editSession(item: ScheduleItem) {
    setEditingId(item.id);
    setClassId(item.classId || "");
    setTitle(item.title);
    setDescription(item.description || "");
    const date = new Date(item.startsAt);
    setStartsAt(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setJoinUrl(item.joinUrl || "");
    setError("");
  }

  async function scheduleSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const payload = {
        classId,
        title,
        description: description || null,
        startsAt: new Date(startsAt).toISOString(),
        joinUrl: joinUrl || null,
      };
      if (editingId) {
        const { schedule } = await apiPut<{ schedule: Omit<ScheduleItem, "canManage"> }>(
          `/schedules/${encodeURIComponent(editingId)}`,
          payload,
        );
        setSchedules((current) =>
          current.map((item) => item.id === editingId ? { ...schedule, canManage: item.canManage } : item),
        );
      } else {
        await apiPost("/schedules", payload);
      }
      resetForm();
    } catch (scheduleError) {
      console.error("Could not save scheduled session:", scheduleError);
      setError(scheduleError instanceof Error ? scheduleError.message : "The session could not be saved.");
    } finally {
      setSending(false);
    }
  }

  async function deleteSession(item: ScheduleItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setError("");
    setDeletingId(item.id);
    try {
      await apiDelete(`/schedules/${encodeURIComponent(item.id)}`);
      setSchedules((current) => current.filter((schedule) => schedule.id !== item.id));
      if (editingId === item.id) resetForm();
    } catch (deleteError) {
      console.error("Could not delete scheduled session:", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "The session could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Title kicker="Live sessions" title="Schedule a learning session" sub="Sessions are saved to the system and visible to enrolled students." />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          {!classes.length ? (
            <p className="text-sm text-mute">You need an assigned class before scheduling a student session.</p>
          ) : (
            <form className="grid content-start gap-3" onSubmit={(event) => void scheduleSession(event)}>
              <Label>{editingId ? "Edit session" : "New session"}</Label>
              <label className="grid gap-1 text-sm font-semibold">
                Class
                <select value={classId} onChange={(event) => setClassId(event.target.value)} required className="rounded-xl border border-line bg-white px-3 py-2">
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Session title" required maxLength={255} />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Meeting details (optional)" maxLength={10000} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--p1)] focus:ring-2 focus:ring-p1-soft" />
              <label className="grid gap-1 text-sm font-semibold">
                Date and time
                <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              </label>
              <Input type="url" value={joinUrl} onChange={(event) => setJoinUrl(event.target.value)} placeholder="Secure meeting link (optional)" />
              <Btn disabled={sending || !classId}>
                {sending ? "Saving session…" : editingId ? "Update session" : "Schedule and notify students"}
              </Btn>
              {editingId && <button type="button" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-p1-soft" onClick={resetForm}>Cancel edit</button>}
              <p className="text-xs text-mute">Students enrolled in this class receive an in-app notification. Paste a real HTTPS meeting link; the app does not generate one.</p>
            </form>
          )}
        </Card>
        <Card>
          <Label>Scheduled sessions</Label>
          <ul className="mt-2 divide-y divide-line">
            {schedules.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1">
                  <b>{item.title}</b>
                  <br />
                  <span className="text-sm text-mute">{item.className || "All students"} · {new Date(item.startsAt).toLocaleString()}</span>
                </span>
                {item.joinUrl && (
                  <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold" onClick={() => void navigator.clipboard?.writeText(item.joinUrl!)}>
                    Copy link
                  </button>
                )}
                {item.canManage && (
                  <>
                    <Btn variant="ghost" onClick={() => editSession(item)}>Edit</Btn>
                    <Btn variant="ghost" disabled={deletingId === item.id} onClick={() => void deleteSession(item)}>
                      {deletingId === item.id ? "Deleting…" : "Delete"}
                    </Btn>
                  </>
                )}
              </li>
            ))}
            {!schedules.length && <li className="py-5 text-center text-sm text-mute">No sessions have been scheduled yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
