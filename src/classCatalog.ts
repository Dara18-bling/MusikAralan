export type ClassCatalogItem = {
  id: string;
  name: string;
  teacher: string;
  age: "all" | "kids" | "youth" | "adults";
  description: string;
  availableForEnrollment: boolean;
  enrolledStudentIds?: string[];
  deleted?: boolean;
};

export const DEFAULT_CLASSES: ClassCatalogItem[] = [
  {
    id: "basic-keyboard-lessons",
    name: "Basic Keyboard Lessons",
    teacher: "Bro. Jet",
    age: "all",
    description: "8 weeks · 16 lessons",
    availableForEnrollment: true,
    enrolledStudentIds: [],
  },
  {
    id: "solfeggio-kids",
    name: "Solfeggio (Kids)",
    teacher: "Sis. Ethyl",
    age: "kids",
    description: "Build note reading and pitch skills.",
    availableForEnrollment: true,
    enrolledStudentIds: [],
  },
  {
    id: "psalmody-masterclass",
    name: "Psalmody Masterclass",
    teacher: "Mr. Rafael Santos",
    age: "adults",
    description: "6 weeks · live coaching",
    availableForEnrollment: true,
    enrolledStudentIds: [],
  },
  {
    id: "advanced-choir-repertoire",
    name: "Advanced Choir Repertoire",
    teacher: "Unassigned",
    age: "all",
    description: "For tenors and sopranos",
    availableForEnrollment: true,
    enrolledStudentIds: [],
  },
];
