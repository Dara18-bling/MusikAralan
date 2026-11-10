import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPatch, refreshApi, watchApi } from "../api";
import { Btn, Card, Title } from "../ui";
import type { AccountFilter, UserStatus } from "./adminTypes";
import { formatPhilippineDate, formatPhilippineDateTime, getPhilippineDateInputValue, getPhilippineDateParts } from "../utils/dateTime";


interface AdminAccountsProps {
  allUsers: any[];
  setAllUsers: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  newRequestNotice: string;
  accountListenerError: string;
}

interface ProfileChangeRequest {
  id: string;
  submittedAt: string;
  current: {
    id: string;
    name: string;
    email: string;
    role: string;
    birthday: string | null;
    phoneNumber: string | null;
    messengerLink: string | null;
  };
  proposed: {
    name: string;
    email: string;
    birthday: string;
    phoneNumber: string;
    messengerLink: string | null;
  };
}

export function AdminAccounts({
  allUsers,
  setAllUsers,
  loading,
  setLoading,
  newRequestNotice,
  accountListenerError,
}: AdminAccountsProps) {
  const [rolesToAssign, setRolesToAssign] = useState<Record<string, string>>({});
  const [accessDates, setAccessDates] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("pending");
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [teacherDateUserId, setTeacherDateUserId] = useState<string | null>(null);
  const [profileChangeRequests, setProfileChangeRequests] = useState<ProfileChangeRequest[]>([]);

  useEffect(() => watchApi<{ data: ProfileChangeRequest[] }>(
    "/admin/profile-change-requests",
    ({ data }) => setProfileChangeRequests(data),
    (error) => console.error("Could not load profile change requests:", error),
    30_000,
  ), []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await apiGet<{ data: any[] }>("/admin/users");
      setAllUsers(data);
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

  const reviewProfileChangeRequest = async (id: string, status: "approved" | "rejected") => {
    try {
      await apiPatch(`/admin/profile-change-requests/${encodeURIComponent(id)}`, { status });
      setProfileChangeRequests((current) => current.filter((item) => item.id !== id));
      refreshApi("/admin/users");
      toast.success(`Profile change request ${status}.`);
    } catch (error) {
      console.error("Could not review profile change request:", error);
      toast.error(error instanceof Error ? error.message : "Could not review this request.");
    }
  };

  const updateAccountStatus = async (
    uid: string,
    newStatus: UserStatus,
    roleToAssign?: string
  ) => {
    const isPendingRequest = allUsers.some(
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
      setAllUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, ...updateData } : u))
      );
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

  const filteredUsers = allUsers.filter((user) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "pending" && user.status === "pending") ||
      (activeFilter === "activated" && user.status === "approved") ||
      (activeFilter === "deactivated" &&
        (user.status === "inactive" || user.status === "rejected")) ||
      (user.role === activeFilter && user.status !== "pending");
    if (!matchesFilter) return false;

    const terms = accountSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const searchableText = [
      user.name,
      user.email,
      user.role,
      user.status,
      user.status === "approved" ? "activated active" : "",
      user.status === "inactive" || user.status === "rejected"
        ? "deactivated inactive rejected"
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => searchableText.includes(term));
  });

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
      {profileChangeRequests.length > 0 && (
        <Card className="mt-5">
          <Title
            kicker="Review needed"
            title={`Profile change requests (${profileChangeRequests.length})`}
            sub="Review proposed student and teacher information before applying it to their accounts."
          />
          <div className="grid gap-4">
            {profileChangeRequests.map((request) => (
              <section key={request.id} className="rounded-xl border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{request.current.name} <span className="font-normal text-mute">({request.current.role})</span></h3>
                    <p className="mt-1 text-xs text-mute">Submitted {formatPhilippineDateTime(request.submittedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void reviewProfileChangeRequest(request.id, "approved")} className="rounded-full bg-p1-soft px-4 py-2 text-sm font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white">Approve</button>
                    <button type="button" onClick={() => void reviewProfileChangeRequest(request.id, "rejected")} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Reject</button>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {([
                    ["Name", request.current.name, request.proposed.name],
                    ["Email", request.current.email, request.proposed.email],
                    ["Birthday", request.current.birthday || "Not provided", request.proposed.birthday],
                    ["Phone", request.current.phoneNumber || "Not provided", request.proposed.phoneNumber],
                    ["Messenger link", request.current.messengerLink || "Not provided", request.proposed.messengerLink || "Not provided"],
                  ] as [string, string, string][]).map(([label, oldValue, newValue]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-p1-soft/30 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</dt>
                      <dd className="mt-2 break-words text-sm"><span className="text-mute">Current:</span> {oldValue}</dd>
                      <dd className="mt-1 break-words text-sm font-semibold"><span className="text-mute">Requested:</span> {newValue}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Card>
      )}
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
                onClick={() => setActiveFilter(filter)}
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
                {filteredUsers.map((u) => {
                  const currentRole = rolesToAssign[u.id] || u.role || "student";
                  return (
                    <tr key={u.id}>
                      <td className="py-4 font-semibold">{u.name}</td>
                      <td className="py-4">{u.email}</td>
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
                          ? formatPhilippineDate(u.dateRequested)
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
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 z-50 grid min-h-full place-items-center overflow-y-auto bg-black/50 p-3 sm:p-5">
          <Card className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain">
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
                  {getPhilippineDateParts().year -
                    Number(selectedUser.birthYear || selectedUser.birthday?.slice(0, 4))}
                </p>
              )}
              <p><strong>Phone Number:</strong> {selectedUser.phoneNumber || "Not provided"}</p>
              <p><strong>Messenger Link:</strong> {selectedUser.messengerLink || "Not provided"}</p>
              {selectedUser.dateRequested && (
                <p>
                  <strong>Request Date:</strong>{" "}
                  {formatPhilippineDateTime(selectedUser.dateRequested)}
                </p>
              )}
              <p><strong>Role:</strong> {selectedUser.role || "N/A"}</p>
              <p><strong>Status:</strong> {selectedUser.status}</p>
              {selectedUser.accessUntil && (
                <p><strong>Access Until:</strong> {formatPhilippineDate(selectedUser.accessUntil)}</p>
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
        <div className="fixed inset-0 z-[60] grid min-h-full place-items-center overflow-y-auto bg-black/50 p-3 sm:p-5">
          <Card className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain p-4 sm:p-6">
            <h3 className="font-display text-xl font-bold sm:text-2xl">Set teacher access limit</h3>
            <p className="mt-2 text-sm text-mute">
              Choose the last date this teacher account can access the system.
            </p>
            <label className="mt-5 grid min-w-0 gap-2 text-sm font-semibold">
              Access until
              <input
                aria-label="Guest teacher access end date"
                type="date"
                required
                min={getPhilippineDateInputValue()}
                value={accessDates[teacherDateUserId] || ""}
                onChange={(event) =>
                  handleDateChange(teacherDateUserId, event.target.value)
                }
                className="teacher-access-date block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink outline-none transition focus:border-[var(--p1)] focus:ring-2 focus:ring-p1-soft sm:text-sm"
              />
            </label>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
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
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold sm:py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!accessDates[teacherDateUserId]}
                onClick={() => setTeacherDateUserId(null)}
                className="grad rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:py-2"
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
