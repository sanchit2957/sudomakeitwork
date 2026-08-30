import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  Droplets,
  HeartPulse,
  Hospital,
  MapPin,
  MessageSquare,
  Minus,
  PackagePlus,
  Phone,
  Pill,
  PlugZap,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Timer,
  User,
  Users,
  Utensils,
  Waves,
  XCircle,
  Zap,
} from "lucide-react";
import OperationsMap from "./OperationsMap";

type SupplyStatus = "available" | "limited" | "critical" | "unavailable";
type HospitalRecord = {
  id: number;
  name: string;
  address: string;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  totalEmergencyBeds: number;
  availableEmergencyBeds: number;
  totalIcuBeds: number;
  availableIcuBeds: number;
  oxygenCylinderCount: number;
  bloodUnitCount: number;
  ambulanceCount: number;
  foodSupplyStatus: SupplyStatus;
  medicineSupplyStatus: SupplyStatus;
  waterSupplyStatus: SupplyStatus;
  powerBackupStatus: SupplyStatus;
  status: "open" | "limited" | "critical" | "closed";
  updatedAt: Date;
};

type Draft = {
  availableEmergencyBeds: string;
  availableIcuBeds: string;
  oxygenCylinderCount: string;
  bloodUnitCount: string;
  ambulanceCount: string;
  foodSupplyStatus: SupplyStatus;
  medicineSupplyStatus: SupplyStatus;
  waterSupplyStatus: SupplyStatus;
  powerBackupStatus: SupplyStatus;
  status: HospitalRecord["status"];
};

const makeDraft = (hospital: HospitalRecord): Draft => ({
  availableEmergencyBeds: String(hospital.availableEmergencyBeds),
  availableIcuBeds: String(hospital.availableIcuBeds),
  oxygenCylinderCount: String(hospital.oxygenCylinderCount),
  bloodUnitCount: String(hospital.bloodUnitCount),
  ambulanceCount: String(hospital.ambulanceCount),
  foodSupplyStatus: hospital.foodSupplyStatus,
  medicineSupplyStatus: hospital.medicineSupplyStatus,
  waterSupplyStatus: hospital.waterSupplyStatus,
  powerBackupStatus: hospital.powerBackupStatus,
  status: hospital.status,
});

const supplyItems = [
  { key: "foodSupplyStatus", label: "Food supply", icon: Utensils },
  { key: "medicineSupplyStatus", label: "Medicine supply", icon: Pill },
  { key: "waterSupplyStatus", label: "Drinking water", icon: Waves },
  { key: "powerBackupStatus", label: "Power backup", icon: PlugZap },
] as const;

