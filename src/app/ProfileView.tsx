import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPatch, apiPost, apiPut, watchApi } from "../api";
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

interface ProfileDetails {
  name: string;
  email: string;
  birthday: string;
  phone: string;
  messengerLink: string;
}

interface PendingProfileEditRequest {
  id: string;
  changes: Record<string, string | null>;
  createdAt: string | null;
  status: "pending" | "approved" | "rejected";
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
  const [phone, setPhone] = useState("");
  const [messengerLink, setMessengerLink] = useState("");
  const [savedProfile, setSavedProfile] = useState<ProfileDetails | null>(null);
  const [pendingEditRequest, setPendingEditRequest] =
    useState<PendingProfileEditRequest | null>(null);
  const [accountStatus, setAccountStatus] = useState("approved");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [editRequestLoadError, setEditRequestLoadError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [selectedPalette, setSelectedPalette] =
    useState<LiturgicalPalette | null>(null);
  const handledEditRequest = useRef("");
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
        const profile = {
          name: data.name ?? name,
          email: data.email ?? "",
          birthday: data.birthday ?? "",
          phone: data.phoneNumber ?? "",
          messengerLink: data.messengerLink ?? "",
        };
        setFullName(profile.name);
        setEmail(profile.email);
        setBirthday(profile.birthday);
        setPhone(profile.phone);
        setMessengerLink(profile.messengerLink);
        setSavedProfile(profile);
        setAccountStatus(data.status ?? "approved");
      })
      .catch((error) => {
        console.error("Could not load profile:", error);
        setProfileLoadError("Could not load your profile. Refresh the page to try again.");
      });
    return watchApi<{ request: PendingProfileEditRequest | null }>(
      "/me/profile-edit-request",
      ({ request }) => {
        setEditRequestLoadError("");
        setPendingEditRequest(request);
        if (!request || request.status === "pending") return;
        const requestStatus = `${request.id}:${request.status}`;
        if (handledEditRequest.current === requestStatus) return;
        handledEditRequest.current = requestStatus;
        apiGet<{
          user: {
            name?: string;
            email?: string;
            birthday?: string | null;
            phoneNumber?: string;
            messengerLink?: string;
          };
        }>("/me")
          .then(({ user: data }) => {
            const profile = {
              name: data.name ?? name,
              email: data.email ?? "",
              birthday: data.birthday ?? "",
              phone: data.phoneNumber ?? "",
              messengerLink: data.messengerLink ?? "",
            };
            setFullName(profile.name);
            setEmail(profile.email);
            setBirthday(profile.birthday);
            setPhone(profile.phone);
            setMessengerLink(profile.messengerLink);
            setSavedProfile(profile);
            localStorage.setItem("name", profile.name);
          })
          .catch((error) => {
            console.error("Could not refresh reviewed profile:", error);
            toast.error("Your request was reviewed, but your profile could not be refreshed.");
          });
      },
      (error) => {
        console.error("Could not load pending profile edit request:", error);
        setEditRequestLoadError("Could not check the status of your profile edit request.");
      },
    );
  }, [name]);

  const saveProfile = async () => {
    if (!savedProfile) {
      toast.error("Your profile is still loading. Please try again shortly.");
      return;
    }
    if (!fullName.trim()) {
      toast.warning("Please enter your full name.");
      return;
    }
    setProfileSaving(true);
    try {
      const currentDetails = savedProfile;
      const proposedDetails = {
        name: fullName.trim(),
        email: email.trim(),
        birthday,
        phone: phone.trim(),
        messengerLink: messengerLink.trim(),
      };
      const changes: Record<string, string | null> = {};
      if (proposedDetails.name !== currentDetails.name) changes.name = proposedDetails.name;
      if (proposedDetails.email !== currentDetails.email) changes.email = proposedDetails.email;
      if (proposedDetails.birthday !== currentDetails.birthday) changes.birthday = proposedDetails.birthday || null;
      if (proposedDetails.phone !== currentDetails.phone) changes.phoneNumber = proposedDetails.phone || null;
      if (proposedDetails.messengerLink !== currentDetails.messengerLink) {
        changes.messengerLink = proposedDetails.messengerLink || null;
      }

      if (Object.keys(changes).length === 0) {
        toast.info("There are no profile changes to save.");
        return;
      }

      if (role === "admin") {
        const { user } = await apiPatch<{ user: { name: string; email: string; birthday: string | null; phoneNumber: string | null; messengerLink: string | null } }>("/me", {
          name: proposedDetails.name,
          email: proposedDetails.email,
          birthday: proposedDetails.birthday || null,
        });
        const { user: updatedUser } = await apiPatch<{ user: typeof user }>("/me/contact-details", {
          phoneNumber: proposedDetails.phone || null,
          messengerLink: proposedDetails.messengerLink || null,
        });
        const updatedProfile = {
          name: updatedUser.name,
          email: updatedUser.email,
          birthday: updatedUser.birthday || "",
          phone: updatedUser.phoneNumber || "",
          messengerLink: updatedUser.messengerLink || "",
        };
        setFullName(updatedProfile.name);
        setEmail(updatedProfile.email);
        setBirthday(updatedProfile.birthday);
        setPhone(updatedProfile.phone);
        setMessengerLink(updatedProfile.messengerLink);
        setSavedProfile(updatedProfile);
        localStorage.setItem("name", updatedProfile.name);
        toast.success("Profile information saved.");
      } else {
        const { request } = await apiPost<{ request: PendingProfileEditRequest }>(
          "/me/profile-edit-requests",
          changes,
        );
        setPendingEditRequest(request);
        toast.success("Your profile edit request was sent to the administrator for review.");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not save profile information.",
      );
    } finally {
      setProfileSaving(false);
    }
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
  const isPendingProfileRequest =
    role !== "admin" && pendingEditRequest?.status === "pending";

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
          {profileLoadError && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {profileLoadError}
            </p>
          )}
          {editRequestLoadError && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {editRequestLoadError}
            </p>
          )}
          {!savedProfile && !profileLoadError && (
            <p className="text-sm text-mute sm:col-span-2" role="status">
              Loading profile details…
            </p>
          )}
          <Field label="Full Name">
            <Input
              disabled={isPendingProfileRequest}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>
          <Field label="Email Address">
            <Input
              type="email"
              value={email}
              disabled={isPendingProfileRequest}
              onChange={(event) => setEmail(event.target.value)}
            />
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
              disabled={isPendingProfileRequest}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="09171234567"
            />
            <p className="mt-1 text-sm text-mute">For contact reference.</p>
          </Field>
          <Field label="Facebook Messenger Link">
            <Input
              type="url"
              value={messengerLink}
              disabled={isPendingProfileRequest}
              onChange={(event) => setMessengerLink(event.target.value)}
              placeholder="https://m.me/yourname"
            />
            <p className="mt-1 text-sm text-mute">For contact reference.</p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Birthday">
              <Input
                type="date"
                value={birthday}
                disabled={isPendingProfileRequest}
                max={formatLocalDate(today)}
                min="1920-01-01"
                onChange={(event) => setBirthday(event.target.value)}
              />
            </Field>
            <p className="pb-2 text-sm text-mute" aria-live="polite">
              Age: {age === null ? "Not available" : `${age} years`}
            </p>
          </div>
          {isPendingProfileRequest && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2"
            >
              <p className="font-semibold">Profile edit request pending review</p>
              <p className="mt-1">
                Your details will remain unchanged until an administrator reviews
                your request. Submitted{" "}
                {pendingEditRequest?.createdAt
                  ? new Date(pendingEditRequest.createdAt).toLocaleString()
                  : "recently"}.
              </p>
              <ul className="mt-2 list-inside list-disc">
                {Object.entries(pendingEditRequest?.changes || {}).map(([field, value]) => (
                  <li key={field}>
                    {field}: {value || "Not provided"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {role !== "admin" && pendingEditRequest?.status === "approved" && (
            <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800 sm:col-span-2">
              Your profile edit request was approved and the changes have been applied.
            </p>
          )}
          {role !== "admin" && pendingEditRequest?.status === "rejected" && (
            <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
              Your profile edit request was not approved. No changes were made to your account.
            </p>
          )}
          <Btn
            className={` w-fit ${role === "admin" ? "lg:col-span-2" : ""}`}
            onClick={saveProfile}
            disabled={profileSaving || isPendingProfileRequest || !savedProfile}
          >
            {profileSaving
              ? "Saving..."
              : isPendingProfileRequest
                ? "Request pending review"
                : role === "admin"
                  ? "Save Changes"
                  : "Submit edit request"}
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
