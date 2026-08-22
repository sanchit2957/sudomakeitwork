import { useAuth } from "@/_core/hooks/useAuth";
import { RoleGate } from "@/components/RoleGate";
import { SafetyAssistanceQueue } from "@/components/SafetyAssistanceQueue";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HospitalManager } from "@/pages/Command";
import { trpc } from "@/lib/trpc";
import { Hospital, MapPinned, UserPlus, HeartPulse } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Medical() { return <RoleGate roles={["medical", "admin"]}><MedicalWorkspace /></RoleGate>; }

function MedicalWorkspace() {
  const [location] = useLocation(); const { user } = useAuth();
  const nav: WorkspaceNavItem[] = [{ label: "Hospital resources", path: "/medical", icon: Hospital }, { label: "Medical safety requests", path: "/medical/safety", icon: HeartPulse }, { label: "Operations map", path: "/medical/map", icon: MapPinned }, ...(user?.role === "admin" ? [{ label: "Medical staff access", path: "/medical/access", icon: UserPlus }] : [])];
  const live = { refetchInterval: 1_500, refetchIntervalInBackground: true, refetchOnWindowFocus: true } as const;
  const hospitals = trpc.rescue.operations.hospitals.useQuery(undefined, live); const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, live);
  return <DashboardLayout navItems={nav} workspace="Operations App" roleLabel={user?.role === "admin" ? "Government coordinator" : "Medical staff"} desktopSidebar="fixed">{location === "/medical/map" ? <section><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Shared operating picture</p><h1 className="mt-1 text-2xl font-extrabold">Hospital and response map</h1><div className="mt-5"><OperationsMap layers={layers.data} /></div></section> : location === "/medical/safety" ? <SafetyAssistanceQueue title="Medical safety requests" description="Medical staff see only medical-support requests from the Victim App. Acknowledge when a clinic, mobile team, medicine supply, or transport response is being coordinated." guidance={["Confirm available beds, transport, medicine, or mobile-team capacity before acknowledging.", "Escalate immediate life-threatening danger to the SOS command flow rather than treating it as a safety request.", "Record hospital capacity changes in Hospital Resources before marking a request resolved."]} /> : location === "/medical/access" && user?.role === "admin" ? <MedicalAccess /> : <HospitalManager hospitals={hospitals.data || []} layers={layers.data} />}</DashboardLayout>;
}

function MedicalAccess() {
  const [selected, setSelected] = useState(""); const utils = trpc.useUtils(); const users = trpc.rescue.operations.availableUsers.useQuery(); const authorize = trpc.rescue.operations.promoteMedical.useMutation({ onSuccess: () => { setSelected(""); void utils.rescue.operations.availableUsers.invalidate(); } }); const eligible = (users.data || []).filter(user => user.role === "user");
  return <section className="max-w-2xl rounded-3xl border bg-white p-6 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary"><UserPlus className="h-5 w-5" /></span><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Protected account setup</p><h1 className="mt-1 text-2xl font-extrabold">Authorize medical staff</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a person who has already signed in. They will receive Hospital Resources and Operations Map access only; they cannot dispatch rescuers, edit command workflows, or access the field workspace.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Select value={selected} onValueChange={setSelected}><SelectTrigger className="h-11 flex-1"><SelectValue placeholder="Select a signed-in user" /></SelectTrigger><SelectContent>{eligible.length ? eligible.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name || user.email || `User ${user.id}`}</SelectItem>) : <SelectItem value="none" disabled>No eligible signed-in users</SelectItem>}</SelectContent></Select><Button disabled={!selected || selected === "none" || authorize.isPending} onClick={() => authorize.mutate({ userId: Number(selected) })} className="h-11 rounded-xl"><UserPlus className="mr-2 h-4 w-4" /> Authorize</Button></div>{authorize.isSuccess && <p className="mt-4 rounded-xl bg-[#e7f7ee] p-3 text-sm font-semibold text-[#19755f]">Medical Operations access has been authorized. The user should refresh or sign in again.</p>}{authorize.error && <p className="mt-4 text-sm font-semibold text-destructive">{authorize.error.message}</p>}</section>;
}
