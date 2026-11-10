import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPatch } from "../api";
import { Btn, Card, Input, Title } from "../ui";
import type { AccountFilter, UserStatus } from "./adminTypes";
import { AdminProfileEditRequests } from "./AdminProfileEditRequests";

function getMessengerUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

interface AdminAccountsProps {
  newRequestNotice: string;
  accountListenerError: string;
  pendingProfileEditRequestCount: number;
}

interface PaginatedUsersResponse {
  data: any[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

const PAGE_SIZE = 10;

export function AdminAccounts({
  newRequestNotice,
  accountListenerError,
  pendingProfileEditRequestCount,
}: AdminAccountsProps) {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rolesToAssign, setRolesToAssign] = useState<Record<string, string>>({});
  const [accessDates, setAccessDates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("pending");
  const [showEditRequests, setShowEditRequests] = useState(
    () => searchParams.get("section") === "edit-requests",
  );
  const [accountSearch, setAccountSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMessengerLink, setEditMessengerLink] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [teacherDateUserId, setTeacherDateUserId] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchUsers = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(currentPage),
      filter: activeFilter,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    try {
      const response = await apiGet<PaginatedUsersResponse>(
        `/admin/users?${params.toString()}`,
      );
      if (request !== requestId.current) return;
      setUsers(response.data);
      setCurrentPage(response.currentPage);
      setLastPage(Math.max(1, response.lastPage));
      setTotal(response.total);
      setListError("");
    } catch (error) {
      console.error("Could not load accounts:", error);
      if (request === requestId.current) {
        setListError(
          error instanceof Error ? error.message : "Could not load accounts.",
        );
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [activeFilter, currentPage, debouncedSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(accountSearch.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [accountSearch]);

  useEffect(() => {
    void fetchUsers();
    const interval = window.setInterval(() => void fetchUsers(), 15_000);
    return () => window.clearInterval(interval);
  }, [fetchUsers]);

  useEffect(() => {
    if (!loading && currentPage > lastPage) {
      setCurrentPage(lastPage);
    }
  }, [currentPage, lastPage, loading]);

  const handleRoleChange = (id: string, role: string) => {
    setRolesToAssign((prev) => ({ ...prev, [id]: role }));
  };

  const handleDateChange = (id: string, date: string) => {
    setAccessDates((prev) => ({ ...prev, [id]: date }));
  };

  const openEditModal = (user: any) => {
    setSelectedUser(null);
    setEditingUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditBirthday(user.birthday || "");
    setEditPhone(user.phoneNumber || "");
    setEditMessengerLink(user.messengerLink || "");
  };

  const saveUserDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const { user } = await apiPatch<{ user: any }>(
        `/admin/users/${encodeURIComponent(editingUser.id)}`,
        {
          name: editName.trim(),
          email: editEmail.trim(),
          birthday: editBirthday || null,
          phoneNumber: editPhone.trim() || null,
          messengerLink: editMessengerLink.trim() || null,
        },
      );
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? user : item)),
      );
      setEditingUser(null);
      toast.success("Account details updated.");
    } catch (error) {
      console.error("Could not update account details:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not update account details.",
      );
    } finally {
      setSavingUser(false);
    }
  };

  const updateAccountStatus = async (
    uid: string,
    newStatus: UserStatus,
    roleToAssign?: string
  ) => {
    const isPendingRequest = users.some(
      (user) => user.id === uid && user.status === "pending"
    );
    if (
      isPendingRequest &&
      newStatus === "approved" &&
      roleToAssign === "teacher" &&
      !accessDates[uid]
    ) {
      setTeacherDateUserId(uid);
      toast.warning("Set an access end date before approving a teacher account.");
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
      await apiPatch(`/admin/users/${encodeURIComponent(uid)}`, updateData);
      await fetchUsers();
      toast.success(`Account ${newStatus} successfully!`);
    } catch (err) {
      console.error("Could not update account approval:", err);
      const error = err as { code?: string; message?: string };
      toast.error(
        `Could not update account${error.code ? ` (${error.code})` : ""}: ${
          error.message || "Check your API connection and try again."
        }`
      );
    }
  };

