import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPatch, apiPost, apiPut } from "../api";
import { Btn, Card, Input, Label, Title } from "../ui";
import { Field } from "./Field";
import type { LiturgicalPalette } from "./AppTypes";

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

interface ProfileViewProps {
  role: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  palettes: LiturgicalPalette[];
  onAppearanceSaved: (appearance: {
    primaryColor: string;
    secondaryColor: string;
    palettes?: LiturgicalPalette[];
  }) => void;
}

export function ProfileView({
  role,
  name,
  primaryColor,
  secondaryColor,
  palettes,
  onAppearanceSaved,
}: ProfileViewProps) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(name);
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [savedBirthday, setSavedBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [messengerLink, setMessengerLink] = useState("");
  const [accountStatus, setAccountStatus] = useState("approved");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedPalette, setSelectedPalette] =
    useState<LiturgicalPalette | null>(null);
  useEffect(() => {
    setSelectedPalette(
      palettes.find(
        (palette) =>
          palette.primary === primaryColor &&
          palette.secondary === secondaryColor,
      ) ?? null,
    );
  }, [palettes, primaryColor, secondaryColor]);

  useEffect(() => {
    apiGet<{
      user: {
        name?: string;
        email?: string;
        birthday?: string | null;
        phoneNumber?: string;
        messengerLink?: string;
        status?: string;
      };
    }>("/me")
      .then(({ user: data }) => {
        setFullName(data.name ?? name);
        setEmail(data.email ?? "");
        setBirthday(data.birthday ?? "");
        setSavedBirthday(data.birthday ?? "");
        setPhone(data.phoneNumber ?? "");
        setMessengerLink(data.messengerLink ?? "");
        setAccountStatus(data.status ?? "approved");
      })
      .catch((error) => console.error("Could not load profile:", error));
  }, [name]);

  const saveProfile = async () => {
    if (!fullName.trim()) {
      toast.warning("Please enter your full name.");
      return;
    }
    setProfileSaving(true);
    try {
      await apiPatch("/me", {
        name: fullName.trim(),
        ...(birthday !== savedBirthday
          ? { birthday: birthday || null }
          : {}),
      });
      await apiPatch("/me/contact-details", {
        phoneNumber: phone.trim() || null,
        messengerLink: messengerLink.trim() || null,
      });
      localStorage.setItem("name", fullName.trim());
      setSavedBirthday(birthday);
      toast.success("Profile information saved.");
    } catch (error) {
      console.error(error);
      toast.error("Could not save profile information.");
    }
    setProfileSaving(false);
  };

  const today = new Date();
  const age = (() => {
    if (!birthday) return null;
    const [year, month, day] = birthday.split("-").map(Number);
    if (!year || !month || !day) return null;
    return (
      today.getFullYear() -
      year -
      (today.getMonth() + 1 < month ||
      (today.getMonth() + 1 === month && today.getDate() < day)
        ? 1
        : 0)
    );
  })();

  const sendPasswordResetInstructions = async () => {
    setPasswordResetSending(true);
    try {
      await apiPost("/me/password-reset-code");
      navigate("/forgot-password", {
        state: { email, profileReset: true },
      });
    } catch (error) {
      console.error("Could not send password reset instructions:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send password reset instructions.",
      );
    } finally {
      setPasswordResetSending(false);
    }
  };

  const saveSystemColor = async () => {
    if (role !== "admin") return;
    setColorSaving(true);
    try {
      const { appearance } = await apiPut<{
        appearance: {
          primaryColor: string;
          secondaryColor: string;
          palettes?: LiturgicalPalette[];
        };
      }>("/settings/appearance", {
        primaryColor: selectedPalette?.primary,
        secondaryColor: selectedPalette?.secondary,
        paletteName: selectedPalette?.name,
      });
      onAppearanceSaved(appearance);
      toast.success("System interface color saved for all users.");
    } catch (error) {
      console.error("Could not save system appearance:", error);
      const details = error as { code?: string; message?: string };
      toast.error(
        `Could not save the system color${details.code ? ` (${details.code})` : ""}: ${details.message || "Check the API and database connection."}`,
      );
    }
    setColorSaving(false);
  };

  return (
    <>
      <Title
        kicker="Account Settings"
        title="My Profile"
        sub="Edit your account information."
      />
      <Card
        className={`mt-5 w-full ${role === "admin" ? "max-w-none [&_button]:text-base [&_input]:text-base [&_label>span]:text-base [&_p]:text-base" : "max-w-xl"}`}
      >
        <div
          className={`grid gap-4 ${role === "admin" ? "lg:grid-cols-2" : ""}`}
        >
          <Field label="Full Name">
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>
          <Field label="Email Address">
            <Input type="email" value={email} readOnly />
          </Field>
          {role === "admin" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-p1-soft p-4 text-base lg:col-span-2">
              <p>
                <span className="font-semibold">Account role:</span>{" "}
                Administrator
              </p>
              <p>
                <span className="font-semibold">Account status:</span>{" "}
                {accountStatus}
              </p>
            </div>
          )}
          <Field label="Contact Number">
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="09171234567"
            />
            <p className="mt-1 text-sm text-mute">For contact reference.</p>
          </Field>
          <Field label="Facebook Messenger Link">
            <Input
              type="url"
              value={messengerLink}
              onChange={(event) => setMessengerLink(event.target.value)}
              placeholder="https://m.me/yourname"
            />
            <p className="mt-1 text-sm text-mute">For contact reference.</p>
          </Field>

          {role !== "admin" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Birthday">
                <Input
                  type="date"
                  value={birthday}
                  max={formatLocalDate(today)}
                  min="1920-01-01"
                  onChange={(event) => setBirthday(event.target.value)}
                />
              </Field>
              <p className="pb-2 text-sm text-mute" aria-live="polite">
                Age: {age === null ? "Not available" : `${age} years`}
              </p>
            </div>
          )}
          <Btn
            className={` w-fit ${role === "admin" ? "lg:col-span-2" : ""}`}
            onClick={saveProfile}
          >
            {profileSaving ? "Saving..." : "Save Changes"}
          </Btn>
          {role === "admin" && (
            <>
              <div className="border-t border-line pt-4 lg:col-span-2">
                <Label>Liturgical color palette for all users</Label>
                <p className="mt-1 text-sm text-mute">
                  Choose a season or feast palette. It updates the login and
                  signup background and system gradients.
                </p>
                <div
                  className="mt-3 flex flex-wrap gap-3"
                  role="radiogroup"
                  aria-label="Liturgical color palette"
                >
                  {palettes.map((palette) => (
                    <button
                      key={palette.name}
                      type="button"
                      role="radio"
                      aria-checked={selectedPalette?.name === palette.name}
                      aria-label={palette.name}
                      title={palette.name}
                      onClick={() => setSelectedPalette(palette)}
                      className={`h-11 w-11 rounded-full bg-gradient-to-br ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p1 ${
                        selectedPalette?.name === palette.name
                          ? "ring-2 ring-p1"
                          : "ring-1 ring-black/10"
                      }`}
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveSystemColor}
                    disabled={colorSaving || !selectedPalette}
                    className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {colorSaving ? "Saving..." : "Save system color"}
                  </button>
                  <span className="text-sm font-medium">
                    {selectedPalette?.name ||
                      (palettes.length
                        ? "Select a palette"
                        : "No palettes are configured")}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
      <Card
        className={`mt-5 w-full ${role === "admin" ? "max-w-none" : "max-w-xl"}`}
      >
        <Label>Change password</Label>
        <p className="mt-1 text-sm text-mute">
          We will email a verification code and password reset instructions to{" "}
          {email || "your account email"}.
        </p>
        <Btn
          className="mt-4 w-fit"
          disabled={passwordResetSending || !email}
          onClick={() => void sendPasswordResetInstructions()}
        >
          {passwordResetSending ? "Sending instructions..." : "Email reset instructions"}
        </Btn>
      </Card>
    </>
  );
}
