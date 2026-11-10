import {
  Bell,
  BookOpen,
  BookHeart,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Music,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Role = "student" | "teacher" | "admin";

export const DASHBOARD_VIEW: Record<Role, string> = {
  student: "help",
  teacher: "dash",
  admin: "dash",
};

export interface LiturgicalPalette {
  name: string;
  primary: string;
  secondary: string;
}

export const NAV: Record<Role, [string, LucideIcon, string][]> = {
  student: [
    ["help", LifeBuoy, "Help Guides"],
    ["home", Home, "Dashboard"],
    ["materials", BookOpen, "Classes"],
    ["notes", Music, "Exercise Tools"],
    ["alerts", Bell, "Notifications"],
    ["profile", User, "My Profile"],
  ],
  teacher: [
    ["dash", LayoutDashboard, "Dashboard"],
    ["classes", BookOpen, "Classes"],
    ["alerts", Bell, "Notifications"],
    ["profile", User, "My Profile"],
  ],
  admin: [
    ["dash", LayoutDashboard, "Dashboard"],
    ["accounts", Users, "Accounts"],
    ["news", Megaphone, "Announcements"],
    ["gospel", BookHeart, "Gospel Verses"],
    ["classes", BookOpen, "Manage Classes"],
    ["bot", MessageCircle, "Chatbot Replies"],
    ["profile", User, "Admin Profile"],
  ],
};