  const selectedMessengerUrl = getMessengerUrl(selectedUser?.messengerLink);
  const firstResult = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <>
      <Title
        kicker="User Management"
        title="All Accounts"
        sub="Browse system accounts by role or account status."
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
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!showEditRequests}
            onClick={() => setShowEditRequests(false)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              !showEditRequests ? "bg-p1 text-white" : "bg-gray-100 text-mute"
            }`}
          >
            Accounts
          </button>
          <button
            type="button"
            aria-pressed={showEditRequests}
            onClick={() => setShowEditRequests(true)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              showEditRequests ? "bg-p1 text-white" : "bg-gray-100 text-mute"
            }`}
          >
            Edit requests ({pendingProfileEditRequestCount})
          </button>
        </div>
        {showEditRequests ? (
          <AdminProfileEditRequests pendingCount={pendingProfileEditRequestCount} />
        ) : (
          <>
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
            {(
              [
                ["all", "All"],
                ["student", "Students"],
                ["teacher", "Teachers"],
                ["admin", "Admins"],
                ["pending", "Pending"],
                ["activated", "Activated"],
                ["deactivated", "Deactivated"],
              ] as [AccountFilter, string][]
            ).map(([filter, label]) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setCurrentPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  activeFilter === filter
                    ? "bg-p1 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => void fetchUsers()}>
            {loading ? "Refreshing..." : "Refresh List"}
          </Btn>
        </div>
        {listError && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load accounts: {listError}
          </p>
        )}
        {loading && users.length === 0 && !listError ? (
          <div className="py-10 text-center text-mute">Loading accounts…</div>
        ) : total === 0 ? (
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
                  <th className="pb-3 font-medium">Messenger</th>
                  {activeFilter !== "pending" && (
                    <th className="pb-3 font-medium">Account type</th>
                  )}
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Requested</th>
                  {activeFilter === "pending" && (
                    <th className="pb-3 font-medium">User type</th>
                  )}
                  <th className="pb-3 text-center font-medium">Details</th>
                  <th className="pb-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const currentRole = rolesToAssign[u.id] || u.role || "student";
                  const messengerUrl = getMessengerUrl(u.messengerLink);
                  return (
                    <tr key={u.id}>
                      <td className="py-4 font-semibold">{u.name}</td>
                      <td className="py-4">{u.email}</td>
                      <td className="max-w-48 truncate py-4">
                        {messengerUrl ? (
                          <a
                            href={messengerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-p1 underline"
                            title={u.messengerLink}
                          >
                            {u.messengerLink}
                          </a>
                        ) : (
                          u.messengerLink || "—"
                        )}
                      </td>
                      {activeFilter !== "pending" && (
                        <td className="py-4 capitalize">
                          {activeFilter === "all" && u.status === "pending"
                            ? "Pending"
                            : u.role || "—"}
                        </td>
                      )}
                      <td className="py-4 capitalize">{u.status || "—"}</td>
                      <td className="py-4">
                        {u.dateRequested
                          ? new Date(u.dateRequested).toLocaleDateString()
                          : "—"}
                      </td>
                      {activeFilter === "pending" && (
                        <td className="py-4">
                          {u.status === "pending" && (
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
                                  updateAccountStatus(u.id, "approved", currentRole)
                                }
                                className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateAccountStatus(u.id, "rejected")}
                                className="rounded-full border border-red-200 text-red-500 px-4 py-1.5 font-semibold hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                updateAccountStatus(
                                  u.id,
                                  u.status === "approved" ? "inactive" : "approved",
                                  u.role || "student"
                                )
                              }
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
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1 || loading}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))}
              disabled={currentPage >= lastPage || loading}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <p className="text-sm text-mute" aria-live="polite">
            Showing {firstResult}–{lastResult} out of {total} accounts · Page{" "}
            {currentPage} out of {lastPage}
          </p>
        </div>
          </>
        )}
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">User Details</h3>
            <div className="grid gap-2 break-words">
              <p><strong>Name:</strong> {selectedUser.name}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p>
                <strong>Birthday:</strong>{" "}
                {selectedUser.birthday
                  ? (() => {
                      const [year, month, day] = selectedUser.birthday.split("-");
                      return `${month}/${day}/${year}`;
                    })()
                  : selectedUser.birthYear || "Not provided"}
              </p>
              {Number(selectedUser.birthYear || selectedUser.birthday?.slice(0, 4)) > 0 && (
                <p>
                  <strong>Age:</strong>{" "}
                  {new Date().getFullYear() -
                    Number(selectedUser.birthYear || selectedUser.birthday?.slice(0, 4))}
                </p>
              )}
              <p><strong>Phone Number:</strong> {selectedUser.phoneNumber || "Not provided"}</p>
              <p>
                <strong>Messenger Link:</strong>{" "}
                {selectedMessengerUrl ? (
                  <a
                    href={selectedMessengerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-p1 underline"
                  >
                    {selectedUser.messengerLink}
                  </a>
                ) : (
                  selectedUser.messengerLink || "Not provided"
                )}
              </p>
              {selectedUser.dateRequested && (
                <p>
                  <strong>Request Date:</strong>{" "}
                  {new Date(selectedUser.dateRequested).toLocaleString()}
                </p>
              )}
              <p><strong>Role:</strong> {selectedUser.role || "N/A"}</p>
              <p><strong>Status:</strong> {selectedUser.status}</p>
              {selectedUser.accessUntil && (
                <p><strong>Access Until:</strong> {selectedUser.accessUntil}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedUser)}
                className="rounded-full bg-p1-soft px-4 py-2 font-semibold text-p1"
              >
                Edit details
              </button>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-full bg-gray-200 px-4 py-2 font-semibold"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {editingUser && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingUser) {
              setEditingUser(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <h3 id="edit-account-title" className="font-display text-2xl font-bold">
              Edit account details
            </h3>
            <p className="mt-1 text-sm text-mute">
              Update profile and contact information for {editingUser.name || editingUser.email}.
            </p>
            <form className="mt-5 grid gap-4" onSubmit={(event) => void saveUserDetails(event)}>
              <label className="grid gap-1.5 text-sm font-semibold">
                Full Name
                <Input
                  required
                  maxLength={255}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Email Address
                <Input
                  required
                  type="email"
                  maxLength={255}
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Birthday
                <Input
                  type="date"
                  min="1920-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={editBirthday}
                  onChange={(event) => setEditBirthday(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Contact Number
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  placeholder="09171234567"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Facebook Messenger Link
                <Input
                  type="url"
                  value={editMessengerLink}
                  onChange={(event) => setEditMessengerLink(event.target.value)}
                  placeholder="https://m.me/yourname"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingUser}
                  onClick={() => setEditingUser(null)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingUser ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
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
                onChange={(event) =>
                  handleDateChange(teacherDateUserId, event.target.value)
                }
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