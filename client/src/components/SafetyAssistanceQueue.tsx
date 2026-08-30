import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, HeartPulse, MapPin, ShieldCheck, TentTree, UsersRound } from "lucide-react";
import { EmergencyContactsDisplay } from "./EmergencyContactsDisplay";
import React from "react";

const iconFor = {
  shelter: TentTree,
  food: UsersRound,
  medical: HeartPulse,
  protection: ShieldCheck,
};

export function SafetyAssistanceQueue({
  title,
  description,
  compact = false,
  guidance,
}: {
  title: string;
  description: string;
  compact?: boolean;
  guidance?: string[];
}) {
  const utils = trpc.useUtils();
  const queue = trpc.rescue.safety.queue.useQuery(undefined, {
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const update = trpc.rescue.safety.updateStatus.useMutation({
    onSuccess: () => void utils.rescue.safety.queue.invalidate(),
  });

  return (
    <section className={`rounded-3xl border bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#16171a] ${compact ? "" : "space-y-5"}`}>
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Safety assistance</p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#122824] dark:text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {guidance?.length ? (
        <div className="mt-4 rounded-2xl border border-[#b8ded4] bg-[#f8fcfa] p-4 dark:border-emerald-950 dark:bg-emerald-950/20">
          <p className="text-xs font-extrabold text-[#285f55] dark:text-emerald-300">Before you acknowledge</p>
          <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-[#58746c] dark:text-emerald-200/80">
            {guidance.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {queue.data?.length ? (
          queue.data.map((item) => {
            const Icon = iconFor[item.category];
            return (
              <article key={item.id} className="rounded-2xl border bg-[#fcfefd] p-4 dark:border-white/10 dark:bg-[#1c1d22]">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf7f4] text-primary dark:bg-emerald-950 dark:text-emerald-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-extrabold capitalize text-[#122824] dark:text-white">{item.category} support</span>
                      <SafetyStatus value={item.status} />
                    </div>

                    <p className="text-xs font-semibold text-[#315e54] dark:text-emerald-300">
                      {item.peopleAffected} {item.peopleAffected === 1 ? "person" : "people"} · {item.requesterName || "Citizen request"}
                    </p>

                    {item.details && (
                      <p className="max-w-2xl rounded-xl bg-[#f4f8f6] p-3 text-xs leading-5 text-[#607971] dark:bg-[#18191d] dark:text-gray-300">
                        {item.details}
                      </p>
                    )}

                    <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </p>

                    {/* Emergency Contacts for Rescuer & Hospital access */}
                    {item.requesterId && (
                      <div className="pt-1">
                        <EmergencyContactsDisplay userId={item.requesterId} compact title="Citizen Emergency Contacts" />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "new" ? (
                      <Button
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: item.id, status: "acknowledged" })}
                        className="rounded-xl text-xs"
                      >
                        Acknowledge
                      </Button>
                    ) : item.status === "acknowledged" ? (
                      <Button
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: item.id, status: "resolved" })}
                        variant="outline"
                        className="rounded-xl text-xs"
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-[#197654] dark:text-emerald-400">Resolved</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed bg-[#fafcfb] p-7 text-center text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-[#16171a]">
            No safety-assistance requests are waiting. New shelter, food, medical, and protection needs will appear here as they are shared from the Victim App.
          </div>
        )}
      </div>

      {queue.error && <p className="mt-3 text-xs font-semibold text-destructive">{queue.error.message}</p>}
    </section>
  );
}

function SafetyStatus({ value }: { value: string }) {
  const classes =
    value === "new"
      ? "bg-[#fff4df] text-[#9b6819] dark:bg-amber-950 dark:text-amber-300"
      : value === "acknowledged"
      ? "bg-[#e9f2fb] text-[#28639b] dark:bg-blue-950 dark:text-blue-300"
      : "bg-[#e7f6ef] text-[#197654] dark:bg-emerald-950 dark:text-emerald-300";
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase ${classes}`}>{value}</span>;
}
