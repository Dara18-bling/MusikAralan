import { Card, Label, Title } from "../ui";

interface AdminDashboardProps {
  pendingCount: number;
  newRequestNotice: string;
  accountListenerError: string;
}

export function AdminDashboard({
  pendingCount,
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
      <div className="mt-5 grid grid-cols-3 gap-5">
        <Card>
          <Label>Pending Approvals</Label>
          <p className="mt-2 font-display text-4xl grad-text">{pendingCount}</p>
        </Card>
        <Card>
          <Label>Total Modules Uploaded</Label>
          <p className="mt-2 font-display text-4xl grad-text">5</p>
        </Card>
        <Card>
          <Label>Certificates Issued</Label>
          <p className="mt-2 font-display text-4xl grad-text">8</p>
        </Card>
      </div>
    </>
  );
}