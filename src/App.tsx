import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Eye,
  EyeOff,
  Music,
  Award,
  CircleCheck,
  ShieldCheck,
  Bell,
  BookOpen,
  MessageCircle,
  Home,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Upload,
  Users,
  Video,
  X,
  User,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import logo from "./assets/logo.png";
import church from "./assets/church.jpg";
import Student, { Gospel, type StudentView } from "./Student";
import Teacher, { type TeacherView } from "./Teacher";
import Admin, { type AdminView } from "./Admin";
import PhoneLogin from "./PhoneLogin";
import { Btn, Input, Label, Card, Title } from "./ui";
import {
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updatePhoneNumber,
  updateProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_CHATBOT_RESPONSES, type ChatbotResponse } from "./chatbotResponses";

export type Role = "student" | "teacher" | "admin";

const LITURGICAL_PALETTES = [
  { name: "Advent & Lent · Violet", primary: "#6842a6", secondary: "#a855a0" },
  { name: "Easter & Christmas · White and gold", primary: "#c28b22", secondary: "#f2d477" },
  { name: "Ordinary Time · Green", primary: "#287653", secondary: "#79a94b" },
  { name: "Feasts · Red", primary: "#a8323b", secondary: "#e16c48" },
  { name: "Marian · Blue and pink", primary: "#2874b8", secondary: "#e58aae" },
];

