import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiPost } from "../api";
import { Btn, Card, Input, Title } from "../ui";
import { Field } from "./Field";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [codeSent, setCodeSent] = useState(false);
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
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                minLength={8}
              />
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
