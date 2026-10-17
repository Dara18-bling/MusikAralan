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

export default function Admin({ view }: { view: AdminView }) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesToAssign, setRolesToAssign] = useState<Record<string, string>>(
    {},
  );
  const [accessDates, setAccessDates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("pending");
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [teacherDateUserId, setTeacherDateUserId] = useState<string | null>(null);
  const [managedClasses, setManagedClasses] = useState<ClassCatalogItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassTeacher, setNewClassTeacher] = useState("Unassigned");
  const [newClassAge, setNewClassAge] = useState<ClassCatalogItem["age"]>("all");

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const updateManagedClass = (id: string, changes: Partial<ClassCatalogItem>) => {
    setManagedClasses((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const saveManagedClass = async (item: ClassCatalogItem) => {
    setSavingClassId(item.id);
    try {
      const { id, enrolledStudentIds: _enrolledStudentIds, ...classData } = item;
      await setDoc(doc(db, "classes", id), classData, { merge: true });
      alert(`${item.name} saved.`);
    } catch (error) {
      console.error(error);
      alert("Could not save this class.");
    }
    setSavingClassId(null);
  };

  const createManagedClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    const newClass: Omit<ClassCatalogItem, "id"> = {
      name: newClassName.trim(),
      teacher: newClassTeacher,
      age: newClassAge,
      description: "New class",
      availableForEnrollment: false,
      enrolledStudentIds: [],
    };
    try {
      const created = await addDoc(collection(db, "classes"), newClass);
      setManagedClasses((current) => [...current, { id: created.id, ...newClass }]);
      setNewClassName("");
      setNewClassTeacher("Unassigned");
      setNewClassAge("all");
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
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      setAllUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Could not listen for account requests:", error);
      setLoading(false);
    });
    return unsubscribe;
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
          await Promise.all(DEFAULT_CLASSES.map(({ id, ...data }) => setDoc(doc(db, "classes", id), data)));
          if (active) setManagedClasses(DEFAULT_CLASSES);
        } else if (active) {
          setManagedClasses(snapshot.docs.map((classDoc) => ({
            ...DEFAULT_CLASSES.find((item) => item.id === classDoc.id),
            ...classDoc.data(),
            id: classDoc.id,
          }) as ClassCatalogItem));
        }
      } catch (error) {
        console.error("Could not load classes:", error);
        if (active) setManagedClasses(DEFAULT_CLASSES);
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
          <p className="mb-3 text-sm text-mute">Enter a sample user question or keyword. Replies are chosen by the closest keyword match.</p>
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
                  const editing = editingReplyId === reply.id;
                  return (
                    <tr key={reply.id}>
                      <td className="py-2 pr-3 align-top">
                        {editing ? (
                          <input aria-label="User question or keyword" className="w-full rounded-md border border-line bg-white px-2 py-1.5" value={reply.keywords} onChange={(e) => updateChatbotReply(reply.id, "keywords", e.target.value)} placeholder="e.g. How do I join class?" />
                        ) : <span className="break-words">{reply.keywords || <span className="text-mute">Default</span>}</span>}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        {editing ? (
                          <textarea aria-label="Chatbot response" className="min-h-16 w-full rounded-md border border-line bg-white px-2 py-1.5" value={reply.response} onChange={(e) => updateChatbotReply(reply.id, "response", e.target.value)} />
                        ) : <p className="line-clamp-2 break-words">{reply.response}</p>}
                      </td>
                      <td className="py-2 text-right align-top">
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                          {editing ? (
                            <>
                              <button type="button" onClick={() => saveChatbotReply(reply)} disabled={chatbotSaving === reply.id} className="font-semibold text-p1 hover:underline disabled:opacity-50">{chatbotSaving === reply.id ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => {
                                if (reply.id.startsWith("new-")) setChatbotReplies((current) => current.filter((item) => item.id !== reply.id));
                                else fetchChatbotReplies();
                                setEditingReplyId(null);
                              }} className="text-mute hover:underline">Cancel</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setEditingReplyId(reply.id)} className="font-semibold text-p1 hover:underline">Edit</button>
                          )}
                          <button type="button" onClick={() => deleteChatbotReply(reply)} className="font-semibold text-red-500 hover:underline">Delete</button>
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
        {showAddReply && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingReply) setShowAddReply(false);
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="add-chatbot-reply-title" className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl">
              <h2 id="add-chatbot-reply-title" className="font-display text-2xl font-bold">Add chatbot response</h2>
              <p className="mt-1 text-sm text-mute">Enter the user question or keyword that should trigger this answer.</p>
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
                ["all", "All Accounts"],
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label>Class Catalog</Label>
            <Btn variant="soft" onClick={() => setShowCreateClass((show) => !show)}>
              {showCreateClass ? "Cancel" : "+ Create New Class"}
            </Btn>
          </div>
          {showCreateClass && (
            <form onSubmit={createManagedClass} className="mb-5 grid gap-3 rounded-xl border border-line bg-p1-soft/40 p-4 md:grid-cols-4">
              <input required value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="Class name" className="rounded-lg border border-line bg-white px-3 py-2" />
              <select value={newClassTeacher} onChange={(event) => setNewClassTeacher(event.target.value)} className="rounded-lg border border-line bg-white px-3 py-2">
                <option>Unassigned</option><option>Sis. Ethyl</option><option>Bro. Jet</option><option>Mr. Rafael Santos</option>
              </select>
              <select value={newClassAge} onChange={(event) => setNewClassAge(event.target.value as ClassCatalogItem["age"])} className="rounded-lg border border-line bg-white px-3 py-2">
                <option value="all">All Ages</option><option value="kids">Kids (5-12)</option><option value="youth">Youth (13-25)</option><option value="adults">Adults (26+)</option>
              </select>
              <button type="submit" className="grad rounded-full px-4 py-2 font-semibold text-white">Create Class</button>
            </form>
          )}
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
                {managedClasses.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3">
                      <input value={c.name} onChange={(event) => updateManagedClass(c.id, { name: event.target.value })} className="w-full rounded-lg border border-line bg-white px-3 py-2 font-semibold" />
                    </td>
                    <td className="py-4">
                      <select
                        value={c.teacher}
                        onChange={(event) => updateManagedClass(c.id, { teacher: event.target.value })}
                        className="border border-line rounded px-2 py-1 text-sm bg-white"
                      >
                        <option>Sis. Ethyl</option>
                        <option>Bro. Jet</option>
                        <option>Mr. Rafael Santos</option>
                        <option>Unassigned</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <select
                        value={c.age}
                        onChange={(event) => updateManagedClass(c.id, { age: event.target.value as ClassCatalogItem["age"] })}
                        className="border border-line rounded px-2 py-1 text-sm bg-white"
                      >
                        <option value="all">All Ages</option>
                        <option value="kids">Kids (5-12)</option>
                        <option value="youth">Youth (13-25)</option>
                        <option value="adults">Adults (26+)</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <select value={c.availableForEnrollment ? "open" : "closed"} onChange={(event) => updateManagedClass(c.id, { availableForEnrollment: event.target.value === "open" })} className="border border-line rounded px-2 py-1 text-sm bg-white">
                        <option value="open">Open for enrollment</option>
                        <option value="closed">Not available</option>
                      </select>
                    </td>
                    <td className="py-4 text-right">
                      <button type="button" onClick={() => void saveManagedClass(c)} disabled={savingClassId === c.id} className="text-p1 font-semibold hover:underline text-sm disabled:opacity-50">
                        {savingClassId === c.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
                {managedClasses.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-mute">No classes have been created yet.</td></tr>}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </>
    );
  }

  return null;
}
