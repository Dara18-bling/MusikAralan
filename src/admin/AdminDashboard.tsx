import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  School,
  UsersRound,
} from "lucide-react";
import { Card, Label, Title } from "../ui";

interface AdminDashboardProps {
  pendingCount: number;
  dashboardData: {
    users: number;
    classes: number;
    modules: number;
    materials: number;
    completedModules: number;
  } | null;
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
        kicker=""
        title={"Welcome " + localStorage.getItem("name") + "!"}
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
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <Clock3 className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{loading ? "—" : pendingCount}</span>
          </p>
        </Card>
        <Card>
          <Label>Total Accounts</Label>
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <UsersRound className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{dashboardData?.users ?? "—"}</span>
          </p>
        </Card>
        <Card>
          <Label>Active Classes</Label>
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <School className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{dashboardData?.classes ?? "—"}</span>
          </p>
        </Card>
        <Card>
          <Label>Learning Modules</Label>
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <BookOpen className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{dashboardData?.modules ?? "—"}</span>
          </p>
        </Card>
        <Card>
          <Label>Learning Materials</Label>
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <FileText className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{dashboardData?.materials ?? "—"}</span>
          </p>
        </Card>
        <Card>
          <Label>Completed Modules</Label>
          <p className="mt-2 flex items-center gap-3 font-display text-4xl">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-p1" aria-hidden="true" />
            <span className="grad-text">{dashboardData?.completedModules ?? "—"}</span>
          </p>
        </Card>
      </div>
    </>
  );
}
