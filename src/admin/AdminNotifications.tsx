import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, UserRoundPen } from "lucide-react";
import { apiGet, watchApi } from "../api";
import { Btn, Card, Title } from "../ui";

interface PendingAccountRequest {
  id: string;
  name: string;
  email: string;
}

interface PendingEditRequest {
  id: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string | null;
}

interface EditRequestsResponse {
  data: PendingEditRequest[];
  currentPage: number;
  lastPage: number;
  total: number;
}

export function AdminNotifications({
  pendingCount,
  pendingRequests,
  pendingEditCount,
}: {
  pendingCount: number;
  pendingRequests: PendingAccountRequest[];
  pendingEditCount: number;
}) {
  const navigate = useNavigate();
  const [editRequests, setEditRequests] = useState<PendingEditRequest[]>([]);
  const [editRequestError, setEditRequestError] = useState("");
  const [editRequestsLoading, setEditRequestsLoading] = useState(true);

  useEffect(() => {
    if (pendingEditCount === 0) {
      setEditRequests([]);
      setEditRequestsLoading(false);
      setEditRequestError("");
      return;
    }

    const page = Math.max(1, Math.ceil(pendingEditCount / 10));
    setEditRequestsLoading(true);
    return watchApi<EditRequestsResponse>(
      `/admin/profile-edit-requests?page=${page}`,
      (response) => {
        setEditRequests([...response.data].reverse());
        setEditRequestError("");
        setEditRequestsLoading(false);
      },
      (error) => {
        console.error("Could not load edit request notifications:", error);
        setEditRequestError(
          error instanceof Error
            ? error.message
            : "Could not load profile edit requests.",
        );
        setEditRequestsLoading(false);
      },
      15_000,
    );
  }, [pendingEditCount]);

  return (
    <>
      <Title
        kicker="Admin"
        title="Notifications"
        sub="New account and profile edit requests awaiting review."
      />
      <div className="mt-5 grid gap-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserRound className="h-6 w-6 text-p1" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold">Account requests</h2>
                <p className="text-sm text-mute">
                  {pendingCount} pending approval{pendingCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Btn className="w-fit" onClick={() => navigate("/admin/accounts")}>
              Review accounts
            </Btn>
          </div>
          {pendingRequests.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {pendingRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-semibold">{request.name || "New account"}</p>
                    <p className="text-sm text-mute">{request.email}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    Pending approval
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-mute">
              No account approval requests are waiting.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserRoundPen className="h-6 w-6 text-p1" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold">Profile edit requests</h2>
                <p className="text-sm text-mute">
                  {pendingEditCount} pending edit{pendingEditCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Btn
              className="w-fit"
              onClick={() => navigate("/admin/accounts?section=edit-requests")}
            >
              Review edits
            </Btn>
          </div>
          {editRequestError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              Could not load profile edit requests: {editRequestError}
            </p>
          )}
          {editRequestsLoading && editRequests.length === 0 && !editRequestError ? (
            <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-mute">
              Loading profile edit requests…
            </p>
          ) : editRequests.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {editRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {request.userName || request.userEmail || "Account"}
                    </p>
                    <p className="text-sm text-mute">{request.userEmail}</p>
                  </div>
                  <span className="text-xs text-mute">
                    {request.createdAt
                      ? `Submitted ${new Date(request.createdAt).toLocaleString()}`
                      : "Awaiting review"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-mute">
              No profile edit requests are waiting.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
