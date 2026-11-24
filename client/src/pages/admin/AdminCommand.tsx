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
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  HeartHandshake,
  Hospital,
  KeyRound,
  Layers,
  MapPinned,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TentTree,
  Timer,
  UserPlus,
  Users,
  UsersRound,
  ShieldPlus,
  ChevronDown,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type StatusFilter = "all" | "pending" | "dispatched" | "resolved";
type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type ShelterForm = { id?: number; name: string; address: string; latitude: string; longitude: string; capacity: string; occupancy: string; status: "open" | "limited" | "closed" };
type SupplyStatus = "available" | "limited" | "critical" | "unavailable";
type HospitalForm = {
  id?: number;
  name: string;
  address: string;
  contactPhone: string;
  latitude: string;
  longitude: string;
  totalEmergencyBeds: string;
  availableEmergencyBeds: string;
  totalIcuBeds: string;
  availableIcuBeds: string;
  oxygenCylinderCount: string;
  bloodUnitCount: string;
  ambulanceCount: string;
  foodSupplyStatus?: SupplyStatus;
  medicineSupplyStatus?: SupplyStatus;
  waterSupplyStatus?: SupplyStatus;
  powerBackupStatus?: SupplyStatus;
  status: "open" | "limited" | "critical" | "closed";
};

const blankShelter = (): ShelterForm => ({ name: "", address: "", latitude: "", longitude: "", capacity: "", occupancy: "", status: "open" });
const blankHospital = (): HospitalForm => ({
  name: "",
  address: "",
  contactPhone: "",
  latitude: "",
  longitude: "",
  totalEmergencyBeds: "",
  availableEmergencyBeds: "",
  totalIcuBeds: "",
  availableIcuBeds: "",
  oxygenCylinderCount: "",
  bloodUnitCount: "",
  ambulanceCount: "",
  foodSupplyStatus: "available",
  medicineSupplyStatus: "available",
  waterSupplyStatus: "available",
  powerBackupStatus: "available",
  status: "open",
});

import { isNativeApp } from "@/lib/apiConfig";
import MobileCommandRestricted from "@/components/MobileCommandRestricted";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminAccessCodes } from "@/components/AdminAccessCodes";
import { PostRescueRecords } from "@/components/PostRescueRecords";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminCommand() {
  return (
    <DesktopOnlyGate portalName="State Command Centre" portalType="admin">
      <RoleGate roles={["admin"]}>
        <CommandWorkspace />
      </RoleGate>
    </DesktopOnlyGate>
  );
}

