import { useAuth } from "@/_core/hooks/useAuth";
import { ProfileAvatar, UserProfileBadge, getFirstName } from "@/components/ProfileAvatar";
import LanguageSelector from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localeOptions, useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { VictimNavigation } from "@/pages/Home";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  HeartPulse,
  Languages,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

const ASSAM_DISTRICTS = [
  "Kamrup Metropolitan",
  "Kamrup",
  "Cachar",
  "Dibrugarh",
  "Jorhat",
  "Nagaon",
  "Sonitpur",
  "Barpeta",
  "Dhubri",
  "Goalpara",
  "Golaghat",
  "Hailakandi",
  "Hojai",
  "Karimganj",
  "Kokrajhar",
  "Lakhimpur",
  "Majuli",
  "Morigaon",
  "Nalbari",
  "Sivasagar",
  "Tinsukia",
  "Baksa",
  "Biswanath",
  "Charaideo",
  "Chirang",
  "Darrang",
  "Dhemaji",
  "Dima Hasao",
  "Karbi Anglong",
  "South Salmara-Mankachar",
  "Tamulpur",
  "Udalguri",
  "West Karbi Anglong",
  "Bajali",
];

const BLOOD_GROUPS = ["Not specified", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const RELATION_OPTIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Relative",
  "Neighbor",
  "Doctor",
  "Friend",
  "Other",
];

