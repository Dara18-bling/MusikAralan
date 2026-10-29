import { useEffect, useState } from "react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card, Label, Title } from "../ui";

export function Dashboard() {
  const [stats, setStats] = useState<{ students: number; modules: number; pendingAssessments: number; schedules: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => watchApi<{ dashboard: { students: number; modules: number; pendingAssessments: number; schedules: number } }>(
    "/dashboard",
    ({ dashboard }) => {
      setStats(dashboard);
      setError("");
    },
    (listenerError) => {
      console.error("Could not load teacher dashboard:", listenerError);
      setError("Dashboard data is unavailable right now.");
    },
    POLL_INTERVAL_TWO_MINUTES,
  ), []);

  return (
    <>
      <Title
        kicker="Overview"
        title="Teacher Dashboard"
        sub="Welcome to your class portal."
      />
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Label>Total Students</Label>
          <p className="mt-2 font-display text-4xl grad-text">{stats?.students ?? "—"}</p>
        </Card>
        <Card>
          <Label>Active Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">{stats?.modules ?? "—"}</p>
        </Card>
        <Card>
          <Label>Classes without an assessment</Label>
          <p className="mt-2 font-display text-4xl grad-text">{stats?.pendingAssessments ?? "—"}</p>
        </Card>
        <Card>
          <Label>Scheduled Sessions</Label>
          <p className="mt-2 font-display text-4xl grad-text">{stats?.schedules ?? "—"}</p>
        </Card>
      </div>
    </>
  );
}