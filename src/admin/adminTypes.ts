export type AdminView = "dash" | "accounts" | "news" | "gospel" | "classes" | "bot";
export type UserStatus = "pending" | "approved" | "rejected" | "inactive";
export type AccountFilter =
  | "all"
  | "student"
  | "teacher"
  | "admin"
  | "pending"
  | "activated"
  | "deactivated";
export type ClassFilter = "all" | "open" | "closed" | "deleted";