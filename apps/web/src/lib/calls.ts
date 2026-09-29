// The open calls page's data, read at build time from the pipeline's registry of seen calls.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { regions, roles, sectors } from "@postthedoc/shared/reference";
import { openCalls, type SeenCall } from "@postthedoc/shared/seen";
import type { Locale } from "../i18n";

/**
 * data/seen.json, or the file in SEEN_FILE (e.g. a copy updated by the pipeline's
 * `run --dry-run --save-seen`, to preview the page). Builds run from apps/web/.
 */
export const seenFile = () =>
  resolve(import.meta.env.SEEN_FILE || resolve(process.cwd(), "../../data/seen.json"));

export interface CallView extends SeenCall {
  roleName: string;
  regionName: string | null;
  /** Scientific areas of the call's G.S.D. */
  areas: string[];
  /** G.S.D. codes with their names. */
  sectors: { code: string; name: string }[];
}

const TIME_ZONE = "Europe/Rome";

export function callViews(calls: SeenCall[], lang: Locale): CallView[] {
  const roleNames = new Map(roles.map((r) => [r.code, r.name[lang]]));
  const regionNames = new Map(regions.map((r) => [r.code, r.name[lang]]));
  const groups = new Map(sectors.groups.map((g) => [g.code, g]));
  return calls.map((call) => ({
    ...call,
    roleName: roleNames.get(call.role) ?? call.role,
    regionName: call.region ? (regionNames.get(call.region) ?? null) : null,
    areas: [...new Set(call.gsd.flatMap((code) => groups.get(code)?.area ?? []))],
    sectors: call.gsd.map((code) => ({ code, name: groups.get(code)?.name ?? code })),
  }));
}

/** The open calls at build time, for `lang`. */
export const loadCalls = (lang: Locale, now = new Date()) =>
  callViews(openCalls(readFileSync(seenFile(), "utf-8"), now), lang);

/** The `n` calls found most recently, closest deadline first among those found together. */
export const latest = (calls: CallView[], n: number) =>
  calls.toSorted((a, b) => b.firstSeen.getTime() - a.firstSeen.getTime()).slice(0, n);

export interface MonthGroup {
  /** e.g. "2026-10"; "" for the calls without a deadline. */
  key: string;
  label: string;
  calls: CallView[];
}

/** Calls grouped by the month of their deadline (Italian time), in the order given. */
export function byMonth(calls: CallView[], lang: Locale, undatedLabel: string): MonthGroup[] {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  });
  const label = new Intl.DateTimeFormat(lang, {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  });
  const groups = new Map<string, MonthGroup>();
  for (const call of calls) {
    const k = call.deadline ? key.format(call.deadline) : "";
    let group = groups.get(k);
    if (!group) {
      const name = call.deadline ? label.format(call.deadline) : undatedLabel;
      group = { key: k, label: name.charAt(0).toUpperCase() + name.slice(1), calls: [] };
      groups.set(k, group);
    }
    group.calls.push(call);
  }
  return [...groups.values()];
}

/** Parts of a deadline as the cards show it, in Italian time. */
export function deadlineParts(deadline: Date, lang: Locale) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, ...options }).format(deadline);
  return {
    day: part({ day: "2-digit" }),
    month: part({ month: "short" }).replace(".", ""),
    time: part({ hour: "2-digit", minute: "2-digit", hour12: false }),
    full: part({ dateStyle: "full", timeStyle: "short" }),
  };
}
