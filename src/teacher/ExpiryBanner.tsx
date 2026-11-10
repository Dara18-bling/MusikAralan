import { useEffect, useState } from "react";
import { formatPhilippineDate, philippineEndOfDay } from "../utils/dateTime";

interface ExpiryBannerProps {
  teacherName?: string;
  accessUntil: string | null;
}

export function ExpiryBanner({
  teacherName = "Teacher",
  accessUntil,
}: ExpiryBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateParts = (accessUntil || "").split("-").map(Number);
  const expiryDate =
    dateParts.length === 3 && dateParts.every(Number.isFinite)
      ? philippineEndOfDay(accessUntil || "")
      : null;
  const remainingMs = expiryDate ? expiryDate.getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const remainingMinutes =
    remainingMs !== null && remainingMs > 0
      ? Math.ceil(remainingMs / 60_000)
      : 0;
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const expiryLabel = expiryDate ? formatPhilippineDate(accessUntil || "") : undefined;
  const progress =
    remainingMs === null
      ? 0
      : Math.max(0, Math.min(100, (remainingMs / (30 * 24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="mb-6 grid grid-cols-1 items-start gap-3 rounded-2xl border border-p2/30 bg-p2-soft p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4 lg:grid-cols-[auto_minmax(0,1fr)_8rem]">
      <span className="w-fit whitespace-nowrap font-mono text-xs uppercase tracking-widest text-p2">
        Guest access
      </span>
      <span className="min-w-0 break-words leading-relaxed">
        {expiryDate ? (
          expired ? (
            <>{teacherName}, your guest access expired on <b>{expiryLabel}</b>.</>
          ) : (
            <>
              {teacherName}, your guest access ends in{" "}
              <b>{days} d {hours} h {minutes} m</b> ({expiryLabel}).
            </>
          )
        ) : (
          <>No guest access end date has been set for {teacherName}.</>
        )}
      </span>
      {expiryDate && !expired && (
        <div
          role="progressbar"
          aria-label="Time remaining before guest access ends"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="col-span-1 h-2 w-full min-w-0 overflow-hidden rounded-full bg-white sm:col-span-2 lg:col-span-1"
        >
          <div
            className="h-full grad transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
