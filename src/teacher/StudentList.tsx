import { useEffect, useState } from "react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card, Pill } from "../ui";

interface RosterStudent {
  id: string;
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
  birthYear?: number | string | null;
  status?: string | null;
  classProgress?: {
    completedMaterialIds?: string[];
    deletedCompletedMaterials?: { id: string; title: string }[];
    assessmentScore?: number | null;
    assessmentPassed?: boolean;
  };
}

interface StudentRosterResponse {
  data: RosterStudent[];
  currentPage: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface StudentListProps {
  classId?: string;
  studentIds?: string[];
}

export function StudentList({ classId, studentIds = [] }: StudentListProps) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [materialCount, setMaterialCount] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setPage(1);
      setLastPage(1);
      setTotal(0);
      setFrom(null);
      setTo(null);
      setLoading(false);
      setLoadError("");
      return;
    }

    setLoading(true);
    setLoadError("");
    return watchApi<StudentRosterResponse>(
      `/classes/${classId}/students?page=${page}`,
      ({ data, lastPage: responseLastPage, total, from, to }) => {
        const safeLastPage = Math.max(1, responseLastPage);
        setStudents(data);
        setPage((currentPage) => Math.min(currentPage, safeLastPage));
        setLastPage(safeLastPage);
        setTotal(total);
        setFrom(from);
        setTo(to);
        setLoading(false);
      },
      (error) => {
        console.error("Could not load enrolled students:", error);
        setLoadError("Could not load enrolled students.");
        setLoading(false);
      },
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId, page, studentIds.join("|")]);

  useEffect(() => {
    if (!classId) {
      setMaterialCount(0);
      return;
    }
    return watchApi<{ data: unknown[] }>(
      `/classes/${classId}/materials`,
      ({ data }) => setMaterialCount(data.length),
      (error) => console.error("Could not load class material count:", error),
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId]);

  return (
    <>
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-mute">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Age Group</th>
              <th className="pb-3 font-medium">Materials</th>
              <th className="pb-3 font-medium">Assessment</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((student) => {
              const birthYear = Number(
                student.birthYear || student.birthday?.slice(0, 4),
              );
              const age =
                birthYear > 0 ? new Date().getFullYear() - birthYear : null;
              const ageGroup =
                age === null
                  ? "Not provided"
                  : age <= 12
                    ? "Kids"
                    : age <= 25
                      ? "Youth"
                      : "Adults";
              const progress = student.classProgress || {};
              const completedCount = Array.isArray(
                progress.completedMaterialIds,
              )
                ? progress.completedMaterialIds.length
                : 0;

              return (
                <tr key={student.id}>
                  <td className="py-4 font-semibold">
                    {student.name || student.email || "Student"}
                  </td>
                  <td className="py-4">{ageGroup}</td>
                  <td className="py-4">
                    <p>
                      {completedCount} / {materialCount} completed
                    </p>
                    {Array.isArray(progress.deletedCompletedMaterials) &&
                      progress.deletedCompletedMaterials.map((material) => (
                        <p
                          key={material.id}
                          className="mt-1 text-xs text-mute"
                        >
                          {material.title}: This material has been deleted
                        </p>
                      ))}
                  </td>
                  <td className="py-4">
                    {progress.assessmentScore == null
                      ? "Not attempted"
                      : `${progress.assessmentScore}%${progress.assessmentPassed ? " · Passed" : " · Retry needed"}`}
                  </td>
                  <td className="py-4 text-right">
                    <Pill tone={student.status === "approved" ? "p1" : "p2"}>
                      {student.status === "approved"
                        ? "Active"
                        : student.status || "Unknown"}
                    </Pill>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-mute">
                  {loading
                    ? "Loading students…"
                    : loadError || "No students are enrolled in this class yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex flex-col items-center gap-2">
        {lastPage > 1 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(lastPage, current + 1))
              }
              disabled={page >= lastPage || loading}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
        <p className="text-sm text-mute" aria-live="polite">
          Showing {from ?? 0}–{to ?? 0} of {total} students · Page {page} of{" "}
          {lastPage}
        </p>
      </div>
    </>
  );
}
