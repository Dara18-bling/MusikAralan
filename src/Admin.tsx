import { useEffect, useRef, useState } from "react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "./api";
import type { AdminView } from "./admin/adminTypes";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AdminAccounts } from "./admin/AdminAccounts";
import { AdminNews } from "./admin/AdminNews";
import { AdminClasses } from "./admin/AdminClasses";
import { AdminChatbot } from "./admin/AdminChatbot";
import { AdminGospel } from "./admin/AdminGospel";
import { AdminNotifications } from "./admin/AdminNotifications";

export type { AdminView };

export default function Admin({ view }: { view: AdminView }) {
  const [loading, setLoading] = useState(false);
  const [newRequestNotice, setNewRequestNotice] = useState("");
  const [accountListenerError, setAccountListenerError] = useState("");
  const [adminUserSummary, setAdminUserSummary] = useState<{
    pendingCount: number;
    pendingProfileEditRequestCount: number;
    pendingRequests: { id: string; name: string; email: string }[];
    teachers: string[];
  } | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    users: number;
    classes: number;
    modules: number;
    materials: number;
  } | null>(null);
  const knownUserIds = useRef(new Set<string>());
  const previousPendingCount = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    let initialSnapshot = true;
    let noticeTimer: number | undefined;

    const unsubscribe = watchApi<{
      pendingCount: number;
      pendingProfileEditRequestCount: number;
      pendingRequests: { id: string; name: string; email: string }[];
      teachers: string[];
    }>(
      "/admin/users/summary",
      (summary) => {
        setAdminUserSummary(summary);
        setAccountListenerError("");
        if (
          !initialSnapshot &&
          summary.pendingCount > (previousPendingCount.current ?? summary.pendingCount)
        ) {
          const newRequests = summary.pendingRequests
            .filter((user) => !knownUserIds.current.has(user.id))
            .map((user) => user.name || user.email || "A user");

          if (newRequests.length > 0) {
            setNewRequestNotice(
              newRequests.length === 1
                ? `New access request from ${newRequests[0]}.`
                : `${newRequests.length} new access requests received.`
            );
          } else {
            setNewRequestNotice("New access request received.");
          }
          window.clearTimeout(noticeTimer);
          noticeTimer = window.setTimeout(() => setNewRequestNotice(""), 8000);
        }
        knownUserIds.current = new Set(summary.pendingRequests.map((user) => user.id));
        previousPendingCount.current = summary.pendingCount;
        initialSnapshot = false;
        setLoading(false);
      },
      (error) => {
        console.error("Could not listen for account requests:", error);
        setAccountListenerError(
          error instanceof Error
            ? error.message
            : "Could not receive live account requests."
        );
        setLoading(false);
      },
      15_000,
    );

    return () => {
      unsubscribe();
      window.clearTimeout(noticeTimer);
    };
  }, []);

  useEffect(() => watchApi<{ dashboard: { users: number; classes: number; modules: number; materials: number } }>(
    "/dashboard",
    ({ dashboard }) => setDashboardData(dashboard),
    (error) => console.error("Could not load admin dashboard metrics:", error),
    POLL_INTERVAL_TWO_MINUTES,
  ), []);

  if (view === "dash") {
    return (
      <AdminDashboard
        pendingCount={adminUserSummary?.pendingCount ?? 0}
        pendingEditCount={adminUserSummary?.pendingProfileEditRequestCount ?? 0}
        dashboardData={dashboardData}
        loading={loading}
        newRequestNotice={newRequestNotice}
        accountListenerError={accountListenerError}
      />
    );
  }

  if (view === "accounts") {
    return (
      <AdminAccounts
        newRequestNotice={newRequestNotice}
        accountListenerError={accountListenerError}
        pendingProfileEditRequestCount={adminUserSummary?.pendingProfileEditRequestCount ?? 0}
      />
    );
  }

  if (view === "alerts") {
    return (
      <AdminNotifications
        pendingCount={adminUserSummary?.pendingCount ?? 0}
        pendingRequests={adminUserSummary?.pendingRequests ?? []}
        pendingEditCount={adminUserSummary?.pendingProfileEditRequestCount ?? 0}
      />
    );
  }

  if (view === "news") {
    return <AdminNews />;
  }

  if (view === "gospel") {
    return <AdminGospel />;
  }

  if (view === "classes") {
    return <AdminClasses accountTeachers={adminUserSummary?.teachers ?? []} />;
  }

  if (view === "bot") {
    return <AdminChatbot />;
  }

  return null;
}