export type ClassCatalogItem = {
  id: string;
  name: string;
  teacher: string;
  age: "all" | "kids" | "youth" | "adults";
  description: string;
  availableForEnrollment: boolean;
  enrolledStudentIds?: string[];
  deleted?: boolean;
  createdAt?: unknown;
  enrollmentUpdatedAt?: unknown;
};
