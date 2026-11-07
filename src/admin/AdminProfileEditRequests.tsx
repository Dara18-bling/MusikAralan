import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPatch } from "../api";
import { Card } from "../ui";

type ProfileValue = string | null;

interface ProfileEditRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  current: Record<string, ProfileValue>;
  changes: Record<string, ProfileValue>;
  createdAt: string | null;
}

interface RequestsResponse {
  data: ProfileEditRequest[];
  currentPage: number;
  lastPage: number;
  total: number;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Full name",
  email: "Email address",
  birthday: "Birthday",
  phoneNumber: "Contact number",
  messengerLink: "Messenger link",
};

function displayValue(value: ProfileValue): string {
  if (!value) return "Not provided";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year}`;
  }
  return value;
}

export function AdminProfileEditRequests({
  pendingCount,
}: {
  pendingCount: number;
}) {
  const [requests, setRequests] = useState<ProfileEditRequest[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<RequestsResponse>(
        `/admin/profile-edit-requests?page=${page}`,
      );
      setRequests(response.data);
      setPage(response.currentPage);
      setLastPage(Math.max(1, response.lastPage));
      setTotal(response.total);
      setLoadError("");
    } catch (error) {
      console.error("Could not load profile edit requests:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load profile edit requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests, pendingCount]);

  const reviewRequest = async (
    editRequest: ProfileEditRequest,
    decision: "approved" | "rejected",
  ) => {
    const action = decision === "approved" ? "approve" : "reject";
    if (
      !window.confirm(
        `${action === "approve" ? "Apply" : "Reject"} the requested changes for ${editRequest.userName || editRequest.userEmail}?`,
      )
    ) {
      return;
    }
    setProcessingId(editRequest.id);
    try {
      await apiPatch(
        `/admin/profile-edit-requests/${encodeURIComponent(editRequest.id)}`,
        { decision },
      );
      toast.success(
        decision === "approved"
          ? "Profile changes approved and applied."
          : "Profile edit request rejected.",
      );
      await fetchRequests();
    } catch (error) {
      console.error("Could not review profile edit request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not review this profile edit request.",
      );
    } finally {
      setProcessingId("");
    }
  };

  const firstResult = total === 0 ? 0 : (page - 1) * 10 + 1;
  const lastResult = Math.min(page * 10, total);

  return (
    <div className="mt-5 grid gap-4">
      {loadError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load edit requests: {loadError}
        </p>
      )}
      {loading && requests.length === 0 && !loadError ? (
        <Card className="py-8 text-center text-mute">Loading edit requests…</Card>
      ) : requests.length === 0 ? (
        <Card className="py-8 text-center text-mute">
          No profile edit requests are awaiting review.
        </Card>
      ) : (
        requests.map((editRequest) => (
          <Card key={editRequest.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">
                  {editRequest.userName || editRequest.userEmail || "Account"}
                </h2>
                <p className="text-sm text-mute">{editRequest.userEmail}</p>
              </div>
              <p className="text-xs text-mute">
                Submitted{" "}
                {editRequest.createdAt
                  ? new Date(editRequest.createdAt).toLocaleString()
                  : "recently"}
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              {Object.entries(editRequest.changes).map(([field, value]) => (
                <div
                  key={field}
                  className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-[10rem_1fr_1fr]"
                >
                  <span className="font-semibold">
                    {FIELD_LABELS[field] || field}
                  </span>
                  <span className="break-all text-mute">
                    Current: {displayValue(editRequest.current[field] ?? null)}
                  </span>
                  <span className="break-all font-medium text-ink">
                    Requested: {displayValue(value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={processingId === editRequest.id}
                onClick={() => void reviewRequest(editRequest, "rejected")}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={processingId === editRequest.id}
                onClick={() => void reviewRequest(editRequest, "approved")}
                className="rounded-full bg-p1 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {processingId === editRequest.id ? "Saving…" : "Approve changes"}
              </button>
            </div>
          </Card>
        ))
      )}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <p className="text-sm text-mute" aria-live="polite">
          Showing {firstResult}–{lastResult} out of {total} requests · Page {page}{" "}
          out of {lastPage}
        </p>
      </div>
    </div>
  );
}
