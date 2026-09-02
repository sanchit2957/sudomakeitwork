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
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  User,
  UserCheck,
  UserPlus,
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
    <div className="victim-page min-h-screen bg-[#f6f8f7] text-[#122824] transition-colors dark:bg-[#090a0a] dark:text-[#f3f4f6]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 transition-colors dark:bg-[#111214] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border dark:md:border-white/10">
        {/* Top Header */}
        <header className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/more")}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-black/5 bg-white text-[#122824] shadow-sm transition hover:bg-[#f0f4f3] active:scale-95 dark:border-white/10 dark:bg-[#1a1b1e] dark:text-white dark:hover:bg-[#232428]"
              aria-label={t("Back to More")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#122824] dark:text-white">{t("Profile Customization")}</h1>
              <p className="text-[11px] font-bold text-[#6b8780] dark:text-[#90a4a0]">{t("Personal & emergency rescue details")}</p>
            </div>
          </div>
          <LanguageSelector compact />
        </header>

        {/* User Hero Banner */}
        <section className="mt-4 rounded-[1.8rem] bg-gradient-to-br from-[#174e46] via-[#1b5850] to-[#0f3832] p-5 text-white shadow-[0_12px_28px_rgba(23,78,70,0.18)] ring-1 ring-white/10">
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
                className="ring-2 ring-white/30"
              />
              <div>
                <p className="text-lg font-black leading-tight text-white">{getFirstName(name || user?.name, user?.email, t("Citizen"))}</p>
                <p className="mt-0.5 text-xs text-[#c2e2db]">{user?.email || t("Account verified")}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#e6f7f3]">
                  <ShieldCheck className="h-3 w-3 text-[#5eead4]" />
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs font-semibold">
              <p className="font-bold">{t("Profile updated successfully!")}</p>
              <p className="text-[11px] opacity-90">{t("Your customized rescue details have been securely synchronized to the database.")}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-xs font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* Section 1: Emergency Contacts Shared with Admin, Rescuer & Hospital */}
        <section className="mt-5 rounded-[1.6rem] border border-amber-500/20 bg-amber-50/40 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-3 dark:border-amber-900/40">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>{t("Emergency Contacts (Rescue & Hospital Sync)")}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddContact(!showAddContact)}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow transition hover:bg-amber-700 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              {showAddContact ? t("Close") : t("Add Contact")}
            </button>
          </div>

          <div className="mt-2.5 text-[11px] font-medium text-amber-900/80 dark:text-amber-200/80">
            {t("Contacts saved here are automatically made available to State Command Admins, SDRF/NDRF Boat Rescuers, and Hospital Emergency Staff during active incidents.")}
          </div>

          {/* Add Contact Form Accordion */}
          {showAddContact && (
            <form onSubmit={handleAddEmergencyContact} className="mt-4 rounded-2xl border border-amber-300 bg-white p-4 shadow dark:border-amber-800 dark:bg-[#1a1b1f]">
              <p className="text-xs font-black uppercase tracking-wider text-[#122824] dark:text-white">{t("New Emergency Contact")}</p>

              {contactError && (
                <div className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {contactError}
                </div>
              )}

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] font-bold">{t("Contact Name *")}</Label>
                    <Input
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder={t("e.g. Rahul Sharma")}
                      required
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold">{t("Relationship *")}</Label>
                    <select
                      value={cRelation}
                      onChange={(e) => setCRelation(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {RELATION_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {t(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] font-bold">{t("Primary Phone *")}</Label>
                    <Input
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      placeholder={t("+91 94350 12345")}
                      required
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold">{t("Alternate Phone")}</Label>
                    <Input
                      value={cAltPhone}
                      onChange={(e) => setCAltPhone(e.target.value)}
                      placeholder={t("Optional phone")}
                      className="mt-1 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-bold">{t("Notes / Location Details")}</Label>
                  <Input
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    placeholder={t("e.g. Has 2nd floor shelter and boat access")}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPrimaryContact"
                    checked={cIsPrimary}
                    onChange={(e) => setCIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600"
                  />
                  <Label htmlFor="isPrimaryContact" className="cursor-pointer text-xs font-semibold">
                    {t("Set as Primary Next-of-Kin")}
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingContact}
                  className="w-full gap-2 rounded-xl bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {isSavingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("Save Emergency Contact")}
                </Button>
              </div>
            </form>
          )}

          {/* Existing Contacts List */}
          <div className="mt-3.5 space-y-2.5">
            {contactsQuery.isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              </div>
            ) : savedContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300 p-4 text-center text-xs text-amber-900/70 dark:border-amber-800 dark:text-amber-300/70">
                {t("No emergency contacts added yet. Tap Add Contact above to register family or next-of-kin.")}
              </div>
            ) : (
              savedContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm transition dark:border-white/10 dark:bg-[#18191d]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#122824] dark:text-white">{contact.name}</span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {t(contact.relation)}
                      </span>
                      {contact.isPrimary === "yes" && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <Star className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" />
                          {t("Primary")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#0f766e] dark:text-[#2dd4bf]">
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" />
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
                    className="rounded-xl p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:hover:bg-rose-950/40"
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
        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Section 2: Identity & Contact */}
          <div className="rounded-[1.6rem] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#16171a]">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-xs font-black uppercase tracking-wider text-[#237563] dark:border-white/10 dark:text-[#5eead4]">
              <User className="h-4 w-4" />
              <span>{t("Personal Identity & Phone")}</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-name" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Full Name / Display Name")}
                </Label>
                <Input
                  id="prof-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("e.g. Anupam Deka")}
                  required
                  className="mt-1 rounded-xl border-black/10 bg-[#f9faf9] text-xs font-semibold dark:border-white/10 dark:bg-[#1c1d22]"
                />
              </div>

              <div>
                <Label htmlFor="prof-email" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Email Address")}
                </Label>
                <Input
                  id="prof-email"
                  value={user?.email || ""}
                  disabled
                  className="mt-1 cursor-not-allowed rounded-xl border-black/10 bg-[#f0f2f1] text-xs font-semibold text-muted-foreground opacity-80 dark:border-white/10 dark:bg-[#18191c]"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">{t("Primary login address (locked).")}</p>
              </div>

              <div>
                <Label htmlFor="prof-phone" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Primary Citizen Phone Number")}
                </Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Phone className="h-4 w-4 text-[#237563] dark:text-[#5eead4]" />
                  </span>
                  <Input
                    id="prof-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("+91 98640 12345")}
                    className="rounded-xl border-black/10 bg-[#f9faf9] pl-9 text-xs font-semibold dark:border-white/10 dark:bg-[#1c1d22]"
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{t("Direct citizen contact number for rescue operations.")}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Health & Emergency Profile */}
          <div className="rounded-[1.6rem] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#16171a]">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-xs font-black uppercase tracking-wider text-rose-600 dark:border-white/10 dark:text-rose-400">
              <HeartPulse className="h-4 w-4" />
              <span>{t("Medical & Disaster Assistance")}</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-blood" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Blood Group")}
                </Label>
                <select
                  id="prof-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-black/10 bg-[#f9faf9] px-3 py-2 text-xs font-semibold text-[#122824] focus:outline-none focus:ring-2 focus:ring-[#237563] dark:border-white/10 dark:bg-[#1c1d22] dark:text-[#f3f4f6]"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg === "Not specified" ? t("Not specified") : bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="prof-med" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Medical Notes & Special Evacuation Needs")}
                </Label>
                <Textarea
                  id="prof-med"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder={t("e.g. Diabetic requiring insulin refrigeration, wheelchair user, 1 elder person (age 78) requiring boat evacuation...")}
                  rows={3}
                  className="mt-1 rounded-xl border-black/10 bg-[#f9faf9] text-xs font-medium dark:border-white/10 dark:bg-[#1c1d22]"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("Shared confidentially with hospital medical responders and boat dispatch units.")}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Location & Region */}
          <div className="rounded-[1.6rem] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#16171a]">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-xs font-black uppercase tracking-wider text-[#0f766e] dark:border-white/10 dark:text-[#2dd4bf]">
              <MapPin className="h-4 w-4" />
              <span>{t("State, District & Locality")}</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-district" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("State & District")}
                </Label>
                <select
                  id="prof-district"
                  value={homeDistrict}
                  onChange={(e) => setHomeDistrict(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-black/10 bg-[#f9faf9] px-3 py-2 text-xs font-semibold text-[#122824] focus:outline-none focus:ring-2 focus:ring-[#0f766e] dark:border-white/10 dark:bg-[#1c1d22] dark:text-[#f3f4f6]"
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
                <Label htmlFor="prof-address" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Home Address / Village / Ward")}
                </Label>
                <Input
                  id="prof-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("e.g. House 42, Ward 12, Lachit Nagar, Guwahati")}
                  className="mt-1 rounded-xl border-black/10 bg-[#f9faf9] text-xs font-semibold dark:border-white/10 dark:bg-[#1c1d22]"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Preferences & Notifications */}
          <div className="rounded-[1.6rem] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#16171a]">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-xs font-black uppercase tracking-wider text-[#6366f1] dark:border-white/10 dark:text-[#a5b4fc]">
              <Languages className="h-4 w-4" />
              <span>{t("Language & Broadcasts")}</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <Label htmlFor="prof-lang" className="text-xs font-bold text-[#122824] dark:text-[#f3f4f6]">
                  {t("Preferred Language")}
                </Label>
                <select
                  id="prof-lang"
                  data-no-operational-translation="true"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-black/10 bg-[#f9faf9] px-3 py-2 text-xs font-semibold text-[#122824] focus:outline-none focus:ring-2 focus:ring-[#6366f1] dark:border-white/10 dark:bg-[#1c1d22] dark:text-[#f3f4f6]"
                >
                  {localeOptions.map((l) => (
                    <option key={l.code} value={l.code} data-no-operational-translation="true">
                      {l.nativeLabel} ({l.label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-[#f9faf9] p-3 dark:border-white/10 dark:bg-[#1c1d22]">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef2ff] text-[#4f46e5] dark:bg-indigo-950 dark:text-indigo-300">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#122824] dark:text-white">{t("Emergency Broadcasts")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("Receive red alert warnings & flood advisories")}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={safetyNotifications}
                  onChange={(e) => setSafetyNotifications(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-[#174e46] focus:ring-[#174e46]"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full gap-2 rounded-2xl bg-[#174e46] py-6 text-sm font-black text-white shadow-lg transition hover:bg-[#113a34] active:scale-[.99] dark:bg-[#237563] dark:hover:bg-[#1c5c4e]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("Saving Changes…")}
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {t("Save Profile Changes")}
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/50 py-3.5 text-xs font-black text-rose-700 transition hover:bg-rose-100/70 active:scale-[.99] dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              {t("Sign Out of Account")}
            </button>
          </div>
        </form>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}
