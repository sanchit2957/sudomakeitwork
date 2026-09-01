import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CheckCircle2,
  Clock,
  Filter,
  HeartHandshake,
  Home,
  LifeBuoy,
  MapPin,
  MessageSquareQuote,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PostRescueRecords() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [reliefFilter, setReliefFilter] = useState<"all" | "yes" | "no">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const recordsQuery = trpc.rescue.operations.postRescueRecords.useQuery(undefined, {
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const records = recordsQuery.data || [];

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesRelief =
        reliefFilter === "all" || r.reliefCentreAllotted === reliefFilter;
      const matchesCategory =
        categoryFilter === "all" || r.helpCategory === categoryFilter;
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        r.publicCode.toLowerCase().includes(query) ||
        (r.reporterName && r.reporterName.toLowerCase().includes(query)) ||
        (r.locationLabel && r.locationLabel.toLowerCase().includes(query)) ||
        (r.notes && r.notes.toLowerCase().includes(query));

      return matchesRelief && matchesCategory && matchesSearch;
    });
  }, [records, reliefFilter, categoryFilter, search]);

  const totalCount = records.length;
  const reliefAllottedCount = records.filter(
    (r) => r.reliefCentreAllotted === "yes"
  ).length;
  const reliefRate =
    totalCount > 0 ? Math.round((reliefAllottedCount / totalCount) * 100) : 0;

  const evacuationCount = records.filter(
    (r) => r.helpCategory === "evacuation"
  ).length;
  const medicalCount = records.filter(
    (r) => r.helpCategory === "medical"
  ).length;

  const formatRemainingTime = (submittedAtDate: Date | string) => {
    const submittedMs = new Date(submittedAtDate).getTime();
    const expiryMs = submittedMs + 24 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, expiryMs - Date.now());
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMins = Math.floor(
      (remainingMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (remainingHours > 0) return `${remainingHours}h ${remainingMins}m left`;
    return `${remainingMins}m left`;
  };

  const formatRelativeTime = (submittedAtDate: Date | string) => {
    const diffMs = Date.now() - new Date(submittedAtDate).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Post-Rescue Audit & Citizen Reviews
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              24-Hour Rolling Retention
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#173d37]">
            Post-Rescue Records
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Citizen confirmations recorded following rescue operations. Track relief
            center allotment status, follow-up medical needs, and survivor review notes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void utils.rescue.operations.postRescueRecords.invalidate()}
          disabled={recordsQuery.isRefetching}
          className="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${recordsQuery.isRefetching ? "animate-spin" : ""}`}
          />
          Refresh Records
        </Button>
      </section>

      {/* Overview Analytics Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total 24h Check-Ins
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <HeartHandshake className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-800">{totalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Verified post-rescue responses</p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Relief Shelter Allotted
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Home className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {reliefAllottedCount}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              ({reliefRate}%)
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Housed in registered relief centers</p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Evacuation Cases
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <LifeBuoy className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-blue-800">{evacuationCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Evacuated from flood zones</p>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Medical Care Follow-Ups
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-rose-800">{medicalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reported ongoing medical needs</p>
        </div>
      </section>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative min-w-72 flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SOS code, citizen name, location, or notes..."
            className="h-10 pl-9 rounded-xl text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Relief Shelter:</span>
            <Select
              value={reliefFilter}
              onValueChange={(val) => setReliefFilter(val as any)}
            >
              <SelectTrigger className="h-9 w-32 rounded-xl text-xs">
                <SelectValue placeholder="All Relief" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="yes">Allotted (Yes)</SelectItem>
                <SelectItem value="no">Not Allotted (No)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Category:</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="evacuation">Evacuation</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="trapped">Trapped Rescue</SelectItem>
                <SelectItem value="other">Other Needs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Record Cards Grid */}
      {filteredRecords.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecords.map((item) => {
            const isReliefYes = item.reliefCentreAllotted === "yes";

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div>
                      <span className="font-mono text-xs font-extrabold text-primary">
                        {item.publicCode}
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(item.submittedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                      {formatRemainingTime(item.submittedAt)}
                    </span>
                  </div>

                  {/* Badges Grid */}
                  <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Relief Centre
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        {isReliefYes ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="font-bold uppercase text-emerald-700">
                              Allotted (Yes)
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-amber-600" />
                            <span className="font-bold uppercase text-amber-700">
                              Not Allotted
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Category Details
                      </p>
                      <p className="mt-1 font-bold uppercase text-slate-800">
                        {item.helpCategory}
                      </p>
                    </div>
                  </div>

                  {/* Citizen / Reporter Info */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    {item.reporterName && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700">
                          {item.reporterName}
                        </span>
                      </div>
                    )}
                    {item.locationLabel && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate text-slate-600">
                          {item.locationLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Citizen Notes / Feedback Review */}
                  {item.notes && (
                    <div className="mt-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 p-3 text-xs leading-relaxed text-slate-700">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <MessageSquareQuote className="h-3 w-3" /> Citizen Note
                      </p>
                      <p className="mt-1 italic">"{item.notes}"</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 text-right">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Recorded: {new Date(item.submittedAt).toLocaleTimeString()} ·{" "}
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-muted-foreground">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-extrabold text-slate-800">
            No Post-Rescue Records Found
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Post-rescue survey submissions and citizen confirmation reviews from the
            Victim App will appear here automatically and persist for 24 hours.
          </p>
        </div>
      )}
    </div>
  );
}
