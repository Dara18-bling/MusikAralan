import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiPost } from "../api";
import { Btn, Card, Input, Title } from "../ui";
import { Field } from "./Field";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { message } = await apiPost<{ message: string }>("/auth/reset-password", {
        token: searchParams.get("token"),
        email: searchParams.get("email"),
        password,
        password_confirmation: confirmation,
      });
      alert(message);
      navigate("/login", { replace: true });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ink p-5">
      <Card className="w-full max-w-md">
        <Title kicker="Account recovery" title="Choose a new password" />
        <form className="mt-5 grid gap-4" onSubmit={reset}>
          <Field label="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </Field>
          <Btn disabled={loading || !searchParams.get("token") || !searchParams.get("email")}>
            {loading ? "Saving..." : "Reset password"}
          </Btn>
        </form>
      </Card>
    </main>
  );
}
