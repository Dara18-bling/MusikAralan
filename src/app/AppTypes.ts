import {
  Bell,
  BookOpen,
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

export interface LiturgicalPalette {
  name: string;
  primary: string;
  secondary: string;
}

export const LITURGICAL_PALETTES: LiturgicalPalette[] = [
  { name: "Advent & Lent · Violet", primary: "#6842a6", secondary: "#a855a0" },
  { name: "Easter & Christmas · White and gold", primary: "#c28b22", secondary: "#f2d477" },
  { name: "Ordinary Time · Green", primary: "#287653", secondary: "#79a94b" },
  { name: "Feasts · Red", primary: "#a8323b", secondary: "#e16c48" },
  { name: "Marian · Pink and blue", primary: "#e88faf", secondary: "#7ea9d2" },
];

export const NAV: Record<Role, [string, LucideIcon, string][]> = {
  student: [
    ["profile", User, "My Profile"],
    ["home", Home, "Dashboard"],
    ["materials", BookOpen, "Classes"],
    ["notes", Music, "Exercise Tools"],
    ["alerts", Bell, "Notifications"],
    ["help", LifeBuoy, "Help Guides"],
  ],
  teacher: [
    ["profile", User, "My Profile"],
    ["dash", LayoutDashboard, "Dashboard"],
    ["classes", BookOpen, "Classes"],
    ["meet", Video, "Live Sessions"],
    ["alerts", Bell, "Notifications"],
  ],
  admin: [
    ["profile", User, "Admin Profile"],
    ["dash", LayoutDashboard, "Dashboard"],
    ["accounts", Users, "Accounts"],
    ["news", Megaphone, "Announcements"],
    ["classes", BookOpen, "Manage Classes"],
    ["bot", MessageCircle, "Chatbot Replies"],
  ],
};