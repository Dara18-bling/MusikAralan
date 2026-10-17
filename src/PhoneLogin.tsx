
import { useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth } from "./firebase";

export default function PhoneLogin() {
  const [phone, setPhone] = useState("+63");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const recaptcha = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptcha.current?.clear();
      recaptcha.current = null;
    };
  }, []);

  async function sendCode() {
    setMessage("");

    // Use international format, e.g. +639171234567
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setMessage("Enter a valid phone number with country code.");
      return;
    }

    setLoading(true);

    try {
      if (!recaptcha.current) {
        recaptcha.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          { size: "normal" }
        );
      }

      const result = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        recaptcha.current
      );

      setConfirmation(result);
      setMessage("Verification code sent. Check your SMS.");
    } catch (error) {
      console.error("SMS error:", error);
      recaptcha.current?.clear();
      recaptcha.current = null;
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not send the verification code."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!confirmation) return;

    setMessage("");
    setLoading(true);

    try {
      await confirmation.confirm(code.trim());
      setMessage("Phone verified! You are now signed in.");
      // Firebase authentication is now complete.
      // Connect this to your existing app navigation/role logic.
    } catch (error) {
      console.error("Verification error:", error);
      setMessage("Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-ink">
        Phone Number Login
      </h2>

      {!confirmation ? (
        <>
          <label className="block text-sm font-medium">
            Phone number
          </label>

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+639171234567"
            className="w-full rounded-lg border border-line p-3"
          />

          <div id="recaptcha-container" />

          <button
            type="button"
            onClick={sendCode}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send SMS Code"}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Verification code
          </label>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter the SMS code"
            className="w-full rounded-lg border border-line p-3"
          />

          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || !code.trim()}
            className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmation(null);
              setCode("");
              setMessage("");
            }}
            className="w-full rounded-lg border border-line p-3"
          >
            Use another phone number
          </button>
        </>
      )}

      {message && (
        <p role="status" className="break-words text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
