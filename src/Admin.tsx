import { useEffect, useRef, useState } from "react";
import { watchApi } from "./api";
import type { AdminView } from "./admin/adminTypes";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AdminAccounts } from "./admin/AdminAccounts";
import { AdminNews } from "./admin/AdminNews";
import { AdminClasses } from "./admin/AdminClasses";
import { AdminChatbot } from "./admin/AdminChatbot";

export type { AdminView };

export default function Admin({ view }: { view: AdminView }) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRequestNotice, setNewRequestNotice] = useState("");
  const [accountListenerError, setAccountListenerError] = useState("");
  const knownUserIds = useRef(new Set<string>());

  useEffect(() => {
    setLoading(true);
    let initialSnapshot = true;
    let noticeTimer: number | undefined;

    const unsubscribe = watchApi<{ data: any[] }>(
      "/admin/users",
      ({ data }) => {
        setAllUsers(data);
        setAccountListenerError("");
        if (!initialSnapshot) {
          const newRequests = data
            .filter((user) => !knownUserIds.current.has(user.id) && user.status === "pending")
            .map((user) => user.name || user.email || "A user");

          if (newRequests.length > 0) {
            setNewRequestNotice(
              newRequests.length === 1
                ? `New access request from ${newRequests[0]}.`
                : `${newRequests.length} new access requests received.`
            );
            window.clearTimeout(noticeTimer);
            noticeTimer = window.setTimeout(() => setNewRequestNotice(""), 8000);
          }
        }
        knownUserIds.current = new Set(data.map((user) => user.id));
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

  const pendingCount = allUsers.filter((u) => u.status === "pending").length;

  const accountTeachers = [
    ...new Set(
      allUsers
        .filter((user) => user.role === "teacher" && user.status === "approved")
        .map((user) => String(user.name || user.email || "").trim())
        .filter(Boolean)
    ),
  ];

  if (view === "dash") {
    return (
      <AdminDashboard
        pendingCount={pendingCount}
        newRequestNotice={newRequestNotice}
        accountListenerError={accountListenerError}
      />
    );
  }

  if (view === "accounts") {
    return (
      <AdminAccounts
        allUsers={allUsers}
        setAllUsers={setAllUsers}
        loading={loading}
        setLoading={setLoading}
        newRequestNotice={newRequestNotice}
        accountListenerError={accountListenerError}
      />
    );
  }

  if (view === "news") {
    return <AdminNews />;
  }

  if (view === "classes") {
    return <AdminClasses accountTeachers={accountTeachers} />;
  }

  if (view === "bot") {
    return <AdminChatbot />;
  }

  return null;
}