import { useEffect, useState } from "react";
import { Card, Label, Title, Btn } from "./ui";
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_CHATBOT_RESPONSES, type ChatbotResponse } from "./chatbotResponses";
import { DEFAULT_CLASSES, type ClassCatalogItem } from "./classCatalog";

export type AdminView = "dash" | "accounts" | "news" | "classes" | "bot";
type UserStatus = "pending" | "approved" | "rejected" | "inactive";
type AccountFilter = "all" | "student" | "teacher" | "admin" | "pending" | "activated" | "deactivated";
type ClassFilter = "all" | "open" | "closed" | "deleted";

export default function Admin({ view }: { view: AdminView }) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRequestNotice, setNewRequestNotice] = useState("");
  const [accountListenerError, setAccountListenerError] = useState("");
  const [rolesToAssign, setRolesToAssign] = useState<Record<string, string>>(
    {},
  );
  const [accessDates, setAccessDates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("pending");
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [teacherDateUserId, setTeacherDateUserId] = useState<string | null>(null);
  const [managedClasses, setManagedClasses] = useState<ClassCatalogItem[]>([]);
  const [editingClass, setEditingClass] = useState<ClassCatalogItem | null>(null);
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [classSearch, setClassSearch] = useState("");
  const [classesLoading, setClassesLoading] = useState(false);
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassTeacher, setNewClassTeacher] = useState("Unassigned");
  const [newClassAge, setNewClassAge] = useState<ClassCatalogItem["age"]>("all");
  const [newClassDescription, setNewClassDescription] = useState("New class");
  const [newClassAvailable, setNewClassAvailable] = useState(false);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<any | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [chatbotReplies, setChatbotReplies] = useState<ChatbotResponse[]>([]);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotSaving, setChatbotSaving] = useState<string | null>(null);
  const [chatbotSearch, setChatbotSearch] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newReplyQuestion, setNewReplyQuestion] = useState("");
  const [newReplyResponse, setNewReplyResponse] = useState("");
  const [creatingReply, setCreatingReply] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"));
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleRoleChange = (id: string, role: string) => {
    setRolesToAssign((prev) => ({ ...prev, [id]: role }));
  };
  const handleDateChange = (id: string, date: string) => {
    setAccessDates((prev) => ({ ...prev, [id]: date }));
  };

  const updateEditingClass = (changes: Partial<ClassCatalogItem>) => {
    setEditingClass((current) => current ? { ...current, ...changes } : current);
  };

  const saveManagedClass = async (item: ClassCatalogItem) => {
    setSavingClassId(item.id);
    try {
      const { id, enrolledStudentIds: _enrolledStudentIds, ...classData } = item;
      const existingClass = managedClasses.find((existing) => existing.id === id);
      if (existingClass && existingClass.availableForEnrollment !== item.availableForEnrollment) {
        classData.enrollmentUpdatedAt = new Date();
      }
      await setDoc(doc(db, "classes", id), classData, { merge: true });
      setManagedClasses((current) => current.map((existing) => existing.id === id
        ? { ...item, enrolledStudentIds: existing.enrolledStudentIds }
        : existing));
      setEditingClass(null);
      alert(`${item.name} saved.`);
    } catch (error) {
      console.error(error);
      alert("Could not save this class.");
    } finally {
      setSavingClassId(null);
    }
  };

  const deleteManagedClass = async (item: ClassCatalogItem) => {
    if (!window.confirm(`Move "${item.name}" to deleted classes? You can restore it later.`)) return;
    try {
      await updateDoc(doc(db, "classes", item.id), { deleted: true });
      setManagedClasses((current) => current.map((existing) => existing.id === item.id ? { ...existing, deleted: true } : existing));
      if (editingClass?.id === item.id) setEditingClass(null);
    } catch (error) {
      console.error(error);
      alert("Could not delete this class.");
    }
  };

  const restoreManagedClass = async (item: ClassCatalogItem) => {
    try {
      await updateDoc(doc(db, "classes", item.id), { deleted: false });
      setManagedClasses((current) => current.map((existing) => existing.id === item.id ? { ...existing, deleted: false } : existing));
    } catch (error) {
      console.error(error);
      alert("Could not restore this class.");
    }
  };

  const createManagedClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    const newClass: Omit<ClassCatalogItem, "id"> = {
      name: newClassName.trim(),
      teacher: newClassTeacher,
      age: newClassAge,
      description: newClassDescription.trim(),
      availableForEnrollment: newClassAvailable,
      enrolledStudentIds: [],
      createdAt: new Date(),
    };
    try {
      const created = await addDoc(collection(db, "classes"), newClass);
      setManagedClasses((current) => [...current, { id: created.id, ...newClass }]);
      setNewClassName("");
      setNewClassTeacher("Unassigned");
      setNewClassAge("all");
      setNewClassDescription("New class");
      setNewClassAvailable(false);
      setShowCreateClass(false);
    } catch (error) {
      console.error(error);
      alert("Could not create the class.");
    }
  };

  const updateAccountStatus = async (
    uid: string,
    newStatus: UserStatus,
    roleToAssign?: string,
  ) => {
    const isPendingRequest = allUsers.some((user) => user.id === uid && user.status === "pending");
    if (isPendingRequest && newStatus === "approved" && roleToAssign === "teacher" && !accessDates[uid]) {
      setTeacherDateUserId(uid);
      alert("Set an access end date before approving a teacher account.");
      return;
    }
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "approved" && roleToAssign) {
        updateData.role = roleToAssign;
        if (roleToAssign === "teacher" && accessDates[uid]) {
          updateData.accessUntil = accessDates[uid];
        }
      }
      await updateDoc(doc(db, "users", uid), updateData);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, ...updateData } : u)),
      );
      alert(`Account ${newStatus} successfully!`);
    } catch (err) {
      console.error("Could not update account approval:", err);
      const error = err as { code?: string; message?: string };
      alert(`Could not update account${error.code ? ` (${error.code})` : ""}: ${error.message || "Check your Firestore permissions and try again."}`);
    }
  };

  const fetchNews = async () => {
    setNewsLoading(true);
    try {
      const q = query(collection(db, "announcements"));
      const snapshot = await getDocs(q);
      const news = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(news);
    } catch (err) {
      console.error(err);
    }
    setNewsLoading(false);
  };

  const handleSaveAnnouncement = async () => {
    if (!newsTitle.trim() || !newsContent.trim())
      return alert("Please fill all fields");
    try {
      const newsData = {
        title: newsTitle,
        content: newsContent,
        createdAt: new Date(),
      };
      if (editingId) {
        await updateDoc(doc(db, "announcements", editingId), newsData);
        alert("Announcement updated!");
      } else {
        await addDoc(collection(db, "announcements"), newsData);
        alert("Announcement posted!");
      }
      setNewsTitle("");
      setNewsContent("");
      setEditingId(null);
      setIsPreview(false);
      fetchNews();
    } catch (err) {
      alert("Error saving announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?"))
      return;
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements(announcements.filter((a) => a.id !== id));
      alert("Announcement deleted!");
    } catch (err) {
      alert("Error deleting announcement.");
    }
  };

  const handleEditClick = (news: any) => {
    setNewsTitle(news.title);
    setNewsContent(news.content);
    setEditingId(news.id);
    setIsPreview(false);
  };

  const fetchChatbotReplies = async () => {
    setChatbotLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "chatbotResponses"));
      const saved = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ChatbotResponse, "id">),
      }));
      setChatbotReplies([
        ...DEFAULT_CHATBOT_RESPONSES.flatMap((fallback) => {
          const override = saved.find((item) => item.id === fallback.id);
          return override?.deleted ? [] : [override ?? fallback];
        }),
        ...saved.filter((item) => !item.deleted && !DEFAULT_CHATBOT_RESPONSES.some((fallback) => fallback.id === item.id)),
      ]);
    } catch (err) {
      console.error(err);
      alert("Could not load chatbot responses.");
    }
    setChatbotLoading(false);
  };

  const updateChatbotReply = (id: string, field: "keywords" | "response", value: string) => {
    setChatbotReplies((current) => current.map((reply) => reply.id === id ? { ...reply, [field]: value } : reply));
  };

  const saveChatbotReply = async (reply: ChatbotResponse) => {
    if (!reply.response.trim()) return alert("Please enter a response.");
    setChatbotSaving(reply.id);
    try {
      const data = { keywords: reply.keywords.trim(), response: reply.response.trim() };
      if (reply.id.startsWith("new-")) {
        const created = await addDoc(collection(db, "chatbotResponses"), { ...data, deleted: false });
        setChatbotReplies((current) => current.map((item) => item.id === reply.id ? { ...item, id: created.id } : item));
      } else {
        await setDoc(doc(db, "chatbotResponses", reply.id), { ...data, deleted: false }, { merge: true });
      }
      setEditingReplyId(null);
      alert("Chatbot response saved.");
    } catch (err) {
      console.error(err);
      alert("Could not save chatbot response.");
    }
    setChatbotSaving(null);
  };

  const createChatbotReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newReplyQuestion.trim() || !newReplyResponse.trim()) return;
    setCreatingReply(true);
    try {
      const data = {
        keywords: newReplyQuestion.trim(),
        response: newReplyResponse.trim(),
        deleted: false,
      };
      const created = await addDoc(collection(db, "chatbotResponses"), data);
      setChatbotReplies((current) => [...current, { id: created.id, ...data }]);
      setNewReplyQuestion("");
      setNewReplyResponse("");
      setShowAddReply(false);
    } catch (err) {
      console.error(err);
      alert("Could not add chatbot response.");
    }
    setCreatingReply(false);
  };

  const deleteChatbotReply = async (reply: ChatbotResponse) => {
    if (!window.confirm(`Delete the chatbot response for "${reply.keywords || "the default reply"}"?`)) return;
    try {
      if (reply.id.startsWith("new-")) {
        setChatbotReplies((current) => current.filter((item) => item.id !== reply.id));
        setEditingReplyId(null);
        return;
      }
      if (DEFAULT_CHATBOT_RESPONSES.some((item) => item.id === reply.id)) {
        await setDoc(doc(db, "chatbotResponses", reply.id), { deleted: true }, { merge: true });
      } else {
        await deleteDoc(doc(db, "chatbotResponses", reply.id));
      }
      setChatbotReplies((current) => current.filter((item) => item.id !== reply.id));
      if (editingReplyId === reply.id) setEditingReplyId(null);
    } catch (err) {
      console.error(err);
      alert("Could not delete chatbot response.");
    }
  };

  useEffect(() => {
    setLoading(true);
    let initialSnapshot = true;
    let noticeTimer: number | undefined;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setAllUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
      setAccountListenerError("");
      if (!initialSnapshot) {
        const newRequests = snapshot.docChanges()
          .filter((change) => change.type === "added" && change.doc.data().status === "pending")
          .map((change) => change.doc.data().name || change.doc.data().email || "A user");
        if (newRequests.length > 0) {
          setNewRequestNotice(newRequests.length === 1
            ? `New access request from ${newRequests[0]}.`
            : `${newRequests.length} new access requests received.`);
          window.clearTimeout(noticeTimer);
          noticeTimer = window.setTimeout(() => setNewRequestNotice(""), 8000);
        }
      }
      initialSnapshot = false;
      setLoading(false);
    }, (error) => {
      console.error("Could not listen for account requests:", error);
      setAccountListenerError(error.message || "Could not receive live account requests.");
      setLoading(false);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(noticeTimer);
    };
  }, []);

  useEffect(() => {
    if (view === "news") fetchNews();
    if (view === "bot") fetchChatbotReplies();
  }, [view]);

  useEffect(() => {
    if (view !== "classes") return;
    let active = true;
    const loadClasses = async () => {
      setClassesLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "classes"));
        if (snapshot.empty) {
          if (active) setManagedClasses([]);
        } else if (active) {
          setManagedClasses(snapshot.docs.map((classDoc) => ({
            ...DEFAULT_CLASSES.find((item) => item.id === classDoc.id),
            ...classDoc.data(),
            id: classDoc.id,
          }) as ClassCatalogItem));
        }
      } catch (error) {
        console.error("Could not load classes:", error);
        if (active) setManagedClasses([]);
      }
      if (active) setClassesLoading(false);
    };
    void loadClasses();
    return () => { active = false; };
  }, [view]);

  const filteredUsers = allUsers.filter((user) => {
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "pending" && user.status === "pending")
      || (activeFilter === "activated" && user.status === "approved")
      || (activeFilter === "deactivated" && (user.status === "inactive" || user.status === "rejected"))
      || (user.role === activeFilter && user.status !== "pending");
    if (!matchesFilter) return false;

    const terms = accountSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const searchableText = [
      user.name,
      user.email,
      user.role,
      user.status,
      user.status === "approved" ? "activated active" : "",
      user.status === "inactive" || user.status === "rejected" ? "deactivated inactive rejected" : "",
    ].filter(Boolean).join(" ").toLowerCase();
    return terms.every((term) => searchableText.includes(term));
  });
  const filteredChatbotReplies = chatbotReplies.filter((reply) =>
    reply.id === editingReplyId || `${reply.keywords} ${reply.response}`.toLowerCase().includes(chatbotSearch.trim().toLowerCase()),
  );
  const accountTeachers = [...new Set(allUsers
    .filter((user) => user.role === "teacher" && user.status === "approved")
    .map((user) => String(user.name || user.email || "").trim())
    .filter(Boolean))];
  const filteredClasses = managedClasses.filter((item) => {
    const matchesDeletedFilter = classFilter === "deleted" ? item.deleted === true : item.deleted !== true;
    const matchesFilter = matchesDeletedFilter && (classFilter === "all"
      || (classFilter === "open" && item.availableForEnrollment)
      || (classFilter === "closed" && !item.availableForEnrollment)
      || classFilter === "deleted");
    const terms = classSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searchableText = `${item.name} ${item.teacher} ${item.age} ${item.description} ${item.availableForEnrollment ? "open available enrollment" : "closed unavailable not available"}`.toLowerCase();
    return matchesFilter && terms.every((term) => searchableText.includes(term));
  });

  if (view === "bot") {
    return (
      <>
        <Title kicker="Support Tools" title="Chatbot Replies" sub="View and manage the answers Music Helper gives to common questions." />
        <Card className="mt-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label className="grid min-w-56 flex-1 gap-1 text-sm font-semibold">
              Search responses
              <input
                type="search"
                value={chatbotSearch}
                onChange={(e) => setChatbotSearch(e.target.value)}
                placeholder="Search keywords or response text"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={fetchChatbotReplies}>{chatbotLoading ? "Refreshing..." : "Refresh"}</Btn>
              <Btn variant="soft" onClick={() => setShowAddReply(true)}>Add response</Btn>
            </div>
          </div>
          <p className="mb-3 text-sm text-mute">A single exact or partial keyword match can trigger a reply, including replies added later.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-line text-mute">
                  <th className="w-1/4 pb-2 pr-3 font-medium">User question or keyword</th>
                  <th className="pb-2 pr-3 font-medium">Chatbot response</th>
                  <th className="w-36 pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredChatbotReplies.map((reply) => {
                  return (
                    <tr key={reply.id}>
                  <td className="py-2 pr-3 align-top"><span className="break-words">{reply.keywords || <span className="text-mute">Default</span>}</span></td>
                      <td className="py-2 pr-3 align-top">
                    <p className="line-clamp-2 break-words">{reply.response}</p>
                      </td>
                      <td className="py-2 text-right align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setEditingReplyId(reply.id)} className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Edit</button>
                      <button type="button" onClick={() => deleteChatbotReply(reply)} className="rounded-full border border-red-200 px-4 py-1.5 font-semibold text-red-500 hover:bg-red-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!chatbotLoading && filteredChatbotReplies.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-mute">{chatbotReplies.length ? "No replies match your search." : "No chatbot replies available."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {editingReplyId && (() => {
          const reply = chatbotReplies.find((item) => item.id === editingReplyId);
          if (!reply) return null;
          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
              if (event.target === event.currentTarget && chatbotSaving !== reply.id) {
                void fetchChatbotReplies();
                setEditingReplyId(null);
              }
            }}>
              <section role="dialog" aria-modal="true" aria-labelledby="edit-chatbot-reply-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
                <h2 id="edit-chatbot-reply-title" className="font-display text-2xl font-bold">Edit chatbot response</h2>
                <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveChatbotReply(reply); }}>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    User question or keyword
                    <textarea value={reply.keywords} onChange={(event) => updateChatbotReply(reply.id, "keywords", event.target.value)} placeholder="Example: How do I join a class?" className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Chatbot response
                    <textarea required value={reply.response} onChange={(event) => updateChatbotReply(reply.id, "response", event.target.value)} className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { void fetchChatbotReplies(); setEditingReplyId(null); }} disabled={chatbotSaving === reply.id} className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={chatbotSaving === reply.id || !reply.response.trim()} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{chatbotSaving === reply.id ? "Saving..." : "Save changes"}</button>
                  </div>
                </form>
              </section>
            </div>
          );
        })()}
        {showAddReply && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingReply) setShowAddReply(false);
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="add-chatbot-reply-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
              <h2 id="add-chatbot-reply-title" className="font-display text-2xl font-bold">Add chatbot response</h2>
              <p className="mt-1 text-sm text-mute">One exact or partial keyword match is enough to trigger this answer.</p>
              <form className="mt-5 grid gap-4" onSubmit={createChatbotReply}>
                <label className="grid gap-1.5 text-sm font-semibold">
                  User question or keyword
                  <textarea autoFocus required value={newReplyQuestion} onChange={(event) => setNewReplyQuestion(event.target.value)} placeholder="Example: How do I join a class?" className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Chatbot response
                  <textarea required value={newReplyResponse} onChange={(event) => setNewReplyResponse(event.target.value)} placeholder="Write the answer the chatbot should send..." className="min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddReply(false)} disabled={creatingReply} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button type="submit" disabled={creatingReply} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{creatingReply ? "Adding..." : "Add response"}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </>
    );
  }

  if (view === "dash") {
    const pendingCount = allUsers.filter((u) => u.status === "pending").length;
    return (
      <>
        <Title
          kicker="Overview"
          title="System Dashboard"
          sub="Welcome to the admin panel."
        />
        {newRequestNotice && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{newRequestNotice}</div>}
        {accountListenerError && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Live access requests unavailable: {accountListenerError}</div>}
        <div className="mt-5 grid grid-cols-3 gap-5">
          <Card>
            <Label>Pending Approvals</Label>
            <p className="mt-2 font-display text-4xl grad-text">
              {pendingCount}
            </p>
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

  if (view === "accounts") {
    return (
      <>
        <Title
          kicker="User Management"
          title="All Accounts"
          sub="Browse system accounts by role or account status."
        />
        {newRequestNotice && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{newRequestNotice}</div>}
        {accountListenerError && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Live access requests unavailable: {accountListenerError}</div>}
        <Card className="mt-5">
          <input
            type="search"
            value={accountSearch}
            onChange={(event) => setAccountSearch(event.target.value)}
            placeholder="Search name, email, account type, or status..."
            aria-label="Search accounts by name, email, account type, or status"
            className="mb-4 w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-p1"
          />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "All"],
                ["student", "Students"],
                ["teacher", "Teachers"],
                ["admin", "Admins"],
                ["pending", "Pending"],
                ["activated", "Activated"],
                ["deactivated", "Deactivated"],
              ] as [AccountFilter, string][]).map(([filter, label]) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${activeFilter === filter ? "bg-p1 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Btn variant="ghost" onClick={fetchUsers}>
              {loading ? "Refreshing..." : "Refresh List"}
            </Btn>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-mute">
              No {activeFilter} accounts right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-mute">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    {activeFilter !== "pending" && <th className="pb-3 font-medium">Account type</th>}
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Requested</th>
                    {activeFilter === "pending" && <th className="pb-3 font-medium">User type</th>}
                    <th className="pb-3 text-center font-medium">Details</th>
                    <th className="pb-3 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredUsers.map((u) => {
                    const currentRole = rolesToAssign[u.id] || u.role || "student";
                    return (
                      <tr key={u.id}>
                        <td className="py-4 font-semibold">{u.name}</td>
                        <td className="py-4">{u.email}</td>
                        {activeFilter !== "pending" && (
                          <td className="py-4 capitalize">{activeFilter === "all" && u.status === "pending" ? "Pending" : u.role || "—"}</td>
                        )}
                        <td className="py-4 capitalize">{u.status || "—"}</td>
                        <td className="py-4">{u.dateRequested ? new Date(u.dateRequested).toLocaleDateString() : "—"}</td>
                        {activeFilter === "pending" && (
                          <td className="py-4">
                          {u.status === "pending" && (
                            <>
                              <select
                                aria-label={`Role for ${u.name}`}
                                value={currentRole}
                                onChange={(e) => {
                                  const role = e.target.value;
                                  handleRoleChange(u.id, role);
                                  if (role === "teacher") setTeacherDateUserId(u.id);
                                }}
                                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold"
                              >
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                              </select>
                            </>
                          )}
                          </td>
                        )}
                        <td className="py-4 text-center">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-200"
                          >
                            View
                          </button>
                        </td>
                        <td className="py-4">
                          <div className="flex justify-center gap-2">
                          {u.status === "pending" ? (
                            <>
                              <button
                                onClick={() =>
                                  updateAccountStatus(
                                    u.id,
                                    "approved",
                                    currentRole,
                                  )
                                }
                                className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  updateAccountStatus(u.id, "rejected")
                                }
                                className="rounded-full border border-red-200 text-red-500 px-4 py-1.5 font-semibold hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => updateAccountStatus(
                                u.id,
                                u.status === "approved" ? "inactive" : "approved",
                                u.role || "student",
                              )}
                              className="rounded-full border border-orange-200 text-orange-500 px-4 py-1.5 font-semibold hover:bg-orange-50"
                            >
                              {u.status === "approved" ? "Deactivate" : "Activate"}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">User Details</h3>
              <div className="grid gap-2 break-words">
              <p>
                <strong>Name:</strong> {selectedUser.name}
              </p>
              <p>
                <strong>Email:</strong> {selectedUser.email}
              </p>
              <p>
                <strong>Birthday:</strong> {selectedUser.birthday
                  ? (() => {
                      const [year, month, day] = selectedUser.birthday.split("-");
                      return `${month}/${day}/${year}`;
                    })()
                  : selectedUser.birthYear || "Not provided"}
              </p>
              {Number(selectedUser.birthYear || selectedUser.birthday?.slice(0, 4)) > 0 && (
                <p>
                  <strong>Age:</strong> {new Date().getFullYear() - Number(selectedUser.birthYear || selectedUser.birthday?.slice(0, 4))}
                </p>
              )}
              <p>
                <strong>Phone Number:</strong> {selectedUser.phoneNumber || "Not provided"}
              </p>
              <p>
                <strong>Messenger Link:</strong> {selectedUser.messengerLink || "Not provided"}
              </p>
              {selectedUser.dateRequested && (
                <p>
                  <strong>Request Date:</strong> {new Date(selectedUser.dateRequested).toLocaleString()}
                </p>
              )}
              <p>
                <strong>Role:</strong> {selectedUser.role || "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {selectedUser.status}
              </p>
              {selectedUser.accessUntil && (
                <p>
                  <strong>Access Until:</strong> {selectedUser.accessUntil}
                </p>
              )}
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="mt-5 w-full rounded-full bg-gray-200 py-2 font-semibold"
              >
                Close
              </button>
            </Card>
          </div>
        )}
        {teacherDateUserId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-bold">Set teacher access limit</h3>
              <p className="mt-2 text-sm text-mute">
                Choose the last date this teacher account can access the system.
              </p>
              <label className="mt-4 grid gap-1.5 text-sm font-semibold">
                Access until
                <input
                  type="date"
                  required
                  value={accessDates[teacherDateUserId] || ""}
                  onChange={(event) => handleDateChange(teacherDateUserId, event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleChange(teacherDateUserId, "student");
                    setAccessDates((current) => {
                      const next = { ...current };
                      delete next[teacherDateUserId];
                      return next;
                    });
                    setTeacherDateUserId(null);
                  }}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!accessDates[teacherDateUserId]}
                  onClick={() => setTeacherDateUserId(null)}
                  className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save date
                </button>
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  if (view === "news") {
    return (
      <>
        <Title
          kicker="Announcements"
          title="Manage Announcements"
          sub="Create, edit, or delete announcements."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <Card>
            <Label>
              {editingId ? "Edit Announcement" : "Create New Announcement"}
            </Label>
            <div className="mt-4 flex flex-col gap-4">
              <input
                type="text"
                placeholder="Announcement Title"
                className="w-full rounded-lg border border-line p-3"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
              />
              <textarea
                placeholder="Write your announcement here..."
                className="w-full rounded-lg border border-line p-3 min-h-[150px]"
                value={newsContent}
                onChange={(e) => setNewsContent(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPreview(!isPreview)}
                  className="rounded-full border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {isPreview ? "Edit Mode" : "Preview"}
                </button>
                <button
                  onClick={handleSaveAnnouncement}
                  className="rounded-full bg-p1 px-4 py-2 font-semibold text-white hover:opacity-90"
                >
                  {editingId ? "Update Post" : "Post Announcement"}
                </button>
                {editingId && (
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setNewsTitle("");
                      setNewsContent("");
                      setIsPreview(false);
                    }}
                    className="rounded-full border border-red-300 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            {isPreview && (
              <div className="mt-5 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                  Preview
                </span>
                <h4 className="text-xl font-bold">
                  {newsTitle || "Untitled Announcement"}
                </h4>
                <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                  {newsContent || "No content written yet."}
                </p>
              </div>
            )}
          </Card>
          <Card>
            <div className="flex justify-between items-center mb-4">
              <Label>Posted Announcements</Label>
              <Btn variant="ghost" onClick={fetchNews}>
                {newsLoading ? "Refreshing..." : "Refresh"}
              </Btn>
            </div>
            <div className="flex flex-col gap-4">
              {announcements.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No announcements posted.
                </div>
              ) : (
                announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border border-line rounded-lg flex justify-between items-start"
                  >
                    <div>
                      <h4 className="font-bold">{a.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {a.content}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => setPreviewAnnouncement(a)}
                        className="text-p1 hover:underline text-sm font-semibold"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleEditClick(a)}
                        className="text-blue-500 hover:underline text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="text-red-500 hover:underline text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
        {previewAnnouncement && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewAnnouncement(null);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title" className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-2xl">
              <Label>Announcement preview</Label>
              <h2 id="announcement-preview-title" className="mt-2 font-display text-2xl font-bold">{previewAnnouncement.title}</h2>
              <p className="mt-4 whitespace-pre-wrap text-ink">{previewAnnouncement.content}</p>
              <div className="mt-6 flex justify-end">
                <Btn variant="ghost" onClick={() => setPreviewAnnouncement(null)}>Close</Btn>
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  if (view === "classes") {
    return (
      <>
        <Title
          kicker="Class Management"
          title="Manage Classes & Teachers"
          sub="Assign teachers, set age groups, and choose which classes students can enroll in."
        />
        <Card className="mt-5">
          <input
            type="search"
            value={classSearch}
            onChange={(event) => setClassSearch(event.target.value)}
            placeholder="Search class, teacher, age group, or enrollment..."
            aria-label="Search classes by name, teacher, age group, or enrollment status"
            className="mb-4 w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-p1"
          />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "All Classes"],
                ["open", "Open"],
                ["closed", "Close"],
                ["deleted", "Deleted"],
              ] as [ClassFilter, string][]).map(([filter, label]) => (
                <button
                  key={filter}
                  onClick={() => setClassFilter(filter)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${classFilter === filter ? "bg-p1 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Btn variant="soft" onClick={() => setShowCreateClass((show) => !show)}>
              {showCreateClass ? "Cancel" : "+ Create New Class"}
            </Btn>
          </div>
          {classesLoading ? (
            <p className="py-8 text-center text-mute">Loading classes…</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-mute">
                  <th className="pb-3 font-medium">Class Name</th>
                  <th className="pb-3 font-medium">Assigned Teacher</th>
                  <th className="pb-3 font-medium">Age Group Allowed</th>
                  <th className="pb-3 font-medium">Enrollment</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredClasses.map((c) => (
                  <tr key={c.id}>
                    <td className="py-4 pr-3 font-semibold">{c.name}</td>
                    <td className="py-4">{c.teacher || "Unassigned"}</td>
                    <td className="py-4 capitalize">{c.age === "all" ? "All ages" : c.age}</td>
                    <td className="py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.availableForEnrollment ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                        {c.availableForEnrollment ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        {c.deleted ? (
                          <button type="button" onClick={() => void restoreManagedClass(c)} className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Restore</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setEditingClass({ ...c })} className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Edit</button>
                            <button type="button" onClick={() => void deleteManagedClass(c)} className="rounded-full border border-red-200 px-4 py-1.5 font-semibold text-red-500 hover:bg-red-50">Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-mute">
                      {managedClasses.length === 0 ? "No classes have been created yet." : "No classes match this search or filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </Card>
        {showCreateClass && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowCreateClass(false);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="create-class-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
              <h2 id="create-class-title" className="font-display text-2xl font-bold">Create new class</h2>
              <form className="mt-5 grid gap-4" onSubmit={createManagedClass}>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Class name
                  <input required value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="Class name" className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Assigned teacher
                  <select value={newClassTeacher} onChange={(event) => setNewClassTeacher(event.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option value="Unassigned">Unassigned</option>
                    {accountTeachers.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Age group
                  <select value={newClassAge} onChange={(event) => setNewClassAge(event.target.value as ClassCatalogItem["age"])} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option value="all">All ages</option><option value="kids">Kids (5–12)</option><option value="youth">Youth (13–25)</option><option value="adults">Adults (26+)</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Description
                  <textarea value={newClassDescription} onChange={(event) => setNewClassDescription(event.target.value)} className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Enrollment
                  <select value={newClassAvailable ? "open" : "closed"} onChange={(event) => setNewClassAvailable(event.target.value === "open")} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCreateClass(false)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button type="submit" className="grad rounded-full px-4 py-2 text-sm font-semibold text-white">Create class</button>
                </div>
              </form>
            </section>
          </div>
        )}
        {editingClass && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && savingClassId !== editingClass.id) setEditingClass(null);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="edit-class-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
              <h2 id="edit-class-title" className="font-display text-2xl font-bold">Edit class</h2>
              <form
                className="mt-5 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveManagedClass(editingClass);
                }}
              >
                <label className="grid gap-1.5 text-sm font-semibold">
                  Class name
                  <input required value={editingClass.name} onChange={(event) => updateEditingClass({ name: event.target.value })} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Assigned teacher
                  <select value={editingClass.teacher} onChange={(event) => updateEditingClass({ teacher: event.target.value })} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option>Unassigned</option>
                    {editingClass.teacher && editingClass.teacher !== "Unassigned" && !accountTeachers.includes(editingClass.teacher) && (
                      <option value={editingClass.teacher} disabled>{editingClass.teacher} (not an active teacher account)</option>
                    )}
                    {accountTeachers.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Age group
                  <select value={editingClass.age} onChange={(event) => updateEditingClass({ age: event.target.value as ClassCatalogItem["age"] })} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option value="all">All ages</option>
                    <option value="kids">Kids (5–12)</option>
                    <option value="youth">Youth (13–25)</option>
                    <option value="adults">Adults (26+)</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Description
                  <textarea value={editingClass.description} onChange={(event) => updateEditingClass({ description: event.target.value })} className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Enrollment
                  <select value={editingClass.availableForEnrollment ? "open" : "closed"} onChange={(event) => updateEditingClass({ availableForEnrollment: event.target.value === "open" })} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingClass(null)} disabled={savingClassId === editingClass.id} className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingClassId === editingClass.id || !editingClass.name.trim()} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {savingClassId === editingClass.id ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </>
    );
  }

  return null;
}
