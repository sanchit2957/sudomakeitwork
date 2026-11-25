import React, { useState } from "react";
import {
  HospitalBranchForm,
  type FacilityStatus,
  type HospitalBranchRecord,
  type HospitalBranchSubmitPayload,
} from "./HospitalBranchForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  Droplets,
  Edit3,
  HeartPulse,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  Wind,
  X,
} from "lucide-react";
import { toast } from "sonner";

function StatusPill({ status }: { status: FacilityStatus }) {
  const styles: Record<FacilityStatus, string> = {
    open: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    limited: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
    critical: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
    closed: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${styles[status] || styles.open}`}>
      {status === "critical" ? "FULL" : status.toUpperCase()}
    </span>
  );
}

export function HospitalMyBranches({
  branches,
  activeBranchId,
  onSelectBranch,
  onOpenDashboard,
}: {
  branches: HospitalBranchRecord[];
  activeBranchId: number | null;
  onSelectBranch: (branchId: number) => void;
  onOpenDashboard?: () => void;
}) {
  const utils = trpc.useUtils();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<HospitalBranchRecord | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<HospitalBranchRecord | null>(null);

  const createBranch = trpc.rescue.operations.createMyHospitalBranch.useMutation({
    onSuccess: async (created: any) => {
      await Promise.all([
        utils.rescue.operations.myBranches.invalidate(),
        utils.rescue.operations.myHospital.invalidate(),
        utils.rescue.operations.hospitals.invalidate(),
        utils.rescue.operations.mapLayers.invalidate(),
      ]);
      const newId = created?.branch?.id ?? created?.id;
      if (newId) onSelectBranch(newId);
      setShowAddModal(false);
      toast.success("New hospital branch registered & synced live!");
    },
    onError: err => {
      toast.error(err.message || "Failed to add hospital branch");
    },
  });

  const updateBranch = trpc.rescue.operations.updateMyHospitalBranch.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.rescue.operations.myBranches.invalidate(),
        utils.rescue.operations.myHospital.invalidate(),
        utils.rescue.operations.hospitals.invalidate(),
        utils.rescue.operations.mapLayers.invalidate(),
      ]);
      setEditingBranch(null);
      toast.success("Branch details & telemetry updated!");
    },
    onError: err => {
      toast.error(err.message || "Failed to update branch");
    },
  });

  const deleteBranch = trpc.rescue.operations.deleteMyHospitalBranch.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.rescue.operations.myBranches.invalidate(),
        utils.rescue.operations.myHospital.invalidate(),
        utils.rescue.operations.hospitals.invalidate(),
        utils.rescue.operations.mapLayers.invalidate(),
      ]);
      setDeletingBranch(null);
      toast.success("Hospital branch removed.");
    },
    onError: err => {
      toast.error(err.message || "Failed to remove branch");
    },
  });

  const totalErAvailable = branches.reduce((sum, b) => sum + (b.availableEmergencyBeds ?? b.erAvailable ?? 0), 0);
  const totalErCap = branches.reduce((sum, b) => sum + (b.totalEmergencyBeds ?? b.erTotal ?? 0), 0);
  const totalIcuAvailable = branches.reduce((sum, b) => sum + (b.availableIcuBeds ?? b.icuAvailable ?? 0), 0);
  const totalIcuCap = branches.reduce((sum, b) => sum + (b.totalIcuBeds ?? b.icuTotal ?? 0), 0);
  const defaultOrg = branches[0]?.organizationName || "";

  async function handleQuickStatus(branch: HospitalBranchRecord, nextStatus: FacilityStatus) {
    await updateBranch.mutateAsync({ id: branch.id, status: nextStatus });
  }

  return (
    <section className="space-y-6 max-w-6xl">
      {/* Header & CTA */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2457FF]">
            Multi-Branch Network Management
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
            My Hospital Branches
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage facilities registered under your hospital operations account across any city in India.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-xl bg-[#2457FF] px-5 font-extrabold text-white hover:bg-[#1d47db] shadow-sm self-start sm:self-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Branch
        </Button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Registered Branches</span>
            <Building2 className="h-4 w-4 text-[#2457FF]" />
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-foreground">{branches.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {branches.filter(b => b.status === "open").length} open for inbound emergency cases
          </p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Combined ER Availability</span>
            <BedDouble className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
            {totalErAvailable} <span className="text-base font-bold text-muted-foreground">/ {totalErCap}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#2457FF] transition-all duration-500"
              style={{ width: `${totalErCap > 0 ? Math.min(100, (totalErAvailable / totalErCap) * 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Combined ICU Availability</span>
            <HeartPulse className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
            {totalIcuAvailable} <span className="text-base font-bold text-muted-foreground">/ {totalIcuCap}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${totalIcuCap > 0 ? Math.min(100, (totalIcuAvailable / totalIcuCap) * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {branches.length === 0 ? (
        <div className="glass-panel p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-foreground">Register Your Hospital</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your main hospital branch with GPS coordinates and live ER/ICU bed capacity to start receiving triage handoffs.
            </p>
          </div>
          <HospitalBranchForm
            mode="create"
            isFirstBranch
            submitting={createBranch.isPending}
            onSubmit={async payload => {
              await createBranch.mutateAsync(payload);
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {branches.map(branch => {
            const isActive = branch.id === activeBranchId;
            const erAvail = branch.availableEmergencyBeds ?? branch.erAvailable ?? 0;
            const erTot = branch.totalEmergencyBeds ?? branch.erTotal ?? 0;
            const icuAvail = branch.availableIcuBeds ?? branch.icuAvailable ?? 0;
            const icuTot = branch.totalIcuBeds ?? branch.icuTotal ?? 0;
            const erPct = erTot > 0 ? Math.min(100, Math.round((erAvail / erTot) * 100)) : 0;
            const icuPct = icuTot > 0 ? Math.min(100, Math.round((icuAvail / icuTot) * 100)) : 0;

            return (
              <article
                key={branch.id}
                className={`glass-panel p-5 transition ${
                  isActive ? "ring-2 ring-[#2457FF] shadow-md" : "hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-black text-foreground truncate">
                        {branch.organizationName || branch.name}
                      </h2>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {branch.branchName}
                      </Badge>
                      {branch.isPrimaryBranch && (
                        <Badge className="bg-[#2457FF]/12 text-[#2457FF] border-0 text-[10px] font-bold">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2457FF]" />
                      <span className="truncate">
                        {[branch.address, branch.city, branch.state, branch.pincode].filter(Boolean).join(", ")}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                      <Phone className="h-3.5 w-3.5 text-[#2457FF]" />
                      <span>{branch.contactPhone}</span>
                      {branch.registrationId && (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                          ID: {branch.registrationId}
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusPill status={(branch.legacyStatus ?? branch.status?.toLowerCase() ?? "open") as FacilityStatus} />
                </div>

                {/* Progress Bars */}
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>ER Beds</span>
                      <span className="tabular-nums text-[#2457FF]">
                        {branch.availableEmergencyBeds ?? branch.erAvailable ?? 0}/{branch.totalEmergencyBeds ?? branch.erTotal ?? 0}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-[#2457FF]" style={{ width: `${erPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>ICU Beds</span>
                      <span className="tabular-nums text-emerald-600">
                        {branch.availableIcuBeds ?? branch.icuAvailable ?? 0}/{branch.totalIcuBeds ?? branch.icuTotal ?? 0}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${icuPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Mini Telemetry */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Wind className="h-3.5 w-3.5 text-[#2457FF]" /> {branch.oxygenUnits ?? branch.oxygenCylinderCount ?? branch.oxygenCylinders ?? 0} O₂
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Droplets className="h-3.5 w-3.5 text-rose-500" /> {branch.bloodUnits ?? branch.bloodUnitCount ?? 0} Blood
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Truck className="h-3.5 w-3.5 text-emerald-600" /> {branch.ambulances ?? branch.ambulanceCount ?? 0} Ambulances
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Sahay Verified
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "default"}
                      onClick={() => {
                        onSelectBranch(branch.id);
                        onOpenDashboard?.();
                      }}
                      className={`rounded-xl text-xs font-bold ${
                        !isActive ? "bg-[#2457FF] text-white hover:bg-[#1d47db]" : ""
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Active Desk
                        </>
                      ) : (
                        "Open Command Desk"
                      )}
                    </Button>

                    <select
                      aria-label="Quick status toggle"
                      value={(branch.legacyStatus ?? branch.status?.toLowerCase() ?? "open") as FacilityStatus}
                      disabled={updateBranch.isPending}
                      onChange={e => void handleQuickStatus(branch, e.target.value as FacilityStatus)}
                      className="h-8 rounded-xl border border-input bg-background px-2 text-[11px] font-bold uppercase"
                    >
                      <option value="open">OPEN</option>
                      <option value="limited">LIMITED</option>
                      <option value="critical">FULL</option>
                      <option value="closed">CLOSED</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingBranch(branch)}
                      className="rounded-xl text-xs"
                    >
                      <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingBranch(branch)}
                      className="rounded-xl text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-lg font-black text-foreground">Add Hospital Branch</h2>
                <p className="text-xs text-muted-foreground">
                  Register another branch or satellite emergency wing anywhere in India.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <HospitalBranchForm
              mode="create"
              defaultOrganizationName={defaultOrg}
              submitting={createBranch.isPending}
              onCancel={() => setShowAddModal(false)}
              onSubmit={async payload => {
                await createBranch.mutateAsync(payload);
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Edit {editingBranch.organizationName} — {editingBranch.branchName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Update address, GPS coordinates, specialties, or bed capacity.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingBranch(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <HospitalBranchForm
              mode="edit"
              initialValues={editingBranch}
              submitting={updateBranch.isPending}
              onCancel={() => setEditingBranch(null)}
              onSubmit={async (payload: HospitalBranchSubmitPayload) => {
                await updateBranch.mutateAsync({
                  id: editingBranch.id,
                  ...payload,
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-foreground">Delete Hospital Branch?</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  This will remove <strong>{deletingBranch.organizationName} — {deletingBranch.branchName}</strong> ({deletingBranch.city}) from live citizen and rescuer hospital discovery.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeletingBranch(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteBranch.isPending}
                onClick={() => deleteBranch.mutate({ id: deletingBranch.id })}
                className="rounded-xl font-bold"
              >
                {deleteBranch.isPending ? "Removing…" : "Yes, Delete Branch"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
