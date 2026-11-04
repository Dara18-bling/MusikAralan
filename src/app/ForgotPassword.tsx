import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Eye, EyeOff } from "lucide-react";
import { apiPost, clearApiToken } from "../api";
import { Btn, Card, Input, Title } from "../ui";
import { Field } from "./Field";

export function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as
    | { email?: string; profileReset?: boolean }
    | null;
  const [email, setEmail] = useState(navigationState?.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [codeSent, setCodeSent] = useState(Boolean(navigationState?.profileReset));
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    setLoading(true);
    try {
      const { message } = await apiPost<{ message: string }>(
        "/auth/forgot-password",
        { email },
      );
      setCodeSent(true);
      toast.info(message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send a verification code.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { message } = await apiPost<{ message: string }>(
        "/auth/reset-password",
        {
          email,
          code,
          password,
          password_confirmation: confirmation,
        },
      );
      toast.success(message);
      clearApiToken();
      localStorage.removeItem("role");
      localStorage.removeItem("uid");
      localStorage.removeItem("name");
      localStorage.removeItem("birthYear");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reset the password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ink p-5">
      <Card className="w-full max-w-md">
        <Title
          kicker="Account recovery"
          title={codeSent ? "Reset your password" : "Forgot your password?"}
          sub={
            codeSent
              ? "Enter the 8-character code sent to your email and choose a new password."
              : "Enter your account email and we will send a verification code if it matches an account."
          }
        />
        {!codeSent ? (
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void requestCode();
            }}
          >
            <Field label="Email address">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={Boolean(navigationState?.profileReset)}
                required
                maxLength={255}
              />
            </Field>
            <Btn disabled={loading}>
              {loading ? "Sending code..." : "Send verification code"}
            </Btn>
          </form>
        ) : (
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => void resetPassword(event)}
          >
            <Field label="Email address">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={Boolean(navigationState?.profileReset)}
                required
                maxLength={255}
              />
            </Field>
            <Field label="8-character verification code">
              <Input
                type="text"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.toUpperCase().slice(0, 8))
                }
                required
                minLength={8}
                maxLength={8}
              />
            </Field>
            <Field label="New password">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  className="pr-11"
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-p1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </Field>
            <Field label="Confirm new password">
              <div className="relative">
                <Input
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  minLength={8}
                  className="pr-11"
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-p1"
                  aria-label={
                    showConfirmation
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                >
                  {showConfirmation ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </Field>
            <Btn disabled={loading || code.length !== 8}>
              {loading ? "Resetting password..." : "Reset password"}
            </Btn>
            <button
              type="button"
              onClick={() => void requestCode()}
              disabled={loading}
              className="text-sm font-semibold text-p1 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="font-semibold text-p1 hover:underline">
            Back to log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
