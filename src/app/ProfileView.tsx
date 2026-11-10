import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiPatch, apiPost, apiPut } from "../api";
import { Btn, Card, Input, Label, Title } from "../ui";
import { Field } from "./Field";
import type { LiturgicalPalette } from "./AppTypes";
import { formatPhilippineDate, formatPhilippineDateTime, getPhilippineDateParts } from "../utils/dateTime";

function calculateAge(birthday: string): number | null {
  const [year, month, day] = birthday.split("-").map(Number);
  if (!year || !month || !day) return null;
  const today = getPhilippineDateParts();
  let age = today.year - year;
  if (
    today.month < month ||
    (today.month === month && today.day < day)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

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

interface ProfileChangeForm {
  name: string;
  birthday: string;
  phoneNumber: string;
  messengerLink: string;
}

export function ProfileView({
  role,
  name,
  primaryColor,
  secondaryColor,
  palettes,
  onAppearanceSaved,
}: ProfileViewProps) {
  const [fullName, setFullName] = useState(name);
  const [savedFullName, setSavedFullName] = useState(name);
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [savedBirthday, setSavedBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [messengerLink, setMessengerLink] = useState("");
  const [savedMessengerLink, setSavedMessengerLink] = useState("");
  const [accountStatus, setAccountStatus] = useState("approved");
  const [accountRole, setAccountRole] = useState(role);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [changeFormOpen, setChangeFormOpen] = useState(false);
  const [confirmProfileSubmit, setConfirmProfileSubmit] = useState(false);
  const [changeFormSaving, setChangeFormSaving] = useState(false);
  const [changeRequestStatus, setChangeRequestStatus] = useState("");
  const [changeRequestSubmittedAt, setChangeRequestSubmittedAt] = useState("");
  const [changeRequestNote, setChangeRequestNote] = useState("");
  const [changeForm, setChangeForm] = useState<ProfileChangeForm>({
    name: "", birthday: "", phoneNumber: "", messengerLink: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState<LiturgicalPalette | null>(null);
  const messengerUrl = /^https?:\/\//i.test(messengerLink) ? messengerLink : "";
  const age = birthday ? calculateAge(birthday) : null;
  useEffect(() => {
    setSelectedPalette(
      palettes.find(
        (palette) => palette.primary === primaryColor && palette.secondary === secondaryColor
      ) ?? null
    );
  }, [palettes, primaryColor, secondaryColor]);

  useEffect(() => {
    apiGet<{ user: {
      name?: string;
      email?: string;
      birthday?: string | null;
      phoneNumber?: string;
      messengerLink?: string | null;
      role?: string;
      status?: string;
    } }>("/me")
      .then(({ user: data }) => {
        setFullName(data.name ?? name);
        setSavedFullName(data.name ?? name);
        setEmail(data.email ?? "");
        setBirthday(data.birthday ?? "");
        setSavedBirthday(data.birthday ?? "");
        setPhone(data.phoneNumber ?? "");
        setSavedPhone(data.phoneNumber ?? "");
        setMessengerLink(data.messengerLink ?? "");
        setSavedMessengerLink(data.messengerLink ?? "");
        setAccountStatus(data.status ?? "approved");
        setAccountRole(data.role ?? role);
        setChangeForm({
          name: data.name ?? name,
          birthday: data.birthday ?? "",
          phoneNumber: data.phoneNumber ?? "",
          messengerLink: data.messengerLink ?? "",
        });
      })
      .catch((error) => console.error("Could not load profile:", error));
    if (role !== "admin") {
      apiGet<{ request: { status: string; submittedAt?: string; reviewNote?: string | null } | null }>("/me/profile-change-request")
        .then(({ request: latest }) => {
          setChangeRequestStatus(latest?.status || "");
          setChangeRequestSubmittedAt(latest?.submittedAt || "");
          setChangeRequestNote(latest?.reviewNote || "");
        })
        .catch((error) => console.error("Could not load profile change request:", error));
    }
  }, [name, role]);

  const openChangeForm = () => {
    setChangeForm({ name: fullName, birthday, phoneNumber: phone, messengerLink });
    setChangeFormOpen(true);
  };

  const submitProfileChangeRequest = async () => {
    setChangeFormSaving(true);
    try {
      const { request } = await apiPost<{ request: { status: string } }>("/me/profile-change-request", {
        ...changeForm,
        name: changeForm.name.trim(),
        phoneNumber: changeForm.phoneNumber.trim(),
        messengerLink: changeForm.messengerLink.trim() || null,
      });
      setChangeRequestStatus(request.status);
      setChangeRequestSubmittedAt(new Date().toISOString());
      setChangeRequestNote("");
      setConfirmProfileSubmit(false);
      setChangeFormOpen(false);
      toast.success("Your profile change request was sent to the admin.");
    } catch (error) {
      console.error("Could not submit profile change request:", error);
      toast.error(error instanceof Error ? error.message : "Could not submit your request.");
    } finally {
      setChangeFormSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    setFullName(savedFullName);
    setBirthday(savedBirthday);
    setPhone(savedPhone);
    setMessengerLink(savedMessengerLink);
    setIsEditingProfile(false);
  };

  const saveProfile = async () => {
    const nextName = fullName.trim();
    if (!nextName) {
      toast.warning("Please enter your full name.");
      return;
    }
    setProfileSaving(true);
    try {
      const { user: updated } = await apiPatch<{ user: {
        name: string;
        birthday: string | null;
        phoneNumber: string | null;
        messengerLink: string | null;
      } }>("/me", {
        name: nextName,
        birthday: birthday || null,
        phoneNumber: phone.trim() || null,
        messengerLink: messengerLink.trim() || null,
      });
      setFullName(updated.name);
      setSavedFullName(updated.name);
      setBirthday(updated.birthday || "");
      setSavedBirthday(updated.birthday || "");
      setPhone(updated.phoneNumber || "");
      setSavedPhone(updated.phoneNumber || "");
      setMessengerLink(updated.messengerLink || "");
      setSavedMessengerLink(updated.messengerLink || "");
      localStorage.setItem("name", updated.name);
      setIsEditingProfile(false);
      toast.success("Profile information saved.");
    } catch (error) {
      console.error("Could not save profile information:", error);
      toast.error(error instanceof Error ? error.message : "Could not save profile information.");
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== passwordConfirmation) {
      toast.warning("The new passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { message } = await apiPatch<{ message: string }>("/me/password", {
        currentPassword,
        password: newPassword,
        password_confirmation: passwordConfirmation,
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      toast.success(message);
    } catch (error) {
      console.error("Could not change password:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not change the password.",
      );
    } finally {
      setPasswordSaving(false);
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
      toast.error(`Could not save the system color${details.code ? ` (${details.code})` : ""}: ${details.message || "Check the API and database connection."}`);
    }
    setColorSaving(false);
  };

  return (
    <>
      <Title
        kicker="Account Settings"
        title="My Profile"
        sub="View your account information and manage your security settings."
      />
      <Card className="mt-5 w-full max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>Account information</Label>
          {role === "admin" && isEditingProfile ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={cancelProfileEdit} disabled={profileSaving} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-p1-soft disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => void saveProfile()} disabled={profileSaving} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : role === "admin" ? (
            <button type="button" onClick={() => setIsEditingProfile(true)} className="rounded-full border border-[var(--p1)] px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-p1-soft">
              Edit
            </button>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Full name", fullName],
            ["Email address", email],
            ["Birthday", birthday ? formatPhilippineDate(birthday) : "Not provided"],
            ["Age", age === null ? "Not available" : `${age} years old`],
            ["Phone number", phone],
            ["Messenger link", messengerLink],
            ["Account role", accountRole],
            ["Account status", accountStatus],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl border border-line bg-p1-soft/30 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</dt>
              <dd className="mt-2 break-words text-sm font-medium text-ink">
                {role === "admin" && isEditingProfile && label === "Full name" ? (
                  <Input
                    aria-label="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                ) : role === "admin" && isEditingProfile && label === "Birthday" ? (
                  <Input aria-label="Birthday" type="date" min="1920-01-01" max="2021-12-31" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
                ) : role === "admin" && isEditingProfile && label === "Phone number" ? (
                  <Input
                    aria-label="Phone number"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                ) : role === "admin" && isEditingProfile && label === "Messenger link" ? (
                  <Input aria-label="Messenger link" type="url" value={messengerLink} onChange={(event) => setMessengerLink(event.target.value)} placeholder="Optional" />
                ) : label === "Messenger link" && messengerUrl ? (
                  <a href={messengerUrl} target="_blank" rel="noreferrer" className="text-p1 underline underline-offset-2">{value || "Not provided"}</a>
                ) : value || "Not provided"}
              </dd>
            </div>
          ))}
        </dl>
        {role !== "admin" && (
          <div className="mt-5 border-t border-line pt-4">
            {changeRequestStatus && (
              <p className="mb-3 text-sm text-mute">
                Latest request: <span className="font-semibold capitalize">{changeRequestStatus}</span>
                {changeRequestSubmittedAt && ` · ${formatPhilippineDateTime(changeRequestSubmittedAt)}`}
                {changeRequestNote && ` · ${changeRequestNote}`}
              </p>
            )}
            <button
              type="button"
              onClick={openChangeForm}
              disabled={changeRequestStatus === "pending"}
              className="rounded-full border border-[var(--p1)] px-4 py-2 text-sm font-semibold text-p1 transition hover:bg-p1-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              Edit information
            </button>
            {changeRequestStatus === "pending" && <span className="ml-3 text-sm text-mute">A request is awaiting admin review.</span>}
          </div>
        )}
      </Card>
      {changeFormOpen && role !== "admin" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-3 sm:p-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setChangeFormOpen(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="profile-change-title" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-4 shadow-2xl sm:p-7">
            <h2 id="profile-change-title" className="font-display text-2xl font-bold">Request profile information change</h2>
            <p className="mt-2 text-sm text-mute">Submit your updated details for admin review. Your profile changes after the request is approved.</p>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setConfirmProfileSubmit(true); }}>
              <Field label="Full Name (optional)">
                <Input maxLength={255} autoComplete="name" value={changeForm.name} onChange={(event) => setChangeForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Birthday (optional)">
                <Input type="date" min="1920-01-01" max="2021-12-31" value={changeForm.birthday} onChange={(event) => setChangeForm((current) => ({ ...current, birthday: event.target.value }))} />
              </Field>
              <Field label="Phone Number (optional)">
                <Input type="tel" inputMode="numeric" minLength={11} maxLength={11} pattern="[0-9]{11}" autoComplete="tel" value={changeForm.phoneNumber} onChange={(event) => setChangeForm((current) => ({ ...current, phoneNumber: event.target.value.replace(/\D/g, "") }))} />
              </Field>
              <Field label="Messenger Link (optional)">
                <Input type="url" autoComplete="url" placeholder="https://m.me/your.name" value={changeForm.messengerLink} onChange={(event) => setChangeForm((current) => ({ ...current, messengerLink: event.target.value }))} />
              </Field>
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setChangeFormOpen(false)} disabled={changeFormSaving} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-p1-soft disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={changeFormSaving} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {changeFormSaving ? "Submitting…" : "Submit request to admin"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {confirmProfileSubmit && role !== "admin" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !changeFormSaving) setConfirmProfileSubmit(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-profile-submit-title" className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl">
            <h2 id="confirm-profile-submit-title" className="font-display text-xl font-bold">Send this request to the admin?</h2>
            <p className="mt-2 text-sm text-mute">The admin will review the profile changes you entered. You can cancel and make edits before sending.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmProfileSubmit(false)} disabled={changeFormSaving} className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-p1-soft disabled:opacity-50">Go back</button>
              <button type="button" onClick={() => void submitProfileChangeRequest()} disabled={changeFormSaving} className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{changeFormSaving ? "Sending…" : "Yes, send request"}</button>
            </div>
          </section>
        </div>
      )}
      {role === "admin" && (
        <Card className="mt-5 w-full max-w-none">
          <Label>Liturgical color palette for all users</Label>
          <p className="mt-1 text-sm text-mute">Choose a season or feast palette. It updates the login and signup background and system gradients.</p>
          <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Liturgical color palette">
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
                  selectedPalette?.name === palette.name ? "ring-2 ring-p1" : "ring-1 ring-black/10"
                }`}
                style={{ backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})` }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selectedPalette?.name || (palettes.length ? "Select a palette" : "No palettes are configured")}
            </span>
            <button
              type="button"
              onClick={saveSystemColor}
              disabled={colorSaving || !selectedPalette}
              className="grad rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {colorSaving ? "Saving..." : "Save system color"}
            </button>
          </div>
        </Card>
      )}
      <Card className="mt-5 w-full max-w-none">
        <Label>Change password</Label>
        <p className="mt-1 text-sm text-mute">
          Use at least 8 characters, including a letter, a number, and a special character.
        </p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void changePassword(event)}>
          <Field label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <span aria-hidden="true" className="hidden sm:block" />
          <Field label="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Btn className="w-fit sm:col-span-2" disabled={passwordSaving}>
            {passwordSaving ? "Changing password..." : "Change password"}
          </Btn>
        </form>
      </Card>
    </>
  );
}
