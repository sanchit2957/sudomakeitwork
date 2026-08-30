import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Phone, PhoneCall, Star, Users, ChevronDown, ChevronUp, Loader2, HeartPulse } from "lucide-react";
import { Button } from "./ui/button";

export function EmergencyContactsDisplay({
  userId,
  incidentId,
  title = "Emergency Contacts",
  compact = false,
}: {
  userId?: number | null;
  incidentId?: number | null;
  title?: string;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);

  const contactsQuery = trpc.auth.emergencyContacts.getForUser.useQuery(
    { userId: userId! },
    {
      enabled: Boolean(userId),
    }
  );

  const contacts = contactsQuery.data || [];

  if (!userId && !incidentId) return null;

  if (contactsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-amber-50/50 p-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
        <span>Loading emergency contacts…</span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/30 p-2.5 text-xs text-amber-900/70 dark:border-amber-900/40 dark:text-amber-400/60">
        <div className="flex items-center gap-1.5 font-semibold">
          <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>No next-of-kin emergency contacts registered yet.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-50/40 p-3 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between font-bold text-amber-950 dark:text-amber-200"
      >
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span>
            {title} ({contacts.length})
          </span>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-amber-800 hover:bg-amber-100/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 bg-white p-2.5 text-xs shadow-sm dark:border-white/10 dark:bg-[#18191d]"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[#122824] dark:text-white">{c.name}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    {c.relation}
                  </span>
                  {c.isPrimary === "yes" && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Star className="h-2.5 w-2.5 fill-emerald-600 text-emerald-600" />
                      Primary
                    </span>
                  )}
                </div>
                {c.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.notes}</p>}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                >
                  <Phone className="h-3 w-3" />
                  <span>Call {c.phone}</span>
                </a>
                {c.alternatePhone && (
                  <a
                    href={`tel:${c.alternatePhone}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-[#1f2025]"
                  >
                    <PhoneCall className="h-3 w-3" />
                    <span>Alt</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
