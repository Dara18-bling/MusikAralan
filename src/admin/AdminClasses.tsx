import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Btn, Card, Title } from "../ui";
import { DEFAULT_CLASSES, type ClassCatalogItem } from "../classCatalog";
import type { ClassFilter } from "./adminTypes";

interface AdminClassesProps {
  accountTeachers: string[];
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

  useEffect(() => {
    let active = true;
    const loadClasses = async () => {
      setClassesLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "classes"));
        if (snapshot.empty) {
          if (active) setManagedClasses([]);
        } else if (active) {
          setManagedClasses(
            snapshot.docs.map(
              (classDoc) =>
                ({
                  ...DEFAULT_CLASSES.find((item) => item.id === classDoc.id),
                  ...classDoc.data(),
                  id: classDoc.id,
                } as ClassCatalogItem)
            )
          );
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
      await setDoc(doc(db, "classes", id), classData, { merge: true });
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === id
            ? { ...item, enrolledStudentIds: existing.enrolledStudentIds }
            : existing
        )
      );
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
    if (
      !window.confirm(
        `Move "${item.name}" to deleted classes? You can restore it later.`
      )
    )
      return;
    try {
      await updateDoc(doc(db, "classes", item.id), { deleted: true });
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, deleted: true } : existing
        )
      );
      if (editingClass?.id === item.id) setEditingClass(null);
    } catch (error) {
      console.error(error);
      alert("Could not delete this class.");
    }
  };

  const restoreManagedClass = async (item: ClassCatalogItem) => {
    try {
      await updateDoc(doc(db, "classes", item.id), { deleted: false });
      setManagedClasses((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, deleted: false } : existing
        )
      );
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
      setManagedClasses((current) => [
        ...current,
        { id: created.id, ...newClass },
      ]);
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

      {showCreateClass && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreateClass(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-class-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <h2 id="create-class-title" className="font-display text-2xl font-bold">
              Create new class
            </h2>
            <form className="mt-5 grid gap-4" onSubmit={createManagedClass}>
              <label className="grid gap-1.5 text-sm font-semibold">
                Class name
                <input
                  required
                  value={newClassName}
                  onChange={(event) => setNewClassName(event.target.value)}
                  placeholder="Class name"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Assigned teacher
                <select
                  value={newClassTeacher}
                  onChange={(event) => setNewClassTeacher(event.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  <option value="Unassigned">Unassigned</option>
                  {accountTeachers.map((teacher) => (
                    <option key={teacher} value={teacher}>
                      {teacher}
                    </option>
                  ))}
                </select>
              </label>
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
              <label className="grid gap-1.5 text-sm font-semibold">
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
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="grad rounded-full px-4 py-2 text-sm font-semibold text-white"
                >
                  Create class
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingClass && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
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
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-2xl"
          >
            <h2 id="edit-class-title" className="font-display text-2xl font-bold">
              Edit class
            </h2>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void saveManagedClass(editingClass);
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
                    <option key={teacher} value={teacher}>
                      {teacher}
                    </option>
                  ))}
                </select>
              </label>
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
                    !editingClass.name.trim()
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