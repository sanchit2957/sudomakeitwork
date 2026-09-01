import { useAuth } from "@/_core/hooks/useAuth";
import { RoleGate } from "@/components/RoleGate";
import { HospitalStaffDashboard } from "@/components/HospitalStaffDashboard";
import DashboardLayout, { type WorkspaceNavItem } from "@/components/DashboardLayout";
import OperationsMap from "@/components/OperationsMap";
import { Button } from "@/components/ui/button";
import { HospitalManager } from "@/pages/Command";
import HospitalRegistration from "@/pages/HospitalRegistration";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, Hospital, MapPinned, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Medical() {
  const { user, loading } = useAuth();
  if (!loading && user?.role === "user") {
    return <HospitalRegistration />;
  }
  return (
    <RoleGate roles={["medical", "admin"]}>
      <MedicalWorkspace />
    </RoleGate>
  );
}

function MedicalWorkspace() {
  const [location] = useLocation();
  const { user } = useAuth();
  const nav: WorkspaceNavItem[] = [
    { label: user?.role === "admin" ? "Hospital Overview" : "Hospital Command Desk", path: "/medical", icon: Hospital },
    { label: "Operations Map", path: "/medical/map", icon: MapPinned },
    ...(user?.role === "admin" ? [{ label: "Hospital Approvals", path: "/medical/access", icon: UserPlus }] : []),
  ];

  const live = { refetchInterval: 6_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
  const hospitals = trpc.rescue.operations.hospitals.useQuery(undefined, live);
  const myHospital = trpc.rescue.operations.myHospital.useQuery(undefined, { ...live, enabled: user?.role === "medical" });
  const layers = trpc.rescue.operations.mapLayers.useQuery(undefined, { refetchInterval: 12_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true });

  return (
    <DashboardLayout
      navItems={nav}
      workspace="Hospital Command Portal"
      roleLabel={user?.role === "admin" ? "State Command Coordinator" : "Authorized Medical Operations Officer"}
      desktopSidebar="fixed"
    >
      {location === "/medical/map" ? (
        <section className="space-y-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Shared Operating Picture</p>
            <h1 className="mt-1 text-2xl font-extrabold">Hospital & Emergency Response Sector Map</h1>
          </div>
          <div className="mt-4">
            <OperationsMap layers={layers.data} />
          </div>
        </section>
      ) : location === "/medical/access" && user?.role === "admin" ? (
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
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Verification Queue</p>
        <h1 className="mt-1 text-2xl font-extrabold">Hospital Registration Approvals</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Approve a verified hospital facility to establish its live resource record and unlock its dedicated hospital operations command desk.
        </p>
      </div>
      <div className="grid gap-4">
        {pending.length ? (
          pending.map(({ request, user }) => (
            <article key={request.id} className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-5 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf2fb] text-[#255c7d]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold">{request.hospitalName}</h2>
                      <p className="text-xs text-muted-foreground">
                        Requested by {user?.name || user?.email || `User #${user?.id ?? "unknown"}`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#284f46]">{request.address}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.contactPhone} · {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
                  </p>
                  {request.note && (
                    <p className="mt-4 rounded-xl bg-[#f4f8f6] p-3 text-sm leading-6 text-[#53746a]">{request.note}</p>
                  )}
                </div>
                <div className="grid min-w-52 gap-2">
                  <Button
                    disabled={review.isPending}
                    onClick={() => review.mutate({ requestId: request.id, decision: "approved" })}
                    className="rounded-xl font-bold"
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
                    className="rounded-xl text-destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Request Review
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-4 text-base font-extrabold">No Hospital Registrations Waiting</p>
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