function CommandWorkspace() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const nav: WorkspaceNavItem[] = [
    { label: t("command.operations") || "Operations Desk", path: "/command", icon: Activity },
    { label: t("command.map") || "Tactical Map", path: "/command/map", icon: MapPinned },
    { label: t("command.postRescueRecords") || "Post rescue records", path: "/command/post-rescue", icon: HeartHandshake },
    { label: "Access codes", path: "/command/access-codes", icon: KeyRound },
    { label: t("command.shelters") || "Shelters", path: "/command/shelters", icon: TentTree },
    { label: t("command.hospitals") || "Hospitals", path: "/command/hospitals", icon: Hospital },
    { label: t("command.team") || "Rescue Roster", path: "/command/team", icon: UsersRound },
    { label: "System users", path: "/command/users", icon: UserPlus },
  ];

  const [location, setLocation] = useLocation();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

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

  const refreshOperations = () => {
    void utils.rescue.operations.incidents.invalidate();
    void utils.rescue.operations.analytics.invalidate();
    void utils.rescue.operations.rescueRoster.invalidate();
    void utils.rescue.operations.mapLayers.invalidate();
    void utils.rescue.operations.availableUsers.invalidate();
    void utils.rescue.operations.rescuerRegistrationRequests.invalidate();
    void utils.rescue.operations.hospitalRegistrationRequests.invalidate();
    void utils.rescue.operations.postRescueRecords.invalidate();
    void utils.auth.listUsers.invalidate();
    void utils.auth.accessCodes.list.invalidate();
  };

  const assignMission = trpc.rescue.operations.assignMission.useMutation({
    onMutate: async ({ incidentId }) => {
      await utils.rescue.operations.incidents.cancel();
      const previous = utils.rescue.operations.incidents.getData();
      utils.rescue.operations.incidents.setData(undefined, rows => markIncidentDispatched(rows, incidentId));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.rescue.operations.incidents.setData(undefined, context.previous);
    },
    onSettled: refreshOperations,
  });

  const promote = trpc.rescue.operations.promoteRescuer.useMutation({ onSuccess: refreshOperations });
  const review = trpc.rescue.operations.reviewRescuerRegistration.useMutation({ onSuccess: refreshOperations });
  const reviewHospital = trpc.rescue.operations.reviewHospitalRegistration.useMutation({ onSuccess: refreshOperations });
  const createUser = trpc.auth.createUser.useMutation({ onSuccess: refreshOperations });

  useEffect(() => {
    const refresh = () => refreshOperations();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [utils]);

  const visibleIncidents = useMemo(() => {
    return (incidents.data || []).filter(row => {
      const matchesStatus = filter === "all" || row.incident.status === filter;
      const matchesSeverity = severityFilter === "all" || row.incident.severity === severityFilter;
      const matchesType = typeFilter === "all" || row.incident.emergencyType?.toLowerCase().includes(typeFilter.toLowerCase());
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        `${row.incident.publicCode} ${row.incident.locationLabel} ${row.incident.emergencyType}`.toLowerCase().includes(query);
      return matchesStatus && matchesSeverity && matchesType && matchesSearch;
    });
  }, [incidents.data, filter, severityFilter, typeFilter, search]);

  const clearAllFilters = () => {
    setFilter("all");
    setSeverityFilter("all");
    setTypeFilter("all");
    setSearch("");
  };

  const hasActiveFilters = filter !== "all" || severityFilter !== "all" || typeFilter !== "all" || search !== "";

  return (
    <DashboardLayout navItems={nav} workspace={t("command.workspace") || "State Command Centre"} roleLabel={t("command.role") || "Executive Dispatch"} desktopSidebar="fixed">
      {location === "/command/map" ? (
        <section className="space-y-4">
          <Heading eyebrow="Common Operating Picture" title="Pan-India Response Map" />
          <OperationsMap layers={layers.data} />
        </section>
      ) : location === "/command/post-rescue" ? (
        <PostRescueRecords />
      ) : location === "/command/access-codes" ? (
        <AdminAccessCodes />
      ) : location === "/command/shelters" ? (
        <ShelterManager layers={layers.data} />
      ) : location === "/command/hospitals" ? (
        <HospitalManager hospitals={hospitals.data || []} layers={layers.data} />
      ) : location === "/command/team" ? (
        <TeamRoster roster={roster.data || []} users={users.data || []} promote={promote} />
      ) : location === "/command/users" ? (
        <AdminUserManagement currentUserId={currentUser?.id} />
      ) : (
        <div className="space-y-6">
          {/* 1. TOP COMMAND BAR (Reference 1: MAP INBOX Header) */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    DISPATCH COMMAND INBOX
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Reconciling
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Operational Incidents & Tactical Dispatch
                </h1>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Real-time multi-agency coordination desk. Assign responders, monitor field units, and follow every mission to verified resolution.
                </p>
              </div>

              {/* Status and Active Filters Pill */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300">
                  INCIDENTS ACTIVE: {visibleIncidents.length} of {incidents.data?.length || 0}
                </span>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 2. BENTO KPI METRICS ROW */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Total Incidents"
              value={analytics.data?.totalIncidents}
              icon={BarChart3}
              tone="blue"
              footer="Total disaster distress calls logged"
            />
            <Metric
              label="Active Cases"
              value={analytics.data?.activeIncidents}
              icon={Activity}
              tone="amber"
              footer="In matching, dispatch, or transit"
            />
            <Metric
              label="Resolved Cases"
              value={analytics.data?.resolvedCases}
              icon={CheckCircle2}
              tone="green"
              footer="Successfully rescued & verified"
            />
            <Metric
              label="Active Responders"
              value={analytics.data?.activeRescuers}
              icon={UsersRound}
              tone="teal"
              footer={
                analytics.data?.averageResponseMinutes !== null && analytics.data?.averageResponseMinutes !== undefined
                  ? `${analytics.data.averageResponseMinutes} min average dispatch`
                  : "Field response telemetry live"
              }
            />
          </section>

          {/* 3. CENTRAL WORKSPACE: LEFT FILTER RAIL + TACTICAL MAP (Reference 1 Layout) */}
          <section className="grid gap-6 lg:grid-cols-12">
            {/* Left Filter Rail (Reference 1 style) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Filter Operations
                </span>
                <Filter className="h-4 w-4 text-slate-400" />
              </div>

              {/* Keyword Search */}
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Keyword Search
                </Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search SOS code, location, type…"
                    className="h-9 pl-8 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Dispatch Status
                </Label>
                <Select value={filter} onValueChange={v => setFilter(v as StatusFilter)}>
                  <SelectTrigger className="mt-1.5 h-9 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dispatch Stages</SelectItem>
                    <SelectItem value="pending">Pending Dispatch</SelectItem>
                    <SelectItem value="dispatched">Unit Dispatched</SelectItem>
                    <SelectItem value="resolved">Resolved & Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Urgency / Severity */}
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Urgency / Severity
                </Label>
                <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
                  <SelectTrigger className="mt-1.5 h-9 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity Levels</SelectItem>
                    <SelectItem value="critical">🔴 Critical Severity</SelectItem>
                    <SelectItem value="high">🟠 High Severity</SelectItem>
                    <SelectItem value="medium">🟡 Medium Severity</SelectItem>
                    <SelectItem value="low">🟢 Low Severity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Incident Type */}
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Emergency Category
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="mt-1.5 h-9 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="flood">Flood Evacuation</SelectItem>
                    <SelectItem value="medical">Medical Assistance</SelectItem>
                    <SelectItem value="collapse">Structure Collapse</SelectItem>
                    <SelectItem value="landslide">Landslide Zone</SelectItem>
                    <SelectItem value="food">Food & Rations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Workflow Protocol Card */}
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Dispatch Protocol</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Automated dispatch continuously pairs closest available units. Coordinators can override or manually route cases at any stage.
                </p>
              </div>
            </div>

            {/* Tactical Map (Reference 1 style) */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Tactical Situational Map
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Common Operating Picture (Pan-India Sector)
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  Carto & Leaflet Sync
                </span>
              </div>
              <OperationsMap layers={layers.data} compact />
            </div>
          </section>

          {/* 4. BOTTOM TABULAR INCIDENT ROSTER (Reference 1 Bottom Table Benchmark) */}
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Incident Roster Table
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Active SOS Alerts & Dispatch Pipeline
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500">
                Showing {visibleIncidents.length} incident record(s)
              </span>
            </div>

            {visibleIncidents.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="mx-auto h-8 w-8 text-teal-500 mb-2" />
                No active incidents match your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="py-3 px-4">SOS Public Code</th>
                      <th className="py-3 px-4">Location / Landmark</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Dispatch Status</th>
                      <th className="py-3 px-4">Assigned Unit</th>
                      <th className="py-3 px-4">Command Action</th>
                      <th className="py-3 px-4">Reported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleIncidents.map(({ incident, rescuerName, rescuerCallSign, activeOffer }: any) => {
                      const ds = incident.dispatchStatus || "triage_pending";
                      const isEscalated = ds === "escalated";
                      const isOffered = ds === "offered";
                      const isMatching = ds === "matching";

                      return (
                        <tr
                          key={incident.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            isEscalated ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                          }`}
                        >
                          {/* Code */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            <span className="font-mono text-teal-700 dark:text-teal-400">
                              {incident.publicCode}
                            </span>
                          </td>

                          {/* Location */}
                          <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs">
                            <div className="truncate font-semibold">{incident.locationLabel}</div>
                            <div className="text-[11px] text-slate-400">
                              {incident.peopleAffected} person(s) affected
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {incident.emergencyType || "Evacuation"}
                            </span>
                          </td>

                          {/* Urgency / Severity */}
                          <td className="py-3.5 px-4">
                            <SeverityBadge severity={incident.severity} />
                          </td>

                          {/* Dispatch Status */}
                          <td className="py-3.5 px-4">
                            {isEscalated ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse">
                                ⚠️ Escalated
                              </span>
                            ) : isOffered ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400">
                                ⏱️ Offer Active
                              </span>
                            ) : isMatching ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-500/30 dark:bg-blue-950/40 dark:text-blue-400">
                                🔍 Matching Unit…
                              </span>
                            ) : incident.status === "dispatched" ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                En Route
                              </span>
                            ) : incident.status === "resolved" ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Resolved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Classifying
                              </span>
                            )}
                          </td>

                          {/* Assigned Unit */}
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            {rescuerName ? (
                              <span className="font-bold text-slate-900 dark:text-white">
                                {rescuerCallSign || rescuerName}
                              </span>
                            ) : isOffered && activeOffer ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                {activeOffer.rescuerCallSign} ({activeOffer.distanceKm?.toFixed(1)} km)
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>

                          {/* Command Action */}
                          <td className="py-3.5 px-4">
                            {incident.status === "pending" ? (
                              incident.dispatchStatus === "escalated" ? (
                                <AssignControl
                                  incidentId={incident.id}
                                  rescuers={(roster.data || []).filter(({ profile }) => profile.availability === "available")}
                                  assigning={assignMission.isPending}
                                  onAssign={rescuerId => assignMission.mutate({ incidentId: incident.id, rescuerId })}
                                  label="Assign Manually"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-300">
                                    Auto-dispatch
                                  </span>
                                  <details className="relative">
                                    <summary className="cursor-pointer text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                                      Override
                                    </summary>
                                    <div className="absolute right-0 top-6 z-20 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                      <AssignControl
                                        incidentId={incident.id}
                                        rescuers={(roster.data || []).filter(({ profile }) => profile.availability === "available")}
                                        assigning={assignMission.isPending}
                                        onAssign={rescuerId => assignMission.mutate({ incidentId: incident.id, rescuerId })}
                                        label="Confirm Override"
                                      />
                                    </div>
                                  </details>
                                </div>
                              )
                            ) : (
                              <span className="text-[11px] font-medium text-slate-500">
                                {incident.status === "dispatched" ? "Dispatched" : "Completed"}
                              </span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

/* -------------------------------------------------------------
 * AUXILIARY MANAGERS & COMPONENTS
 * ------------------------------------------------------------- */

function AssignControl({
  incidentId,
  rescuers,
  assigning,
  onAssign,
  label = "Assign",
}: {
  incidentId: number;
  rescuers: Array<{ user: { id: number; name: string | null }; profile: { callSign: string } }>;
  assigning: boolean;
  onAssign: (rescuerId: number) => void;
  label?: string;
}) {
  const [selection, setSelection] = useState("");
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <Select value={selection} onValueChange={setSelection}>
        <SelectTrigger className="h-8 text-xs font-medium">
          <SelectValue placeholder="Select rescuer" />
        </SelectTrigger>
        <SelectContent>
          {rescuers.length ? (
            rescuers.map(({ user, profile }) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {profile.callSign}{user.name ? ` · ${user.name}` : ""}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>No units available</SelectItem>
          )}
        </SelectContent>
      </Select>
      <Button
        disabled={!selection || selection === "none" || assigning}
        onClick={() => onAssign(Number(selection))}
        className="h-7 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold"
      >
        <UserPlus className="mr-1 h-3 w-3" /> {label}
      </Button>
    </div>
  );
}

function ShelterManager({ layers }: { layers?: OperationalLayers }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ShelterForm>(blankShelter());
  const add = trpc.rescue.operations.addShelter.useMutation({
    onSuccess: () => {
      utils.rescue.operations.mapLayers.invalidate();
      setForm(blankShelter());
    },
  });
  const update = trpc.rescue.operations.updateShelter.useMutation({
    onSuccess: () => {
      utils.rescue.operations.mapLayers.invalidate();
      setForm(blankShelter());
    },
  });

  const save = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      address: form.address,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      capacity: Number(form.capacity || 0),
      occupancy: Number(form.occupancy || 0),
      status: form.status,
    };
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return;
    if (form.id) update.mutate({ id: form.id, ...payload });
    else add.mutate(payload);
  };

  return (
    <section className="space-y-6">
      <Heading eyebrow="Relief Infrastructure" title="Shelter Operations Layer" />
      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={save} className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                {form.id ? "Edit Shelter" : "New Relief Site"}
              </p>
              <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {form.id ? form.name : "Register Evacuation Shelter"}
              </h2>
            </div>
            {form.id && (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(blankShelter())} className="rounded-xl text-xs">
                New
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="Shelter Name" value={form.name} onChange={value => setForm({ ...form, name: value })} />
            <Field label="Address / Landmark" value={form.address} onChange={value => setForm({ ...form, address: value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" value={form.latitude} onChange={value => setForm({ ...form, latitude: value })} type="number" />
              <Field label="Longitude" value={form.longitude} onChange={value => setForm({ ...form, longitude: value })} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Capacity" value={form.capacity} onChange={value => setForm({ ...form, capacity: value })} type="number" />
              <Field label="Current Occupancy" value={form.occupancy} onChange={value => setForm({ ...form, occupancy: value })} type="number" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</Label>
              <Select value={form.status} onValueChange={value => setForm({ ...form, status: value as ShelterForm["status"] })}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🟢 Operational (Open)</SelectItem>
                  <SelectItem value="limited">🟡 Limited Capacity</SelectItem>
                  <SelectItem value="closed">⚫ Offline / Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={add.isPending || update.isPending} className="mt-5 w-full rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> {form.id ? "Update Shelter Record" : "Add Shelter to Map"}
          </Button>
          {(add.error || update.error) && <p className="mt-3 text-xs font-semibold text-rose-600">{add.error?.message || update.error?.message}</p>}
        </form>

        <div className="lg:col-span-7 space-y-4">
          <OperationsMap
            layers={layers}
            onPickLocation={point => setForm(previous => ({ ...previous, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) }))}
            compact
          />
          <div className="grid gap-2">
            {layers?.shelters?.length ? (
              layers.shelters.map(shelter => (
                <button
                  key={shelter.id}
                  onClick={() =>
                    setForm({
                      id: shelter.id,
                      name: shelter.name,
                      address: shelter.address,
                      latitude: String(shelter.latitude),
                      longitude: String(shelter.longitude),
                      capacity: String(shelter.capacity),
                      occupancy: String(shelter.occupancy),
                      status: shelter.status as ShelterForm["status"],
                    })
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 text-left hover:border-teal-500/50 dark:border-slate-800 dark:bg-slate-900 transition"
                >
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{shelter.name}</span>
                    <span className="block text-[11px] text-slate-500">{shelter.address}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {shelter.occupancy} / {shelter.capacity} ({shelter.status})
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No shelters recorded yet. Click map to pick coordinates and register.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HospitalManager({
  hospitals,
  layers,
}: {
  hospitals: Array<{
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
    status: string;
  }>;
  layers?: OperationalLayers;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<HospitalForm>(blankHospital());
  const add = trpc.rescue.operations.addHospital.useMutation({
    onSuccess: () => {
      utils.rescue.operations.hospitals.invalidate();
      utils.rescue.operations.mapLayers.invalidate();
      setForm(blankHospital());
    },
  });
  const update = trpc.rescue.operations.updateHospital.useMutation({
    onSuccess: () => {
      utils.rescue.operations.hospitals.invalidate();
      utils.rescue.operations.mapLayers.invalidate();
      setForm(blankHospital());
    },
  });

  const save = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      address: form.address,
      contactPhone: form.contactPhone || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      totalEmergencyBeds: Number(form.totalEmergencyBeds || 0),
      availableEmergencyBeds: Number(form.availableEmergencyBeds || 0),
      totalIcuBeds: Number(form.totalIcuBeds || 0),
      availableIcuBeds: Number(form.availableIcuBeds || 0),
      oxygenCylinderCount: Number(form.oxygenCylinderCount || 0),
      bloodUnitCount: Number(form.bloodUnitCount || 0),
      ambulanceCount: Number(form.ambulanceCount || 0),
      status: form.status,
    };
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return;
    if (form.id) update.mutate({ id: form.id, ...payload });
    else add.mutate(payload);
  };

  const edit = (hospital: typeof hospitals[number]) =>
    setForm({
      id: hospital.id,
      name: hospital.name,
      address: hospital.address,
      contactPhone: hospital.contactPhone || "",
      latitude: String(hospital.latitude),
      longitude: String(hospital.longitude),
      totalEmergencyBeds: String(hospital.totalEmergencyBeds),
      availableEmergencyBeds: String(hospital.availableEmergencyBeds),
      totalIcuBeds: String(hospital.totalIcuBeds),
      availableIcuBeds: String(hospital.availableIcuBeds),
      oxygenCylinderCount: String(hospital.oxygenCylinderCount),
      bloodUnitCount: String(hospital.bloodUnitCount),
      ambulanceCount: String(hospital.ambulanceCount),
      status: hospital.status as HospitalForm["status"],
    });

  return (
    <section className="space-y-6">
      <Heading eyebrow="Clinical Infrastructure" title="Hospitals & Critical Medical Assets" />
      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={save} className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                {form.id ? "Edit Medical Centre" : "New Hospital"}
              </p>
              <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {form.id ? form.name : "Add Healthcare Facility"}
              </h2>
            </div>
            {form.id && (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(blankHospital())} className="rounded-xl text-xs">
                New
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="Facility Name" value={form.name} onChange={value => setForm({ ...form, name: value })} />
            <Field label="Address / Sector" value={form.address} onChange={value => setForm({ ...form, address: value })} />
            <Field label="Emergency Contact Phone" value={form.contactPhone} onChange={value => setForm({ ...form, contactPhone: value })} placeholder="+91 …" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" value={form.latitude} onChange={value => setForm({ ...form, latitude: value })} type="number" />
              <Field label="Longitude" value={form.longitude} onChange={value => setForm({ ...form, longitude: value })} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emergency Beds Total" value={form.totalEmergencyBeds} onChange={value => setForm({ ...form, totalEmergencyBeds: value })} type="number" />
              <Field label="Emergency Beds Available" value={form.availableEmergencyBeds} onChange={value => setForm({ ...form, availableEmergencyBeds: value })} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ICU Beds Total" value={form.totalIcuBeds} onChange={value => setForm({ ...form, totalIcuBeds: value })} type="number" />
              <Field label="ICU Beds Available" value={form.availableIcuBeds} onChange={value => setForm({ ...form, availableIcuBeds: value })} type="number" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Oxygen" value={form.oxygenCylinderCount} onChange={value => setForm({ ...form, oxygenCylinderCount: value })} type="number" />
              <Field label="Blood Units" value={form.bloodUnitCount} onChange={value => setForm({ ...form, bloodUnitCount: value })} type="number" />
              <Field label="Ambulances" value={form.ambulanceCount} onChange={value => setForm({ ...form, ambulanceCount: value })} type="number" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Readiness Status</Label>
              <Select value={form.status} onValueChange={value => setForm({ ...form, status: value as HospitalForm["status"] })}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">🟢 Operational (Open)</SelectItem>
                  <SelectItem value="limited">🟡 Limited Capacity</SelectItem>
                  <SelectItem value="critical">🔴 Critical Shortage</SelectItem>
                  <SelectItem value="closed">⚫ Facility Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={add.isPending || update.isPending} className="mt-5 w-full rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" /> {form.id ? "Update Facility Record" : "Add Hospital to Operational Network"}
          </Button>
          {(add.error || update.error) && <p className="mt-3 text-xs font-semibold text-rose-600">{add.error?.message || update.error?.message}</p>}
        </form>

        <div className="lg:col-span-7 space-y-4">
          <OperationsMap
            layers={layers}
            onPickLocation={point => setForm(previous => ({ ...previous, latitude: point.lat.toFixed(6), longitude: point.lng.toFixed(6) }))}
            compact
          />
          <div className="grid gap-2">
            {hospitals.length ? (
              hospitals.map(h => (
                <button
                  key={h.id}
                  onClick={() => edit(h)}
                  className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-left hover:border-teal-500/50 dark:border-slate-800 dark:bg-slate-900 transition shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{h.name}</p>
                      <p className="text-[11px] text-slate-500">{h.address}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {h.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    <span>ER: {h.availableEmergencyBeds}/{h.totalEmergencyBeds}</span>
                    <span>ICU: {h.availableIcuBeds}/{h.totalIcuBeds}</span>
                    <span>O₂: {h.oxygenCylinderCount}</span>
                    <span>Ambulances: {h.ambulanceCount}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No hospitals mapped yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamRoster({
  roster,
  users,
  promote,
}: {
  roster: Array<{ user: { id: number; name: string | null; email: string | null }; profile: { callSign: string; availability: string; updatedAt: Date } }>;
  users: Array<{ id: number; name: string | null; email: string | null; role: string }>;
  promote: ReturnType<typeof trpc.rescue.operations.promoteRescuer.useMutation>;
}) {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState("");
  const [callSign, setCallSign] = useState("");
  const [phone, setPhone] = useState("");
  const candidates = users.filter(user => user.role === "user");

  const create = () => {
    if (!selected || !callSign.trim()) return;
    promote.mutate(
      { userId: Number(selected), callSign: callSign.trim(), phone: phone.trim() || undefined },
      {
        onSuccess: () => {
          setSelected("");
          setCallSign("");
          setPhone("");
          utils.rescue.operations.rescueRoster.invalidate();
        },
      }
    );
  };

  return (
    <section className="space-y-6">
      <Heading eyebrow="Response Capacity" title="Field Rescue Roster" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Authorize Responder
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">Provision Field Unit</h2>
          <div className="mt-4 grid gap-3">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select candidate user" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length ? (
                  candidates.map(u => (
                    <SelectItem value={String(u.id)} key={u.id}>
                      {u.name || u.email || `User #${u.id}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No unassigned users</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Field label="Call Sign" value={callSign} onChange={setCallSign} placeholder="NDRF-Bravo-01" />
            <Field label="Phone Contact" value={phone} onChange={setPhone} placeholder="+91 …" />
            <Button
              disabled={!selected || selected === "none" || !callSign.trim() || promote.isPending}
              onClick={create}
              className="mt-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-semibold text-xs"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Authorize Field Unit
            </Button>
            {promote.error && <p className="text-xs font-semibold text-rose-600">{promote.error.message}</p>}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-2">
          {roster.length ? (
            roster.map(({ user, profile }) => (
              <article
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-600 font-bold dark:bg-teal-950/40 dark:text-teal-400">
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{profile.callSign}</p>
                    <p className="text-[11px] text-slate-500">{user.name || user.email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  profile.availability === "available"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : profile.availability === "on_mission"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  {profile.availability.replace("_", " ")}
                </span>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No field rescuers authorized yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">{eyebrow}</p>
      <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "teal",
  footer,
}: {
  label: string;
  value?: number;
  icon: typeof BarChart3;
  tone?: "teal" | "amber" | "green" | "blue";
  footer?: string;
}) {
  const tones = {
    teal: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400",
    green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
  };

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value ?? "—"}</p>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      {footer && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-slate-800">
          {footer}
        </p>
      )}
    </article>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const modes = {
    critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400",
    high: "bg-amber-50 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400",
    medium: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-500/30 dark:bg-yellow-950/40 dark:text-yellow-400",
    low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${modes[severity as keyof typeof modes] || "bg-slate-100 text-slate-700"}`}>
      {severity}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-xs bg-white dark:bg-slate-800"
      />
    </div>
  );
}