export function HospitalStaffDashboard({ hospital }: { hospital: HospitalRecord | null | undefined }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Draft | null>(hospital ? makeDraft(hospital) : null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<"operations" | "resources" | "coordination" | "timeline">("operations");

  // Coordination dialog state
  const [coordCategory, setCoordCategory] = useState<string>("additional_ambulance");
  const [coordMessage, setCoordMessage] = useState("");
  const [coordUrgency, setCoordUrgency] = useState<"critical" | "high" | "normal">("high");
  const [coordSuccess, setCoordSuccess] = useState("");

  const liveCases = { refetchInterval: 4_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true } as const;
  const liveLayers = { refetchInterval: 10_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;

  // Live queries
  const incomingCases = trpc.rescue.operations.hospitalCases.useQuery(undefined, liveCases);
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, liveLayers);
  const timeline = trpc.rescue.operations.hospitalActivityTimeline.useQuery(undefined, liveLayers);

  // Mutations
  const updateResources = trpc.rescue.operations.updateMyHospitalResources.useMutation({
    onSuccess: () => {
      setSavedNotice(true);
      void utils.rescue.operations.myHospital.invalidate();
      void utils.rescue.operations.hospitals.invalidate();
      void utils.rescue.safety.resources.invalidate();
      setTimeout(() => setSavedNotice(false), 4000);
    },
  });

  const updateCaseStatus = trpc.rescue.operations.updateHospitalCaseStatus.useMutation({
    onSuccess: () => {
      void utils.rescue.operations.hospitalCases.invalidate();
      void utils.rescue.operations.hospitalActivityTimeline.invalidate();
    },
  });

  const sendCoordination = trpc.rescue.operations.sendHospitalCoordinationMessage.useMutation({
    onSuccess: () => {
      setCoordSuccess("Operational message dispatched to State Command Centre.");
      setCoordMessage("");
      void utils.rescue.operations.hospitalActivityTimeline.invalidate();
      setTimeout(() => setCoordSuccess(""), 5000);
    },
  });

  useEffect(() => {
    if (hospital) setDraft(makeDraft(hospital));
  }, [hospital?.id]);

  // Compute Hospital Readiness Status from actual live resources
  const readiness = useMemo(() => {
    if (!hospital || !draft) return { level: "OFFLINE", color: "bg-zinc-500", text: "text-zinc-500", border: "border-zinc-500/30", label: "OFFLINE" };
    const emBeds = Number(draft.availableEmergencyBeds || 0);
    const icuBeds = Number(draft.availableIcuBeds || 0);
    const oxy = Number(draft.oxygenCylinderCount || 0);

    const hasCriticalSupply = [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("unavailable") || [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("critical");

    if (hospital.status === "closed" || draft.status === "closed") {
      return { level: "CLOSED", color: "bg-zinc-600", text: "text-zinc-600", border: "border-zinc-500/30", label: "FACILITY CLOSED" };
    }
    if (emBeds === 0 || icuBeds === 0 || oxy <= 5 || hasCriticalSupply) {
      return { level: "CRITICAL", color: "bg-red-500", text: "text-red-500", border: "border-red-500/40", label: "CRITICAL LOAD" };
    }
    if (emBeds < 5 || icuBeds < 3 || oxy < 15 || [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("limited")) {
      return { level: "LIMITED", color: "bg-amber-500", text: "text-amber-500", border: "border-amber-500/40", label: "LIMITED CAPACITY" };
    }
    return { level: "READY", color: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500/40", label: "OPERATIONAL & READY" };
  }, [hospital, draft]);

  // Unacknowledged & active cases count
  const activeCasesList = incomingCases.data || [];
  const urgentInboundCount = activeCasesList.filter(c => c.notification.status === "notified" || c.notification.status === "acknowledged" || c.notification.status === "preparing").length;

  if (!hospital || !draft) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-lg">
        <Hospital className="mx-auto h-12 w-12 text-[#255c7d]" />
        <h1 className="mt-4 text-2xl font-extrabold">Hospital Portal Initialization</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your account is authorized for Medical Operations, but it is pending linkage to an approved hospital facility.
          Once the administrator approves your hospital registration, your live command desk will automatically unlock here.
        </p>
      </section>
    );
  }

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(previous => (previous ? { ...previous, [key]: value } : previous));
  };

  const adjustNumberField = (field: "availableEmergencyBeds" | "availableIcuBeds" | "oxygenCylinderCount" | "bloodUnitCount" | "ambulanceCount", delta: number, max?: number) => {
    const current = Number(draft[field] || 0);
    const next = Math.max(0, max !== undefined ? Math.min(max, current + delta) : current + delta);
    updateDraft(field, String(next));
  };

  const handleSaveResources = () => {
    updateResources.mutate({
      id: hospital.id,
      availableEmergencyBeds: Math.max(0, Number(draft.availableEmergencyBeds || 0)),
      availableIcuBeds: Math.max(0, Number(draft.availableIcuBeds || 0)),
      oxygenCylinderCount: Math.max(0, Number(draft.oxygenCylinderCount || 0)),
      bloodUnitCount: Math.max(0, Number(draft.bloodUnitCount || 0)),
      ambulanceCount: Math.max(0, Number(draft.ambulanceCount || 0)),
      foodSupplyStatus: draft.foodSupplyStatus,
      medicineSupplyStatus: draft.medicineSupplyStatus,
      waterSupplyStatus: draft.waterSupplyStatus,
      powerBackupStatus: draft.powerBackupStatus,
      status: draft.status,
    });
  };

  const handleSendCoordination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordMessage.trim()) return;
    sendCoordination.mutate({
      hospitalId: hospital.id,
      category: coordCategory as any,
      message: coordMessage.trim(),
      urgency: coordUrgency,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & OPERATIONAL STATUS */}
      <section className="overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-[#103d36] via-[#164e45] to-[#1e5d53] p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 shadow-inner backdrop-blur-md">
              <Hospital className="h-7 w-7 text-[#c2ede1]" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9ee3d1]">
                  Emergency Hospital Operations Desk
                </span>
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-200">
                  Verified Facility #{hospital.id}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{hospital.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#d2eae3]">
                <span>{hospital.address}</span>
                {hospital.contactPhone && (
                  <span className="flex items-center gap-1 font-mono font-semibold">
                    <Phone className="h-3 w-3" /> {hospital.contactPhone}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${readiness.color} animate-pulse shadow-sm`} />
              <span className="font-mono text-xs font-black uppercase tracking-wider text-white">
                {readiness.label}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#b9ded5]">
              Last sync: {new Date(hospital.updatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* ACTIVE INCOMING ALERT BANNER */}
        {urgentInboundCount > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-red-400/40 bg-red-950/60 p-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white animate-bounce">
                <AlertOctagon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-red-200">
                  🚨 {urgentInboundCount} Inbound Emergency Case(s) En Route
                </p>
                <p className="text-xs text-red-300">
                  Field rescuers have notified this facility. Review requirements below.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("operations")}
              className="rounded-xl bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-red-600"
            >
              View Inbound Cases
            </button>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <TabButton
            active={activeTab === "operations"}
            onClick={() => setActiveTab("operations")}
            icon={HeartPulse}
            label="Inbound Cases"
            badge={urgentInboundCount > 0 ? String(urgentInboundCount) : undefined}
          />
          <TabButton
            active={activeTab === "resources"}
            onClick={() => setActiveTab("resources")}
            icon={BedDouble}
            label="Resource Capacity"
          />
          <TabButton
            active={activeTab === "coordination"}
            onClick={() => setActiveTab("coordination")}
            icon={Radio}
            label="Command Centre Coordination"
          />
          <TabButton
            active={activeTab === "timeline"}
            onClick={() => setActiveTab("timeline")}
            icon={Activity}
            label="Operational Audit Trail"
          />
        </div>
      </section>

      {/* 2. TAB: INBOUND & ACTIVE EMERGENCY CASES */}
      {activeTab === "operations" && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Live Incident Dispatch
              </p>
              <h2 className="text-xl font-extrabold tracking-tight">Incoming & Active Emergency Cases</h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Live Synchronized
            </div>
          </div>

          {activeCasesList.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card p-12 text-center shadow-xs">
              <ShieldCheck className="mx-auto h-12 w-12 text-primary/60" />
              <h3 className="mt-3 text-base font-extrabold">No Incoming Emergency Cases</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                When field rescuers or State Command assign patients to this hospital, inbound telemetry and patient counts will appear here instantly.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeCasesList.map(({ notification, incident, rescuer }) => (
                <CaseCard
                  key={notification.id}
                  notification={notification}
                  incident={incident}
                  rescuer={rescuer}
                  onUpdateStatus={(status, notes) => updateCaseStatus.mutate({ notificationId: notification.id, status: status as any, hospitalNotes: notes })}
                  isUpdating={updateCaseStatus.isPending}
                />
              ))}
            </div>
          )}

          {/* INTEGRATED OPERATIONS MAP */}
          <div className="mt-8 rounded-3xl border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Spatial Situational Awareness
              </p>
              <h3 className="text-lg font-extrabold">Facility & Response Sector Map</h3>
            </div>
            <OperationsMap layers={layers.data} compact />
          </div>
        </section>
      )}

      {/* 3. TAB: RESOURCE MANAGEMENT */}
      {activeTab === "resources" && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Live Capacity Controls
              </p>
              <h2 className="text-xl font-extrabold tracking-tight">Hospital Resources & Medical Supplies</h2>
            </div>
            <Button
              onClick={handleSaveResources}
              disabled={updateResources.isPending}
              className="h-11 rounded-xl bg-primary px-5 font-bold shadow-md hover:bg-primary/90"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {updateResources.isPending ? "Publishing…" : "Publish Live Updates"}
            </Button>
          </div>

          {savedNotice && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              Live hospital resources updated. Information is now broadcasted to rescuers, citizens, and Command Centre.
            </div>
          )}

          {/* CAPACITY CARDS GRID */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickCapacityCard
              icon={BedDouble}
              label="Emergency Beds Available"
              value={Number(draft.availableEmergencyBeds || 0)}
              total={hospital.totalEmergencyBeds}
              onMinus={() => adjustNumberField("availableEmergencyBeds", -1, hospital.totalEmergencyBeds)}
              onPlus={() => adjustNumberField("availableEmergencyBeds", +1, hospital.totalEmergencyBeds)}
              onChange={val => updateDraft("availableEmergencyBeds", val)}
              tone="green"
            />
            <QuickCapacityCard
              icon={HeartPulse}
              label="ICU Beds Available"
              value={Number(draft.availableIcuBeds || 0)}
              total={hospital.totalIcuBeds}
              onMinus={() => adjustNumberField("availableIcuBeds", -1, hospital.totalIcuBeds)}
              onPlus={() => adjustNumberField("availableIcuBeds", +1, hospital.totalIcuBeds)}
              onChange={val => updateDraft("availableIcuBeds", val)}
              tone="blue"
            />
            <QuickCapacityCard
              icon={Droplets}
              label="Oxygen Cylinders"
              value={Number(draft.oxygenCylinderCount || 0)}
              onMinus={() => adjustNumberField("oxygenCylinderCount", -5)}
              onPlus={() => adjustNumberField("oxygenCylinderCount", +5)}
              onChange={val => updateDraft("oxygenCylinderCount", val)}
              tone="emerald"
            />
            <QuickCapacityCard
              icon={PackagePlus}
              label="Blood Units Stocked"
              value={Number(draft.bloodUnitCount || 0)}
              onMinus={() => adjustNumberField("bloodUnitCount", -2)}
              onPlus={() => adjustNumberField("bloodUnitCount", +2)}
              onChange={val => updateDraft("bloodUnitCount", val)}
              tone="red"
            />
            <QuickCapacityCard
              icon={Ambulance}
              label="Ambulances Ready"
              value={Number(draft.ambulanceCount || 0)}
              onMinus={() => adjustNumberField("ambulanceCount", -1)}
              onPlus={() => adjustNumberField("ambulanceCount", +1)}
              onChange={val => updateDraft("ambulanceCount", val)}
              tone="amber"
            />
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1ecfb] text-[#7251a3]">
                <Hospital className="h-5 w-5" />
              </span>
              <Label className="mt-4 block text-sm font-extrabold">Overall Facility Service Status</Label>
              <Select value={draft.status} onValueChange={val => updateDraft("status", val as any)}>
                <SelectTrigger className="mt-3 h-12 text-sm font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🟢 Operational (Open)</SelectItem>
                  <SelectItem value="limited">🟡 Limited Capacity</SelectItem>
                  <SelectItem value="critical">🔴 Critical Load</SelectItem>
                  <SelectItem value="closed">⚫ Facility Offline / Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ESSENTIAL SUPPLIES STATUS */}
          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Infrastructure & Supplies
            </p>
            <h3 className="mt-1 text-lg font-extrabold">Essential Disaster Logistics</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {supplyItems.map(({ key, label, icon: Icon }) => (
                <div key={key} className="rounded-2xl border bg-background/50 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <Label className="text-xs font-bold">{label}</Label>
                  </div>
                  <Select value={draft[key]} onValueChange={val => updateDraft(key, val as SupplyStatus)}>
                    <SelectTrigger className="mt-3 h-10 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">🟢 Available</SelectItem>
                      <SelectItem value="limited">🟡 Limited</SelectItem>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                      <SelectItem value="unavailable">⚫ Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          <Button
            onClick={handleSaveResources}
            disabled={updateResources.isPending}
            className="h-12 w-full rounded-xl bg-primary text-base font-bold text-white shadow-md hover:bg-primary/90"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {updateResources.isPending ? "Publishing Live Update…" : "Publish Live Hospital Update"}
          </Button>
        </section>
      )}

      {/* 4. TAB: COMMAND CENTRE / GOVERNMENT COORDINATION */}
      {activeTab === "coordination" && (
        <section className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Inter-Agency Communications
            </p>
            <h2 className="text-xl font-extrabold tracking-tight">State Command Centre Coordination</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Direct emergency channel between {hospital.name} and the Assam Disaster Management Command Centre.
            </p>
          </div>

          {coordSuccess && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              {coordSuccess}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* DISPATCH NEW BROADCAST */}
            <form onSubmit={handleSendCoordination} className="rounded-3xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold">Send Command Centre Dispatch</h3>
                  <p className="text-xs text-muted-foreground">Request emergency assets or report critical bottlenecks</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Request Category</Label>
                <Select value={coordCategory} onValueChange={setCoordCategory}>
                  <SelectTrigger className="mt-1.5 h-11 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="additional_ambulance">🚑 Request Additional Ambulance Support</SelectItem>
                    <SelectItem value="icu_critical">⚠️ Report ICU Capacity Critically Low</SelectItem>
                    <SelectItem value="oxygen_low">🫁 Report Oxygen Cylinder Depletion</SelectItem>
                    <SelectItem value="critical_cases_hold">🛑 Request Divert / Hold on New Critical Cases</SelectItem>
                    <SelectItem value="additional_staff">👩‍⚕️ Request Emergency Medical Personnel</SelectItem>
                    <SelectItem value="hospital_offline">⛔ Report Facility Temporarily Offline</SelectItem>
                    <SelectItem value="general_assistance">🛡️ General Disaster Assistance Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">Urgency Level</Label>
                <Select value={coordUrgency} onValueChange={val => setCoordUrgency(val as any)}>
                  <SelectTrigger className="mt-1.5 h-11 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical (Immediate Action Required)</SelectItem>
                    <SelectItem value="high">🟠 High Priority</SelectItem>
                    <SelectItem value="normal">🟡 Normal Operational Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">Operational Note & Details</Label>
                <textarea
                  value={coordMessage}
                  onChange={e => setCoordMessage(e.target.value)}
                  placeholder="Describe specific requirements, patient counts, or logistical blockages…"
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={sendCoordination.isPending || !coordMessage.trim()}
                className="h-11 w-full rounded-xl font-bold"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendCoordination.isPending ? "Transmitting…" : "Transmit to State Command Centre"}
              </Button>
            </form>

            {/* PRESET QUICK BROADCAST TILES */}
            <div className="rounded-3xl border bg-card p-6 shadow-sm space-y-3">
              <h3 className="text-base font-extrabold">Instant Tactical Broadcasts</h3>
              <p className="text-xs text-muted-foreground">Click a preset to quickly prefill and coordinate</p>

              <div className="grid gap-2.5 pt-2">
                <QuickActionTile
                  icon={Ambulance}
                  title="Request 2 Extra Ambulances"
                  desc="Heavy evacuation triage load in sector"
                  onClick={() => {
                    setCoordCategory("additional_ambulance");
                    setCoordMessage("Requesting 2 additional 4x4 ambulance units for flood sector triage transport.");
                    setCoordUrgency("high");
                  }}
                />
                <QuickActionTile
                  icon={HeartPulse}
                  title="ICU at Full Occupancy"
                  desc="Notify command to divert critical cases"
                  onClick={() => {
                    setCoordCategory("icu_critical");
                    setCoordMessage("All ICU ventilator beds are currently occupied. Please route critical trauma cases to secondary medical centers.");
                    setCoordUrgency("critical");
                  }}
                />
                <QuickActionTile
                  icon={Droplets}
                  title="Oxygen Logistics Alert"
                  desc="Refill tanker requested within 3 hours"
                  onClick={() => {
                    setCoordCategory("oxygen_low");
                    setCoordMessage("Oxygen reserves below 20%. Requesting urgent refill tanker dispatch from Guwahati medical warehouse.");
                    setCoordUrgency("critical");
                  }}
                />
                <QuickActionTile
                  icon={Users}
                  title="Request Volunteer Medical Staff"
                  desc="Emergency triage staff reinforcement"
                  onClick={() => {
                    setCoordCategory("additional_staff");
                    setCoordMessage("Requesting 4 volunteer trauma nurses and 2 emergency medical officers for nighttime flood shifts.");
                    setCoordUrgency("high");
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. TAB: OPERATIONAL AUDIT TIMELINE */}
      {activeTab === "timeline" && (
        <section className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              System Audit Trail
            </p>
            <h2 className="text-xl font-extrabold tracking-tight">Recent Operational Activity</h2>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-sm">
            {timeline.data && timeline.data.length > 0 ? (
              <div className="relative border-l-2 border-primary/30 pl-5 space-y-6">
                {timeline.data.map(event => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-white text-[10px]">
                      ●
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        {event.action}
                      </p>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {new Date(event.createdAt).toLocaleTimeString()} · {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground">{event.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Logged by: {event.actor?.name || "System"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
 * SUB-COMPONENTS
 * ------------------------------------------------------------- */

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
        active
          ? "bg-white text-[#103d36] shadow-md"
          : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge && (
        <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.2 font-mono text-[10px] font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function QuickCapacityCard({
  icon: Icon,
  label,
  value,
  total,
  onMinus,
  onPlus,
  onChange,
  tone = "green",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  total?: number;
  onMinus: () => void;
  onPlus: () => void;
  onChange: (val: string) => void;
  tone?: "green" | "blue" | "emerald" | "red" | "amber";
}) {
  const tones = {
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : null;

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        {pct !== null && (
          <span className="font-mono text-xs font-extrabold text-muted-foreground">
            {pct}% available
          </span>
        )}
      </div>

      <p className="mt-3 text-xs font-extrabold text-muted-foreground">{label}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onMinus}
          className="grid h-10 w-10 place-items-center rounded-xl border bg-background text-foreground transition hover:bg-muted active:scale-95"
        >
          <Minus className="h-4 w-4" />
        </button>

        <Input
          type="number"
          min="0"
          max={total}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 text-center font-mono text-xl font-black"
        />

        <button
          type="button"
          onClick={onPlus}
          className="grid h-10 w-10 place-items-center rounded-xl border bg-background text-foreground transition hover:bg-muted active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {total !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${pct && pct < 20 ? "bg-red-500" : pct && pct < 40 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Total capacity: {total} units
          </p>
        </div>
      )}
    </div>
  );
}

function CaseCard({
  notification,
  incident,
  rescuer,
  onUpdateStatus,
  isUpdating,
}: {
  notification: any;
  incident: any;
  rescuer: any;
  onUpdateStatus: (status: string, notes?: string) => void;
  isUpdating: boolean;
}) {
  const severityColors = {
    critical: "bg-red-500 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-500 text-white",
    low: "bg-emerald-600 text-white",
  };

  const statusMap: Record<string, { label: string; tone: string }> = {
    notified: { label: "INBOUND NOTIFIED", tone: "bg-red-500/10 text-red-600 border-red-500/30" },
    acknowledged: { label: "ACKNOWLEDGED", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    preparing: { label: "PREPARING ER / ICU", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
    ready: { label: "READY FOR ARRIVAL", tone: "bg-teal-500/10 text-teal-600 border-teal-500/30" },
    received: { label: "PATIENTS RECEIVED", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    completed: { label: "CASE COMPLETED", tone: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30" },
  };

  const currentStatus = statusMap[notification.status] || { label: notification.status.toUpperCase(), tone: "bg-muted text-foreground border-border" };

  return (
    <article className="overflow-hidden rounded-3xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] font-black uppercase ${severityColors[notification.severity as keyof typeof severityColors] || "bg-red-500 text-white"}`}>
              {notification.severity} SEVERITY
            </span>
            <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${currentStatus.tone}`}>
              {currentStatus.label}
            </span>
            <span className="font-mono text-xs font-extrabold text-muted-foreground">
              CASE #{incident?.publicCode || notification.incidentId}
            </span>
          </div>

          <h4 className="text-base font-extrabold">
            {incident?.emergencyType ? `${incident.emergencyType.toUpperCase()} RESCUE EVACUATION` : "Emergency Rescue Inbound"}
          </h4>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" /> {rescuer?.callSign || rescuer?.name || "Field Unit"}
            </span>
            <span className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
              <Timer className="h-3.5 w-3.5" /> ETA ~{notification.estimatedArrivalMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {notification.patientCount} Patient(s)
            </span>
            <span className="flex items-center gap-1">
              <Stethoscope className="h-3.5 w-3.5" /> {notification.requiredDepartment}
            </span>
          </div>

          {(notification.icuRequired === "yes" || notification.oxygenRequired === "yes") && (
            <div className="flex gap-2 pt-1">
              {notification.icuRequired === "yes" && (
                <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-red-600 dark:text-red-400">
                  🔴 ICU Bed Required
                </span>
              )}
              {notification.oxygenRequired === "yes" && (
                <span className="rounded-md bg-teal-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">
                  🫁 Oxygen Support Required
                </span>
              )}
            </div>
          )}

          {notification.notes && (
            <p className="rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <strong>Field Notes:</strong> {notification.notes}
            </p>
          )}
        </div>

        {/* STATUS ACTION BUTTONS */}
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {notification.status === "notified" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("acknowledged")}
              className="rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Acknowledge Case
            </Button>
          )}
          {notification.status === "acknowledged" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("preparing")}
              className="rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
            >
              <HeartPulse className="mr-1.5 h-3.5 w-3.5" /> Prepare ER & ICU
            </Button>
          )}
          {notification.status === "preparing" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("ready")}
              className="rounded-xl bg-teal-600 text-xs font-bold text-white hover:bg-teal-700"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Ready for Inbound
            </Button>
          )}
          {notification.status === "ready" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("received")}
              className="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Hospital className="mr-1.5 h-3.5 w-3.5" /> Confirm Patients Received
            </Button>
          )}
          {notification.status === "received" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("completed")}
              variant="outline"
              className="rounded-xl text-xs font-bold text-muted-foreground"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Finalize Case
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function QuickActionTile({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border bg-background/60 p-3 text-left transition hover:border-primary/50 hover:bg-background"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