export const NAV: Record<Role, [string, LucideIcon, string][]> = {
  student: [
    ["profile", User, "My Profile"],
    ["home", Home, "Dashboard"],
    ["materials", BookOpen, "Classes"],
    ["notes", Music, "Solfeggio (Note Reading)"],
    ["live", Video, "Live Classes"],
    ["exams", Award, "Assessments"],
    ["alerts", Bell, "Notifications"],
    ["help", LifeBuoy, "Help Guides"],
  ],
  teacher: [
    ["profile", User, "My Profile"],
    ["dash", LayoutDashboard, "Dashboard"],
    ["students", Users, "My Students"],
    ["upload", Upload, "Upload Content"],
    ["quiz", ListChecks, "Assessment Builder"],
    ["meet", Video, "Live Sessions"],
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function ProfileView({
  role,
  name,
  primaryColor,
  secondaryColor,
}: {
  role: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  const [user, setUser] = useState(auth.currentUser);
  const [fullName, setFullName] = useState(name);
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user?.phoneNumber));
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.emailVerified));
  const [accountStatus, setAccountStatus] = useState("approved");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpChecking, setOtpChecking] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(() => LITURGICAL_PALETTES.find((palette) => palette.primary === primaryColor) ?? LITURGICAL_PALETTES[0]);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    setSelectedPalette(LITURGICAL_PALETTES.find((palette) => palette.primary === primaryColor && palette.secondary === secondaryColor) ?? LITURGICAL_PALETTES[0]);
  }, [primaryColor, secondaryColor]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setFullName(data.name ?? user.displayName ?? name);
      setEmail(user.email ?? data.email ?? "");
      setPhone(user.phoneNumber ?? data.phoneNumber ?? "");
      setPhoneVerified(Boolean(user.phoneNumber));
      setEmailVerified(Boolean(user.emailVerified));
      setAccountStatus(data.status ?? "approved");
      if (user.email && user.email !== data.email) {
        void setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });
      }
    }).catch((error) => console.error("Could not load admin profile:", error));
  }, [user, name]);

  useEffect(() => () => recaptchaRef.current?.clear(), []);

  const saveProfile = async () => {
    if (!user) return alert("Please sign in again before updating your profile.");
    if (!fullName.trim()) return alert("Please enter your full name.");
    setProfileSaving(true);
    try {
      await updateProfile(user, { displayName: fullName.trim() });
      await setDoc(doc(db, "users", user.uid), { name: fullName.trim() }, { merge: true });
      localStorage.setItem("name", fullName.trim());
      alert("Profile information saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save profile information.");
    }
    setProfileSaving(false);
  };

  const refreshVerificationStatus = async () => {
    if (!user) return;
    try {
      await reload(user);
      setEmailVerified(Boolean(user.emailVerified));
      setEmail(user.email ?? "");
      setPhoneVerified(Boolean(user.phoneNumber));
      if (user.phoneNumber) setPhone(user.phoneNumber);
      if (user.email) await setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });
    } catch (error) {
      console.error(error);
      alert("Could not refresh verification status.");
    }
  };

  const sendEmailConfirmation = async () => {
    if (!user || !email.trim()) return alert("Enter the email address to confirm.");
    setEmailSending(true);
    try {
      if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
        await sendEmailVerification(user);
      } else {
        await verifyBeforeUpdateEmail(user, email.trim());
      }
      alert(`A confirmation link was sent to ${email.trim()}.`);
    } catch (error) {
      console.error(error);
      alert("Could not send the confirmation email. Sign in again and retry if Firebase requires recent authentication.");
    }
    setEmailSending(false);
  };

  const sendPhoneOtp = async () => {
    if (!user) return alert("Please sign in again before verifying a phone number.");
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      return alert("Enter the phone number in international format, for example +639171234567.");
    }
    setOtpSending(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, "admin-phone-recaptcha", { size: "normal" });
      }
      const id = await new PhoneAuthProvider(auth).verifyPhoneNumber(phone.trim(), recaptchaRef.current);
      setVerificationId(id);
      alert("SMS verification code sent.");
    } catch (error) {
      console.error(error);
      alert("Could not send the SMS code. Check Firebase Phone Authentication settings and try again.");
    }
    setOtpSending(false);
  };

  const confirmPhoneOtp = async () => {
    if (!user || !verificationId || !otp.trim()) return;
    setOtpChecking(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp.trim());
      if (user.phoneNumber) await updatePhoneNumber(user, credential);
      else await linkWithCredential(user, credential);
      await setDoc(doc(db, "users", user.uid), { phoneNumber: phone.trim(), phoneVerified: true }, { merge: true });
      setPhoneVerified(true);
      setVerificationId("");
      setOtp("");
      alert("Phone number verified and linked to the admin account.");
    } catch (error) {
      console.error(error);
      alert("The SMS code could not be verified. Check the code and try again.");
    }
    setOtpChecking(false);
  };

  const saveSystemColor = async () => {
    if (role !== "admin") return;
    setColorSaving(true);
    try {
      await setDoc(doc(db, "settings", "appearance"), { primaryColor: selectedPalette.primary, secondaryColor: selectedPalette.secondary, paletteName: selectedPalette.name }, { merge: true });
      alert("System interface color saved for all users.");
    } catch (error) {
      console.error(error);
      alert("Could not save the system color. Check access to the settings collection.");
    }
    setColorSaving(false);
  };

  return (
    <>
      <Title
        kicker="Account Settings"
        title="My Profile"
        sub="Edit information and manage verifications."
      />
      <Card className={`mt-5 w-full ${role === "admin" ? "max-w-none [&_button]:text-base [&_input]:text-base [&_label>span]:text-base [&_p]:text-base" : "max-w-xl"}`}>
        <div className={`grid gap-4 ${role === "admin" ? "lg:grid-cols-2" : ""}`}>
          <Field label="Full Name">
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </Field>
          <Field label="Email Address">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {role === "admin" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-p1-soft p-4 text-base lg:col-span-2">
              <p><span className="font-semibold">Account role:</span> Administrator</p>
              <p><span className="font-semibold">Account status:</span> {accountStatus}</p>
            </div>
          )}
          {role === "admin" && (
            <button type="button" onClick={sendEmailConfirmation} disabled={emailSending} className="w-fit rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-60 lg:col-span-2">
              {emailSending ? "Sending confirmation..." : email.trim().toLowerCase() !== user?.email?.toLowerCase() ? "Confirm email change" : emailVerified ? "Resend Gmail verification" : "Send Gmail confirmation"}
            </button>
          )}
          {role === "admin" && (
            <>
              <Field label="Phone Number (international format)">
                <Input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerified(false); }} placeholder="+639171234567" />
              </Field>
              <p className="text-mute lg:self-center">{phoneVerified ? "SMS verification is linked to this account." : "Verify this number with an SMS one-time code."}</p>
              <div id="admin-phone-recaptcha" className="lg:col-span-2" />
              <button type="button" onClick={sendPhoneOtp} disabled={otpSending} className="w-fit rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-60">
                {otpSending ? "Sending code..." : "Send SMS OTP"}
              </button>
              {verificationId && (
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  <Input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6-digit SMS code" />
                  <button type="button" onClick={confirmPhoneOtp} disabled={otpChecking} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{otpChecking ? "Verifying..." : "Verify phone"}</button>
                </div>
              )}
              <div className="border-t border-line pt-4 lg:col-span-2">
                <Label>Liturgical color palette for all users</Label>
                <p className="mt-1 text-sm text-mute">Choose a season or feast palette. It updates the login and signup background and system gradients.</p>
                <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Liturgical color palette">
                  {LITURGICAL_PALETTES.map((palette) => (
                    <button key={palette.name} type="button" role="radio" aria-checked={selectedPalette.name === palette.name} aria-label={palette.name} title={palette.name} onClick={() => setSelectedPalette(palette)} className={`h-11 w-11 rounded-full bg-gradient-to-br ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p1 ${selectedPalette.name === palette.name ? "ring-2 ring-p1" : "ring-1 ring-black/10"}`} style={{ backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }} />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedPalette.name}</span>
                  <button type="button" onClick={saveSystemColor} disabled={colorSaving} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{colorSaving ? "Saving..." : "Save system color"}</button>
                </div>
              </div>
            </>
          )}
          {role !== "admin" && (
            <Field label="Birth Year (For auto-age assignment)">
              <Input type="number" defaultValue="2005" />
            </Field>
          )}
          <div className={`pt-4 border-t border-line ${role === "admin" ? "lg:col-span-2" : ""}`}>
            <Label>Verification Status</Label>
            {role === "admin" ? (
              <div className="mt-2 grid gap-2">
                <p className={`flex w-fit items-center gap-2 rounded-lg p-2 font-semibold ${emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}><CircleCheck className="h-4 w-4" /> Email {emailVerified ? "verified" : "not verified"}</p>
                <p className={`flex w-fit items-center gap-2 rounded-lg p-2 font-semibold ${phoneVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}><CircleCheck className="h-4 w-4" /> Phone {phoneVerified ? "verified" : "not verified"}</p>
                <button type="button" onClick={refreshVerificationStatus} className="w-fit font-semibold text-p1 hover:underline">Refresh verification status</button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-green-600 mt-2 bg-green-50 p-2 rounded-lg w-fit font-semibold"><CircleCheck className="w-4 h-4" /> Account Verified</p>
            )}
          </div>
          <Btn className={`mt-4 w-fit ${role === "admin" ? "lg:col-span-2" : ""}`} onClick={saveProfile}>{profileSaving ? "Saving..." : "Save Changes"}</Btn>
        </div>
      </Card>
    </>
  );
}

