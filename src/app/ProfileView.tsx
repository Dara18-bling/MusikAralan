import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import {
  linkWithCredential,
  onAuthStateChanged,
  PhoneAuthProvider,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  updatePhoneNumber,
  updateProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Btn, Card, Input, Label, Title } from "../ui";
import { Field } from "./Field";
import { LITURGICAL_PALETTES } from "./AppTypes";

interface ProfileViewProps {
  role: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export function ProfileView({
  role,
  name,
  primaryColor,
  secondaryColor,
}: ProfileViewProps) {
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
  const [selectedPalette, setSelectedPalette] = useState(
    () => LITURGICAL_PALETTES.find((palette) => palette.primary === primaryColor) ?? LITURGICAL_PALETTES[0]
  );
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    setSelectedPalette(
      LITURGICAL_PALETTES.find(
        (palette) => palette.primary === primaryColor && palette.secondary === secondaryColor
      ) ?? LITURGICAL_PALETTES[0]
    );
  }, [primaryColor, secondaryColor]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snapshot) => {
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
      })
      .catch((error) => console.error("Could not load admin profile:", error));
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
      await setDoc(
        doc(db, "settings", "appearance"),
        { primaryColor: selectedPalette.primary, secondaryColor: selectedPalette.secondary, paletteName: selectedPalette.name },
        { merge: true }
      );
      alert("System interface color saved for all users.");
    } catch (error) {
      console.error("Could not save system appearance:", error);
      const details = error as { code?: string; message?: string };
      alert(`Could not save the system color${details.code ? ` (${details.code})` : ""}: ${details.message || "Check Firestore access to settings/appearance."}`);
    }
    setColorSaving(false);
  };

  return (
    <>
      <Title kicker="Account Settings" title="My Profile" sub="Edit information and manage verifications." />
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
            <button
              type="button"
              onClick={sendEmailConfirmation}
              disabled={emailSending}
              className="w-fit rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-60 lg:col-span-2"
            >
              {emailSending
                ? "Sending confirmation..."
                : email.trim().toLowerCase() !== user?.email?.toLowerCase()
                  ? "Confirm email change"
                  : emailVerified
                    ? "Resend Gmail verification"
                    : "Send Gmail confirmation"}
            </button>
          )}
          {role === "admin" && (
            <>
              <Field label="Phone Number (international format)">
                <Input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerified(false); }} placeholder="+639171234567" />
              </Field>
              <p className="text-mute lg:self-center">
                {phoneVerified ? "SMS verification is linked to this account." : "Verify this number with an SMS one-time code."}
              </p>
              <div id="admin-phone-recaptcha" className="lg:col-span-2" />
              <button
                type="button"
                onClick={sendPhoneOtp}
                disabled={otpSending}
                className="w-fit rounded-full border border-line px-4 py-2 font-semibold disabled:opacity-60"
              >
                {otpSending ? "Sending code..." : "Send SMS OTP"}
              </button>
              {verificationId && (
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  <Input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6-digit SMS code" />
                  <button
                    type="button"
                    onClick={confirmPhoneOtp}
                    disabled={otpChecking}
                    className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {otpChecking ? "Verifying..." : "Verify phone"}
                  </button>
                </div>
              )}
              <div className="border-t border-line pt-4 lg:col-span-2">
                <Label>Liturgical color palette for all users</Label>
                <p className="mt-1 text-sm text-mute">Choose a season or feast palette. It updates the login and signup background and system gradients.</p>
                <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Liturgical color palette">
                  {LITURGICAL_PALETTES.map((palette) => (
                    <button
                      key={palette.name}
                      type="button"
                      role="radio"
                      aria-checked={selectedPalette.name === palette.name}
                      aria-label={palette.name}
                      title={palette.name}
                      onClick={() => setSelectedPalette(palette)}
                      className={`h-11 w-11 rounded-full bg-gradient-to-br ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p1 ${
                        selectedPalette.name === palette.name ? "ring-2 ring-p1" : "ring-1 ring-black/10"
                      }`}
                      style={{ backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedPalette.name}</span>
                  <button
                    type="button"
                    onClick={saveSystemColor}
                    disabled={colorSaving}
                    className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {colorSaving ? "Saving..." : "Save system color"}
                  </button>
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
                <p className={`flex w-fit items-center gap-2 rounded-lg p-2 font-semibold ${emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  <CircleCheck className="h-4 w-4" /> Email {emailVerified ? "verified" : "not verified"}
                </p>
                <p className={`flex w-fit items-center gap-2 rounded-lg p-2 font-semibold ${phoneVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  <CircleCheck className="h-4 w-4" /> Phone {phoneVerified ? "verified" : "not verified"}
                </p>
                <button type="button" onClick={refreshVerificationStatus} className="w-fit font-semibold text-p1 hover:underline">
                  Refresh verification status
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-green-600 mt-2 bg-green-50 p-2 rounded-lg w-fit font-semibold">
                <CircleCheck className="w-4 h-4" /> Account Verified
              </p>
            )}
          </div>
          <Btn className={`mt-4 w-fit ${role === "admin" ? "lg:col-span-2" : ""}`} onClick={saveProfile}>
            {profileSaving ? "Saving..." : "Save Changes"}
          </Btn>
        </div>
      </Card>
    </>
  );
}