import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPost, apiPut, refreshApi } from "../api";
import { Btn, Card, Title } from "../ui";
import type { ClassCatalogItem } from "../classCatalog";
import type { ClassFilter } from "./adminTypes";
import { StudentClassWorkspace, type WorkspaceTab } from "../student/StudentClassWorkspace";

interface AdminClassesProps {
  accountTeachers: string[];
}

function TeacherAssignmentNotice({ teacher, currentClassCount }: { teacher: string; currentClassCount: number }) {
  if (!teacher || teacher === "Unassigned" || currentClassCount === 0) return null;
  const message = currentClassCount === 2
    ? `${teacher} currently has 2 active classes. The limit per teacher is 3, Assigning this class will make it their 3rd and final class.`
    : currentClassCount >= 3
      ? `${teacher} already has ${currentClassCount} active classes and cannot be assigned another. The limit is 3.`
      : `${teacher} currently has ${currentClassCount} active class. The limit is 3 classes per teacher.`;

  return (
    <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {message}
    </p>
  );
}

export function AdminClasses({ accountTeachers }: AdminClassesProps) {
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
  const [previewClass, setPreviewClass] = useState<ClassCatalogItem | null>(null);
  const [previewTab, setPreviewTab] = useState<WorkspaceTab>("dashboard");
  const [previewMaterialId, setPreviewMaterialId] = useState("");

  useEffect(() => {
    let active = true;
    const loadClasses = async () => {
      setClassesLoading(true);
      try {
        const { data } = await apiGet<{ data: ClassCatalogItem[] }>("/classes");
        if (data.length === 0) {
          if (active) setManagedClasses([]);
        } else if (active) {
          setManagedClasses(data);
        }
      } catch (error) {
        console.error("Could not load classes:", error);
        if (active) setManagedClasses([]);
      }
      if (active) setClassesLoading(false);
    };
    void loadClasses();
    return () => {
      active = false;
    };
  }, []);

  const updateEditingClass = (changes: Partial<ClassCatalogItem>) => {
    setEditingClass((current) => (current ? { ...current, ...changes } : current));
  };

  const assignedActiveClassCount = (teacher: string, excludeClassId = "") =>
    managedClasses.filter((item) =>
      !item.deleted &&
      item.id !== excludeClassId &&
      item.teacher.trim().toLowerCase() === teacher.trim().toLowerCase(),
    ).length;

  const saveManagedClass = async (item: ClassCatalogItem) => {
    setSavingClassId(item.id);
    try {
      const { id, enrolledStudentIds: _enrolledStudentIds, ...classData } = item;
      const existingClass = managedClasses.find((existing) => existing.id === id);
      if (
        existingClass &&
        existingClass.availableForEnrollment !== item.availableForEnrollment
      ) {
        classData.enrollmentUpdatedAt = new Date();
      }
      const { class: saved } = await apiPut<{ class: ClassCatalogItem }>(`/classes/${id}`, classData);
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === id ? saved : existing
        )
      );
      refreshApi("/classes");
      refreshApi("/dashboard");
      setEditingClass(null);
      toast.success(`${item.name} saved.`);
    } catch (error) {
      console.error(error);
      toast.error("Could not save this class.");
    } finally {
      setSavingClassId(null);
    }
  };

  const deleteManagedClass = async (item: ClassCatalogItem) => {
    if (
      !window.confirm(
        `Move "${item.name}" to deleted classes? You can restore it later.`
      )
    )
      return;
    try {
      await apiPut(`/classes/${item.id}`, { deleted: true });
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, deleted: true } : existing
        )
      );
      refreshApi("/classes");
      refreshApi("/dashboard");
      if (editingClass?.id === item.id) setEditingClass(null);
    } catch (error) {
      console.error(error);
      toast.error("Could not delete this class.");
    }
  };

  const restoreManagedClass = async (item: ClassCatalogItem) => {
    try {
      await apiPut(`/classes/${item.id}`, { deleted: false });
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, deleted: false } : existing
        )
      );
      refreshApi("/classes");
      refreshApi("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Could not restore this class.");
    }
  };

  const createManagedClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    if (newClassTeacher !== "Unassigned" && assignedActiveClassCount(newClassTeacher) >= 3) {
      toast.warning(`${newClassTeacher} already has 3 active classes and cannot be assigned another.`);
      return;
    }
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
      const { class: created } = await apiPost<{ class: ClassCatalogItem }>("/classes", newClass);
      setManagedClasses((current) => [
        ...current,
        created,
      ]);
      refreshApi("/classes");
      refreshApi("/dashboard");
      setNewClassName("");
      setNewClassTeacher("Unassigned");
      setNewClassAge("all");
      setNewClassDescription("New class");
      setNewClassAvailable(false);
      setShowCreateClass(false);
    } catch (error) {
      console.error(error);
      toast.error("Could not create the class.");
    }
  };

  const filteredClasses = managedClasses.filter((item) => {
    const matchesDeletedFilter =
      classFilter === "deleted" ? item.deleted === true : item.deleted !== true;
    const matchesFilter =
      matchesDeletedFilter &&
      (classFilter === "all" ||
        (classFilter === "open" && item.availableForEnrollment) ||
        (classFilter === "closed" && !item.availableForEnrollment) ||
        classFilter === "deleted");
    const terms = classSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searchableText =
      `${item.name} ${item.teacher} ${item.age} ${item.description} ${
        item.availableForEnrollment
          ? "open available enrollment"
          : "closed unavailable not available"
      }`.toLowerCase();
    return matchesFilter && terms.every((term) => searchableText.includes(term));
  });

  const saveEditingClass = async (item: ClassCatalogItem) => {
    const original = managedClasses.find((existing) => existing.id === item.id);
    const teacherChanged = original?.teacher.trim().toLowerCase() !== item.teacher.trim().toLowerCase();
    if (
      teacherChanged &&
      item.teacher !== "Unassigned" &&
      assignedActiveClassCount(item.teacher, item.id) >= 3
    ) {
      toast.warning(`${item.teacher} already has 3 active classes and cannot be assigned another.`);
      return;
    }
    await saveManagedClass(item);
  };

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
            {(
              [
                ["all", "All Classes"],
                ["open", "Open"],
                ["closed", "Close"],
                ["deleted", "Deleted"],
              ] as [ClassFilter, string][]
            ).map(([filter, label]) => (
              <button
                key={filter}
                onClick={() => setClassFilter(filter)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  classFilter === filter
                    ? "bg-p1 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Btn
            variant="soft"
            onClick={() => setShowCreateClass((show) => !show)}
          >
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
                    <td className="py-4 capitalize">
                      {c.age === "all" ? "All ages" : c.age}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          c.availableForEnrollment
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.availableForEnrollment ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        {c.deleted ? (
                          <button
                            type="button"
                            onClick={() => void restoreManagedClass(c)}
                            className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewClass(c);
                                setPreviewTab("dashboard");
                                setPreviewMaterialId("");
                              }}
                              className="rounded-full border border-[var(--p1)] px-4 py-1.5 font-semibold text-p1 hover:bg-p1-soft"
                            >
                              View Class
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClass({ ...c })}
                              className="rounded-full bg-p1-soft px-4 py-1.5 font-semibold text-p1 hover:bg-[var(--p1)] hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteManagedClass(c)}
                              className="rounded-full border border-red-200 px-4 py-1.5 font-semibold text-red-500 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-mute">
                      {managedClasses.length === 0
                        ? "No classes have been created yet."
                        : "No classes match this search or filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {previewClass && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 p-4 sm:p-8">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${previewClass.name} student class preview`}
            className="mx-auto min-h-full max-w-6xl rounded-2xl bg-white p-5 shadow-2xl sm:p-8"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
              <p className="text-sm font-semibold text-mute">Admin preview · read only</p>
              <button
                type="button"
                onClick={() => setPreviewClass(null)}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Close preview
              </button>
            </div>
            <StudentClassWorkspace
              classInfo={previewClass}
              userName="Student preview"
              activeTab={previewTab}
              selectedMaterialId={previewMaterialId}
              onSelectTab={(tab) => { setPreviewTab(tab); setPreviewMaterialId(""); }}
              onOpenMaterial={setPreviewMaterialId}
              onBack={() => setPreviewClass(null)}
              readOnly
            />
          </section>
        </div>
      )}

      {showCreateClass && (
        <div
          className="fixed inset-0 z-50 grid min-h-full place-items-center overflow-y-auto bg-black/50 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreateClass(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-class-title"
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-4 shadow-2xl sm:p-6"
          >
            <h2 id="create-class-title" className="font-display text-2xl font-bold">
              Create new class
            </h2>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createManagedClass}>
              <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">
                Class name
                <input
                  required
                  value={newClassName}
                  onChange={(event) => setNewClassName(event.target.value)}
                  placeholder="Class name"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">
                Assigned teacher
                <select
                  value={newClassTeacher}
                  onChange={(event) => setNewClassTeacher(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="Unassigned">Unassigned</option>
                  {accountTeachers.map((teacher) => (
                    <option key={teacher} value={teacher} disabled={assignedActiveClassCount(teacher) >= 3}>
                      {teacher}{assignedActiveClassCount(teacher) >= 3 ? " (class limit reached)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
              <TeacherAssignmentNotice
                teacher={newClassTeacher}
                currentClassCount={assignedActiveClassCount(newClassTeacher)}
              />
              </div>
              <label className="grid gap-1.5 text-sm font-semibold">
                Age group
                <select
                  value={newClassAge}
                  onChange={(event) =>
                    setNewClassAge(event.target.value as ClassCatalogItem["age"])
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="all">All ages</option>
                  <option value="kids">Kids (5–12)</option>
                  <option value="youth">Youth (13–25)</option>
                  <option value="adults">Adults (26+)</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">
                Description
                <textarea
                  value={newClassDescription}
                  onChange={(event) => setNewClassDescription(event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Enrollment
                <select
                  value={newClassAvailable ? "open" : "closed"}
                  onChange={(event) =>
                    setNewClassAvailable(event.target.value === "open")
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <div className="flex flex-col-reverse justify-end gap-2 sm:col-span-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="w-full rounded-full border border-line px-4 py-2 text-sm font-semibold sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newClassTeacher !== "Unassigned" && assignedActiveClassCount(newClassTeacher) >= 3}
                  className="grad w-full rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {newClassTeacher !== "Unassigned" && assignedActiveClassCount(newClassTeacher) >= 3 ? "Teacher class limit reached" : "Create class"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingClass && (
        <div
          className="fixed inset-0 z-50 grid min-h-full place-items-center overflow-y-auto bg-black/50 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              savingClassId !== editingClass.id
            )
              setEditingClass(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-class-title"
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-4 shadow-2xl sm:p-6"
          >
            <h2 id="edit-class-title" className="font-display text-2xl font-bold">
              Edit class
            </h2>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEditingClass(editingClass);
              }}
            >
              <label className="grid gap-1.5 text-sm font-semibold">
                Class name
                <input
                  required
                  value={editingClass.name}
                  onChange={(event) =>
                    updateEditingClass({ name: event.target.value })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Assigned teacher
                <select
                  value={editingClass.teacher}
                  onChange={(event) =>
                    updateEditingClass({ teacher: event.target.value })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option>Unassigned</option>
                  {editingClass.teacher &&
                    editingClass.teacher !== "Unassigned" &&
                    !accountTeachers.includes(editingClass.teacher) && (
                      <option value={editingClass.teacher} disabled>
                        {editingClass.teacher} (not an active teacher account)
                      </option>
                    )}
                  {accountTeachers.map((teacher) => (
                    <option
                      key={teacher}
                      value={teacher}
                      disabled={
                        teacher !== editingClass.teacher &&
                        assignedActiveClassCount(teacher, editingClass.id) >= 3
                      }
                    >
                      {teacher}{teacher !== editingClass.teacher && assignedActiveClassCount(teacher, editingClass.id) >= 3 ? " (class limit reached)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {editingClass.teacher.trim().toLowerCase() !==
                (managedClasses.find((item) => item.id === editingClass.id)?.teacher || "").trim().toLowerCase() && (
                  <TeacherAssignmentNotice
                    teacher={editingClass.teacher}
                    currentClassCount={assignedActiveClassCount(editingClass.teacher, editingClass.id)}
                  />
                )}
              <label className="grid gap-1.5 text-sm font-semibold">
                Age group
                <select
                  value={editingClass.age}
                  onChange={(event) =>
                    updateEditingClass({
                      age: event.target.value as ClassCatalogItem["age"],
                    })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="all">All ages</option>
                  <option value="kids">Kids (5–12)</option>
                  <option value="youth">Youth (13–25)</option>
                  <option value="adults">Adults (26+)</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Description
                <textarea
                  value={editingClass.description}
                  onChange={(event) =>
                    updateEditingClass({ description: event.target.value })
                  }
                  className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Enrollment
                <select
                  value={editingClass.availableForEnrollment ? "open" : "closed"}
                  onChange={(event) =>
                    updateEditingClass({
                      availableForEnrollment: event.target.value === "open",
                    })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  disabled={savingClassId === editingClass.id}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingClassId === editingClass.id ||
                    !editingClass.name.trim() ||
                    (editingClass.teacher !== (managedClasses.find((item) => item.id === editingClass.id)?.teacher || "") &&
                      editingClass.teacher !== "Unassigned" &&
                      assignedActiveClassCount(editingClass.teacher, editingClass.id) >= 3)
                  }
                  className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
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
