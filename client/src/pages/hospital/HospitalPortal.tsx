import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePortalConnectionStatus } from "@/hooks/usePortalStream";
import { RoleGate } from "@/components/RoleGate";
import { HospitalStaffDashboard } from "@/components/HospitalStaffDashboard";
import { HospitalMyBranches } from "@/components/HospitalMyBranches";
import type { HospitalBranchRecord } from "@/components/HospitalBranchForm";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap from "@/components/OperationsMap";
import { INDIA_CENTER } from "@shared/india-locations";
import { Button } from "@/components/ui/button";
import { HospitalManager } from "@/pages/admin/AdminCommand";
import HospitalRegistration from "./HospitalRegistration";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Hospital, MapPinned, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { useLocation } from "wouter";

const ACTIVE_BRANCH_STORAGE_KEY = "sahay_active_hospital_branch_id";

export default function HospitalPortal() {
  const { user, loading } = useAuth();
  if (!loading && user?.role === "user") {
    return <HospitalRegistration />;
  }
  return (
    <RoleGate roles={["hospital", "medical", "admin"]}>
      <HospitalWorkspace />
    </RoleGate>
  );
}

function HospitalWorkspace() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isOfficer = user?.role === "hospital" || user?.role === "medical";

  const nav: WorkspaceNavItem[] = [
    { label: user?.role === "admin" ? "Hospital Overview" : "Hospital Command Desk", path: "/hospital", icon: Hospital },
    ...(isOfficer ? [{ label: "My Branches", path: "/hospital/branches", icon: Building2 }] : []),
    { label: "Operations Map", path: "/hospital/map", icon: MapPinned },
    ...(user?.role === "admin" ? [{ label: "Hospital Approvals", path: "/hospital/access", icon: UserPlus }] : []),
  ];

  const sseConnected = usePortalConnectionStatus("hospital");
  const live = { refetchInterval: sseConnected ? false : 6_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const hospitals = trpc.rescue.operations.hospitals.useQuery(undefined, live);
  const myBranches = trpc.rescue.operations.myBranches.useQuery(undefined, {
    ...live,
    enabled: isOfficer,
  });

  const branchList = (myBranches.data || []) as unknown as HospitalBranchRecord[];
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
      return saved ? parseInt(saved, 10) || null : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!branchList.length) {
      if (activeBranchId !== null) setActiveBranchId(null);
      return;
    }
    const stillExists = activeBranchId != null && branchList.some(b => b.id === activeBranchId);
    if (!stillExists) {
      const primary = branchList.find(b => b.isPrimaryBranch) ?? branchList[0];
      setActiveBranchId(primary.id);
    }
  }, [branchList, activeBranchId]);

  const handleSelectBranch = (branchId: number) => {
    setActiveBranchId(branchId);
    try {
      localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, String(branchId));
    } catch {}
  };

  const activeBranch =
    branchList.find(b => b.id === activeBranchId) ?? branchList.find(b => b.isPrimaryBranch) ?? branchList[0] ?? null;

  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, {
    refetchInterval: sseConnected ? false : 12_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return (
    <DashboardLayout
      navItems={nav}
      workspace="Hospital Command Portal"
      roleLabel={user?.role === "admin" ? "National / State Command Coordinator" : "Authorized Hospital Operations Officer"}
      desktopSidebar="fixed"
    >
      {location === "/hospital/branches" && isOfficer ? (
        <HospitalMyBranches
          branches={branchList}
          activeBranchId={activeBranch?.id ?? null}
          onSelectBranch={handleSelectBranch}
          onOpenDashboard={() => setLocation("/hospital")}
        />
      ) : location === "/hospital/map" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Shared Operating Picture
              </p>
              <h1 className="mt-1 text-2xl font-extrabold">
                {activeBranch
                  ? `${activeBranch.organizationName} — ${activeBranch.branchName} Map`
                  : "Hospital & Emergency Response Map (India)"}
              </h1>
            </div>
            {isOfficer && branchList.length > 1 && (
              <select
                aria-label="Center map on branch"
                value={activeBranch?.id ?? ""}
                onChange={e => handleSelectBranch(Number(e.target.value))}
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                {branchList.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.organizationName} — {b.branchName} ({b.city})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4">
            <OperationsMap
              layers={layers.data}
              focusCenter={
                activeBranch ? { lat: activeBranch.latitude, lng: activeBranch.longitude } : INDIA_CENTER
              }
              focusZoom={activeBranch ? 14 : 5}
              highlightedHospitalId={activeBranch?.id ?? null}
            />
          </div>
        </section>
      ) : location === "/hospital/access" && user?.role === "admin" ? (
        <HospitalApprovals />
      ) : user?.role === "admin" ? (
        <HospitalManager hospitals={hospitals.data || []} layers={layers.data} />
      ) : (
        <HospitalStaffDashboard
          hospital={activeBranch as any}
          branches={branchList}
          activeBranchId={activeBranch?.id ?? null}
          onSelectBranch={handleSelectBranch}
          loadingBranches={myBranches.isLoading}
        />
      )}
    </DashboardLayout>
  );
}

function HospitalApprovals() {
  const utils = trpc.useUtils();
  const requests = trpc.rescue.operations.hospitalRegistrationRequests.useQuery(undefined, { refetchInterval: 8_000, refetchOnWindowFocus: true });
  const review = trpc.rescue.operations.reviewHospitalRegistration.useMutation({
    onSuccess: () => {
      void utils.rescue.operations.hospitalRegistrationRequests.invalidate();
      void utils.rescue.operations.hospitals.invalidate();
      void utils.rescue.operations.mapLayers.invalidate();
    },
  });
  const pending = (requests.data || []).filter(({ request }) => request.status === "pending");

  return (
    <section className="max-w-5xl space-y-6">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Verification Queue</p>
        <h1 className="mt-1 text-2xl font-extrabold">Hospital Registration Approvals</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Approve a verified hospital facility to establish its live resource record and unlock its dedicated hospital operations command desk.
        </p>
      </div>
      <div className="grid gap-4">
        {pending.length ? (
          pending.map(({ request, user }) => (
            <article key={request.id} className="rounded-3xl border border-[#E2E8F0]/25 dark:border-white/10 bg-card/90 backdrop-blur-md p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-5 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#1D4ED8]/10 text-[#1D4ED8]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-black text-foreground">{request.hospitalName}</h2>
                      <p className="text-xs text-muted-foreground">
                        Requested by {user?.name || user?.email || `User #${user?.id ?? "unknown"}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">{request.address}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.contactPhone} · {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
                  </p>
                  {request.note && (
                    <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{request.note}</p>
                  )}
                </div>
                <div className="grid min-w-52 gap-2">
                  <Button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ requestId: request.id, decision: "approved" })}
                    className="rounded-xl font-bold bg-[#1D4ED8] text-white hover:bg-[#1a44cc] shadow-sm transition"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Facility
                  </Button>
                  <Button
                    disabled={review.isPending}
                    variant="outline"
                    onClick={() =>
                      review.mutate({
                        requestId: request.id,
                        decision: "rejected",
                        reviewNote: "Please provide official medical facility accreditation.",
                      })
                    }
                    className="rounded-xl text-destructive border-[#E2E8F0]/30 hover:bg-destructive/10"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Request Review
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-[#E2E8F0]/30 bg-card/60 backdrop-blur-md p-10 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#1D4ED8]" />
            <p className="mt-4 text-base font-extrabold text-foreground">No Hospital Registrations Waiting</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              New medical center registrations will appear here for State Command verification.
            </p>
          </div>
        )}
      </div>
      {review.error && <p className="text-sm font-semibold text-destructive">{review.error.message}</p>}
    </section>
  );
}