function useSystemAppearance(darkMode: boolean) {
  const [primaryColor, setPrimaryColor] = useState("#1f6fe0");
  const [secondaryColor, setSecondaryColor] = useState("#e8608c");

  useEffect(() => onSnapshot(doc(db, "settings", "appearance"), (snapshot) => {
    const color = snapshot.data()?.primaryColor;
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) setPrimaryColor(color);
    const secondary = snapshot.data()?.secondaryColor;
    if (typeof secondary === "string" && /^#[0-9a-f]{6}$/i.test(secondary)) setSecondaryColor(secondary);
  }, (error) => console.error("Could not load system appearance:", error)), []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--p1", primaryColor);
    root.style.setProperty("--p2", secondaryColor);
    root.style.setProperty("--p1-soft", `color-mix(in srgb, ${primaryColor} ${darkMode ? "28%" : "12%"}, ${darkMode ? "#1e293b" : "white"})`);
    root.style.setProperty("--p2-soft", `color-mix(in srgb, ${secondaryColor} ${darkMode ? "25%" : "10%"}, ${darkMode ? "#1e293b" : "white"})`);
  }, [primaryColor, secondaryColor, darkMode]);

  return { primaryColor, secondaryColor };
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPass, setReqPass] = useState("");
  const [reqConfirm, setReqConfirm] = useState("");
  const [reqBirthday, setReqBirthday] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqMessenger, setReqMessenger] = useState("");
  const [showReqPass, setShowReqPass] = useState(false);
  const [showReqConfirm, setShowReqConfirm] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const today = new Date();
  const toDateInputValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const maxBirthday = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const minBirthday = toDateInputValue(new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()));
  useSystemAppearance(darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const handleLogin = async () => {
    if (!email || !password) return alert("Please enter email and password.");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (email === "lucionaradnas@gmail.com") {
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            name: "Sandara Torres",
            email: "lucionaradnas@gmail.com",
            role: "admin",
            status: "approved",
          },
          { merge: true },
        );

        localStorage.setItem("role", "admin");
        localStorage.setItem("uid", cred.user.uid);
        localStorage.setItem("name", "Sis. Ethyl");
        navigate("/admin/dash");
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.status === "pending") {
          await signOut(auth);
          alert("Your account is still pending admin approval.");
          setLoading(false);
          return;
        }
        if (data.status === "rejected") {
          await signOut(auth);
          alert("Your account request was declined.");
          setLoading(false);
          return;
        }
        localStorage.setItem("role", data.role);
        localStorage.setItem("uid", cred.user.uid);
        localStorage.setItem("name", data.name || "User");
        localStorage.setItem("birthYear", data.birthYear || "2000");
        navigate(`/${data.role}/${NAV[data.role as Role][0][0]}`);
      } else {
        await signOut(auth);
        alert("User data not found in database.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (!/^[\p{L}\p{M} .'-]+$/u.test(reqName.trim())) {
      setSignupError("Enter a complete name using letters only (spaces, periods, apostrophes, and hyphens are allowed).");
      return;
    }
    if (!reqBirthday || reqBirthday < minBirthday || reqBirthday > maxBirthday) {
      setSignupError("Enter a valid birthday between 120 years ago and yesterday. Today's date and dates in the future aren't allowed.");
      return;
    }
    if (!/^\d+$/.test(reqPhone)) {
      setSignupError("Phone number can contain numbers only.");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/.test(reqPass)) {
      setSignupError("Password must be at least 8 characters and include a letter, a number, and a special character.");
      return;
    }
    if (reqPass !== reqConfirm) {
      setSignupError("Passwords do not match. Check both fields and try again.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        reqEmail,
        reqPass,
      );
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name: reqName,
        email: reqEmail,
        birthday: reqBirthday,
        birthYear: reqBirthday.slice(0, 4),
        phoneNumber: reqPhone,
        messengerLink: reqMessenger.trim(),
        role: "student",
        status: "pending",
        dateRequested: new Date().toISOString(),
      });
      await signOut(auth);
      setSent(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email)
      return alert("Please enter your email address in the field first.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your Gmail inbox/spam.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-ink lg:grid-cols-[1.1fr_1fr]">
      <img
        src={church}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(125deg, color-mix(in srgb, var(--p1) 88%, transparent), color-mix(in srgb, var(--p2) 88%, transparent))",
        }}
      />
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <img
          src={logo}
          alt="OLSHP"
          className="mx-auto h-[62vh] w-auto object-contain"
          style={{
            filter:
              `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 8px rgba(255,255,255,0.85)) drop-shadow(0 0 26px rgba(255,255,255,0.58)) drop-shadow(0 0 ${darkMode ? "64px rgba(125,211,252,0.58)" : "52px rgba(125,211,252,0.38)"}) drop-shadow(0 20px 40px rgba(0,0,0,0.38))`,
          }}
        />
        <div className="text-white">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/90">
            OLSHP · Bacoor, Cavite · Est. 2005
          </p>
          <p className="mt-2 max-w-md font-display text-3xl leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">
            "He who sings, prays twice."{"   "}
            <span className="mt-1 block text-white/85">— St. Augustine</span>
          </p>
        </div>
      </div>
      <div className="relative grid place-items-center p-6 h-screen overflow-y-auto">
        <div className={`relative my-auto w-full max-w-md rounded-3xl border border-line bg-white/95 p-8 text-ink shadow-2xl shadow-black/25 backdrop-blur [&_input]:font-medium [&_label>span]:font-bold [&_p]:font-medium ${darkMode ? "[&_label>span]:text-slate-100" : "[&_label>span]:text-slate-800"}`}>
          <button
            type="button"
            onClick={() => setDarkMode((enabled) => !enabled)}
            className="absolute right-5 top-5 rounded-full border border-line p-2 text-mute transition hover:text-p1"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <img
            src={logo}
            alt=""
            className="mx-auto mb-4 h-28 lg:hidden"
            style={{ filter: darkMode ? "drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,255,255,0.65)) drop-shadow(0 0 28px rgba(125,211,252,0.55))" : "drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 10px rgba(255,255,255,0.3))" }}
          />
          <p className="mx-auto mb-4 max-w-xs text-center font-display text-sm italic leading-relaxed text-slate-600 lg:hidden">
            “He who sings, prays twice.” <span className="mt-1 block whitespace-nowrap not-italic text-slate-500">— St. Augustine</span>
          </p>
          <div className="text-center">
            <div className="block">
              <Label>Ministry of Music in the Liturgy</Label>
            </div>
            <h1 className="mt-1 font-display text-3xl font-semibold grad-text">
              MusikAralan
            </h1>
          </div>

          {mode === "login" ? (
            <>
              <p className="mt-1 text-center text-mute">
                For members and aspirants only.
              </p>
              <div className="mt-6 grid gap-3">
                <Field label="Email Address">
                  <Input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="placeholder:text-slate-400"
                  />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <Input
                      type={show ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-p1"
                    >
                      {show ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </Field>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-sm font-semibold text-p1 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full rounded-full bg-[var(--p1)] py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Authenticating..." : "Log In"}
                </button>

                <p className="text-center text-sm text-mute">
                  New aspirant?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="font-semibold text-p1 hover:underline"
                  >
                    Request access
                  </button>
                </p>
              </div>
            </>
          ) : sent ? (
            <div className="mt-6 text-center">
              <CircleCheck
                className="mx-auto h-12 w-12 text-p1"
                strokeWidth={1.5}
              />
              <p className="mt-3 font-display text-xl">Request submitted</p>
              <p className="mt-1 text-sm text-mute">
                An administrator will review your account. You'll be notified by
                email once approved.
              </p>
              <Btn
                variant="ghost"
                className="mt-5"
                onClick={() => {
                  setMode("login");
                  setSent(false);
                }}
              >
                Back to log in
              </Btn>
            </div>
          ) : (
            <form className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2" onSubmit={handleSignup}>
              <p className="-mt-4 mb-1 text-center text-mute lg:col-span-2">
                Request access as a member or aspirant.
              </p>
              <Field label="Full Name">
                <Input
                  required
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value.replace(/[^\p{L}\p{M} .'-]/gu, ""))}
                  autoComplete="name"
                  placeholder="Sandara L. Torres"
                  className="placeholder:text-slate-400"
                />
              </Field>
              <Field label="Email Address">
                <Input
                  required
                  type="email"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="example@gmail.com"
                  className="placeholder:text-slate-400"
                />
              </Field>
              <Field label="Birthday">
                <Input
                  required
                  type="date"
                  value={reqBirthday}
                  onChange={(e) => setReqBirthday(e.target.value)}
                  min={minBirthday}
                  max={maxBirthday}
                  placeholder="MM/DD/YYYY"
                  className={`placeholder:text-slate-400 ${reqBirthday ? "text-slate-800" : "text-slate-400"}`}
                />
              </Field>
              <Field label="Phone Number">
                <Input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="09171234567"
                  className="placeholder:text-slate-400"
                />
              </Field>
              <Field label="Messenger Link (optional)">
                <Input
                  type="url"
                  value={reqMessenger}
                  onChange={(e) => setReqMessenger(e.target.value)}
                  placeholder="https://m.me/your.name"
                  className="placeholder:text-slate-400"
                />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Input
                    required
                    type={showReqPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={reqPass}
                    onChange={(e) => setReqPass(e.target.value)}
                    placeholder="8+ characters, letter, number & symbol"
                    className="pr-11 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowReqPass((visible) => !visible)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-p1"
                    aria-label={showReqPass ? "Hide password" : "Show password"}
                  >
                    {showReqPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password">
                <div className="relative">
                  <Input
                    required
                    type={showReqConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={reqConfirm}
                    onChange={(e) => setReqConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className="pr-11 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowReqConfirm((visible) => !visible)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-p1"
                    aria-label={showReqConfirm ? "Hide confirmation password" : "Show confirmation password"}
                  >
                    {showReqConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </Field>
              {signupError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 lg:col-span-2">{signupError}</p>}
              <p className="flex items-center justify-center gap-2 rounded-xl bg-p2-soft px-3 py-2 text-xs text-p2 lg:col-span-2">
                <ShieldCheck className="h-4 w-4 shrink-0" /> Accounts require
                Admin approval.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--p1)] py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 lg:col-span-2"
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>

              <p className="text-center text-sm text-mute lg:col-span-2">
                Already a member?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-p1 hover:underline"
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function keywordDistanceIsOne(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex++;
      rightIndex++;
      continue;
    }
    differences++;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex++;
    else if (right.length > left.length) rightIndex++;
    else {
      leftIndex++;
      rightIndex++;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) differences++;
  return differences === 1;
}

const CHATBOT_STOP_WORDS = new Set([
  "a", "an", "the", "how", "do", "does", "did", "i", "me", "my", "you", "your",
  "what", "whats", "when", "where", "why", "can", "could", "would", "should",
  "is", "are", "am", "to", "for", "of", "on", "in", "with", "please", "tell",
]);

function Chatbot({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState(DEFAULT_CHATBOT_RESPONSES);
  const [msgs, setMsgs] = useState([
    {
      me: false,
      t: 'Kumusta po! I am your Music Helper. Ask me anything — like "How do I join class?"',
    },
  ]);
  const [v, setV] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "chatbotResponses"), (snapshot) => {
      if (snapshot.empty) {
        setResponses(DEFAULT_CHATBOT_RESPONSES);
        return;
      }
      const saved = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ChatbotResponse, "id">),
      }));
      setResponses([
        ...DEFAULT_CHATBOT_RESPONSES.flatMap((fallback) => {
          const override = saved.find((item) => item.id === fallback.id);
          return override?.deleted ? [] : [override ?? fallback];
        }),
        ...saved.filter((item) => !item.deleted && !DEFAULT_CHATBOT_RESPONSES.some((fallback) => fallback.id === item.id)),
      ]);
    }, (error) => console.error("Could not load chatbot responses:", error));
  }, []);

  const send = (t: string) => {
    if (!t) return;
    const inputWords = (t.toLowerCase().match(/[a-z0-9']+/g) ?? [])
      .filter((word) => !CHATBOT_STOP_WORDS.has(word));
    const matched = responses
      .map((item) => {
        const keywords = (item.keywords.toLowerCase().match(/[a-z0-9']+/g) ?? [])
          .filter((word) => !CHATBOT_STOP_WORDS.has(word));
        const score = keywords.reduce((total, keyword) => {
          const bestWordScore = inputWords.reduce((best, word) => {
            if (word === keyword) return Math.max(best, 3);
            if (Math.min(word.length, keyword.length) >= 4 && (word.includes(keyword) || keyword.includes(word))) {
              return Math.max(best, 2);
            }
            if (Math.min(word.length, keyword.length) >= 4 && keywordDistanceIsOne(word, keyword)) {
              return Math.max(best, 1);
            }
            return best;
          }, 0);
          return total + bestWordScore;
        }, 0);
        return { item, score };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.item;
    const a = matched?.response ?? responses.find((item) => !item.keywords.trim())?.response ?? "I don't have an answer for that yet. Please contact your coordinator.";
    /*
    const legacyResponse = /class|meet|join/i.test(t)
      ? 'Tap "Live Classes" on the left, then the big blue "Join on Google Meet" button.'
      : /download|pdf/i.test(t)
        ? "Open Materials, choose the lesson, then tap ⬇ Download. It will work even without internet."
        : "Salamat po! A coordinator will reply soon. You can also call Sis. Ethyl at 0917 123 4567.";
    */
    setMsgs((m) => [...m, { me: true, t }, { me: false, t: a }]);
    setV("");
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl">
          <div className="grad px-5 py-4 text-white flex justify-between items-center">
            <div>
              <p className="font-display text-lg">Music Helper</p>
              <p className="text-xs text-white/80">
                Always here · Tagalog or English
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate("/admin/bot")}
                className="text-xs underline"
              >
                Manage Replies
              </button>
            )}
          </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {msgs.map((m, i) => (
                  <p
                    key={i}
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] ${m.me ? "ml-auto grad text-white" : "bg-p1-soft"}`}
                  >
                    {m.t}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 px-3">
                {["How do I join class?", "Download a PDF"].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-line px-3 py-1 text-xs"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(v);
                }}
                className="flex gap-2 p-3"
              >
                <Input
                  value={v}
                  onChange={(e) => setV(e.target.value)}
                  placeholder="Type here…"
                />
                <Btn>Send</Btn>
              </form>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Open help chat"
        className="grad ml-auto flex h-16 items-center gap-2 rounded-full px-6 text-lg font-semibold text-white shadow-xl"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />{" "}
            {isAdmin ? "Edit Bot" : "Help"}
          </>
        )}
      </button>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const role = localStorage.getItem("role") as Role | null;
  const userName = localStorage.getItem("name") || "User";
  const userBirthYear = Number(localStorage.getItem("birthYear")) || 2010;

  const currentYear = new Date().getFullYear();
  const ageNum = currentYear - userBirthYear;
  const computedAgeMode =
    ageNum <= 12 ? "kids" : ageNum <= 25 ? "youth" : "adult";

  const [big, setBig] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const { primaryColor, secondaryColor } = useSystemAppearance(darkMode);
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

  if (pathRole !== role)
    return <Navigate to={`/${role}/${NAV[role][0][0]}`} replace />;
  if (role === "student" && view === "store")
    return <Navigate to="/student/materials" replace />;

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
    <div
      className={`canvas min-h-screen lg:grid lg:grid-cols-[17rem_1fr] ${darkMode ? "bg-gray-900 text-white" : ""}`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-y-auto border-r border-line ${darkMode ? "bg-gray-800" : "bg-white/95"} p-5 backdrop-blur transition lg:static lg:top-auto lg:h-auto lg:min-h-screen lg:w-auto lg:self-stretch lg:overflow-visible lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`relative z-10 -mx-5 -mt-5 flex shrink-0 items-center gap-3 px-5 pt-5 pb-3 backdrop-blur ${darkMode ? "bg-gray-800" : "bg-white/95"}`}
        >
          <img
            src={logo}
            alt="MML logo"
            className="h-14 w-auto"
            style={{
              filter: `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 8px rgba(255,255,255,0.85)) drop-shadow(0 0 26px rgba(255,255,255,0.58)) drop-shadow(0 0 ${darkMode ? "64px rgba(125,211,252,0.58)" : "52px rgba(125,211,252,0.38)"}) drop-shadow(0 20px 40px rgba(0,0,0,0.38))`,
            }}
          />
          <div className="ml-1 min-w-0 translate-y-0.5">
            <p className="font-display text-lg leading-tight">MusikAralan</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
              OLSHP · MML
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto lg:flex-none lg:overflow-visible">
          <nav className="mt-8 grid gap-1">
            {NAV[role].map(([k, I, n]) => (
              <button
                key={k}
                onClick={() => go(k)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium transition ${view === k ? "bg-p1-soft text-p1" : "text-mute hover:bg-slate-50 hover:text-ink"}`}
              >
                <I className="h-5 w-5" strokeWidth={1.75} /> {n}
              </button>
            ))}
          </nav>
          {role === "student" && (
            <div className="mt-6 hidden xl:block">
              <Gospel />
            </div>
          )}
        </div>
        <div className={`sticky bottom-0 z-20 mt-auto -mx-5 -mb-5 shrink-0 border-t border-line px-5 pt-4 pb-7 ${darkMode ? "bg-gray-800" : "bg-white/95"}`}>
          <button
            onClick={handleSignOut}
            className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${darkMode ? "border-red-400/20 text-red-300 hover:border-red-300/40 hover:bg-red-400/10 hover:text-red-200" : "border-red-100 bg-red-50/60 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"}`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-lg transition ${darkMode ? "bg-red-400/10 group-hover:bg-red-400/20" : "bg-white/80 group-hover:bg-white"}`}>
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
          className={`sticky top-0 z-10 flex items-center gap-3 border-b border-line ${darkMode ? "bg-gray-800/70" : "bg-white/70"} px-5 py-3 backdrop-blur md:px-10`}
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
              className={`rounded-full border p-2 text-sm font-bold ${darkMode ? "border-line text-yellow-400" : "border-line"}`}
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setBig(!big)}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${big ? "border-[var(--p1)] bg-p1-soft text-p1" : "border-line"}`}
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10">
          {view === "profile" ? (
            <ProfileView role={role} name={userName} primaryColor={primaryColor} secondaryColor={secondaryColor} />
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
              {role === "teacher" && <Teacher view={view as TeacherView} />}
              {role === "admin" && <Admin view={view as AdminView} />}
            </>
          )}
          {role === "student" && (
            <div className="mt-8 xl:hidden">
              <Gospel />
            </div>
          )}
        </main>
      </div>
      {(role === "student" || role === "admin") && (
        <Chatbot isAdmin={role === "admin"} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/:role/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
