import {
  Bell,
  BookOpen,
  ClipboardCheck,
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

export const LITURGICAL_PALETTES: LiturgicalPalette[] = [
  { name: "Advent & Lent · Violet", primary: "#6842a6", secondary: "#a855a0" },
  {
    name: "Easter & Christmas · White and gold",
    primary: "#c28b22",
    secondary: "#f2d477",
  },
  { name: "Ordinary Time · Green", primary: "#287653", secondary: "#79a94b" },
  { name: "Feasts · Red", primary: "#a8323b", secondary: "#e16c48" },
  { name: "Marian · Pink and blue", primary: "#e88faf", secondary: "#7ea9d2" },
];

export const NAV: Record<Role, [string, LucideIcon, string][]> = {
  student: [
    ["home", Home, "Dashboard"],
    ["materials", BookOpen, "Classes"],
    ["notes", Music, "Exercise Tools"],
    ["live", Video, "Live Sessions"],
    ["exams", ClipboardCheck, "Assessments"],
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
