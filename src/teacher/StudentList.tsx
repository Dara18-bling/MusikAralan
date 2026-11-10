import { useEffect, useState } from "react";
import { POLL_INTERVAL_TWO_MINUTES, watchApi } from "../api";
import { Card, Pill, Title } from "../ui";
import { getPhilippineDateParts } from "../utils/dateTime";

interface StudentListProps {
  className?: string;
  classId?: string;
  studentIds?: string[];
}

export function StudentList({ className, classId, studentIds = [] }: StudentListProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [materialCount, setMaterialCount] = useState(0);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      return;
    }
    return watchApi<{ data: any[] }>(
      `/classes/${classId}/students`,
      ({ data }) => setStudents(data),
      (error) => console.error("Could not load enrolled students:", error),
      POLL_INTERVAL_TWO_MINUTES,
    );
  }, [classId, studentIds.join("|")]);

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
      <Title
        kicker="Class Roster"
        title="My Students"
        sub={className ? `Students enrolled in ${className}.` : "List of students assigned to your class."}
      />
      <Card className="mt-5 min-w-0">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
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
            {students.map((s) => {
              const birthYear = Number(s.birthYear || s.birthday?.slice(0, 4));
              const age = birthYear > 0 ? getPhilippineDateParts().year - birthYear : null;
              const ageGroup = age === null ? "Not provided" : age <= 12 ? "Kids" : age <= 25 ? "Youth" : "Adults";
              const progress = classId ? s.classProgress?.[classId] || {} : {};
              const completedCount = Array.isArray(progress.completedMaterialIds) ? progress.completedMaterialIds.length : 0;
              return (
                <tr key={s.id}>
                  <td className="py-4 font-semibold">{s.name || s.email || "Student"}</td>
                  <td className="py-4">{ageGroup}</td>
                  <td className="py-4">
                    <p>{completedCount} / {materialCount} completed</p>
                    {Array.isArray(progress.deletedCompletedMaterials) &&
                      progress.deletedCompletedMaterials.map((material: { id: string; title: string }) => (
                        <p key={material.id} className="mt-1 text-xs text-mute">
                          {material.title}: This material has been deleted
                        </p>
                      ))}
                  </td>
                  <td className="py-4">
                    {progress.assessmentScore === undefined
                      ? "Not attempted"
                      : `${progress.assessmentScore}%${progress.assessmentPassed ? " · Passed" : " · Retry needed"}`}
                  </td>
                  <td className="py-4 text-right">
                    <Pill tone={s.status === "approved" ? "p1" : "p2"}>
                      {s.status === "approved" ? "Active" : s.status || "Unknown"}
                    </Pill>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-mute">
                  No students are enrolled in this class yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </>
  );
}
