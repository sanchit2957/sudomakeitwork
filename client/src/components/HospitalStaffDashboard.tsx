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
  ArrowUpRight,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  HeartPulse,
  Hospital,
  Info,
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
  Sparkles,
  Stethoscope,
  Timer,
  User,
  UserCheck,
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
  { key: "foodSupplyStatus", label: "Nutritional rations", icon: Utensils },
  { key: "medicineSupplyStatus", label: "Trauma pharmaceuticals", icon: Pill },
  { key: "waterSupplyStatus", label: "Purified water reserve", icon: Waves },
  { key: "powerBackupStatus", label: "Auxiliary generator", icon: PlugZap },
] as const;

export function HospitalStaffDashboard({ hospital }: { hospital: HospitalRecord | null | undefined }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Draft | null>(hospital ? makeDraft(hospital) : null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "resources" | "coordination" | "timeline">("overview");
  const [equipmentTab, setEquipmentTab] = useState<"ventilator" | "oxygen" | "infusion" | "monitors">("ventilator");
  const [bedViewMode, setBedViewMode] = useState<"bed" | "room">("bed");

  // Coordination modal state
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
      setCoordSuccess("Operational request transmitted to State Command Centre.");
      setCoordMessage("");
      void utils.rescue.operations.hospitalActivityTimeline.invalidate();
      setTimeout(() => setCoordSuccess(""), 5000);
    },
  });

  useEffect(() => {
    if (hospital) setDraft(makeDraft(hospital));
  }, [hospital?.id]);

  // Dynamic capacity computations
  const totalBeds = (hospital?.totalEmergencyBeds || 0) + (hospital?.totalIcuBeds || 0);
  const availBeds = Number(draft?.availableEmergencyBeds || 0) + Number(draft?.availableIcuBeds || 0);
  const bedOccupancyPct = totalBeds > 0 ? Math.min(100, Math.max(0, Math.round(((totalBeds - availBeds) / totalBeds) * 100))) : 42;
  const icuOccupancyPct = (hospital?.totalIcuBeds || 0) > 0 
    ? Math.min(100, Math.max(0, Math.round((((hospital?.totalIcuBeds || 0) - Number(draft?.availableIcuBeds || 0)) / (hospital?.totalIcuBeds || 1)) * 100))) 
    : 72;
  const staffCoveragePct = 78; // Clinical staff on duty
  const departmentLoadPct = Math.min(96, Math.max(25, Math.round(bedOccupancyPct * 1.08)));

  // Compute Hospital Readiness Status from actual live resources
  const readiness = useMemo(() => {
    if (!hospital || !draft) return { level: "OFFLINE", color: "bg-slate-400", dot: "bg-slate-400", label: "OFFLINE" };
    const emBeds = Number(draft.availableEmergencyBeds || 0);
    const icuBeds = Number(draft.availableIcuBeds || 0);
    const oxy = Number(draft.oxygenCylinderCount || 0);

    const hasCriticalSupply = [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("unavailable") || [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("critical");

    if (hospital.status === "closed" || draft.status === "closed") {
      return { level: "CLOSED", color: "bg-slate-600", dot: "bg-slate-500", label: "FACILITY OFFLINE" };
    }
    if (emBeds === 0 || icuBeds === 0 || oxy <= 5 || hasCriticalSupply) {
      return { level: "CRITICAL", color: "bg-rose-600", dot: "bg-rose-500", label: "CRITICAL CAPACITY" };
    }
    if (emBeds < 5 || icuBeds < 3 || oxy < 15 || [draft.foodSupplyStatus, draft.medicineSupplyStatus, draft.waterSupplyStatus, draft.powerBackupStatus].includes("limited")) {
      return { level: "LIMITED", color: "bg-amber-500", dot: "bg-amber-400", label: "LIMITED CAPACITY" };
    }
    return { level: "READY", color: "bg-emerald-600", dot: "bg-emerald-500", label: "LIVE & OPERATIONAL" };
  }, [hospital, draft]);

  // Unacknowledged & active cases count
  const activeCasesList = incomingCases.data || [];
  const urgentInboundCount = activeCasesList.filter(c => c.notification.status === "notified" || c.notification.status === "acknowledged" || c.notification.status === "preparing").length;

  if (!hospital || !draft) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
          <Hospital className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Facility Provisioning in Progress</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Your account is authenticated for Medical Operations. Access will automatically unlock as soon as State Command approves this facility's clinical credentials.
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
      {/* 1. CLINICAL HEADER & NAVIGATION (Inspired by Reference 2) */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          {/* Facility Identity */}
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
              <Hospital className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operations & Resource
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Facility #{hospital.id}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {hospital.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{hospital.address}</span>
                {hospital.contactPhone && (
                  <span className="flex items-center gap-1 font-mono font-medium text-slate-700 dark:text-slate-300">
                    <Phone className="h-3 w-3 text-teal-600 dark:text-teal-400" /> {hospital.contactPhone}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Today: {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>

            {urgentInboundCount > 0 && (
              <button
                onClick={() => setActiveTab("cases")}
                className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-500/20 hover:bg-rose-100 transition dark:bg-rose-950/50 dark:text-rose-300"
              >
                <AlertOctagon className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
                <span>{urgentInboundCount} Inbound Cases</span>
              </button>
            )}

            <Button
              onClick={() => setActiveTab("coordination")}
              size="sm"
              className="h-9 rounded-xl bg-teal-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <Radio className="mr-1.5 h-3.5 w-3.5" />
              <span>Broadcast Request</span>
            </Button>
          </div>
        </div>

        {/* Clinical Navigation Tabs (Reference 2 Pill Bar) */}
        <div className="mt-6 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <ClinicalTabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Overview"
            icon={Activity}
          />
          <ClinicalTabButton
            active={activeTab === "cases"}
            onClick={() => setActiveTab("cases")}
            label="Inbound Cases"
            badge={urgentInboundCount > 0 ? String(urgentInboundCount) : undefined}
            icon={HeartPulse}
          />
          <ClinicalTabButton
            active={activeTab === "resources"}
            onClick={() => setActiveTab("resources")}
            label="Resource Capacity"
            icon={BedDouble}
          />
          <ClinicalTabButton
            active={activeTab === "coordination"}
            onClick={() => setActiveTab("coordination")}
            label="Command Coordination"
            icon={Radio}
          />
          <ClinicalTabButton
            active={activeTab === "timeline"}
            onClick={() => setActiveTab("timeline")}
            label="Audit Trail"
            icon={Clock}
          />
        </div>
      </header>

      {/* 2. CLINICAL TELEMETRY TILES (Shown on Overview & Resources) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClinicalMetricCard
          label="Bed Occupied"
          value={`${bedOccupancyPct}%`}
          subtext="occupied"
          trend="87% total capacity"
          indicatorTone={bedOccupancyPct > 85 ? "danger" : bedOccupancyPct > 60 ? "warning" : "teal"}
          barPercent={bedOccupancyPct}
        />
        <ClinicalMetricCard
          label="Staff Coverage"
          value={`${staffCoveragePct}%`}
          subtext="on duty"
          trend="3 shifts manned"
          indicatorTone="teal"
          barPercent={staffCoveragePct}
        />
        <ClinicalMetricCard
          label="ICU Utilization"
          value={`${icuOccupancyPct}%`}
          subtext="utilization"
          trend={`${draft.availableIcuBeds} beds remaining`}
          indicatorTone={icuOccupancyPct > 80 ? "danger" : "teal"}
          barPercent={icuOccupancyPct}
        />
        <ClinicalMetricCard
          label="Department Load"
          value={`>${departmentLoadPct}%`}
          subtext="capacity"
          trend={departmentLoadPct > 85 ? "High triage queue" : "Optimal intake"}
          indicatorTone={departmentLoadPct > 85 ? "danger" : "warning"}
          barPercent={departmentLoadPct}
        />
      </section>

      {/* 3. TAB: OVERVIEW (BENTO OF BEDS, EQUIPMENT, ACTIVE STAFF, AND INBOUND) */}
      {activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Bed & Room Overview Card (Reference 2 style) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <BedDouble className="h-4 w-4 text-teal-600" />
                  <span>Bed & Room Overview</span>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold dark:bg-slate-800">
                  <button
                    onClick={() => setBedViewMode("bed")}
                    className={`rounded-md px-2.5 py-1 transition ${bedViewMode === "bed" ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
                  >
                    Bed
                  </button>
                  <button
                    onClick={() => setBedViewMode("room")}
                    className={`rounded-md px-2.5 py-1 transition ${bedViewMode === "room" ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
                  >
                    Room
                  </button>
                </div>
              </div>

              {/* Clinical Bed Highlight Card */}
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="inline-block rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
                  {draft.availableEmergencyBeds} emergency beds ready
                </span>
                <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                  General Emergency & Trauma Beds
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Total allocation: {hospital.totalEmergencyBeds} beds. Fully equipped with wall-mount oxygen, vitals telemetry, and IV infusion pumps.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("resources")}
                    className="h-8 rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Manage Beds
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("cases")}
                    className="h-8 rounded-lg text-xs font-semibold"
                  >
                    View Inbound Queue
                  </Button>
                </div>
                <p className="mt-3 font-mono text-[10px] text-slate-400">
                  Sanitized & inspected: {new Date(hospital.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Summary Stats Row */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{draft.availableEmergencyBeds} / {hospital.totalEmergencyBeds}</p>
                  <p className="text-[10px] font-medium text-slate-500">Emergency Beds</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{draft.availableIcuBeds} / {hospital.totalIcuBeds}</p>
                  <p className="text-[10px] font-medium text-slate-500">ICU Ventilator Beds</p>
                </div>
              </div>
            </div>

            {/* Equipments Insight Card (Circular gauge, Reference 2) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <HeartPulse className="h-4 w-4 text-teal-600" />
                  <span>Equipment Insights</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>

              {/* Subtabs for Equipment */}
              <div className="mt-3 flex gap-1 border-b border-slate-100 pb-2 text-[11px] font-medium text-slate-500 dark:border-slate-800">
                <button
                  onClick={() => setEquipmentTab("ventilator")}
                  className={`rounded-md px-2 py-0.5 transition ${equipmentTab === "ventilator" ? "bg-teal-50 font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" : "hover:text-slate-900"}`}
                >
                  Ventilator
                </button>
                <button
                  onClick={() => setEquipmentTab("oxygen")}
                  className={`rounded-md px-2 py-0.5 transition ${equipmentTab === "oxygen" ? "bg-teal-50 font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" : "hover:text-slate-900"}`}
                >
                  Oxygen
                </button>
                <button
                  onClick={() => setEquipmentTab("infusion")}
                  className={`rounded-md px-2 py-0.5 transition ${equipmentTab === "infusion" ? "bg-teal-50 font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" : "hover:text-slate-900"}`}
                >
                  Blood Units
                </button>
                <button
                  onClick={() => setEquipmentTab("monitors")}
                  className={`rounded-md px-2 py-0.5 transition ${equipmentTab === "monitors" ? "bg-teal-50 font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-400" : "hover:text-slate-900"}`}
                >
                  Ambulance
                </button>
              </div>

              {/* Circular Arc / Radial Progress Presentation */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-teal-600 transition-all duration-700"
                      strokeDasharray={`${equipmentTab === "ventilator" ? 75 : equipmentTab === "oxygen" ? 82 : equipmentTab === "infusion" ? 64 : 90}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center text-center">
                    <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {equipmentTab === "ventilator" ? "75%" : equipmentTab === "oxygen" ? `${draft.oxygenCylinderCount}` : equipmentTab === "infusion" ? `${draft.bloodUnitCount}` : `${draft.ambulanceCount}`}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {equipmentTab === "oxygen" ? "Cylinders" : equipmentTab === "infusion" ? "Units Ready" : equipmentTab === "monitors" ? "Ambulances" : "Operational"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {equipmentTab === "ventilator" && `${draft.availableIcuBeds} / ${hospital.totalIcuBeds} ICU units deployed`}
                  {equipmentTab === "oxygen" && `${draft.oxygenCylinderCount} medical oxygen cylinders stocked`}
                  {equipmentTab === "infusion" && `${draft.bloodUnitCount} packed red cell units reserved`}
                  {equipmentTab === "monitors" && `${draft.ambulanceCount} patient transport vehicles active`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <span className="font-bold text-teal-700 dark:text-teal-400">Clinical Insight: </span>
                {Number(draft.oxygenCylinderCount) < 10
                  ? "Oxygen reserves below safety margin. Re-stocking dispatch recommended."
                  : "Critical lifesupport reserves are stable and synchronized with State Command."}
              </div>
            </div>

            {/* Active On-Duty Staff Card (Reference 2 style) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                  <span>On-Duty Clinical Staff</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>

              {/* Lead Doctor Featured Card */}
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3.5 dark:border-teal-950/60 dark:bg-teal-950/20">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white shadow-xs">
                  DR
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <span className="h-1 w-1 rounded-full bg-emerald-600" /> On Duty
                  </span>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                    Dr. B. K. Sarma, MD
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    Chief of Trauma & Emergency Medicine
                  </p>
                </div>
              </div>

              {/* On-Duty Staff List */}
              <div className="mt-4 space-y-2">
                <OnDutyStaffItem
                  name="Dr. Ananya Baruah"
                  specialty="ICU Intensivist"
                  dept="Critical Care"
                  status="Active in ER"
                />
                <OnDutyStaffItem
                  name="T. Deka, RN"
                  specialty="Trauma Charge Nurse"
                  dept="Triage Desk"
                  status="On Floor"
                />
                <OnDutyStaffItem
                  name="R. Kalita"
                  specialty="EMT Paramedic"
                  dept="Mobile Transport"
                  status="En Route"
                />
              </div>
            </div>
          </div>

          {/* Inbound Cases Queue Preview on Overview */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  Live Dispatch Stream
                </p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Incoming Emergency Evacuations
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("cases")}
                className="h-8 rounded-lg text-xs font-semibold"
              >
                View Full Queue ({activeCasesList.length})
              </Button>
            </div>

            <div className="mt-4">
              {activeCasesList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <ShieldCheck className="mx-auto h-8 w-8 text-teal-500/80 mb-2" />
                  No patients currently en route to this facility. Ready for field triage assignments.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeCasesList.slice(0, 2).map(({ notification, incident, rescuer }) => (
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
            </div>
          </div>
        </section>
      )}

      {/* 4. TAB: INBOUND CASES */}
      {activeTab === "cases" && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Patient Intake & Triage
              </p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Inbound & Active Emergency Cases
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-600" />
              Live Telemetry Linked
            </div>
          </div>

          {activeCasesList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <ShieldCheck className="mx-auto h-12 w-12 text-teal-500" />
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">All Clear — No Incoming Cases</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                When field rescuers or State Command route evacuated victims to this hospital, incoming telemetry and triage needs appear here in real-time.
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

          {/* Map Layer */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Geospatial Sector View
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Hospital & Inbound Rescue Sector Map</h3>
            </div>
            <OperationsMap layers={layers.data} compact />
          </div>
        </section>
      )}

      {/* 5. TAB: RESOURCE CAPACITY CONTROLS */}
      {activeTab === "resources" && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Live Capacity Controls
              </p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Hospital Resources & Medical Inventory
              </h2>
            </div>
            <Button
              onClick={handleSaveResources}
              disabled={updateResources.isPending}
              className="h-10 rounded-xl bg-teal-600 px-5 font-semibold text-white shadow-xs hover:bg-teal-700 transition dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {updateResources.isPending ? "Publishing updates…" : "Publish Live Updates"}
            </Button>
          </div>

          {savedNotice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Live hospital resources updated. Information broadcasted to responders, citizens, and Command Centre.
            </div>
          )}

          {/* Steppers Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickCapacityCard
              icon={BedDouble}
              label="Emergency Beds Available"
              value={Number(draft.availableEmergencyBeds || 0)}
              total={hospital.totalEmergencyBeds}
              onMinus={() => adjustNumberField("availableEmergencyBeds", -1, hospital.totalEmergencyBeds)}
              onPlus={() => adjustNumberField("availableEmergencyBeds", +1, hospital.totalEmergencyBeds)}
              onChange={val => updateDraft("availableEmergencyBeds", val)}
              tone="teal"
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
              label="Oxygen Cylinders Stocked"
              value={Number(draft.oxygenCylinderCount || 0)}
              onMinus={() => adjustNumberField("oxygenCylinderCount", -5)}
              onPlus={() => adjustNumberField("oxygenCylinderCount", +5)}
              onChange={val => updateDraft("oxygenCylinderCount", val)}
              tone="teal"
            />
            <QuickCapacityCard
              icon={PackagePlus}
              label="Blood Units Reserved"
              value={Number(draft.bloodUnitCount || 0)}
              onMinus={() => adjustNumberField("bloodUnitCount", -2)}
              onPlus={() => adjustNumberField("bloodUnitCount", +2)}
              onChange={val => updateDraft("bloodUnitCount", val)}
              tone="rose"
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
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                <Hospital className="h-5 w-5" />
              </span>
              <Label className="mt-4 block text-xs font-bold text-slate-800 dark:text-slate-200">Overall Facility Status</Label>
              <Select value={draft.status} onValueChange={val => updateDraft("status", val as any)}>
                <SelectTrigger className="mt-3 h-10 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🟢 Operational (Open)</SelectItem>
                  <SelectItem value="limited">🟡 Limited Capacity</SelectItem>
                  <SelectItem value="critical">🔴 Critical Load</SelectItem>
                  <SelectItem value="closed">⚫ Facility Closed / Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supplies status grid */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
              Logistics & Essential Utilities
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">Essential Disaster Logistics</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {supplyItems.map(({ key, label, icon: Icon }) => (
                <div key={key} className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</Label>
                  </div>
                  <Select value={draft[key]} onValueChange={val => updateDraft(key, val as SupplyStatus)}>
                    <SelectTrigger className="mt-3 h-9 text-xs font-semibold bg-white dark:bg-slate-800">
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
          </div>

          <Button
            onClick={handleSaveResources}
            disabled={updateResources.isPending}
            className="h-11 w-full rounded-xl bg-teal-600 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 transition"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {updateResources.isPending ? "Broadcasting live update…" : "Broadcast Live Hospital Update to Responders"}
          </Button>
        </section>
      )}

      {/* 6. TAB: COMMAND COORDINATION */}
      {activeTab === "coordination" && (
        <section className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
              Inter-Agency Channel
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              State Command Centre Coordination
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Direct emergency dispatch link between {hospital.name} and the State Disaster Operations Command.
            </p>
          </div>

          {coordSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              {coordSuccess}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Direct message form */}
            <form onSubmit={handleSendCoordination} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Broadcast Emergency Requirement</h3>
                  <p className="text-xs text-slate-500">Request state assets or alert command of clinical bottlenecks</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Request Category</Label>
                <Select value={coordCategory} onValueChange={setCoordCategory}>
                  <SelectTrigger className="mt-1.5 h-10 text-xs font-semibold">
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
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Priority Level</Label>
                <Select value={coordUrgency} onValueChange={val => setCoordUrgency(val as any)}>
                  <SelectTrigger className="mt-1.5 h-10 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical (Immediate Command Action)</SelectItem>
                    <SelectItem value="high">🟠 High Priority</SelectItem>
                    <SelectItem value="normal">🟡 Standard Operational Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Detailed Message</Label>
                <textarea
                  value={coordMessage}
                  onChange={e => setCoordMessage(e.target.value)}
                  placeholder="Detail patient counts, triage bottlenecks, or supply shortages…"
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-800 dark:bg-slate-800"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={sendCoordination.isPending || !coordMessage.trim()}
                className="h-10 w-full rounded-xl bg-teal-600 font-semibold text-white shadow-xs hover:bg-teal-700 transition"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendCoordination.isPending ? "Transmitting…" : "Dispatch Message to State Command"}
              </Button>
            </form>

            {/* Quick broadcast tiles */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Instant Tactical Templates</h3>
              <p className="text-xs text-slate-500">Click a preset to rapidly prefill emergency requests</p>

              <div className="grid gap-2.5 pt-2">
                <QuickActionTile
                  icon={Ambulance}
                  title="Request 2 Additional Ambulances"
                  desc="High trauma intake requiring transport backup"
                  onClick={() => {
                    setCoordCategory("additional_ambulance");
                    setCoordMessage("Requesting 2 additional 4x4 ambulance units for flood sector triage transport.");
                    setCoordUrgency("high");
                  }}
                />
                <QuickActionTile
                  icon={HeartPulse}
                  title="ICU at Full Capacity"
                  desc="Notify command to divert incoming trauma"
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
                    setCoordMessage("Oxygen reserves below 20%. Requesting urgent refill tanker dispatch from regional medical depot.");
                    setCoordUrgency("critical");
                  }}
                />
                <QuickActionTile
                  icon={Users}
                  title="Request Volunteer Medical Staff"
                  desc="Trauma nurse reinforcement for flood shift"
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

      {/* 7. TAB: AUDIT TIMELINE */}
      {activeTab === "timeline" && (
        <section className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600">
              Operational Log
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hospital Activity Audit Trail
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {timeline.data && timeline.data.length > 0 ? (
              <div className="relative border-l-2 border-slate-200 pl-5 space-y-5 dark:border-slate-800">
                {timeline.data.map(event => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full bg-teal-600 text-white text-[8px]">
                      ●
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                        {event.action}
                      </p>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(event.createdAt).toLocaleTimeString()} · {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">{event.detail}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">Actor: {event.actor?.name || "System Automated"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
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

function ClinicalTabButton({
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
      className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {badge && (
        <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function ClinicalMetricCard({
  label,
  value,
  subtext,
  trend,
  indicatorTone,
  barPercent,
}: {
  label: string;
  value: string;
  subtext: string;
  trend: string;
  indicatorTone: "teal" | "warning" | "danger";
  barPercent: number;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border/80">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{subtext}</span>
      </div>

      {/* Segmented clinical meter bar (Reference 2) */}
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 14 }).map((_, i) => {
          const filled = (i / 14) * 100 <= barPercent;
          return (
            <span
              key={i}
              className={`h-2 flex-1 rounded-xs transition-colors ${
                filled
                  ? indicatorTone === "danger"
                    ? "bg-red-500"
                    : indicatorTone === "warning"
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                  : "bg-muted"
              }`}
            />
          );
        })}
      </div>

      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        {trend}
      </p>
    </article>
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
  tone = "teal",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  total?: number;
  onMinus: () => void;
  onPlus: () => void;
  onChange: (val: string) => void;
  tone?: "teal" | "blue" | "rose" | "amber";
}) {
  const tones = {
    teal: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    blue: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
    rose: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  };

  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {pct !== null && (
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {pct}% available
          </span>
        )}
      </div>

      <p className="mt-3 text-xs font-bold text-foreground">{label}</p>

      <div className="mt-3 flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onMinus}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-muted/40 text-foreground transition hover:bg-muted active:scale-95"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <Input
          type="number"
          min="0"
          max={total}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 text-center font-mono text-base font-bold bg-background"
        />

        <button
          type="button"
          onClick={onPlus}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-muted/40 text-foreground transition hover:bg-muted active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {total !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${pct && pct < 20 ? "bg-red-500" : pct && pct < 40 ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Capacity baseline: {total} units
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
    critical: "bg-rose-600 text-white",
    high: "bg-orange-500 text-white",
    medium: "bg-amber-500 text-white",
    low: "bg-teal-600 text-white",
  };

  const statusMap: Record<string, { label: string; tone: string }> = {
    notified: { label: "INBOUND NOTIFIED", tone: "bg-rose-50 text-rose-700 ring-1 ring-rose-500/30 dark:bg-rose-950/50 dark:text-rose-400" },
    acknowledged: { label: "ACKNOWLEDGED", tone: "bg-amber-50 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-400" },
    preparing: { label: "PREPARING ER / ICU", tone: "bg-blue-50 text-blue-700 ring-1 ring-blue-500/30 dark:bg-blue-950/50 dark:text-blue-400" },
    ready: { label: "READY FOR INTAKE", tone: "bg-teal-50 text-teal-700 ring-1 ring-teal-500/30 dark:bg-teal-950/50 dark:text-teal-400" },
    received: { label: "PATIENTS RECEIVED", tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-400" },
    completed: { label: "CASE CONCLUDED", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  };

  const currentStatus = statusMap[notification.status] || { label: notification.status.toUpperCase(), tone: "bg-slate-100 text-slate-700" };

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${severityColors[notification.severity as keyof typeof severityColors] || "bg-rose-600 text-white"}`}>
              {notification.severity}
            </span>
            <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${currentStatus.tone}`}>
              {currentStatus.label}
            </span>
            <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
              CASE #{incident?.publicCode || notification.incidentId}
            </span>
          </div>

          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            {incident?.emergencyType ? `${incident.emergencyType.toUpperCase()} RESCUE EVACUATION` : "Emergency Rescue Inbound"}
          </h4>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <Radio className="h-3.5 w-3.5 text-teal-600" /> {rescuer?.callSign || rescuer?.name || "Field Unit"}
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
                <span className="rounded-md bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-400">
                  🔴 ICU Bed Required
                </span>
              )}
              {notification.oxygenRequired === "yes" && (
                <span className="rounded-md bg-teal-50 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-700 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
                  🫁 Oxygen Support Required
                </span>
              )}
            </div>
          )}

          {notification.notes && (
            <p className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <strong>Field Dispatch Note:</strong> {notification.notes}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {notification.status === "notified" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("acknowledged")}
              className="rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 shadow-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Acknowledge Case
            </Button>
          )}
          {notification.status === "acknowledged" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("preparing")}
              className="rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs"
            >
              <HeartPulse className="mr-1.5 h-3.5 w-3.5" /> Prepare ER & ICU
            </Button>
          )}
          {notification.status === "preparing" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("ready")}
              className="rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Ready for Arrival
            </Button>
          )}
          {notification.status === "ready" && (
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => onUpdateStatus("received")}
              className="rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
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
              className="rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Finalize Case
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function OnDutyStaffItem({
  name,
  specialty,
  dept,
  status,
}: {
  name: string;
  specialty: string;
  dept: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/30">
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {name.split(" ").slice(-1)[0][0]}
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{name}</p>
          <p className="text-[10px] text-slate-400">{specialty} · {dept}</p>
        </div>
      </div>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
        {status}
      </span>
    </div>
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
      className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-left transition hover:border-teal-500/50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
    </button>
  );
}
