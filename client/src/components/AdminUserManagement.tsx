import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  Filter,
  History,
  Hospital,
  KeyRound,
  Lock,
  Mail,
  MoreVertical,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Unlock,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  XCircle,
} from "lucide-react";
import React, { FormEvent, useMemo, useState } from "react";

type CanonicalRole = "user" | "hospital" | "rescuer" | "admin";
type AccountStatus = "active" | "disabled";

interface AdminUserManagementProps {
  currentUserId?: number;
}

export function AdminUserManagement({ currentUserId }: AdminUserManagementProps) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | CanonicalRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");

  // Dialog States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<any | null>(null);
  const [statusModalUser, setStatusModalUser] = useState<any | null>(null);
  const [detailsModalUserId, setDetailsModalUserId] = useState<number | null>(null);

  // Queries
  const usersQuery = trpc.rescue.operations.adminUsersList.useQuery(
    {
      search: search || undefined,
      role: roleFilter,
      status: statusFilter,
      limit: 100,
    },
    { refetchInterval: 10_000, refetchOnWindowFocus: true }
  );

  const hospitalsQuery = trpc.rescue.operations.hospitals.useQuery(undefined, {
    staleTime: 60_000,
  });

  const refreshAll = () => {
    void utils.rescue.operations.adminUsersList.invalidate();
    void utils.auth.listUsers.invalidate();
    void utils.rescue.operations.availableUsers.invalidate();
  };

  const usersList = usersQuery.data?.users || [];
  const summary = usersQuery.data?.summary || {
    total: 0,
    citizens: 0,
    hospitalStaff: 0,
    rescuers: 0,
    admins: 0,
    active: 0,
    disabled: 0,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              State Authority Hub
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#173d37] dark:text-[#f3f4f6] sm:text-3xl">
            User Management & RBAC
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Oversee all registered citizens, field rescue responders, hospital operations personnel, and state administrators. Manage canonical roles, account activation, and auditable permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={usersQuery.isFetching}
            className="rounded-xl border-black/10 text-xs font-bold shadow-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-xl bg-[#0f766e] text-xs font-bold text-white shadow-sm hover:bg-[#0f766e]/90"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Create User
          </Button>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total Accounts"
          value={summary.total}
          icon={UsersRound}
          color="bg-[#edf9f4] text-[#0f766e] border-[#b5ddcf] dark:bg-[#0f766e]/10 dark:text-emerald-400 dark:border-emerald-500/20"
        />
        <KpiCard
          label="Citizens"
          value={summary.citizens}
          icon={User}
          color="bg-[#f0f9ff] text-[#0284c7] border-[#bae6fd] dark:bg-[#0284c7]/10 dark:text-sky-400 dark:border-sky-500/20"
        />
        <KpiCard
          label="Rescuers"
          value={summary.rescuers}
          icon={Radio}
          color="bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe] dark:bg-[#4f46e5]/10 dark:text-indigo-400 dark:border-indigo-500/20"
        />
        <KpiCard
          label="Hospital Staff"
          value={summary.hospitalStaff}
          icon={Hospital}
          color="bg-[#fdf4ff] text-[#a21caf] border-[#f5d0fe] dark:bg-[#a21caf]/10 dark:text-fuchsia-400 dark:border-fuchsia-500/20"
        />
        <KpiCard
          label="Administrators"
          value={summary.admins}
          icon={ShieldAlert}
          color="bg-[#fff1f2] text-[#e11d48] border-[#fecdd3] dark:bg-[#e11d48]/10 dark:text-rose-400 dark:border-rose-500/20"
        />
        <KpiCard
          label="Active Status"
          value={`${summary.active}/${summary.total}`}
          sublabel={summary.disabled > 0 ? `${summary.disabled} disabled` : "All active"}
          icon={Activity}
          color="bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] dark:bg-[#16a34a]/10 dark:text-green-400 dark:border-green-500/20"
        />
      </section>

      {/* Main Filter & Table Card */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#141517]">
        {/* Filter Controls Bar */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, user ID, call sign, or hospital…"
              className="h-10 rounded-xl pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as any)}>
              <SelectTrigger className="h-10 w-[145px] rounded-xl text-xs font-semibold">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">Citizens (user)</SelectItem>
                <SelectItem value="rescuer">Rescuers</SelectItem>
                <SelectItem value="hospital">Hospital Staff</SelectItem>
                <SelectItem value="admin">Administrators</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
              <SelectTrigger className="h-10 w-[135px] rounded-xl text-xs font-semibold">
                <Activity className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="disabled">Disabled Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Users Table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-black/5 dark:border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-black/5 bg-[#f8faf9] font-mono text-[10px] uppercase tracking-wider text-muted-foreground dark:border-white/5 dark:bg-[#191b1f]">
              <tr>
                <th className="px-4 py-3 font-bold">User Identity</th>
                <th className="px-4 py-3 font-bold">Assigned Role</th>
                <th className="px-4 py-3 font-bold">Linked Profile / Facility</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Activity</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {usersList.length > 0 ? (
                usersList.map((user) => (
                  <tr
                    key={user.id}
                    className="group transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    {/* User Identity */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-mono text-xs font-black ${
                            user.role === "admin"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                              : user.role === "rescuer"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                              : user.role === "hospital"
                              ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : "U")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-extrabold text-foreground truncate max-w-[180px] sm:max-w-none">
                            {user.name || "Unnamed Account"}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px] sm:max-w-none">
                            {user.email || "No email"}
                          </p>
                          <span className="font-mono text-[9px] text-muted-foreground/80">
                            ID: #{user.id} · {user.loginMethod}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="px-4 py-3.5">
                      <RoleBadge role={user.role} />
                    </td>

                    {/* Linked Profile / Details */}
                    <td className="px-4 py-3.5">
                      {user.role === "rescuer" && user.rescuerProfile ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Radio className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            <span className="font-mono text-xs font-bold text-indigo-950 dark:text-indigo-200">
                              {user.rescuerProfile.callSign}
                            </span>
                          </div>
                          {user.rescuerProfile.phone && (
                            <p className="text-[10px] text-muted-foreground">{user.rescuerProfile.phone}</p>
                          )}
                          <span className="inline-block rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                            {user.rescuerProfile.availability}
                          </span>
                        </div>
                      ) : user.role === "hospital" && user.hospitalProfile ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Hospital className="h-3 w-3 text-fuchsia-600 dark:text-fuchsia-400" />
                            <span className="font-extrabold text-xs text-fuchsia-950 dark:text-fuchsia-200 truncate max-w-[200px] block">
                              {user.hospitalProfile.hospitalName}
                            </span>
                          </div>
                          {user.hospitalProfile.designation && (
                            <p className="text-[10px] text-muted-foreground">{user.hospitalProfile.designation}</p>
                          )}
                        </div>
                      ) : user.role === "admin" ? (
                        <div className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-semibold text-[11px]">
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                          <span>Command Centre</span>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-[11px]">
                          {user.rescuerRequest?.status === "pending" ? (
                            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              Pending Rescuer Req
                            </span>
                          ) : user.hospitalRequest?.status === "pending" ? (
                            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              Pending Hospital Req
                            </span>
                          ) : (
                            <span>Standard Citizen</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={user.status} />
                    </td>

                    {/* Activity Timestamps */}
                    <td className="px-4 py-3.5 text-muted-foreground">
                      <p className="text-[11px]">
                        Last: {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : "Never"}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        Reg: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailsModalUserId(user.id)}
                          className="h-8 rounded-lg px-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                          title="View user details & audit history"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRoleModalUser(user)}
                          className="h-8 rounded-lg border-black/10 px-2.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary dark:border-white/10"
                        >
                          <UserCog className="mr-1 h-3.5 w-3.5" />
                          Role
                        </Button>

                        <Button
                          variant={user.status === "active" ? "ghost" : "outline"}
                          size="sm"
                          disabled={user.id === currentUserId}
                          onClick={() => setStatusModalUser(user)}
                          className={`h-8 rounded-lg px-2.5 text-xs font-semibold ${
                            user.status === "active"
                              ? "text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          }`}
                          title={user.id === currentUserId ? "Cannot disable your own account" : undefined}
                        >
                          {user.status === "active" ? (
                            <>
                              <Lock className="mr-1 h-3 w-3" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Unlock className="mr-1 h-3 w-3" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 font-bold">No user accounts found.</p>
                    <p className="mt-1 text-xs">Try adjusting your search query or role filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <CreateUserDialog
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          hospitals={hospitalsQuery.data || []}
          onSuccess={refreshAll}
        />
      )}

      {/* CHANGE ROLE MODAL */}
      {roleModalUser && (
        <ChangeRoleDialog
          user={roleModalUser}
          open={Boolean(roleModalUser)}
          onOpenChange={(open) => !open && setRoleModalUser(null)}
          hospitals={hospitalsQuery.data || []}
          onSuccess={refreshAll}
        />
      )}

      {/* TOGGLE STATUS MODAL */}
      {statusModalUser && (
        <ToggleStatusDialog
          user={statusModalUser}
          open={Boolean(statusModalUser)}
          onOpenChange={(open) => !open && setStatusModalUser(null)}
          onSuccess={refreshAll}
        />
      )}

      {/* USER DETAILS & AUDIT DRAWER */}
      {detailsModalUserId && (
        <UserDetailsDialog
          userId={detailsModalUserId}
          open={Boolean(detailsModalUserId)}
          onOpenChange={(open) => !open && setDetailsModalUserId(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Helper Sub-Components
// ----------------------------------------------------

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-75" />
      </div>
      <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
      {sublabel && <p className="mt-0.5 font-mono text-[10px] opacity-75">{sublabel}</p>}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-400">
          <ShieldAlert className="h-3 w-3" />
          Admin
        </span>
      );
    case "rescuer":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-indigo-700 dark:text-indigo-400">
          <Radio className="h-3 w-3" />
          Rescuer
        </span>
      );
    case "hospital":
    case "medical":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-fuchsia-700 dark:text-fuchsia-400">
          <Hospital className="h-3 w-3" />
          Hospital
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
          <User className="h-3 w-3" />
          Citizen
        </span>
      );
  }
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-400">
        <Lock className="h-2.5 w-2.5" />
        Disabled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Active
    </span>
  );
}

// ----------------------------------------------------
// Dialog: Create User
// ----------------------------------------------------

function CreateUserDialog({
  open,
  onOpenChange,
  hospitals,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: any[];
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CanonicalRole>("user");
  const [callSign, setCallSign] = useState("");
  const [phone, setPhone] = useState("");
  const [hospitalId, setHospitalId] = useState<string>("");
  const [designation, setDesignation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const createMutation = trpc.auth.createUser.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create user account.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Full name is required.");
    if (!email.trim() || !email.includes("@")) return setError("A valid email address is required.");
    if (!password.trim() || password.length < 6) return setError("Password must be at least 6 characters.");

    if (role === "rescuer" && (!callSign.trim() || callSign.trim().length < 2)) {
      return setError("Field call sign (at least 2 chars) is required for Rescuers.");
    }
    if (role === "hospital" && !hospitalId) {
      return setError("Please select a verified hospital facility.");
    }

    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      role,
      callSign: role === "rescuer" ? callSign.trim() : undefined,
      phone: phone.trim() || undefined,
      hospitalId: role === "hospital" && hospitalId ? Number(hospitalId) : undefined,
      designation: role === "hospital" ? designation.trim() || "Medical Staff" : undefined,
      reason: reason.trim() || "Provisioned by administrator",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Provision User Account</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create an authoritative user profile and assign operational permissions server-side.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-bold">Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Inspector Barua"
                className="mt-1 h-9 rounded-xl text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. officer@assamrescue.gov.in"
                className="mt-1 h-9 rounded-xl text-xs"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Initial Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1 h-9 rounded-xl text-xs"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Canonical Role</Label>
            <Select value={role} onValueChange={(val) => setRole(val as CanonicalRole)}>
              <SelectTrigger className="mt-1 h-10 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Citizen (Public Registration)</SelectItem>
                <SelectItem value="rescuer">Rescuer (Field Response Unit)</SelectItem>
                <SelectItem value="hospital">Hospital Staff (Medical Operations)</SelectItem>
                <SelectItem value="admin">Administrator (State Command Centre)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Rescuer Profile Inputs */}
          {role === "rescuer" && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-3">
              <p className="font-mono text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400">
                Rescuer Profile Requirements
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-bold">Call Sign *</Label>
                  <Input
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value)}
                    placeholder="e.g. SDRF Boat 07"
                    className="mt-1 h-8 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold">Contact Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="mt-1 h-8 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Hospital Profile Inputs */}
          {role === "hospital" && (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3.5 space-y-3">
              <p className="font-mono text-[10px] font-bold uppercase text-fuchsia-700 dark:text-fuchsia-400">
                Hospital Facility Affiliation
              </p>
              <div>
                <Label className="text-[11px] font-bold">Hospital / Triage Centre *</Label>
                <Select value={hospitalId} onValueChange={setHospitalId}>
                  <SelectTrigger className="mt-1 h-9 rounded-lg text-xs">
                    <SelectValue placeholder="Select verified hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name} ({h.address})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold">Designation / Role Title</Label>
                <Input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Emergency Triage Coordinator"
                  className="mt-1 h-8 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Admin Elevation Warning */}
          {role === "admin" && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                <strong>Elevated Privileges:</strong> Administrator role grants complete control over mission dispatches, emergency alerts, RBAC, and system configurations.
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">Audit Reason / Justification</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Induction of new flood response team lead"
              className="mt-1 h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-xl bg-[#0f766e] text-xs font-bold text-white hover:bg-[#0f766e]/90"
            >
              {createMutation.isPending ? "Creating User…" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------
// Dialog: Change Role
// ----------------------------------------------------

function ChangeRoleDialog({
  user,
  open,
  onOpenChange,
  hospitals,
  onSuccess,
}: {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: any[];
  onSuccess: () => void;
}) {
  const [role, setRole] = useState<CanonicalRole>(user.role || "user");
  const [callSign, setCallSign] = useState(user.rescuerProfile?.callSign || "");
  const [phone, setPhone] = useState(user.rescuerProfile?.phone || "");
  const [hospitalId, setHospitalId] = useState<string>(
    user.hospitalProfile?.hospitalId ? String(user.hospitalProfile.hospitalId) : ""
  );
  const [designation, setDesignation] = useState(user.hospitalProfile?.designation || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const updateRoleMutation = trpc.rescue.operations.adminUpdateUserRole.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err.message || "Failed to update user role.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (role === "rescuer" && (!callSign.trim() || callSign.trim().length < 2)) {
      return setError("Field call sign is required for Rescuer role.");
    }
    if (role === "hospital" && !hospitalId) {
      return setError("Please select a verified hospital facility.");
    }

    updateRoleMutation.mutate({
      userId: user.id,
      role,
      callSign: role === "rescuer" ? callSign.trim() : undefined,
      phone: phone.trim() || undefined,
      hospitalId: role === "hospital" && hospitalId ? Number(hospitalId) : undefined,
      designation: role === "hospital" ? designation.trim() || "Medical Coordinator" : undefined,
      reason: reason.trim() || `Administrative role change from ${user.role} to ${role}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Modify User Role</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update canonical role permissions for <strong className="text-foreground">{user.name || user.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="rounded-2xl border border-black/5 bg-[#f8faf9] p-3 dark:border-white/5 dark:bg-[#181a1d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-extrabold text-foreground">{user.name || "User"}</p>
                <p className="text-[11px] text-muted-foreground">{user.email}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Current Role</p>
                <RoleBadge role={user.role} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">New Canonical Role</Label>
            <Select value={role} onValueChange={(val) => setRole(val as CanonicalRole)}>
              <SelectTrigger className="mt-1 h-10 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Citizen (Public User)</SelectItem>
                <SelectItem value="rescuer">Rescuer (Field Response Unit)</SelectItem>
                <SelectItem value="hospital">Hospital Staff (Medical Operations)</SelectItem>
                <SelectItem value="admin">Administrator (State Command Centre)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Rescuer Profile Inputs */}
          {role === "rescuer" && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-3">
              <p className="font-mono text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400">
                Rescuer Profile Requirements
              </p>
              <div>
                <Label className="text-[11px] font-bold">Call Sign *</Label>
                <Input
                  value={callSign}
                  onChange={(e) => setCallSign(e.target.value)}
                  placeholder="e.g. NDRF Boat 02"
                  className="mt-1 h-8 rounded-lg text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold">Contact Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="mt-1 h-8 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Dynamic Hospital Profile Inputs */}
          {role === "hospital" && (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3.5 space-y-3">
              <p className="font-mono text-[10px] font-bold uppercase text-fuchsia-700 dark:text-fuchsia-400">
                Hospital Facility Affiliation
              </p>
              <div>
                <Label className="text-[11px] font-bold">Hospital Facility *</Label>
                <Select value={hospitalId} onValueChange={setHospitalId}>
                  <SelectTrigger className="mt-1 h-9 rounded-lg text-xs">
                    <SelectValue placeholder="Select verified hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name} ({h.address})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold">Designation</Label>
                <Input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Chief Medical Officer"
                  className="mt-1 h-8 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {role === "admin" && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                <strong>Warning:</strong> Elevating to Administrator grants full state command access, audit viewing, and RBAC control.
              </span>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">Audit Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for role change (recorded in audit logs)"
              className="mt-1 h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateRoleMutation.isPending}
              className="rounded-xl bg-[#0f766e] text-xs font-bold text-white hover:bg-[#0f766e]/90"
            >
              {updateRoleMutation.isPending ? "Saving Role…" : "Apply Role Change"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------
// Dialog: Toggle Status (Activate / Disable)
// ----------------------------------------------------

function ToggleStatusDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const targetStatus: AccountStatus = user.status === "active" ? "disabled" : "active";

  const setStatusMutation = trpc.rescue.operations.adminSetUserStatus.useMutation({
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err.message || "Failed to update account status.");
    },
  });

  const handleConfirm = () => {
    setError("");
    setStatusMutation.mutate({
      userId: user.id,
      status: targetStatus,
      reason: reason.trim() || `Administrative ${targetStatus === "disabled" ? "disable" : "activation"}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">
            {targetStatus === "disabled" ? "Disable User Account" : "Re-activate User Account"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {targetStatus === "disabled"
              ? "Disabling this account will immediately block login sessions and operational access."
              : "Re-activating this account will restore standard access based on their canonical role."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div className="rounded-2xl border border-black/5 bg-[#f8faf9] p-3 dark:border-white/5 dark:bg-[#181a1d]">
            <p className="font-extrabold text-foreground">{user.name || "User"}</p>
            <p className="text-[11px] text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Audit Reason / Justification</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inactive volunteer departure or temporary suspension"
              className="mt-1 h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={setStatusMutation.isPending}
              onClick={handleConfirm}
              className={`rounded-xl text-xs font-bold text-white ${
                targetStatus === "disabled"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {setStatusMutation.isPending
                ? "Updating…"
                : targetStatus === "disabled"
                ? "Confirm Disable"
                : "Confirm Activation"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------
// Dialog: User Details & Audit History
// ----------------------------------------------------

function UserDetailsDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = trpc.rescue.operations.adminGetUser.useQuery(
    { userId },
    { enabled: open }
  );

  const data = detailQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">User Profile & Audit Record</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete account parameters, linked emergency records, and administrative audit trails.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 font-bold">Loading user profile…</p>
          </div>
        ) : data?.user ? (
          <div className="space-y-5 text-xs">
            {/* Header info */}
            <div className="rounded-2xl border border-black/5 bg-[#f8faf9] p-4 dark:border-white/5 dark:bg-[#181a1d]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">{data.user.name || "Unnamed Account"}</h3>
                  <p className="text-xs text-muted-foreground">{data.user.email}</p>
                  <p className="font-mono text-[10px] text-muted-foreground/70">ID: #{data.user.id} · OpenID: {data.user.openId}</p>
                </div>
                <div className="text-right space-y-1">
                  <RoleBadge role={data.user.role} />
                  <div>
                    <StatusBadge status={data.user.status} />
                  </div>
                </div>
              </div>
            </div>

            {/* Operational stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-black/5 p-3 dark:border-white/5">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Login Method</p>
                <p className="mt-1 font-bold text-foreground truncate">{data.user.loginMethod}</p>
              </div>
              <div className="rounded-xl border border-black/5 p-3 dark:border-white/5">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Emergency Contacts</p>
                <p className="mt-1 font-bold text-foreground">{data.emergencyContactsCount} registered</p>
              </div>
              <div className="rounded-xl border border-black/5 p-3 dark:border-white/5">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Missions Assigned</p>
                <p className="mt-1 font-bold text-foreground">{data.assignedMissionsCount} missions</p>
              </div>
            </div>

            {/* Role Specific details */}
            {data.user.role === "rescuer" && data.rescuerProfile && (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
                <p className="font-mono text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400">
                  Rescuer Operations Profile
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Call Sign:</span>{" "}
                    <strong className="text-foreground">{data.rescuerProfile.callSign}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Availability:</span>{" "}
                    <strong className="text-foreground uppercase">{data.rescuerProfile.availability}</strong>
                  </div>
                  {data.rescuerProfile.phone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      <strong className="text-foreground">{data.rescuerProfile.phone}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.user.role === "hospital" && (
              <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-2">
                <p className="font-mono text-[10px] font-bold uppercase text-fuchsia-700 dark:text-fuchsia-400">
                  Hospital Affiliation
                </p>
                <p className="font-extrabold text-foreground text-sm">
                  {data.hospital?.name || `Hospital #${data.hospitalStaffProfile?.hospitalId || "N/A"}`}
                </p>
                {data.hospital?.address && <p className="text-muted-foreground">{data.hospital.address}</p>}
                {data.hospitalStaffProfile?.designation && (
                  <p className="text-fuchsia-900 dark:text-fuchsia-300 font-semibold">
                    Designation: {data.hospitalStaffProfile.designation}
                  </p>
                )}
              </div>
            )}

            {/* Audit Log Trail */}
            <div>
              <div className="flex items-center gap-1.5 pb-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="font-bold text-foreground">Recent Audit Trail</h4>
              </div>

              {data.auditHistory && data.auditHistory.length > 0 ? (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {data.auditHistory.map((log: any) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-black/5 bg-black/[0.01] p-2.5 text-[11px] dark:border-white/5 dark:bg-white/[0.01]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-primary">{log.action}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                        </span>
                      </div>
                      {log.detail && (
                        <p className="mt-1 text-muted-foreground font-mono text-[10px] break-all">{log.detail}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-[11px]">
                  No administrative audit records found for this user.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-xl text-xs font-bold"
              >
                Close Profile
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">User profile could not be loaded.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
