import { RoleGate } from "@/components/RoleGate";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import LanguageSelector from "@/components/LanguageSelector";
import OperationsMap from "@/components/OperationsMap";
import { SafetyAssistanceQueue } from "@/components/SafetyAssistanceQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { reconcileAvailability, reconcileMissionStatus } from "@/lib/operationalSync";
import { Bell, Camera, CheckCircle2, ClipboardList, ClipboardPenLine, LocateFixed, MapPinned, MessageCircle, Navigation, Phone, Radio, Send, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import React, { ChangeEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

type PushState = "not_requested" | "permission_granted" | "subscribed" | "unsupported" | "failed";

export default function Responder() {
  const { user, loading } = useAuth();
  if (!loading && user?.role === "user") return <RescuerRegistration />;
  return <RoleGate roles={["rescuer"]}><ResponderWorkspace /></RoleGate>;
}

function ResponderWorkspace() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const nav: WorkspaceNavItem[] = [
    { label: t("responder.missions"), path: "/responder", icon: ClipboardList },
    { label: t("responder.map"), path: "/responder/map", icon: MapPinned },
    { label: "Safety requests", path: "/responder/safety", icon: ShieldCheck },
    { label: t("responder.alerts"), path: "/responder/alerts", icon: Bell },
  ];
  const utils = trpc.useUtils();
  const [pushState, setPushState] = useState<PushState>("not_requested");
  const [pushDetail, setPushDetail] = useState("");
  const liveQuery = { refetchInterval: 1_500, refetchIntervalInBackground: true, refetchOnWindowFocus: true } as const;
  const profile = trpc.rescue.rescuer.profile.useQuery(undefined, liveQuery);
  const missions = trpc.rescue.rescuer.missions.useQuery(undefined, liveQuery);
  const alerts = trpc.rescue.rescuer.notifications.useQuery(undefined, liveQuery);
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, liveQuery);
  const pushConfig = trpc.rescue.rescuer.pushConfig.useQuery();
  const subscribePush = trpc.rescue.rescuer.subscribePush.useMutation();
  const refreshOperationalState = () => { void utils.rescue.rescuer.profile.invalidate(); void utils.rescue.rescuer.missions.invalidate(); void utils.rescue.rescuer.notifications.invalidate(); void utils.rescue.operations.mapLayers.invalidate(); };
  const setAvailability = trpc.rescue.rescuer.setAvailability.useMutation({ onMutate: async ({ availability }) => { await utils.rescue.rescuer.profile.cancel(); const previous = utils.rescue.rescuer.profile.getData(); utils.rescue.rescuer.profile.setData(undefined, profile => reconcileAvailability(profile, availability)); return { previous }; }, onError: (_error, _input, context) => { if (context?.previous) utils.rescue.rescuer.profile.setData(undefined, context.previous); }, onSettled: refreshOperationalState });
  const updateMission = trpc.rescue.rescuer.updateMission.useMutation({ onMutate: async ({ missionId, status }) => { await utils.rescue.rescuer.missions.cancel(); const previous = utils.rescue.rescuer.missions.getData(); utils.rescue.rescuer.missions.setData(undefined, rows => reconcileMissionStatus(rows, missionId, status)); return { previous }; }, onError: (_error, _input, context) => { if (context?.previous) utils.rescue.rescuer.missions.setData(undefined, context.previous); }, onSettled: refreshOperationalState });
  const updateProfile = trpc.rescue.rescuer.updateProfile.useMutation({ onSettled: refreshOperationalState });
  const setLocationSharing = trpc.rescue.rescuer.setLocationSharing.useMutation({ onSettled: refreshOperationalState });
  const updateLiveLocation = trpc.rescue.rescuer.updateLiveLocation.useMutation();
  const markRead = trpc.rescue.rescuer.markNotificationRead.useMutation({ onSuccess: () => { void utils.rescue.rescuer.notifications.invalidate(); } });
  const hasActiveMission = Boolean(missions.data?.some(({ mission }) => mission.status !== "resolved"));

  useEffect(() => { const refresh = () => refreshOperationalState(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [utils]);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail(t("This browser cannot receive secure background alerts. Keep the Alerts page open for in-app updates."));
      return;
    }
    if (Notification.permission === "granted") {
      setPushState("permission_granted");
      setPushDetail(t("Browser permission is granted. Finish setup to securely register this device for delivery."));
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !alerts.data) return;
    const newest = alerts.data.items.find(item => !item.readAt);
    if (newest && document.visibilityState === "hidden") new Notification(newest.title, { body: newest.body });
  }, [alerts.data]);

  useEffect(() => {
    if (!hasActiveMission || profile.data?.locationSharing !== "yes" || !navigator.geolocation) return;
    let lastSentAt = 0;
    const watchId = navigator.geolocation.watchPosition(
      point => {
        const now = Date.now();
        if (now - lastSentAt < 10_000) return;
        lastSentAt = now;
        updateLiveLocation.mutate({ latitude: point.coords.latitude, longitude: point.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasActiveMission, profile.data?.locationSharing]);

  const enableAlerts = async () => {
    if (!pushConfig.data?.enabled || !pushConfig.data.publicKey) {
      setPushState("unsupported");
      setPushDetail(t("Background delivery is unavailable until the operations team configures the push service."));
      return;
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail(t("This browser does not support secure background alerts. Use a current HTTPS browser session instead."));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("failed");
        setPushDetail(t("Browser alerts were not permitted. You can enable them later in the browser site settings."));
        return;
      }
      setPushState("permission_granted");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("The alert service is still starting. Wait a moment, refresh this page, and try again.");
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(pushConfig.data.publicKey) });
      const payload = subscription.toJSON();
      if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys.auth) throw new Error("The browser returned an incomplete push subscription.");
      await subscribePush.mutateAsync({ endpoint: payload.endpoint, p256dh: payload.keys.p256dh, auth: payload.keys.auth });
      setPushState("subscribed");
      setPushDetail(t("This device is registered for mission assignment and nearby priority SOS alerts."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/could not retrieve the public key/i.test(message)) {
        try {
          await resetPushRegistration();
          setPushState("permission_granted");
          setPushDetail(t("The existing browser alert registration was cleared. Click Finish browser alert setup once more to create a fresh subscription."));
          return;
        } catch { /* Fall through to detailed recovery guidance. */ }
      }
      setPushState("failed");
      setPushDetail(describePushFailure(error, t));
    }
  };

  const withCurrentLocation = (availability: "available" | "on_mission" | "off_duty") => {
    if (!navigator.geolocation) { setAvailability.mutate({ availability }); return; }
    navigator.geolocation.getCurrentPosition(
      point => setAvailability.mutate({ availability, latitude: point.coords.latitude, longitude: point.coords.longitude }),
      () => setAvailability.mutate({ availability }),
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  };

  return <DashboardLayout navItems={nav} workspace={t("responder.workspace")} roleLabel={t("responder.role")}><div className="space-y-6">
    {location === "/responder/map" ? <section><PageHeading eyebrow={t("responder.map")} title={t("responder.mapTitle")} /><OperationsMap layers={layers.data} /></section>
      : location === "/responder/safety" ? <SafetyAssistanceQueue title="Safety assistance requests" description="Review shelter, food, medical, and protection needs shared by people who are not reporting immediate SOS danger. Acknowledge only when you or the command team can begin a response." guidance={["Check current weather, flood-zone, and route conditions on the Operations Map before travelling.", "Use the SOS mission board for immediate danger; do not replace an active SOS assignment with a safety request.", "Acknowledge only after confirming a safe response route, team capacity, or command handoff."]} />
      : location === "/responder/alerts" ? <AlertsView items={alerts.data?.items ?? []} onRead={id => markRead.mutate({ notificationId: id })} />
          : <><section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><div className="rounded-3xl bg-[#174e46] p-6 text-white shadow-[0_20px_60px_-30px_rgb(21_78_70/0.75)]"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1dbd1]">{t("responder.readiness")}</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight">{profile.data?.callSign || t("responder.profilePending")}</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#c2e1d9]">{t("responder.readinessCopy")}</p><div className="mt-5 flex flex-wrap gap-2">{([['available',t('responder.available')],['on_mission',t('responder.onMission')],['off_duty',t('responder.offDuty')]] as const).map(([value, label]) => <button key={value} onClick={() => withCurrentLocation(value)} disabled={setAvailability.isPending || !profile.data} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${profile.data?.availability === value ? 'bg-white text-[#174e46]' : 'bg-white/10 text-[#d8eee8] hover:bg-white/20'}`}>{setAvailability.isPending ? t("responder.updating") : label}</button>)}</div></div><AlertSetup unread={alerts.data?.unread ?? 0} state={pushState} detail={pushDetail} disabled={subscribePush.isPending || pushState === "subscribed"} onEnable={enableAlerts} /></section><ResponderProfileCard profile={profile.data ?? null} hasActiveMission={hasActiveMission} saving={updateProfile.isPending || setLocationSharing.isPending} onSave={input => updateProfile.mutate(input)} onLocationSharing={enabled => setLocationSharing.mutate({ enabled })} /><section><PageHeading eyebrow={t("responder.board")} title={t("responder.boardTitle")} /><div className="grid gap-3">{missions.data?.length ? missions.data.map(({ mission, incident }) => <article key={mission.id} className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-medium text-primary">{incident.publicCode}</span><StatusBadge status={mission.status} /></div><h2 className="mt-2 text-lg font-extrabold">{incident.locationLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{incident.peopleAffected} {t("responder.people")} · {incident.emergencyType} · <strong className={incident.severity === "critical" ? "text-destructive" : ""}>{incident.severity}</strong> {t("responder.priority")}</p>{mission.notes && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{mission.notes}</p>}</div><div className="flex items-center md:justify-end">{mission.status === "resolved" ? <span className="flex items-center gap-2 text-sm font-bold text-[#19755f]"><CheckCircle2 className="h-5 w-5" /> {t("responder.completed")}</span> : <Button disabled={updateMission.isPending} onClick={() => updateMission.mutate({ missionId: mission.id, status: mission.status === "pending" ? "dispatched" : "resolved" })} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">{updateMission.isPending ? t("responder.updating") : mission.status === "pending" ? <><Navigation className="mr-2 h-4 w-4" /> {t("responder.dispatched")}</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> {t("responder.resolved")}</>}</Button>}</div></article>) : <Empty text={t("responder.noMission")} />}</div></section></>}
  <ResponderMissionChat missions={missions.data ?? []} /></div></DashboardLayout>;
}

function AlertSetup({ unread, state, detail, disabled: _disabled, onEnable }: { unread: number; state: PushState; detail: string; disabled: boolean; onEnable: () => void }) { const { t } = useLanguage(); const label = state === "subscribed" ? t("Browser alerts active") : state === "permission_granted" ? t("Finish browser alert setup") : state === "unsupported" ? t("Background alerts unavailable") : t("responder.enableAlerts"); const isLocked = state === "subscribed" || state === "unsupported"; return <div className="rounded-3xl border bg-white p-6"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Bell className="h-5 w-5" /></span><span className="rounded-full bg-[#fff0ee] px-2.5 py-1 font-mono text-[10px] font-bold text-[#b44742]">{unread} {t("general.new")}</span></div><h2 className="mt-5 text-lg font-extrabold">{t("responder.assignmentAlerts")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("responder.alertCopy")}</p><button type="button" onClick={onEnable} disabled={isLocked} className="mt-4 w-full rounded-xl border border-[#91cbbb] px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-[#effaf6] disabled:cursor-not-allowed disabled:opacity-50">{label}</button>{detail && <p className={`mt-3 text-xs leading-5 ${state === "failed" ? "text-destructive" : state === "subscribed" ? "text-[#19755f]" : "text-muted-foreground"}`}>{detail}</p>}{!isLocked && <button type="button" onClick={onEnable} className="mt-2 w-full text-xs font-bold text-primary underline underline-offset-4">{t("responder.retryAlerts")}</button>}</div>; }

type RescuerProfileSummary = { callSign: string; phone: string | null; photoUrl: string | null; contactSharing: "yes" | "no"; locationSharing: "yes" | "no" };
type ProfileUpdate = { phone?: string | null; contactSharing?: "yes" | "no"; photoDataUrl?: string | null; clearPhoto?: boolean };

export function ResponderProfileCard({ profile, hasActiveMission, saving, onSave, onLocationSharing }: { profile: RescuerProfileSummary | null; hasActiveMission: boolean; saving: boolean; onSave: (input: ProfileUpdate) => void; onLocationSharing: (enabled: boolean) => void }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [contactSharing, setContactSharing] = useState<"yes" | "no">(profile?.contactSharing ?? "no");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  useEffect(() => { setPhone(profile?.phone ?? ""); setContactSharing(profile?.contactSharing ?? "no"); }, [profile?.phone, profile?.contactSharing]);
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_000_000) { setPhotoError(t("Choose a PNG, JPEG, or WebP image smaller than 1 MB.")); return; }
    const reader = new FileReader();
    reader.onload = () => { setPhotoDataUrl(String(reader.result)); setPhotoError(""); };
    reader.readAsDataURL(file);
  };
  const preview = photoDataUrl || profile?.photoUrl;
  return <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e7f7ee] text-primary">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7" />}</div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("Your field profile")}</p><h2 className="mt-1 text-xl font-extrabold">{profile?.callSign || t("responder.profilePending")}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{t("Your contact details are shown only to the person linked to an active mission when you choose to share them.")}</p></div></div><label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#91cbbb] px-4 py-2.5 text-sm font-bold text-primary hover:bg-[#effaf6]"><Camera className="h-4 w-4" /> {t("Add or change photo")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} className="sr-only" /></label></div><div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]"><div className="grid gap-2"><Label htmlFor="rescuer-phone">{t("Assignment contact number")}</Label><div className="flex gap-2"><Phone className="mt-3 h-4 w-4 shrink-0 text-primary" /><Input id="rescuer-phone" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder={t("Phone number for active assignments")} /></div></div><label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f0faf6] px-4 py-3 text-sm font-semibold text-[#285f55]"><input type="checkbox" checked={contactSharing === "yes"} onChange={event => setContactSharing(event.target.checked ? "yes" : "no")} className="h-4 w-4 accent-primary" />{t("Show my phone number to my active assignment")}</label></div>{photoError && <p className="mt-3 text-xs font-semibold text-destructive">{photoError}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => onSave({ phone: phone.trim() || null, contactSharing, ...(photoDataUrl ? { photoDataUrl } : {}) })} disabled={saving || !profile} className="rounded-xl">{saving ? t("responder.updating") : t("Save profile and contact settings")}</Button>{preview && <Button type="button" variant="outline" onClick={() => { setPhotoDataUrl(null); onSave({ clearPhoto: true }); }} disabled={saving}>{t("Remove photo")}</Button>}</div><div className={`mt-6 rounded-2xl border p-4 ${hasActiveMission ? "border-[#b8ded4] bg-[#f8fcfa]" : "border-border bg-muted/40"}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${profile?.locationSharing === "yes" ? "bg-primary text-white" : "bg-secondary text-primary"}`}><LocateFixed className="h-5 w-5" /></span><div><h3 className="font-extrabold">{t("Live mission location")}</h3><p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{hasActiveMission ? t("Share your current position with this SOS only while this mission is active. Sharing stops and the location is cleared when the mission is resolved or you turn it off.") : t("Live location can be started after you are assigned an active SOS mission.")}</p></div></div><Button type="button" variant={profile?.locationSharing === "yes" ? "outline" : "default"} onClick={() => onLocationSharing(profile?.locationSharing !== "yes")} disabled={saving || !hasActiveMission}>{profile?.locationSharing === "yes" ? <><Radio className="mr-2 h-4 w-4" /> {t("Stop sharing")}</> : <><LocateFixed className="mr-2 h-4 w-4" /> {t("Share live location")}</>}</Button></div></div></section>;
}

