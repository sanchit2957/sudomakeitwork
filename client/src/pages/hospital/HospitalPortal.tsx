import { useAuth } from "@/_core/hooks/useAuth";
import { RoleGate } from "@/components/RoleGate";
import { DesktopOnlyGate } from "@/components/DesktopOnlyGate";
import { HospitalStaffDashboard } from "@/components/HospitalStaffDashboard";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { HospitalManager } from "@/pages/admin/AdminCommand";
import HospitalRegistration from "./HospitalRegistration";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Hospital, MapPinned, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function HospitalPortal() {
  const { user, loading } = useAuth();
  if (!loading && user?.role === "user") {
    return <HospitalRegistration />;
  }
  return (
    <DesktopOnlyGate portalName="Hospital Operations Desk" portalType="hospital">
      <RoleGate roles={["hospital", "medical", "admin"]}>
        <HospitalWorkspace />
      </RoleGate>
    </DesktopOnlyGate>
  );
}

function HospitalWorkspace() {
  const [location] = useLocation();
  const { user } = useAuth();
  const nav: WorkspaceNavItem[] = [
    { label: user?.role === "admin" ? "Hospital Overview" : "Hospital Command Desk", path: "/hospital", icon: Hospital },
    { label: "Operations Map", path: "/hospital/map", icon: MapPinned },
    ...(user?.role === "admin" ? [{ label: "Hospital Approvals", path: "/hospital/access", icon: UserPlus }] : []),
  ];

  const live = { refetchInterval: 6_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const hospitals = trpc.rescue.operations.hospitals.useQuery(undefined, live);
  const myHospital = trpc.rescue.operations.myHospital.useQuery(undefined, { ...live, enabled: user?.role === "hospital" || user?.role === "medical" });
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, { refetchInterval: 12_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true });

  return (
    <DashboardLayout
      navItems={nav}
      workspace="Hospital Command Portal"
      roleLabel={user?.role === "admin" ? "State Command Coordinator" : "Authorized Hospital Operations Officer"}
      desktopSidebar="fixed"
    >
      {location === "/hospital/map" ? (
        <section className="space-y-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Shared Operating Picture
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hospital & Emergency Response Sector Map
            </h1>
          </div>
          <div className="mt-4">
            <OperationsMap layers={layers.data} />
          </div>
        </section>
      ) : location === "/hospital/access" && user?.role === "admin" ? (
        <HospitalApprovals />
      ) : user?.role === "admin" ? (
        <HospitalManager hospitals={hospitals.data || []} layers={layers.data} />
      ) : (
        <HospitalStaffDashboard hospital={myHospital.data} />
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
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          Verification Queue
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Hospital Registration Approvals
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Approve verified healthcare facilities to establish live inventory tracking and unlock their specialized clinical desk.
        </p>
      </div>
      <div className="grid gap-4">
        {pending.length ? (
          pending.map(({ request, user }) => (
            <article key={request.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col justify-between gap-5 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{request.hospitalName}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Requested by {user?.name || user?.email || `User #${user?.id ?? "unknown"}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{request.address}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {request.contactPhone} · {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
                  </p>
                  {request.note && (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {request.note}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-48 justify-center">
                  <Button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ requestId: request.id, decision: "approved" })}
                    className="rounded-xl font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-xs transition"
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
                    className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Request Review
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <ShieldCheck className="mx-auto h-10 w-10 text-teal-600 dark:text-teal-400" />
            <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">No Hospital Registrations Waiting</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              New medical center registrations will appear here for State Command verification.
            </p>
          </div>
        )}
      </div>
      {review.error && <p className="text-sm font-semibold text-rose-600">{review.error.message}</p>}
    </section>
  );
}
