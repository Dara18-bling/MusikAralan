import { Card, Label, Title } from "../ui";

interface AdminDashboardProps {
  pendingCount: number;
  dashboardData: { users: number; classes: number; modules: number; materials: number; completedModules: number } | null;
  loading: boolean;
  newRequestNotice: string;
  accountListenerError: string;
}

export function AdminDashboard({
  pendingCount,
  dashboardData,
  loading,
  newRequestNotice,
  accountListenerError,
}: AdminDashboardProps) {
  return (
    <>
      <Title
        kicker="Overview"
        title="System Dashboard"
        sub="Welcome to the admin panel."
      />
      {newRequestNotice && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          {newRequestNotice}
        </div>
      )}
      {accountListenerError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Live access requests unavailable: {accountListenerError}
        </div>
      )}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <Label>Pending Approvals</Label>
          <p className="mt-2 font-display text-4xl grad-text">{loading ? "—" : pendingCount}</p>
        </Card>
        <Card>
          <Label>Total Accounts</Label>
          <p className="mt-2 font-display text-4xl grad-text">{dashboardData?.users ?? "—"}</p>
        </Card>
        <Card>
          <Label>Active Classes</Label>
          <p className="mt-2 font-display text-4xl grad-text">{dashboardData?.classes ?? "—"}</p>
        </Card>
        <Card>
          <Label>Learning Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">{dashboardData?.modules ?? "—"}</p>
        </Card>
        <Card>
          <Label>Learning Materials</Label>
          <p className="mt-2 font-display text-4xl grad-text">{dashboardData?.materials ?? "—"}</p>
        </Card>
        <Card>
          <Label>Completed Modules</Label>
          <p className="mt-2 font-display text-4xl grad-text">{dashboardData?.completedModules ?? "—"}</p>
        </Card>
      </div>
    </>
  );
}