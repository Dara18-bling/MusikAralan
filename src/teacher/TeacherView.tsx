import { useEffect, useState } from "react";
import { watchApi } from "../api";

interface ExpiryBannerProps {
  teacherName?: string;
  userId: string;
}

export function ExpiryBanner({
  teacherName = "Teacher",
  userId,
}: ExpiryBannerProps) {
  const [accessUntil, setAccessUntil] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!userId) return;
    return watchApi<{ user: { accessUntil?: string | null } }>(
      "/me",
      ({ user }) => setAccessUntil(String(user.accessUntil || "")),
      (error) => console.error("Could not load teacher access end date:", error),
    );
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateParts = accessUntil.split("-").map(Number);
  const expiryDate =
    dateParts.length === 3 && dateParts.every(Number.isFinite)
      ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59)
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
  const expiryLabel = expiryDate?.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const progress =
    remainingMs === null
      ? 0
      : Math.max(0, Math.min(100, (remainingMs / (30 * 24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-p2/30 bg-p2-soft px-4 py-3 text-sm">
      <span className="font-mono text-xs uppercase tracking-widest text-p2">
        Guest access
      </span>
      <span className="flex-1">
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
          className="h-1.5 w-32 overflow-hidden rounded-full bg-white"
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