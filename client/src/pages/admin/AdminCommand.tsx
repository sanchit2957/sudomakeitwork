import { RoleGate } from "@/components/RoleGate";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap, { type OperationalLayers } from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { markIncidentDispatched } from "@/lib/operationalSync";
import { useLanguage } from "@/contexts/LanguageContext";
import { SafetyAssistanceQueue } from "@/components/SafetyAssistanceQueue";
import { Activity, BarChart3, Building2, CheckCircle2, ClipboardList, ClipboardPenLine, Filter, Hospital, KeyRound, MapPinned, MapPin, Plus, Search, ShieldCheck, TentTree, UserPlus, UsersRound, ShieldPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type StatusFilter = "all" | "pending" | "dispatched" | "resolved";
type ShelterForm = { id?: number; name: string; address: string; latitude: string; longitude: string; capacity: string; occupancy: string; status: "open" | "limited" | "closed" };
type SupplyStatus = "available" | "limited" | "critical" | "unavailable";
type HospitalForm = { id?: number; name: string; address: string; contactPhone: string; latitude: string; longitude: string; totalEmergencyBeds: string; availableEmergencyBeds: string; totalIcuBeds: string; availableIcuBeds: string; oxygenCylinderCount: string; bloodUnitCount: string; ambulanceCount: string; foodSupplyStatus?: SupplyStatus; medicineSupplyStatus?: SupplyStatus; waterSupplyStatus?: SupplyStatus; powerBackupStatus?: SupplyStatus; status: "open" | "limited" | "critical" | "closed" };
const blankShelter = (): ShelterForm => ({ name: "", address: "", latitude: "", longitude: "", capacity: "", occupancy: "", status: "open" });
const blankHospital = (): HospitalForm => ({ name: "", address: "", contactPhone: "", latitude: "", longitude: "", totalEmergencyBeds: "", availableEmergencyBeds: "", totalIcuBeds: "", availableIcuBeds: "", oxygenCylinderCount: "", bloodUnitCount: "", ambulanceCount: "", foodSupplyStatus: "available", medicineSupplyStatus: "available", waterSupplyStatus: "available", powerBackupStatus: "available", status: "open" });

import { isNativeApp } from "@/lib/apiConfig";
import MobileCommandRestricted from "@/components/MobileCommandRestricted";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminAccessCodes } from "@/components/AdminAccessCodes";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminCommand() {
  if (isNativeApp()) return <MobileCommandRestricted />;
  return <RoleGate roles={["admin"]}><CommandWorkspace /></RoleGate>;
}
function CommandWorkspace() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const nav: WorkspaceNavItem[] = [
    { label: t("command.operations"), path: "/command", icon: ClipboardList },
    { label: t("command.map"), path: "/command/map", icon: MapPinned },
    { label: "Safety assistance", path: "/command/safety", icon: ShieldPlus },
    { label: "Access codes", path: "/command/access-codes", icon: KeyRound },
    { label: t("command.shelters"), path: "/command/shelters", icon: TentTree },
    { label: t("command.hospitals"), path: "/command/hospitals", icon: Hospital },
    { label: t("command.requests"), path: "/command/requests", icon: ClipboardPenLine },
    { label: t("command.team"), path: "/command/team", icon: UsersRound },
    { label: "System users", path: "/command/users", icon: UserPlus },
  ];
  const [location, setLocation] = useLocation(); const [filter, setFilter] = useState<StatusFilter>("all"); const [search, setSearch] = useState(""); const utils = trpc.useUtils();
  const liveIncidents = { refetchInterval: 4_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true } as const;
  const liveResources = { refetchInterval: 10_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const liveAdmin = { refetchInterval: 15_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const analytics = trpc.rescue.operations.analytics.useQuery(undefined, liveIncidents);
  const incidents = trpc.rescue.operations.incidents.useQuery(undefined, liveIncidents);
  const roster = trpc.rescue.operations.rescueRoster.useQuery(undefined, liveResources);
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, liveResources);
  const hospitals = trpc.rescue.operations.hospitals.useQuery(undefined, liveResources);
  const requests = trpc.rescue.operations.rescuerRegistrationRequests.useQuery(undefined, liveAdmin);
  const hospitalRequests = trpc.rescue.operations.hospitalRegistrationRequests.useQuery(undefined, liveAdmin);
  const users = trpc.rescue.operations.availableUsers.useQuery(undefined, liveAdmin);
  const allUsers = trpc.auth.listUsers.useQuery(undefined, liveAdmin);
  const refreshOperations = () => { void utils.rescue.operations.incidents.invalidate(); void utils.rescue.operations.analytics.invalidate(); void utils.rescue.operations.rescueRoster.invalidate(); void utils.rescue.operations.mapLayers.invalidate(); void utils.rescue.operations.availableUsers.invalidate(); void utils.rescue.operations.rescuerRegistrationRequests.invalidate(); void utils.rescue.operations.hospitalRegistrationRequests.invalidate(); void utils.auth.listUsers.invalidate(); void utils.auth.accessCodes.list.invalidate(); }; const assignMission = trpc.rescue.operations.assignMission.useMutation({ onMutate: async ({ incidentId }) => { await utils.rescue.operations.incidents.cancel(); const previous = utils.rescue.operations.incidents.getData(); utils.rescue.operations.incidents.setData(undefined, rows => markIncidentDispatched(rows, incidentId)); return { previous }; }, onError: (_error, _input, context) => { if (context?.previous) utils.rescue.operations.incidents.setData(undefined, context.previous); }, onSettled: refreshOperations }); const promote = trpc.rescue.operations.promoteRescuer.useMutation({ onSuccess: refreshOperations }); const review = trpc.rescue.operations.reviewRescuerRegistration.useMutation({ onSuccess: refreshOperations }); const reviewHospital = trpc.rescue.operations.reviewHospitalRegistration.useMutation({ onSuccess: refreshOperations }); const createUser = trpc.auth.createUser.useMutation({ onSuccess: refreshOperations });
  useEffect(() => { const refresh = () => refreshOperations(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [utils]);
  const visibleIncidents = useMemo(() => (incidents.data || []).filter(row => (filter === "all" || row.incident.status === filter) && `${row.incident.publicCode} ${row.incident.locationLabel} ${row.incident.emergencyType}`.toLowerCase().includes(search.toLowerCase())), [incidents.data, filter, search]);
  return <DashboardLayout navItems={nav} workspace={t("command.workspace")} roleLabel={t("command.role")} desktopSidebar="fixed">{location === "/command/map" ? <section><Heading eyebrow="Common operating picture" title="Live response map" /><OperationsMap layers={layers.data} /></section> : location === "/command/safety" ? <SafetyAssistanceQueue title="Safety-assistance triage" description="These are non-SOS requests for shelter, food, medical support, or protection. Acknowledge them to confirm an authorized team is reviewing the need; use the SOS incident board for immediate danger." /> : location === "/command/access-codes" ? <AdminAccessCodes /> : location === "/command/shelters" ? <ShelterManager layers={layers.data} /> : location === "/command/hospitals" ? <HospitalManager hospitals={hospitals.data || []} layers={layers.data} /> : location === "/command/requests" ? <RescuerRequestReview requests={requests.data || []} review={review} hospitalRequests={hospitalRequests.data || []} reviewHospital={reviewHospital} /> : location === "/command/team" ? <TeamRoster roster={roster.data || []} users={users.data || []} promote={promote} /> : location === "/command/users" ? <AdminUserManagement currentUserId={currentUser?.id} /> : <div className="space-y-6"><section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{t("command.overview")}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#173d37]">{t("command.heading")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Updates reconcile every few seconds and immediately after a command action. Assign only available responders and follow every mission from SOS through resolution.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b5ddcf] bg-[#edf9f4] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary"><Activity className="h-3.5 w-3.5" /> {t("command.liveFeed")}</span></section><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total incidents" value={analytics.data?.totalIncidents} icon={ClipboardList} tone="teal" /><Metric label="Active cases" value={analytics.data?.activeIncidents} icon={Activity} tone="amber" /><Metric label="Resolved cases" value={analytics.data?.resolvedCases} icon={CheckCircle2} tone="green" /><Metric label="Active rescuers" value={analytics.data?.activeRescuers} icon={UsersRound} tone="blue" footer={analytics.data?.averageResponseMinutes !== null && analytics.data?.averageResponseMinutes !== undefined ? `${analytics.data.averageResponseMinutes} min avg. dispatch` : "Response time builds as missions dispatch"} /></section><button onClick={() => setLocation("/command/safety")} className="flex w-full items-center justify-between rounded-3xl border border-[#b8dcd2] bg-[#effaf6] p-5 text-left transition hover:bg-[#e4f6ef]"><span className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#277b6b] text-white"><ShieldPlus className="h-5 w-5" /></span><span><span className="block text-sm font-extrabold text-[#173d37]">Safety assistance</span><span className="mt-1 block text-xs text-[#4b7268]">Triage non-SOS shelter, food, medical, and protection requests from the Victim App.</span></span></span><MapPin className="h-5 w-5 text-primary" /></button><section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t("command.incidents")}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">{t("command.openCoordination")}</h2></div><div className="flex flex-wrap gap-2"><div className="relative min-w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("command.search")} className="h-10 pl-9" /></div><Select value={filter} onValueChange={value => setFilter(value as StatusFilter)}><SelectTrigger className="h-10 w-32"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("command.allCases")}</SelectItem><SelectItem value="pending">{t("command.pending")}</SelectItem><SelectItem value="dispatched">{t("command.dispatched")}</SelectItem><SelectItem value="resolved">{t("command.resolved")}</SelectItem></SelectContent></Select></div></div><div className="mt-5 space-y-3">{visibleIncidents.length ? visibleIncidents.map(({ incident, rescuerName, rescuerCallSign, activeOffer }: any) => {
  const ds = incident.dispatchStatus || "triage_pending";
  const isEscalated = ds === "escalated";
  const isOffered = ds === "offered";
  const isMatching = ds === "matching";
  const isTriage = ds === "triage_pending";
  return (
    <article className={`rounded-2xl border p-4 transition-all ${isEscalated ? "border-red-500/50 bg-red-500/5 shadow-md shadow-red-950/10" : isOffered ? "border-amber-500/40 bg-amber-500/5" : "bg-[#fcfefd]"}`} key={incident.id}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">{incident.publicCode}</span>
            <Badge status={incident.status} />
            <Severity severity={incident.severity} />
            {incident.requestCategory && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30">
                {incident.requestCategory}
              </span>
            )}
            {/* Dispatch Status Pill */}
            {isEscalated ? (
              <span className="animate-pulse rounded-full bg-red-600 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-white shadow-sm">
                ⚠️ Escalated to Command
              </span>
            ) : isOffered ? (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40">
                ⏱️ Offered ({activeOffer?.rescuerCallSign || `Unit #${activeOffer?.rescuerId}`} · {activeOffer?.distanceKm?.toFixed(1) || "?"}km)
              </span>
            ) : isMatching ? (
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                🔍 Matching Unit…
              </span>
            ) : isTriage ? (
              <span className="rounded-full bg-zinc-500/20 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-zinc-600 dark:text-zinc-400">
                ⏳ Citizen Classifying
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-sm font-extrabold text-[#173d37] dark:text-white">{incident.locationLabel}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {incident.peopleAffected} people · {incident.emergencyType} · reported {new Date(incident.createdAt).toLocaleTimeString()}
          </p>
          {rescuerName && <p className="mt-2 text-xs font-bold text-[#255c7d]">Assigned Unit: {rescuerCallSign || rescuerName}</p>}
          {isOffered && activeOffer && (
            <p className="mt-1 font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Candidate: {activeOffer.rescuerCallSign} (Score: {activeOffer.matchScore} pts, {activeOffer.distanceKm?.toFixed(1)} km)
            </p>
          )}
        </div>
        <div className="shrink-0">
          {incident.status === 'pending' ? (
            incident.dispatchStatus === 'escalated' ? (
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">
                  ⚠️ Action Required: Escalated
                </span>
                <AssignControl
                  incidentId={incident.id}
                  rescuers={(roster.data || []).filter(({ profile }) => profile.availability === 'available')}
                  assigning={assignMission.isPending}
                  onAssign={rescuerId => assignMission.mutate({ incidentId: incident.id, rescuerId })}
                  label="Assign Manually"
                />
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  🤖 Auto-dispatch active
                </span>
                <details className="text-right">
                  <summary className="cursor-pointer text-[10px] font-bold text-muted-foreground uppercase hover:underline">
                    Override
                  </summary>
                  <div className="mt-2">
                    <AssignControl
                      incidentId={incident.id}
                      rescuers={(roster.data || []).filter(({ profile }) => profile.availability === 'available')}
                      assigning={assignMission.isPending}
                      onAssign={rescuerId => assignMission.mutate({ incidentId: incident.id, rescuerId })}
                      label="Override Assign"
                    />
                  </div>
                </details>
              </div>
            )
          ) : (
            <div className="flex items-center">
              <span className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                {incident.status === 'dispatched' ? 'Responder en route' : 'Case recorded complete'}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No incidents match this view.</div>}</div></div><div className="space-y-4"><div className="overflow-hidden rounded-3xl border bg-white p-3 shadow-sm"><OperationsMap layers={layers.data} compact /><p className="px-2 pb-1 pt-4 text-sm font-extrabold">Response geography</p><p className="px-2 text-xs leading-5 text-muted-foreground">SOS, flood zones, shelters, hospitals, and active teams appear as the latest recorded positions.</p></div><div className="rounded-3xl bg-[#174e46] p-5 text-white"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><ShieldCheck className="h-5 w-5 text-[#b2dfd3]" /></span><div><p className="text-sm font-extrabold">Workflow control</p><p className="mt-0.5 text-xs text-[#bedfd8]">Pending → Dispatched → Resolved</p></div></div><p className="mt-4 text-xs leading-6 text-[#c2e2db]">Assignment locks a responder into the mission. Responders, not dispatchers, record deployment and resolution to maintain an auditable handoff.</p></div></div></section></div>}</DashboardLayout>;
}
function AssignControl({ incidentId, rescuers, assigning, onAssign, label = "Assign" }: { incidentId: number; rescuers: Array<{ user: { id: number; name: string | null }; profile: { callSign: string } }>; assigning: boolean; onAssign: (rescuerId: number) => void; label?: string }) { const [selection, setSelection] = useState(""); return <div className="flex min-w-44 flex-col gap-2"><Select value={selection} onValueChange={setSelection}><SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Select rescuer" /></SelectTrigger><SelectContent>{rescuers.length ? rescuers.map(({ user, profile }) => <SelectItem key={user.id} value={String(user.id)}>{profile.callSign}{user.name ? ` · ${user.name}` : ""}</SelectItem>) : <SelectItem value="none" disabled>No responders available</SelectItem>}</SelectContent></Select><Button disabled={!selection || selection === "none" || assigning} onClick={() => onAssign(Number(selection))} className="h-9 rounded-xl text-xs"><UserPlus className="mr-1.5 h-3.5 w-3.5" /> {label}</Button></div>; }
function ShelterManager({ layers }: { layers?: OperationalLayers }) { const utils = trpc.useUtils(); const [form, setForm] = useState<ShelterForm>(blankShelter()); const add = trpc.rescue.operations.addShelter.useMutation({ onSuccess: () => { utils.rescue.operations.mapLayers.invalidate(); setForm(blankShelter()); } }); const update = trpc.rescue.operations.updateShelter.useMutation({ onSuccess: () => { utils.rescue.operations.mapLayers.invalidate(); setForm(blankShelter()); } }); const save = (event: FormEvent) => { event.preventDefault(); const payload = { name: form.name, address: form.address, latitude: Number(form.latitude), longitude: Number(form.longitude), capacity: Number(form.capacity || 0), occupancy: Number(form.occupancy || 0), status: form.status }; if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return; if (form.id) update.mutate({ id: form.id, ...payload }); else add.mutate(payload); }; return <section className="space-y-6"><Heading eyebrow="Relief capacity" title="Shelter map layer" /><div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><form onSubmit={save} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{form.id ? 'Edit shelter' : 'New shelter'}</p><h2 className="mt-1 text-lg font-extrabold">{form.id ? form.name : 'Add a relief location'}</h2></div>{form.id && <Button type="button" variant="outline" onClick={() => setForm(blankShelter)} className="rounded-xl">New</Button>}</div><div className="mt-5 grid gap-4"><Field label="Shelter name" value={form.name} onChange={value => setForm({ ...form, name: value })} /><Field label="Address / landmark" value={form.address} onChange={value => setForm({ ...form, address: value })} /><div className="grid grid-cols-2 gap-3"><Field label="Latitude" value={form.latitude} onChange={value => setForm({ ...form, latitude: value })} type="number" /><Field label="Longitude" value={form.longitude} onChange={value => setForm({ ...form, longitude: value })} type="number" /></div><div className="grid grid-cols-2 gap-3"><Field label="Capacity" value={form.capacity} onChange={value => setForm({ ...form, capacity: value })} type="number" /><Field label="Occupancy" value={form.occupancy} onChange={value => setForm({ ...form, occupancy: value })} type="number" /></div><div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as ShelterForm['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="limited">Limited capacity</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div></div><Button type="submit" disabled={add.isPending || update.isPending} className="mt-5 w-full rounded-xl"><Plus className="mr-2 h-4 w-4" /> {form.id ? 'Update shelter' : 'Add shelter to map'}</Button>{(add.error || update.error) && <p className="mt-3 text-xs font-semibold text-destructive">{add.error?.message || update.error?.message}</p>}</form><div className="space-y-4"><OperationsMap layers={layers} onPickLocation={point => setForm(previous => ({ ...previous, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) }))} compact /><div className="grid gap-2">{layers?.shelters?.length ? layers.shelters.map(shelter => <button onClick={() => setForm({ id: shelter.id, name: shelter.name, address: shelter.address, latitude: String(shelter.latitude), longitude: String(shelter.longitude), capacity: String(shelter.capacity), occupancy: String(shelter.occupancy), status: shelter.status as ShelterForm['status'] })} key={shelter.id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-left hover:border-[#87c6b7]"><span><span className="block text-sm font-extrabold">{shelter.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{shelter.address}</span></span><span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-primary">{shelter.status}</span></button>) : <div className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">No shelter locations have been added. Click the map to choose coordinates, then save the first location.</div>}</div></div></div></section>; }
export function HospitalManager({ hospitals, layers }: { hospitals: Array<{ id: number; name: string; address: string; contactPhone: string | null; latitude: number; longitude: number; totalEmergencyBeds: number; availableEmergencyBeds: number; totalIcuBeds: number; availableIcuBeds: number; oxygenCylinderCount: number; bloodUnitCount: number; ambulanceCount: number; status: string }>; layers?: OperationalLayers }) { const utils = trpc.useUtils(); const [form, setForm] = useState<HospitalForm>(blankHospital()); const add = trpc.rescue.operations.addHospital.useMutation({ onSuccess: () => { utils.rescue.operations.hospitals.invalidate(); utils.rescue.operations.mapLayers.invalidate(); setForm(blankHospital()); } }); const update = trpc.rescue.operations.updateHospital.useMutation({ onSuccess: () => { utils.rescue.operations.hospitals.invalidate(); utils.rescue.operations.mapLayers.invalidate(); setForm(blankHospital()); } }); const save = (event: FormEvent) => { event.preventDefault(); const payload = { name: form.name, address: form.address, contactPhone: form.contactPhone || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude), totalEmergencyBeds: Number(form.totalEmergencyBeds || 0), availableEmergencyBeds: Number(form.availableEmergencyBeds || 0), totalIcuBeds: Number(form.totalIcuBeds || 0), availableIcuBeds: Number(form.availableIcuBeds || 0), oxygenCylinderCount: Number(form.oxygenCylinderCount || 0), bloodUnitCount: Number(form.bloodUnitCount || 0), ambulanceCount: Number(form.ambulanceCount || 0), status: form.status }; if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return; if (form.id) update.mutate({ id: form.id, ...payload }); else add.mutate(payload); }; const edit = (hospital: typeof hospitals[number]) => setForm({ id: hospital.id, name: hospital.name, address: hospital.address, contactPhone: hospital.contactPhone || "", latitude: String(hospital.latitude), longitude: String(hospital.longitude), totalEmergencyBeds: String(hospital.totalEmergencyBeds), availableEmergencyBeds: String(hospital.availableEmergencyBeds), totalIcuBeds: String(hospital.totalIcuBeds), availableIcuBeds: String(hospital.availableIcuBeds), oxygenCylinderCount: String(hospital.oxygenCylinderCount), bloodUnitCount: String(hospital.bloodUnitCount), ambulanceCount: String(hospital.ambulanceCount), status: hospital.status as HospitalForm['status'] }); return <section className="space-y-6"><Heading eyebrow="Medical capacity" title="Hospitals & critical resources" /><p className="max-w-3xl text-sm leading-6 text-muted-foreground">Track nearby emergency beds, ICU capacity, oxygen, blood, ambulances, and medical readiness. Only coordinators should make these operational updates.</p><div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]"><form onSubmit={save} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{form.id ? "Edit hospital" : "New hospital"}</p><h2 className="mt-1 text-lg font-extrabold">{form.id ? form.name : "Add medical resource"}</h2></div>{form.id && <Button type="button" variant="outline" onClick={() => setForm(blankHospital)} className="rounded-xl">New</Button>}</div><div className="mt-5 grid gap-4"><Field label="Hospital / health centre" value={form.name} onChange={value => setForm({ ...form, name: value })} /><Field label="Address / landmark" value={form.address} onChange={value => setForm({ ...form, address: value })} /><Field label="Emergency contact" value={form.contactPhone} onChange={value => setForm({ ...form, contactPhone: value })} placeholder="Optional" /><div className="grid grid-cols-2 gap-3"><Field label="Latitude" value={form.latitude} onChange={value => setForm({ ...form, latitude: value })} type="number" /><Field label="Longitude" value={form.longitude} onChange={value => setForm({ ...form, longitude: value })} type="number" /></div><p className="pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Beds</p><div className="grid grid-cols-2 gap-3"><Field label="ER total" value={form.totalEmergencyBeds} onChange={value => setForm({ ...form, totalEmergencyBeds: value })} type="number" /><Field label="ER available" value={form.availableEmergencyBeds} onChange={value => setForm({ ...form, availableEmergencyBeds: value })} type="number" /><Field label="ICU total" value={form.totalIcuBeds} onChange={value => setForm({ ...form, totalIcuBeds: value })} type="number" /><Field label="ICU available" value={form.availableIcuBeds} onChange={value => setForm({ ...form, availableIcuBeds: value })} type="number" /></div><p className="pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Stock & transport</p><div className="grid grid-cols-3 gap-3"><Field label="Oxygen" value={form.oxygenCylinderCount} onChange={value => setForm({ ...form, oxygenCylinderCount: value })} type="number" /><Field label="Blood units" value={form.bloodUnitCount} onChange={value => setForm({ ...form, bloodUnitCount: value })} type="number" /><Field label="Ambulances" value={form.ambulanceCount} onChange={value => setForm({ ...form, ambulanceCount: value })} type="number" /></div><div className="grid gap-2"><Label>Readiness</Label><Select value={form.status} onValueChange={value => setForm({ ...form, status: value as HospitalForm['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="limited">Limited capacity</SelectItem><SelectItem value="critical">Critical shortage</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div></div><Button type="submit" disabled={add.isPending || update.isPending} className="mt-5 w-full rounded-xl"><Plus className="mr-2 h-4 w-4" /> {form.id ? "Update hospital resources" : "Add hospital to map"}</Button>{(add.error || update.error) && <p className="mt-3 text-xs font-semibold text-destructive">{add.error?.message || update.error?.message}</p>}</form><div className="space-y-4"><OperationsMap layers={layers} onPickLocation={point => setForm(previous => ({ ...previous, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) }))} compact /><div className="grid gap-3">{hospitals.length ? hospitals.map(hospital => <button onClick={() => edit(hospital)} key={hospital.id} className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-[#87c6b7]"><div className="flex items-start justify-between gap-3"><span><span className="block text-sm font-extrabold">{hospital.name}</span><span className="mt-1 block text-xs text-muted-foreground">{hospital.address}</span></span><span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${hospital.status === "open" ? "bg-[#d9f3e8] text-[#19755f]" : hospital.status === "limited" ? "bg-[#fff2d9] text-[#9b6615]" : "bg-[#fff0ee] text-[#b44742]"}`}>{hospital.status}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span className="rounded-lg bg-[#edf7f4] px-2 py-1.5 font-bold text-primary">ER {hospital.availableEmergencyBeds}/{hospital.totalEmergencyBeds}</span><span className="rounded-lg bg-[#eaf2fb] px-2 py-1.5 font-bold text-[#255c7d]">ICU {hospital.availableIcuBeds}/{hospital.totalIcuBeds}</span><span className="rounded-lg bg-[#f7f7f2] px-2 py-1.5 font-bold text-[#5e6b62]">O₂ {hospital.oxygenCylinderCount}</span></div></button>) : <div className="rounded-2xl border border-dashed p-6 text-sm leading-6 text-muted-foreground">No hospital resource has been added. Use the map to pin a verified hospital or health centre, then record only current operational capacity.</div>}</div></div></div></section>; }
function RescuerRequestReview({ requests, review, hospitalRequests = [], reviewHospital }: { requests: Array<{ request: { id: number; phone: string | null; note: string | null; status: string; createdAt: Date }; user: { id: number; name: string | null; email: string | null } }>; review: ReturnType<typeof trpc.rescue.operations.reviewRescuerRegistration.useMutation>; hospitalRequests?: Array<{ request: { id: number; hospitalName: string; address: string; contactPhone: string; note: string | null; status: string; createdAt: Date }; user: { id: number; name: string | null; email: string | null } | null }>; reviewHospital?: ReturnType<typeof trpc.rescue.operations.reviewHospitalRegistration.useMutation> }) {
  const [tab, setTab] = useState<"rescuers" | "hospitals">("rescuers");
  const [callSigns, setCallSigns] = useState<Record<number, string>>({});
  const [designations, setDesignations] = useState<Record<number, string>>({});
  const pendingRescuers = requests.filter(({ request }) => request.status === "pending");
  const pendingHospitals = hospitalRequests.filter(({ request }) => request.status === "pending");

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <Heading eyebrow="Staff & Facility Authorization" title="Registration approvals" />
        <div className="flex items-center gap-1 rounded-2xl bg-black/5 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setTab("rescuers")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "rescuers" ? "bg-white text-foreground shadow-sm dark:bg-[#202226]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🚤 Rescuer Requests ({pendingRescuers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("hospitals")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              tab === "hospitals" ? "bg-white text-foreground shadow-sm dark:bg-[#202226]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🏥 Hospital Requests ({pendingHospitals.length})
          </button>
        </div>
      </div>

      {tab === "rescuers" ? (
        <div className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review each field applicant. Without your approval and designated call sign, responders cannot access mission assignments.
          </p>
          <div className="grid gap-3">
            {pendingRescuers.length ? (
              pendingRescuers.map(({ request, user }) => (
                <article key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div>
                      <p className="text-base font-extrabold">{user.name || user.email || `User ${user.id}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email || "No email"}{request.phone ? ` · 📞 ${request.phone}` : ""}</p>
                      {request.note && <p className="mt-3 max-w-2xl rounded-xl bg-[#f7fbf9] p-3 text-sm leading-6 text-[#315e54]">{request.note}</p>}
                    </div>
                    <div className="grid min-w-60 gap-2">
                      <Input
                        value={callSigns[request.id] || ""}
                        onChange={event => setCallSigns({ ...callSigns, [request.id]: event.target.value })}
                        placeholder="Assign Call Sign (e.g. NDRF-Boat-04)"
                        className="h-10 text-xs"
                      />
                      <Button
                        disabled={!callSigns[request.id]?.trim() || review.isPending}
                        onClick={() => review.mutate({ requestId: request.id, decision: "approved", callSign: callSigns[request.id].trim() })}
                        className="rounded-xl bg-[#0f766e] text-white"
                      >
                        <UserPlus className="mr-2 h-4 w-4" /> Approve & Assign Call Sign
                      </Button>
                      <Button
                        disabled={review.isPending}
                        variant="outline"
                        onClick={() => review.mutate({ requestId: request.id, decision: "rejected", reviewNote: "Application rejected by Command." })}
                        className="rounded-xl text-destructive"
                      >
                        Reject Application
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm leading-6 text-muted-foreground">
                No field rescuer registrations waiting for review.
              </div>
            )}
          </div>
          {review.error && <p className="text-sm font-semibold text-destructive">{review.error.message}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review hospital registrations submitted by medical personnel. Approval creates the hospital facility record and promotes the applicant to medical staff.
          </p>
          <div className="grid gap-3">
            {pendingHospitals.length ? (
              pendingHospitals.map(({ request, user }) => (
                <article key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600">Hospital Onboarding</span>
                        <h3 className="text-base font-extrabold">{request.hospitalName}</h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">📍 {request.address} · 📞 {request.contactPhone}</p>
                      <p className="mt-1 text-xs font-semibold text-primary">Requested by: {user?.name || user?.email || `User ${user?.id}`}</p>
                      {request.note && <p className="mt-3 max-w-2xl rounded-xl bg-[#f0f6ff] p-3 text-sm leading-6 text-[#1e40af]">{request.note}</p>}
                    </div>
                    <div className="grid min-w-64 gap-2">
                      <Input
                        value={designations[request.id] || ""}
                        onChange={event => setDesignations({ ...designations, [request.id]: event.target.value })}
                        placeholder="Staff designation (e.g. Medical Superintendent)"
                        className="h-10 text-xs"
                      />
                      <Button
                        disabled={reviewHospital?.isPending}
                        onClick={() => reviewHospital?.mutate({ requestId: request.id, decision: "approved", designation: designations[request.id]?.trim() || undefined })}
                        className="rounded-xl bg-[#0f766e] text-white"
                      >
                        <Building2 className="mr-2 h-4 w-4" /> Approve & Authorize Hospital
                      </Button>
                      <Button
                        disabled={reviewHospital?.isPending}
                        variant="outline"
                        onClick={() => reviewHospital?.mutate({ requestId: request.id, decision: "rejected", reviewNote: "Facility verification not approved." })}
                        className="rounded-xl text-destructive"
                      >
                        Reject Request
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm leading-6 text-muted-foreground">
                No hospital registrations waiting for review.
              </div>
            )}
          </div>
          {reviewHospital?.error && <p className="text-sm font-semibold text-destructive">{reviewHospital.error.message}</p>}
        </div>
      )}
    </section>
  );
}

function TeamRoster({ roster, users, promote }: { roster: Array<{ user: { id: number; name: string | null; email: string | null }; profile: { callSign: string; availability: string; updatedAt: Date } }>; users: Array<{ id: number; name: string | null; email: string | null; role: string }>; promote: ReturnType<typeof trpc.rescue.operations.promoteRescuer.useMutation> }) { const utils = trpc.useUtils(); const [selected, setSelected] = useState(""); const [callSign, setCallSign] = useState(""); const [phone, setPhone] = useState(""); const candidates = users.filter(user => user.role === 'user'); const create = () => { if (!selected || !callSign.trim()) return; promote.mutate({ userId: Number(selected), callSign: callSign.trim(), phone: phone.trim() || undefined }, { onSuccess: () => { setSelected(""); setCallSign(""); setPhone(""); utils.rescue.operations.rescueRoster.invalidate(); } }); }; return <section className="space-y-6"><Heading eyebrow="Response capacity" title="Rescue-team roster" /><div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Authorize a responder</p><h2 className="mt-1 text-lg font-extrabold">Add a verified field account</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Choose an existing signed-in user and assign a call sign. Only authorized coordinators should make this change.</p><div className="mt-5 grid gap-3"><Select value={selected} onValueChange={setSelected}><SelectTrigger><SelectValue placeholder="Select an eligible user" /></SelectTrigger><SelectContent>{candidates.length ? candidates.map(user => <SelectItem value={String(user.id)} key={user.id}>{user.name || user.email || `User ${user.id}`}</SelectItem>) : <SelectItem value="none" disabled>No eligible signed-in users</SelectItem>}</SelectContent></Select><Field label="Field call sign" value={callSign} onChange={setCallSign} placeholder="Example: NDRF-04" /><Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="Team contact number" /><Button disabled={!selected || selected === 'none' || !callSign.trim() || promote.isPending} onClick={create} className="rounded-xl"><UserPlus className="mr-2 h-4 w-4" /> Authorize rescuer</Button>{promote.error && <p className="text-xs font-semibold text-destructive">{promote.error.message}</p>}</div></div><div className="grid gap-3">{roster.length ? roster.map(({ user, profile }) => <article className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm" key={user.id}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><UsersRound className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">{profile.callSign}</p><p className="text-xs text-muted-foreground">{user.name || user.email || `User ${user.id}`}</p></div></div><Badge status={profile.availability === 'available' ? 'resolved' : profile.availability === 'on_mission' ? 'dispatched' : 'pending'} label={profile.availability.replace('_', ' ')} /></article>) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm leading-6 text-muted-foreground">No field accounts are authorized yet. Users must sign in once before they can be added to the team roster.</div>}</div></div></section>; }
function Heading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1></div>; }
function Metric({ label, value, icon: Icon, tone, footer }: { label: string; value?: number; icon: typeof ClipboardList; tone?: string; footer?: string }) { const color = tone === 'amber' ? 'bg-[#fff4df] text-[#a76f1a]' : tone === 'green' ? 'bg-[#e7f7ee] text-[#18775e]' : tone === 'blue' ? 'bg-[#e9f2fb] text-[#255c7d]' : 'bg-[#e6f6ef] text-primary'; return <article className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></span><BarChart3 className="h-4 w-4 text-border" /></div><p className="mt-5 text-2xl font-extrabold tracking-tight">{value ?? '—'}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>{footer && <p className="mt-3 border-t pt-2 text-[10px] leading-4 text-muted-foreground">{footer}</p>}</article>; }
function Badge({ status, label }: { status: string; label?: string }) { const mode = status === 'resolved' ? 'bg-[#d9f3e8] text-[#19755f]' : status === 'dispatched' ? 'bg-[#dfeeff] text-[#255c7d]' : 'bg-[#fff2d9] text-[#9b6615]'; return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${mode}`}>{label || status}</span>; }
function Severity({ severity }: { severity: string }) { return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${severity === 'critical' ? 'bg-[#fff0ee] text-[#b44742]' : severity === 'high' ? 'bg-[#fff4df] text-[#a76f1a]' : 'bg-[#e7f7ee] text-[#18775e]'}`}>{severity}</span>; }
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <div className="grid gap-2"><Label>{label}</Label><Input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>; }

function UserManager({ users, create }: { users: Array<any>; create: any }) {
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callSign, setCallSign] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    create.mutate({ name: name.trim(), email: email.trim(), password: password.trim(), role: role as any, callSign: callSign.trim() }, {
      onSuccess: () => {
        setName("");
        setEmail("");
        setPassword("");
        setCallSign("");
      }
    });
  };

  return <section className="space-y-6"><Heading eyebrow="System access" title="User management" /><div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Create account</p><h2 className="mt-1 text-lg font-extrabold">Provision new user</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Administer role-based accounts with passwords to grant portal access.</p><form onSubmit={submit} className="mt-5 grid gap-4"><div className="grid gap-2"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Citizen (User)</SelectItem><SelectItem value="rescuer">Rescuer</SelectItem><SelectItem value="medical">Medical Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div><Field label="Full name" value={name} onChange={setName} /><Field label="Email address" type="email" value={email} onChange={setEmail} /><Field label="Password" type="password" value={password} onChange={setPassword} />{role === "rescuer" && <Field label="Call sign" value={callSign} onChange={setCallSign} placeholder="Unit ID" />}<Button disabled={create.isPending} type="submit" className="mt-2 rounded-xl"><UserPlus className="mr-2 h-4 w-4" /> Create user account</Button>{create.error && <p className="text-xs font-semibold text-destructive">{create.error.message}</p>}</form></div><div className="space-y-4"><div className="grid gap-3">{users.length ? users.map((u) => <article className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm" key={u.id}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><UsersRound className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div></div><Badge status={u.role === 'admin' ? 'dispatched' : u.role === 'rescuer' ? 'pending' : u.role === 'medical' ? 'resolved' : 'default'} label={u.role} /></article>) : <div className="rounded-2xl border border-dashed p-8 text-center text-sm leading-6 text-muted-foreground">No users found.</div>}</div></div></div></section>;
}
