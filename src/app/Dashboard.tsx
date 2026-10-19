import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { signOut } from "firebase/auth";

import logo from "../assets/logo.png";
import Student, { Gospel, type StudentView } from "../Student";
import Teacher, { type TeacherView } from "../Teacher";
import Admin, { type AdminView } from "../Admin";
import { auth } from "../firebase";
import { NAV, type Role } from "./AppTypes";
import { useSystemAppearance } from "./useSystemAppearance";
import { ProfileView } from "./ProfileView";
import { Chatbot } from "./Chatbot";

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const role = localStorage.getItem("role") as Role | null;
  const userName = localStorage.getItem("name") || "User";
  const userBirthYear = Number(localStorage.getItem("birthYear")) || 2010;

  const currentYear = new Date().getFullYear();
  const ageNum = currentYear - userBirthYear;
  const computedAgeMode = ageNum <= 12 ? "kids" : ageNum <= 25 ? "youth" : "adult";

  const [big, setBig] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const { primaryColor } = useSystemAppearance(darkMode);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = big ? "18px" : "";
  }, [big]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  if (!role || !NAV[role]) return <Navigate to="/login" replace />;

  const pathParts = location.pathname.split("/");
  const pathRole = pathParts[1] as Role;
  const view = pathParts[2] || NAV[role][0][0];

  if (pathRole !== role) return <Navigate to={`/${role}/${NAV[role][0][0]}`} replace />;
  if (role === "student" && view === "store") return <Navigate to="/student/materials" replace />;

  const go = (v: string) => {
    navigate(`/${role}/${v}`);
    setMenu(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    localStorage.removeItem("role");
    localStorage.removeItem("uid");
    localStorage.removeItem("name");
    localStorage.removeItem("birthYear");
    navigate("/login");
  };

  return (
    <div className={`canvas min-h-screen lg:grid lg:grid-cols-[17rem_1fr] ${darkMode ? "bg-gray-900 text-white" : ""}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-y-auto border-r border-line ${
          darkMode ? "bg-gray-800" : "bg-white/95"
        } p-5 backdrop-blur transition lg:static lg:top-auto lg:h-auto lg:min-h-screen lg:w-auto lg:self-stretch lg:overflow-visible lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className={`relative z-10 -mx-5 -mt-5 flex shrink-0 items-center gap-3 px-5 pt-5 pb-3 backdrop-blur ${
            darkMode ? "bg-gray-800" : "bg-white/95"
          }`}
        >
          <img
            src={logo}
            alt="MML logo"
            className="h-14 w-auto"
            style={{
              filter: `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 8px rgba(255,255,255,0.85)) drop-shadow(0 0 26px rgba(255,255,255,0.58)) drop-shadow(0 0 ${
                darkMode
                  ? `64px color-mix(in srgb, ${primaryColor} 58%, transparent)`
                  : `52px color-mix(in srgb, ${primaryColor} 38%, transparent)`
              }) drop-shadow(0 20px 40px rgba(0,0,0,0.38))`,
            }}
          />
          <div className="ml-1 min-w-0 translate-y-0.5">
            <p className="font-display text-lg leading-tight">MusikAralan</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">OLSHP · MML</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:flex-none lg:overflow-visible">
          <nav className="mt-8 grid gap-1">
            {NAV[role].map(([k, I, n]) => (
              <button
                key={k}
                onClick={() => go(k)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium transition ${
                  view === k
                    ? "bg-p1-soft text-p1"
                    : "text-mute hover:bg-slate-50 hover:text-ink"
                }`}
              >
                <I className="h-5 w-5" strokeWidth={1.75} /> {n}
              </button>
            ))}
          </nav>
          <div className="mt-6 pb-8">
            <Gospel />
          </div>
        </div>

        <div
          className={`sticky bottom-0 z-20 mt-auto -mx-5 -mb-5 shrink-0 border-t border-line px-5 pt-4 pb-7 ${
            darkMode ? "bg-gray-800" : "bg-white/95"
          }`}
        >
          <button
            onClick={handleSignOut}
            className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
              darkMode
                ? "border-red-400/20 text-red-300 hover:border-red-300/40 hover:bg-red-400/10 hover:text-red-200"
                : "border-red-100 bg-red-50/60 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                darkMode ? "bg-red-400/10 group-hover:bg-red-400/20" : "bg-white/80 group-hover:bg-white"
              }`}
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {menu && (
        <div
          className="fixed inset-0 z-20 bg-ink/20 lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}

      <div className="min-w-0">
        <div
          className={`sticky top-0 z-10 flex items-center gap-3 border-b border-line ${
            darkMode ? "bg-gray-800/70" : "bg-white/70"
          } px-5 py-3 backdrop-blur md:px-10`}
        >
          <button
            onClick={() => setMenu(true)}
            className="text-2xl lg:hidden"
            aria-label="Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-mono text-xs uppercase tracking-widest text-mute">
            {role === "student"
              ? "Member portal"
              : role === "teacher"
                ? "Guest teacher portal"
                : "Admin portal"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-full border p-2 text-sm font-bold ${
                darkMode ? "border-line text-yellow-400" : "border-line"
              }`}
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setBig(!big)}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                big ? "border-[var(--p1)] bg-p1-soft text-p1" : "border-line"
              }`}
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
        </div>

        <main className={`mx-auto max-w-6xl px-5 py-8 md:px-10 ${role === "student" || role === "admin" ? "pb-32" : ""}`}>
          {view === "profile" ? (
            <ProfileView role={role} name={userName} primaryColor={primaryColor} secondaryColor={primaryColor} />
          ) : (
            <>
              {role === "student" && (
                <Student
                  view={view as StudentView}
                  go={go}
                  age={computedAgeMode}
                  userName={userName}
                  userId={localStorage.getItem("uid") || ""}
                />
              )}
              {role === "teacher" && (
                <Teacher view={view as TeacherView} userId={localStorage.getItem("uid") || ""} go={go} />
              )}
              {role === "admin" && <Admin view={view as AdminView} />}
            </>
          )}
        </main>
      </div>
      {(role === "student" || role === "admin") && <Chatbot isAdmin={role === "admin"} />}
    </div>
  );
}