import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Label } from "../ui";

export type CalendarSchedule = {
  id: string;
  className: string | null;
  title: string;
  startsAt: string;
  joinUrl: string | null;
};

export type CalendarMaterial = {
  id: string;
  classId: string;
  title: string;
  isAssignment?: boolean;
  availableFrom?: string | null;
  dueAt?: string | null;
};

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  type: "deadline" | "opening" | "session";
  time: string;
  materialId?: string;
  classId?: string;
  joinUrl?: string | null;
};

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

interface StudentCalendarProps {
  schedules: CalendarSchedule[];
  materials: CalendarMaterial[];
  onOpenMaterial?: (classId: string, materialId: string) => void;
}

export function StudentCalendar({
  schedules,
  materials,
  onOpenMaterial,
}: StudentCalendarProps) {
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = schedules.map((schedule) => {
      const date = new Date(schedule.startsAt);
      return {
        id: `session-${schedule.id}`,
        date: dateKey(date),
        title: schedule.title,
        type: "session",
        time: date.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        joinUrl: schedule.joinUrl,
      };
    });

    materials.forEach((material) => {
      if (!material.isAssignment) return;
      if (material.availableFrom) {
        const date = new Date(material.availableFrom);
        events.push({
          id: `${material.id}-opening`,
          date: dateKey(date),
          title: material.title,
          type: "opening",
          time: date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          materialId: material.id,
          classId: material.classId,
        });
      }
      if (material.dueAt) {
        const date = new Date(material.dueAt);
        events.push({
          id: `${material.id}-deadline`,
          date: dateKey(date),
          title: material.title,
          type: "deadline",
          time: date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          materialId: material.id,
          classId: material.classId,
        });
      }
    });

    return events.sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.time.localeCompare(right.time),
    );
  }, [materials, schedules]);
  const calendarEventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const events = grouped.get(event.date) || [];
      events.push(event);
      grouped.set(event.date, events);
    });
    return grouped;
  }, [calendarEvents]);
  const calendarCells = useMemo(() => {
    const firstDay = calendarMonth.getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    ).getDate();
    return Array.from({ length: firstDay + daysInMonth }, (_, index) =>
      index < firstDay ? null : index - firstDay + 1,
    );
  }, [calendarMonth]);

  return (
    <div className="grid gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label>Important dates</Label>
            <h2 className="mt-1 font-display text-2xl">
              {calendarMonth.toLocaleDateString([], {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setCalendarMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                )
              }
              className="rounded-full border border-line p-2 text-mute transition hover:border-p1 hover:text-p1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
              className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setCalendarMonth(
                  (month) =>
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                )
              }
              className="rounded-full border border-line p-2 text-mute transition hover:border-p1 hover:text-p1"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <div className="grid min-w-[42rem] grid-cols-7 border-l border-t border-line text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="border-b border-r border-line bg-slate-50 p-2 text-center font-semibold text-mute"
              >
                {day}
              </div>
            ))}
            {calendarCells.map((day, index) => {
              const date = day
                ? new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth(),
                    day,
                  )
                : null;
              const events = date
                ? calendarEventsByDate.get(dateKey(date)) || []
                : [];
              return (
                <div
                  key={date ? dateKey(date) : `empty-${index}`}
                  className="min-h-28 border-b border-r border-line p-2"
                >
                  {date && (
                    <>
                      <p
                        className={`mb-2 text-right font-semibold ${dateKey(date) === dateKey(new Date()) ? "text-p1" : "text-mute"}`}
                      >
                        {day}
                      </p>
                      <div className="grid gap-1">
                        {events.map((event) => {
                          const eventClass =
                            event.type === "deadline"
                              ? "bg-red-50 text-red-700"
                              : event.type === "opening"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-p1-soft text-p1";
                          const content = (
                            <>
                              <span className="block truncate font-semibold">
                                {event.type === "deadline"
                                  ? "Due: "
                                  : event.type === "opening"
                                    ? "Opens: "
                                    : ""}
                                {event.title}
                              </span>
                              <span className="block truncate text-[11px] opacity-80">
                                {event.time}
                              </span>
                            </>
                          );
                          return event.materialId &&
                            event.classId &&
                            onOpenMaterial ? (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() =>
                                onOpenMaterial(event.classId!, event.materialId!)
                              }
                              className={`w-full rounded-md px-2 py-1 text-left text-xs ${eventClass}`}
                            >
                              {content}
                            </button>
                          ) : event.joinUrl ? (
                            <a
                              key={event.id}
                              href={event.joinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`block rounded-md px-2 py-1 text-xs ${eventClass}`}
                            >
                              {content}
                            </a>
                          ) : (
                            <div
                              key={event.id}
                              className={`rounded-md px-2 py-1 text-xs ${eventClass}`}
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3 text-sm text-mute">
        <span className="rounded-full bg-p1-soft px-3 py-1 text-p1">
          Sessions
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
          Assignment openings
        </span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
          Assignment deadlines
        </span>
      </div>
      {!calendarEvents.length && (
        <Card className="text-center text-mute">
          No important dates have been scheduled for your classes.
        </Card>
      )}
    </div>
  );
}
