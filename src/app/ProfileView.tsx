import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { apiGet, apiPatch, apiPut } from "../api";
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
  const [fullName, setFullName] = useState(name);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [accountStatus, setAccountStatus] = useState("approved");
  const [profileSaving, setProfileSaving] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(
    () => LITURGICAL_PALETTES.find((palette) => palette.primary === primaryColor) ?? LITURGICAL_PALETTES[0]
  );
  useEffect(() => {
    setSelectedPalette(
      LITURGICAL_PALETTES.find(
        (palette) => palette.primary === primaryColor && palette.secondary === secondaryColor
      ) ?? LITURGICAL_PALETTES[0]
    );
  }, [primaryColor, secondaryColor]);

  useEffect(() => {
    apiGet<{ user: {
      name?: string;
      email?: string;
      phoneNumber?: string;
      phoneVerified?: boolean;
      status?: string;
    } }>("/me")
      .then(({ user: data }) => {
        setFullName(data.name ?? name);
        setEmail(data.email ?? "");
        setPhone(data.phoneNumber ?? "");
        setPhoneVerified(Boolean(data.phoneVerified));
        setAccountStatus(data.status ?? "approved");
      })
      .catch((error) => console.error("Could not load profile:", error));
  }, [name]);

  const saveProfile = async () => {
    if (!fullName.trim()) return alert("Please enter your full name.");
    setProfileSaving(true);
    try {
      await apiPatch("/me", { name: fullName.trim() });
      if (phone.trim()) {
        const { user: updated } = await apiPatch<{ user: { phoneVerified?: boolean } }>("/me/phone", {
          phoneNumber: phone.trim(),
        });
        setPhoneVerified(Boolean(updated.phoneVerified));
      }
      localStorage.setItem("name", fullName.trim());
      alert("Profile information saved.");
    } catch (error) {
      console.error(error);
      alert("Could not save profile information.");
    }
    setProfileSaving(false);
  };

  const saveSystemColor = async () => {
    if (role !== "admin") return;
    setColorSaving(true);
    try {
      await apiPut("/settings/appearance", {
        primaryColor: selectedPalette.primary,
        secondaryColor: selectedPalette.secondary,
        paletteName: selectedPalette.name,
      });
      alert("System interface color saved for all users.");
    } catch (error) {
      console.error("Could not save system appearance:", error);
      const details = error as { code?: string; message?: string };
      alert(`Could not save the system color${details.code ? ` (${details.code})` : ""}: ${details.message || "Check the API and database connection."}`);
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
            <Input type="email" value={email} readOnly />
          </Field>
          {role === "admin" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-p1-soft p-4 text-base lg:col-span-2">
              <p><span className="font-semibold">Account role:</span> Administrator</p>
              <p><span className="font-semibold">Account status:</span> {accountStatus}</p>
            </div>
          )}
          {role === "admin" && (
            <>
              <Field label="Phone Number">
                <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09171234567" />
              </Field>
              <p className="text-mute lg:self-center">
                {phoneVerified ? "Phone number verified." : "Changing the number clears its verified status."}
              </p>
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
            <Label>Phone verification</Label>
            <p className={`mt-2 flex w-fit items-center gap-2 rounded-lg p-2 text-sm font-semibold ${phoneVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              <CircleCheck className="h-4 w-4" /> Phone {phoneVerified ? "verified" : "not verified"}
            </p>
            {role !== "admin" && (
              <p className="mt-2 text-sm text-mute">
                Email confirmation is handled by account recovery and is not currently required for access.
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