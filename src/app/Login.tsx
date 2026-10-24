import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Eye, EyeOff, Moon, ShieldCheck, Sun } from "lucide-react";
import logo from "../assets/logo.png";
import church from "../assets/church.jpg";
import { apiPost, setApiToken } from "../api";
import { Btn, Input, Label } from "../ui";
import { Field } from "./Field";
import { DASHBOARD_VIEW, type Role } from "./AppTypes";
import { useSystemAppearance } from "./useSystemAppearance";

export function Login() {
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
  const [nameInputWarning, setNameInputWarning] = useState("");
  const [phoneInputWarning, setPhoneInputWarning] = useState("");
  const [nameWarningPosition, setNameWarningPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [phoneWarningPosition, setPhoneWarningPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [reqMessenger, setReqMessenger] = useState("");
  const [showReqPass, setShowReqPass] = useState(false);
  const [showReqConfirm, setShowReqConfirm] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );

  const maxBirthday = "2021-12-31";
  const minBirthday = "1920-01-01";
  const { primaryColor: themePrimaryColor } = useSystemAppearance(darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const handleLogin = async () => {
    if (!email || !password) return alert("Please enter email and password.");
    setLoading(true);
    try {
      const { token, user: data } = await apiPost<{
        token: string;
        user: {
          id: string;
          name: string;
          birthYear: number | null;
          role: Role;
        };
      }>("/auth/login", { email, password });

      setApiToken(token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("uid", data.id);
      localStorage.setItem("name", data.name || "User");
      localStorage.setItem("birthYear", String(data.birthYear || "2000"));
      navigate(`/${data.role}/${DASHBOARD_VIEW[data.role]}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (!/^[\p{L}\p{M} .'-]+$/u.test(reqName.trim())) {
      setSignupError(
        "Enter a complete name using letters only (spaces, periods, apostrophes, and hyphens are allowed).",
      );
      return;
    }
    if (
      !reqBirthday ||
      reqBirthday < minBirthday ||
      reqBirthday > maxBirthday
    ) {
      setSignupError(
        "Enter a birthday between January 1920 and December 2021.",
      );
      return;
    }
    if (!/^\d{11}$/.test(reqPhone)) {
      setSignupError("Phone number must be exactly 11 digits.");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/.test(reqPass)) {
      setSignupError(
        "Password must be at least 8 characters and include a letter, a number, and a special character.",
      );
      return;
    }
    if (reqPass !== reqConfirm) {
      setSignupError(
        "Passwords do not match. Check both fields and try again.",
      );
      return;
    }

    setLoading(true);
    try {
      await apiPost("/auth/register", {
        name: reqName,
        email: reqEmail,
        password: reqPass,
        password_confirmation: reqConfirm,
        birthday: reqBirthday,
        phoneNumber: reqPhone,
        messengerLink: reqMessenger.trim(),
      });
      setSent(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email)
      return alert("Please enter your email address in the field first.");
    try {
      const response = await apiPost<{ message: string }>(
        "/auth/forgot-password",
        { email },
      );
      alert(response.message);
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
            filter: `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 8px rgba(255,255,255,0.85)) drop-shadow(0 0 26px rgba(255,255,255,0.58)) drop-shadow(0 0 ${
              darkMode
                ? `64px color-mix(in srgb, ${themePrimaryColor} 58%, transparent)`
                : `52px color-mix(in srgb, ${themePrimaryColor} 38%, transparent)`
            }) drop-shadow(0 20px 40px rgba(0,0,0,0.38))`,
          }}
        />
        <div className="text-white">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/90">
            OLSHP · Bacoor, Cavite · Est. 2005
          </p>
          <p className="mt-2 max-w-md font-display text-3xl leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">
            "He who sings, prays twice."{" "}
            <span className="mt-1 block text-white/85">— St. Augustine</span>
          </p>
        </div>
      </div>
      <div className="relative grid place-items-center p-6 h-screen overflow-y-auto">
        <div
          className={`relative my-auto w-full max-w-md rounded-3xl border border-line bg-white/95 p-8 text-ink shadow-2xl shadow-black/25 backdrop-blur [&_input]:font-medium [&_label>span]:font-bold [&_p]:font-medium ${
            darkMode
              ? "[&_label>span]:text-slate-100"
              : "[&_label>span]:text-slate-800"
          }`}
        >
          <button
            type="button"
            onClick={() => setDarkMode((enabled) => !enabled)}
            className="absolute right-5 top-5 rounded-full border border-line p-2 text-mute transition hover:text-p1"
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <img
            src={logo}
            alt=""
            className="mx-auto mb-4 h-28 lg:hidden"
            style={{
              filter: darkMode
                ? `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,255,255,0.65)) drop-shadow(0 0 28px color-mix(in srgb, ${themePrimaryColor} 55%, transparent))`
                : `drop-shadow(1px 0 0 rgba(255,255,255,0.95)) drop-shadow(-1px 0 0 rgba(255,255,255,0.95)) drop-shadow(0 1px 0 rgba(255,255,255,0.95)) drop-shadow(0 -1px 0 rgba(255,255,255,0.95)) drop-shadow(0 0 10px color-mix(in srgb, ${themePrimaryColor} 38%, transparent))`,
            }}
          />
          <p className="mx-auto mb-4 max-w-xs text-center font-display text-sm italic leading-relaxed text-slate-600 lg:hidden">
            “He who sings, prays twice.”{" "}
            <span className="mt-1 block whitespace-nowrap not-italic text-slate-500">
              — St. Augustine
            </span>
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
            <form>
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
                  type="submit"
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
            </form>
          ) : sent ? (
            <form>
              <div className="mt-6 text-center">
                <CircleCheck
                  className="mx-auto h-12 w-12 text-p1"
                  strokeWidth={1.5}
                />
                <p className="mt-3 font-display text-xl">Request submitted</p>
                <p className="mt-1 text-sm text-mute">
                  An administrator will review your account. You'll be notified
                  by email once approved.
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
            </form>
          ) : (
            <form
              className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2"
              onSubmit={handleSignup}
            >
              <p className="-mt-4 mb-1 text-center text-mute lg:col-span-2">
                Request access as a member or aspirant.
              </p>
              <div>
                <Field label="Full Name">
                  <Input
                    required
                    value={reqName}
                    onBlur={() => {
                      setNameInputWarning("");
                      setNameWarningPosition(null);
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      const hasInvalidCharacters = /[^\p{L}\p{M} .'-]/u.test(
                        value,
                      );
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNameInputWarning(
                        hasInvalidCharacters
                          ? "Letters and spaces only. Digits are not allowed."
                          : "",
                      );
                      setNameWarningPosition(
                        hasInvalidCharacters
                          ? {
                              left: rect.left,
                              top: rect.top - 8,
                              width: rect.width,
                            }
                          : null,
                      );
                      setReqName(value.replace(/[^\p{L}\p{M} .'-]/gu, ""));
                    }}
                    autoComplete="name"
                    placeholder="Ex.Sandara Torres"
                    className="placeholder:text-slate-400"
                  />
                </Field>
              </div>
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
              <div>
                <Field label="Phone Number">
                  <Input
                    required
                    type="tel"
                    inputMode="numeric"
                    minLength={11}
                    maxLength={11}
                    autoComplete="tel"
                    value={reqPhone}
                    onBlur={() => {
                      setPhoneInputWarning("");
                      setPhoneWarningPosition(null);
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      const hasInvalidCharacters = /\D/.test(value);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPhoneInputWarning(
                        hasInvalidCharacters
                          ? "Digits only. Letters are not allowed."
                          : "",
                      );
                      setPhoneWarningPosition(
                        hasInvalidCharacters
                          ? {
                              left: rect.left,
                              top: rect.top - 8,
                              width: rect.width,
                            }
                          : null,
                      );
                      setReqPhone(value.replace(/\D/g, ""));
                    }}
                    placeholder="Ex.09171234567"
                    className="placeholder:text-slate-400"
                  />
                </Field>
              </div>
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
                    {showReqPass ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
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
                    aria-label={
                      showReqConfirm
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showReqConfirm ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </Field>
              {signupError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 lg:col-span-2"
                >
                  {signupError}
                </p>
              )}
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
      {nameInputWarning &&
        nameWarningPosition &&
        createPortal(
          <p
            role="alert"
            style={{
              position: "fixed",
              left: nameWarningPosition.left,
              top: nameWarningPosition.top,
              width: nameWarningPosition.width,
              transform: "translateY(-100%)",
              zIndex: 2147483647,
            }}
            className="pointer-events-none rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 shadow-lg before:absolute before:-bottom-1 before:left-3 before:h-2 before:w-2 before:rotate-45 before:border-b before:border-r before:border-red-200 before:bg-red-50"
          >
            {nameInputWarning}
          </p>,
          document.body,
        )}
      {phoneInputWarning &&
        phoneWarningPosition &&
        createPortal(
          <p
            role="alert"
            style={{
              position: "fixed",
              left: phoneWarningPosition.left,
              top: phoneWarningPosition.top,
              width: phoneWarningPosition.width,
              transform: "translateY(-100%)",
              zIndex: 2147483647,
            }}
            className="pointer-events-none rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 shadow-lg before:absolute before:-bottom-1 before:left-3 before:h-2 before:w-2 before:rotate-45 before:border-b before:border-r before:border-red-200 before:bg-red-50"
          >
            {phoneInputWarning}
          </p>,
          document.body,
        )}
    </div>
  );
}
