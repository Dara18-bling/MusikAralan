import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
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

  useEffect(() => {
    setLoading(true);
    let initialSnapshot = true;
    let noticeTimer: number | undefined;

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setAllUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
        setAccountListenerError("");
        if (!initialSnapshot) {
          const newRequests = snapshot
            .docChanges()
            .filter(
              (change) => change.type === "added" && change.doc.data().status === "pending"
            )
            .map((change) => change.doc.data().name || change.doc.data().email || "A user");

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
        initialSnapshot = false;
        setLoading(false);
      },
      (error) => {
        console.error("Could not listen for account requests:", error);
        setAccountListenerError(
          error.message || "Could not receive live account requests."
        );
        setLoading(false);
      }
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