function RescuerRegistration() { const [, setLocation] = useLocation(); const { t } = useLanguage(); const [phone, setPhone] = useState(""); const [note, setNote] = useState(""); const request = trpc.rescue.rescuer.requestRegistration.useMutation(); return <div className="relative min-h-screen app-grid flex items-center justify-center p-5"><div className="absolute right-4 top-4"><LanguageSelector compact /></div><section className="w-full max-w-lg rounded-[2rem] border bg-white p-6 shadow-xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7f7ee] text-primary"><ClipboardPenLine className="h-6 w-6" /></span><p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("Join the field team")}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("Request rescuer access")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Send your details to the Command Centre. An administrator will review and assign a secure field call sign before missions can be shown.")}</p><div className="mt-6 grid gap-4"><div className="grid gap-2"><Label htmlFor="phone">{t("Phone")}</Label><Input id="phone" value={phone} onChange={event => setPhone(event.target.value)} placeholder={t("Optional field contact")} /></div><div className="grid gap-2"><Label htmlFor="note">{t("Experience or availability note")}</Label><Textarea id="note" value={note} onChange={event => setNote(event.target.value)} placeholder={t("Example: trained boat operator, medical volunteer, local area knowledge…")} /></div></div><Button disabled={request.isPending} onClick={() => request.mutate({ phone: phone.trim() || undefined, note: note.trim() || undefined })} className="mt-6 w-full rounded-xl">{request.isPending ? t("Sending request…") : t("Request rescuer access")}</Button>{request.isSuccess && <p className="mt-4 rounded-xl bg-[#e7f7ee] p-3 text-sm font-semibold text-[#19755f]">{t("Request sent. Wait for Command Centre approval, then refresh this page.")}</p>}{request.error && <p className="mt-4 text-sm font-semibold text-destructive">{request.error.message}</p>}<Button variant="outline" onClick={() => setLocation("/")} className="mt-3 w-full rounded-xl">{t("Return to safety hub")}</Button></section></div>; }

function AlertsView({ items, onRead }: { items: Array<{ id: number; title: string; body: string; readAt: Date | null }>; onRead: (id: number) => void }) { const { t } = useLanguage(); return <section><PageHeading eyebrow={t("responder.missionAlerts")} title={t("responder.operationalNotifications")} /><div className="grid gap-3">{items.length ? items.map(alert => <button key={alert.id} onClick={() => !alert.readAt && onRead(alert.id)} className={`rounded-2xl border p-4 text-left transition hover:border-[#83c5b4] ${alert.readAt ? "bg-white" : "bg-[#effaf6]"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-extrabold">{alert.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p></div>{!alert.readAt && <span className="h-2.5 w-2.5 rounded-full bg-[#c94b45]" />}</div></button>) : <Empty text={t("responder.noAlerts")} />}</div></section>; }
function base64UrlToUint8Array(value: string) { const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(padded); return Uint8Array.from(raw, character => character.charCodeAt(0)); }
async function resetPushRegistration() { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map(async registration => { const subscription = await registration.pushManager.getSubscription(); await subscription?.unsubscribe(); await registration.unregister(); })); }
function describePushFailure(error: unknown, t: (key: string) => string) { const message = error instanceof Error ? error.message : ""; if (/could not retrieve the public key/i.test(message)) return t("This browser’s PushManager key store did not respond. sudo MakeItWork’s VAPID pair is valid. Restart the browser or device, then retry; if it persists, clear this site’s storage and notification permission or use another current browser. In-app alerts remain available."); if (/no active Service Worker/i.test(message)) return t("The alert worker is still starting. Wait a few seconds, refresh this page, and try again."); return message || t("We could not complete browser alert setup. Please try again or use the in-app Alerts view."); }
function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="mb-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1></div>; }
function ResponderMissionChat({ missions }: { missions: Array<{ mission: { id: number; status: string }; incident: { publicCode: string } }> }) { const active = missions.find(({ mission }) => mission.status !== "resolved") || missions[0]; const [message, setMessage] = useState(""); const utils = trpc.useUtils(); const thread = trpc.rescue.rescuer.missionMessages.useQuery({ missionId: active?.mission.id || 0 }, { enabled: Boolean(active), refetchInterval: 5_000, retry: false }); const send = trpc.rescue.rescuer.sendMissionMessage.useMutation({ onSuccess: () => { setMessage(""); if (active) void utils.rescue.rescuer.missionMessages.invalidate({ missionId: active.mission.id }); } }); if (!active) return null; return <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><MessageCircle className="h-5 w-5" /></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">SOS conversation</p><h2 className="mt-1 text-lg font-extrabold">{active.incident.publicCode}</h2></div></div><div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-[#f7faf9] p-3">{thread.data?.length ? thread.data.map(item => <div key={item.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 ${item.authorType === "rescuer" ? "ml-auto bg-[#174e46] text-white" : "bg-white text-[#315e54]"}`}><span className="block text-[9px] font-black uppercase tracking-wide opacity-70">{item.authorType === "victim" ? "Victim" : item.authorType === "operations" ? "Operations" : "You"}</span>{item.message}</div>) : <p className="text-xs text-muted-foreground">No messages yet. Send a concise update if contact is needed.</p>}</div>{active.mission.status !== "resolved" && <div className="mt-3 flex gap-2"><Input value={message} onChange={event => setMessage(event.target.value)} maxLength={500} placeholder="Send a short update" className="h-10 text-xs" /><Button disabled={!message.trim() || send.isPending} onClick={() => send.mutate({ missionId: active.mission.id, message: message.trim() })} className="h-10 w-10 shrink-0 rounded-xl p-0"><Send className="h-4 w-4" /></Button></div>}{send.error && <p className="mt-2 text-xs font-semibold text-destructive">{send.error.message}</p>}</section>; }
function StatusBadge({ status }: { status: string }) { return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${status === "resolved" ? "bg-[#d9f3e8] text-[#19755f]" : status === "dispatched" ? "bg-[#dfeeff] text-[#255c7d]" : "bg-[#fff2d9] text-[#9b6615]"}`}>{status}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm leading-6 text-muted-foreground"><UserRoundCheck className="mx-auto mb-3 h-7 w-7 text-primary/60" />{text}</div>; }
