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
  Video,
  type LucideIcon,
} from "lucide-react";

export type Role = "student" | "teacher" | "admin";

export const DASHBOARD_VIEW: Record<Role, string> = {
  student: "home",
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
    ["home", Home, "Dashboard"],
    ["materials", BookOpen, "Classes"],
    ["notes", Music, "Exercise Tools"],
    ["alerts", Bell, "Notifications"],
    ["help", LifeBuoy, "Help Guides"],
    ["profile", User, "My Profile"],
  ],
  teacher: [
    ["dash", LayoutDashboard, "Dashboard"],
    ["classes", BookOpen, "Classes"],
    ["meet", Video, "Live Sessions"],
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