export default function UserProfile() {
  const { user, updateProfile, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Basic Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [emergencyContact, setEmergencyContact] = useState((user as any)?.emergencyContact || "");
  const [bloodGroup, setBloodGroup] = useState((user as any)?.bloodGroup || "Not specified");
  const [medicalNotes, setMedicalNotes] = useState((user as any)?.medicalNotes || "");
  const [homeDistrict, setHomeDistrict] = useState((user as any)?.homeDistrict || "Kamrup Metropolitan");
  const [address, setAddress] = useState((user as any)?.address || "");
  const [preferredLanguage, setPreferredLanguage] = useState((user as any)?.preferredLanguage || "en");
  const [safetyNotifications, setSafetyNotifications] = useState<boolean>(
    (user as any)?.safetyNotifications !== undefined ? Boolean((user as any)?.safetyNotifications) : true
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Emergency Contacts State
  const contactsQuery = trpc.auth.emergencyContacts.list.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const [showAddContact, setShowAddContact] = useState(false);
  const [cName, setCName] = useState("");
  const [cRelation, setCRelation] = useState("Spouse");
  const [cPhone, setCPhone] = useState("");
  const [cAltPhone, setCAltPhone] = useState("");
  const [cIsPrimary, setCIsPrimary] = useState(false);
  const [cNotes, setCNotes] = useState("");
  const [contactError, setContactError] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  const upsertContactMutation = trpc.auth.emergencyContacts.upsert.useMutation({
    onSuccess: async () => {
      await utils.auth.emergencyContacts.list.invalidate();
      setShowAddContact(false);
      setCName("");
      setCPhone("");
      setCAltPhone("");
      setCNotes("");
      setCIsPrimary(false);
      setContactError("");
    },
    onError: (err) => {
      setContactError(err.message || t("Failed to save emergency contact."));
    },
  });

  const deleteContactMutation = trpc.auth.emergencyContacts.delete.useMutation({
    onSuccess: async () => {
      await utils.auth.emergencyContacts.list.invalidate();
    },
  });

  // Sync initial user fields when loaded
  useEffect(() => {
    if (user) {
      if (user.name && !name) setName(user.name);
      if ((user as any).phone && !phone) setPhone((user as any).phone);
      if ((user as any).emergencyContact && !emergencyContact) setEmergencyContact((user as any).emergencyContact);
      if ((user as any).bloodGroup && bloodGroup === "Not specified") setBloodGroup((user as any).bloodGroup);
      if ((user as any).medicalNotes && !medicalNotes) setMedicalNotes((user as any).medicalNotes);
      if ((user as any).homeDistrict && !homeDistrict) setHomeDistrict((user as any).homeDistrict);
      if ((user as any).address && !address) setAddress((user as any).address);
      if ((user as any).preferredLanguage && !preferredLanguage) setPreferredLanguage((user as any).preferredLanguage);
    }
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!updateProfile) return;

    setIsSaving(true);
    setErrorMessage("");
    setSaveSuccess(false);

    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        bloodGroup: bloodGroup !== "Not specified" ? bloodGroup : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        homeDistrict: homeDistrict || undefined,
        address: address.trim() || undefined,
        preferredLanguage: preferredLanguage || undefined,
        safetyNotifications,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || t("Failed to update profile. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEmergencyContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim()) {
      setContactError(t("Contact name and phone number are required."));
      return;
    }

    setIsSavingContact(true);
    setContactError("");
    try {
      await upsertContactMutation.mutateAsync({
        name: cName.trim(),
        relation: cRelation,
        phone: cPhone.trim(),
        alternatePhone: cAltPhone.trim() || undefined,
        isPrimary: cIsPrimary ? "yes" : "no",
        notes: cNotes.trim() || undefined,
      });
    } catch {
      // Handled in onError
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (confirm(t("Remove this emergency contact?"))) {
      await deleteContactMutation.mutateAsync({ id });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/login");
    } catch {
      setLocation("/login");
    }
  };

  const roleLabel =
    user?.role === "admin"
      ? t("Superadmin")
      : user?.role === "rescuer"
      ? t("Verified Rescuer")
      : user?.role === "medical"
      ? t("Medical Officer")
      : t("Verified Citizen");

  const savedContacts = contactsQuery.data || [];

  return (
    <div className="victim-page min-h-screen bg-background text-foreground transition-colors overflow-x-hidden">
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-28 pt-4">
        {/* Top Header */}
        <header className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/more")}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted/60 text-foreground transition active:scale-95 hover:bg-muted"
              aria-label={t("Back to More")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                {t("Citizen Safety Profile")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("Emergency Dispatch & Medical Evacuation Credentials")}
              </p>
            </div>
          </div>
          <LanguageSelector compact />
        </header>

        {/* User Institutional Profile Card */}
        <section className="mb-5 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                user={{
                  name: name || user?.name,
                  email: user?.email,
                  photoUrl: (user as any)?.photoUrl,
                  avatarUrl: (user as any)?.avatarUrl,
                  role: user?.role,
                }}
                size="xl"
              />
              <div>
                <p className="text-lg font-bold leading-tight text-foreground">
                  {getFirstName(name || user?.name, user?.email, t("Citizen"))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{user?.email || t("Account verified")}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs font-semibold">
              <p className="font-bold">{t("Profile updated successfully!")}</p>
              <p className="text-[11px] opacity-90">{t("Your customized rescue details have been securely synchronized to the database.")}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-900 dark:text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-xs font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* Section 1: Emergency Contacts Shared with Admin, Rescuer & Hospital */}
        <section className="mb-5 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {t("Emergency Contacts & Next-of-Kin")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddContact(!showAddContact)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              {showAddContact ? t("Close") : t("Add Contact")}
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {t("Contacts saved here are automatically provided to Command Center dispatchers, field rescue teams, and emergency clinical staff during an active SOS.")}
          </p>

          {/* Add Contact Form Accordion */}
          {showAddContact && (
            <form onSubmit={handleAddEmergencyContact} className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("New Emergency Contact")}
              </p>

              {contactError && (
                <div className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs font-semibold text-red-700 dark:text-red-300 border border-red-500/20">
                  {contactError}
                </div>
              )}

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("Contact Name *")}</Label>
                    <Input
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder={t("Full name")}
                      required
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("Relationship *")}</Label>
                    <select
                      value={cRelation}
                      onChange={(e) => setCRelation(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground"
                    >
                      {RELATION_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {t(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("Primary Phone *")}</Label>
                    <Input
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      placeholder={t("+91 94350 12345")}
                      required
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("Alternate Phone")}</Label>
                    <Input
                      value={cAltPhone}
                      onChange={(e) => setCAltPhone(e.target.value)}
                      placeholder={t("Optional phone")}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground">{t("Notes / Location Details")}</Label>
                  <Input
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    placeholder={t("e.g. Has 2nd floor shelter and boat access")}
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPrimaryContact"
                    checked={cIsPrimary}
                    onChange={(e) => setCIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <Label htmlFor="isPrimaryContact" className="cursor-pointer text-xs font-medium text-foreground">
                    {t("Set as Primary Next-of-Kin")}
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingContact}
                  className="w-full gap-2 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  {isSavingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("Save Emergency Contact")}
                </Button>
              </div>
            </form>
          )}

          {/* Existing Contacts List */}
          <div className="mt-4 space-y-2.5">
            {contactsQuery.isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : savedContacts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {t("No emergency contacts registered yet. Tap Add Contact above to configure next-of-kin.")}
              </div>
            ) : (
              savedContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{contact.name}</span>
                      <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                        {t(contact.relation)}
                      </span>
                      {contact.isPrimary === "yes" && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <Star className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" />
                          {t("Primary")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-foreground">
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {contact.phone}
                      </a>
                      {contact.alternatePhone && (
                        <a href={`tel:${contact.alternatePhone}`} className="flex items-center gap-1 text-muted-foreground hover:underline">
                          <PhoneCall className="h-3 w-3" />
                          {contact.alternatePhone}
                        </a>
                      )}
                    </div>
                    {contact.notes && <p className="text-[11px] text-muted-foreground">{contact.notes}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:hover:bg-rose-950/40"
                    title={t("Delete contact")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Profile Customization Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Section 2: Identity & Contact */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {t("Personal Identity & Contact Information")}
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-name" className="text-xs font-medium text-foreground">
                  {t("Full Name / Display Name")}
                </Label>
                <Input
                  id="prof-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("e.g. Rahul Sharma")}
                  required
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="prof-email" className="text-xs font-medium text-foreground">
                  {t("Email Address")}
                </Label>
                <Input
                  id="prof-email"
                  value={user?.email || ""}
                  disabled
                  className="mt-1 cursor-not-allowed text-xs opacity-70"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t("Primary login address (locked).")}</p>
              </div>

              <div>
                <Label htmlFor="prof-phone" className="text-xs font-medium text-foreground">
                  {t("Primary Citizen Phone Number")}
                </Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </span>
                  <Input
                    id="prof-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("+91 98640 12345")}
                    className="pl-9 text-xs"
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{t("Direct citizen contact number for rescue operations.")}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Health & Emergency Profile */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <HeartPulse className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {t("Medical Notes & Special Evacuation Needs")}
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-blood" className="text-xs font-medium text-foreground">
                  {t("Blood Group")}
                </Label>
                <select
                  id="prof-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg === "Not specified" ? t("Not specified") : bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="prof-med" className="text-xs font-medium text-foreground">
                  {t("Medical Conditions & Evacuation Logistics")}
                </Label>
                <Textarea
                  id="prof-med"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder={t("e.g. Diabetic requiring insulin refrigeration, wheelchair user, elderly family members requiring boat assistance...")}
                  rows={3}
                  className="mt-1 text-xs"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("Shared confidentially with hospital medical responders and boat dispatch units.")}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Location & Region */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {t("Jurisdiction, District & Locality")}
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-district" className="text-xs font-medium text-foreground">
                  {t("State & District")}
                </Label>
                <select
                  id="prof-district"
                  value={homeDistrict}
                  onChange={(e) => setHomeDistrict(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground"
                >
                  {ASSAM_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {t(dist)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("Configures default weather forecast & local environmental alerts for your area.")}
                </p>
              </div>

              <div>
                <Label htmlFor="prof-address" className="text-xs font-medium text-foreground">
                  {t("Home Address / Locality / Ward")}
                </Label>
                <Input
                  id="prof-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("e.g. Sector 4, Civil Lines")}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Preferences & Notifications */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {t("Language & Emergency Notifications")}
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-lang" className="text-xs font-medium text-foreground">
                  {t("Preferred Language")}
                </Label>
                <select
                  id="prof-lang"
                  data-no-operational-translation="true"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground"
                >
                  {localeOptions.map((l) => (
                    <option key={l.code} value={l.code} data-no-operational-translation="true">
                      {l.nativeLabel} ({l.label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-muted/60 text-foreground">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{t("Emergency Broadcasts")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("Receive red alert warnings & flood advisories")}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={safetyNotifications}
                  onChange={(e) => setSafetyNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-neutral-900 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full gap-2 rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.99]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("Saving Changes…")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("Save Profile Changes")}
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              {t("Sign Out of Account")}
            </button>
          </div>
        </form>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}
