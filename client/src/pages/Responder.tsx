import { RoleGate } from "@/components/RoleGate";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, ClipboardList, MapPinned, Navigation, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const nav: WorkspaceNavItem[] = [
  { label: "My missions", path: "/responder", icon: ClipboardList },
  { label: "Field map", path: "/responder/map", icon: MapPinned },
  { label: "Alerts", path: "/responder/alerts", icon: Bell },
];
type PushState = "not_requested" | "permission_granted" | "subscribed" | "unsupported" | "failed";

export default function Responder() {
  return <RoleGate roles={["rescuer"]}><ResponderWorkspace /></RoleGate>;
}

function ResponderWorkspace() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const [pushState, setPushState] = useState<PushState>("not_requested");
  const [pushDetail, setPushDetail] = useState("");
  const profile = trpc.rescue.rescuer.profile.useQuery(undefined, { refetchInterval: 8_000 });
  const missions = trpc.rescue.rescuer.missions.useQuery(undefined, { refetchInterval: 8_000 });
  const alerts = trpc.rescue.rescuer.notifications.useQuery(undefined, { refetchInterval: 8_000 });
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, { refetchInterval: 8_000 });
  const pushConfig = trpc.rescue.rescuer.pushConfig.useQuery();
  const subscribePush = trpc.rescue.rescuer.subscribePush.useMutation();
  const setAvailability = trpc.rescue.rescuer.setAvailability.useMutation({ onSuccess: () => { utils.rescue.rescuer.profile.invalidate(); utils.rescue.operations.mapLayers.invalidate(); } });
  const updateMission = trpc.rescue.rescuer.updateMission.useMutation({ onSuccess: () => { utils.rescue.rescuer.missions.invalidate(); utils.rescue.rescuer.profile.invalidate(); utils.rescue.operations.mapLayers.invalidate(); } });
  const markRead = trpc.rescue.rescuer.markNotificationRead.useMutation({ onSuccess: () => utils.rescue.rescuer.notifications.invalidate() });

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail("This browser cannot receive secure background alerts. Keep the Alerts page open for in-app updates.");
      return;
    }
    if (Notification.permission === "granted") {
      setPushState("permission_granted");
      setPushDetail("Browser permission is granted. Finish setup to securely register this device for delivery.");
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !alerts.data) return;
    const newest = alerts.data.items.find(item => !item.readAt);
    if (newest && document.visibilityState === "hidden") new Notification(newest.title, { body: newest.body });
  }, [alerts.data]);

  const enableAlerts = async () => {
    if (!pushConfig.data?.enabled || !pushConfig.data.publicKey) {
      setPushState("unsupported");
      setPushDetail("Background delivery is unavailable until the operations team configures the push service.");
      return;
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setPushState("unsupported");
      setPushDetail("This browser does not support secure background alerts. Use a current HTTPS browser session instead.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("failed");
        setPushDetail("Browser alerts were not permitted. You can enable them later in the browser site settings.");
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
      setPushDetail("This device is registered for mission assignment and nearby priority SOS alerts.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/could not retrieve the public key/i.test(message)) {
        try {
          await resetPushRegistration();
          setPushState("permission_granted");
          setPushDetail("The existing browser alert registration was cleared. Click Finish browser alert setup once more to create a fresh subscription.");
          return;
        } catch { /* Fall through to detailed recovery guidance. */ }
      }
      setPushState("failed");
      setPushDetail(describePushFailure(error));
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

  return <DashboardLayout navItems={nav} workspace="Rescuer operations" roleLabel="Field responder"><div className="space-y-6">
    {location === "/responder/map" ? <section><PageHeading eyebrow="Field map" title="See active conditions in your response area." /><OperationsMap layers={layers.data} /></section>
      : location === "/responder/alerts" ? <AlertsView items={alerts.data?.items ?? []} onRead={id => markRead.mutate({ notificationId: id })} />
        : <><section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><div className="rounded-3xl bg-[#174e46] p-6 text-white shadow-[0_20px_60px_-30px_rgb(21_78_70/0.75)]"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1dbd1]">Field readiness</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight">{profile.data?.callSign || "Rescuer profile pending"}</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#c2e1d9]">Set your availability before deploying. Share current GPS only when it is safe to do so.</p><div className="mt-5 flex flex-wrap gap-2">{([['available','Available'],['on_mission','On mission'],['off_duty','Off duty']] as const).map(([value, label]) => <button key={value} onClick={() => withCurrentLocation(value)} disabled={setAvailability.isPending || !profile.data} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${profile.data?.availability === value ? 'bg-white text-[#174e46]' : 'bg-white/10 text-[#d8eee8] hover:bg-white/20'}`}>{label}</button>)}</div></div><AlertSetup unread={alerts.data?.unread ?? 0} state={pushState} detail={pushDetail} disabled={subscribePush.isPending || pushState === "subscribed"} onEnable={enableAlerts} /></section><section><PageHeading eyebrow="My mission board" title="Work each mission through its required sequence." /><div className="grid gap-3">{missions.data?.length ? missions.data.map(({ mission, incident }) => <article key={mission.id} className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-medium text-primary">{incident.publicCode}</span><StatusBadge status={mission.status} /></div><h2 className="mt-2 text-lg font-extrabold">{incident.locationLabel}</h2><p className="mt-1 text-sm text-muted-foreground">{incident.peopleAffected} people · {incident.emergencyType} · <strong className={incident.severity === "critical" ? "text-destructive" : ""}>{incident.severity}</strong> priority</p>{mission.notes && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{mission.notes}</p>}</div><div className="flex items-center md:justify-end">{mission.status === "resolved" ? <span className="flex items-center gap-2 text-sm font-bold text-[#19755f]"><CheckCircle2 className="h-5 w-5" /> Completed</span> : <Button disabled={updateMission.isPending} onClick={() => updateMission.mutate({ missionId: mission.id, status: mission.status === "pending" ? "dispatched" : "resolved" })} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">{mission.status === "pending" ? <><Navigation className="mr-2 h-4 w-4" /> Mark dispatched</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Mark resolved</>}</Button>}</div></article>) : <Empty text="No mission has been assigned to this account. Keep your availability current so dispatchers can find you." />}</div></section></>}
  </div></DashboardLayout>;
}

function AlertSetup({ unread, state, detail, disabled: _disabled, onEnable }: { unread: number; state: PushState; detail: string; disabled: boolean; onEnable: () => void }) { const label = state === "subscribed" ? "Browser alerts active" : state === "permission_granted" ? "Finish browser alert setup" : state === "unsupported" ? "Background alerts unavailable" : "Enable browser alerts"; const isLocked = state === "subscribed" || state === "unsupported"; return <div className="rounded-3xl border bg-white p-6"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Bell className="h-5 w-5" /></span><span className="rounded-full bg-[#fff0ee] px-2.5 py-1 font-mono text-[10px] font-bold text-[#b44742]">{unread} NEW</span></div><h2 className="mt-5 text-lg font-extrabold">Assignment alerts</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Register this device to receive mission assignments and nearby priority SOS alerts even when Riverguard is not open.</p><button type="button" onClick={onEnable} disabled={isLocked} className="mt-4 w-full rounded-xl border border-[#91cbbb] px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-[#effaf6] disabled:cursor-not-allowed disabled:opacity-50">{label}</button>{detail && <p className={`mt-3 text-xs leading-5 ${state === "failed" ? "text-destructive" : state === "subscribed" ? "text-[#19755f]" : "text-muted-foreground"}`}>{detail}</p>}{!isLocked && <button type="button" onClick={onEnable} className="mt-2 w-full text-xs font-bold text-primary underline underline-offset-4">Retry browser alert registration</button>}</div>; }

function AlertsView({ items, onRead }: { items: Array<{ id: number; title: string; body: string; readAt: Date | null }>; onRead: (id: number) => void }) { return <section><PageHeading eyebrow="Mission alerts" title="Operational notifications" /><div className="grid gap-3">{items.length ? items.map(alert => <button key={alert.id} onClick={() => !alert.readAt && onRead(alert.id)} className={`rounded-2xl border p-4 text-left transition hover:border-[#83c5b4] ${alert.readAt ? "bg-white" : "bg-[#effaf6]"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-extrabold">{alert.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p></div>{!alert.readAt && <span className="h-2.5 w-2.5 rounded-full bg-[#c94b45]" />}</div></button>) : <Empty text="No current alerts. Mission notifications will appear here." />}</div></section>; }
function base64UrlToUint8Array(value: string) { const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(padded); return Uint8Array.from(raw, character => character.charCodeAt(0)); }
async function resetPushRegistration() { const registrations = await navigator.serviceWorker.getRegistrations(); await Promise.all(registrations.map(async registration => { const subscription = await registration.pushManager.getSubscription(); await subscription?.unsubscribe(); await registration.unregister(); })); }
function describePushFailure(error: unknown) { const message = error instanceof Error ? error.message : ""; if (/could not retrieve the public key/i.test(message)) return "This browser’s PushManager key store did not respond. Riverguard’s VAPID pair is valid. Restart the browser or device, then retry; if it persists, clear this site’s storage and notification permission or use another current browser. In-app alerts remain available."; if (/no active Service Worker/i.test(message)) return "The alert worker is still starting. Wait a few seconds, refresh this page, and try again."; return message || "We could not complete browser alert setup. Please try again or use the in-app Alerts view."; }
function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="mb-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1></div>; }
function StatusBadge({ status }: { status: string }) { return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${status === "resolved" ? "bg-[#d9f3e8] text-[#19755f]" : status === "dispatched" ? "bg-[#dfeeff] text-[#255c7d]" : "bg-[#fff2d9] text-[#9b6615]"}`}>{status}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm leading-6 text-muted-foreground"><UserRoundCheck className="mx-auto mb-3 h-7 w-7 text-primary/60" />{text}</div>; }
