/**
 * The calls registry written by the pipeline (data/seen.json, see storage/seen.py there): the
 * site lists the open calls it knows. Entries from files older than version 3 have no details,
 * and are left out until the pipeline fills them in; so are the calls withdrawn before their
 * deadline.
 */
import { z } from "zod";

const callSchema = z.object({
  role: z.string(),
  title: z.string(),
  url: z.url(),
  institution_name: z.string(),
  institution_code: z.string().nullish(),
  region: z.string().nullish(),
  gsd: z.array(z.string()).default([]),
  positions: z.number().int().nullish(),
});

const changeSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  field: z.string(),
  old: z.union([z.string(), z.number()]).nullable(),
  new: z.union([z.string(), z.number()]).nullable(),
});

const entrySchema = z.object({
  deadline: z.iso.datetime({ offset: true }).nullable(),
  first_seen: z.iso.datetime({ offset: true }),
  call: callSchema.nullish(),
  changes: z.array(changeSchema).default([]),
});

/** Whether the last change to a call's status took it out of the open calls. */
function withdrawn(changes: z.infer<typeof changeSchema>[]): boolean {
  const status = changes.filter((change) => change.field === "status");
  return status.at(-1)?.new === "withdrawn";
}

const seenSchema = z.object({
  version: z.number().int().min(2),
  calls: z.record(z.string(), entrySchema),
});

export interface SeenCall {
  id: string;
  role: string;
  title: string;
  url: string;
  institution: string;
  institutionCode: string | null;
  region: string | null;
  gsd: string[];
  positions: number | null;
  deadline: Date | null;
  /** When the pipeline first found the call. */
  firstSeen: Date;
}

/**
 * The calls of a seen.json text still open at `now`, by deadline (calls without one last).
 * Throws if the file does not have the expected format.
 */
export function openCalls(text: string, now: Date): SeenCall[] {
  const seen = seenSchema.parse(JSON.parse(text));
  const open: SeenCall[] = [];
  for (const [id, entry] of Object.entries(seen.calls)) {
    const deadline = entry.deadline ? new Date(entry.deadline) : null;
    if (!entry.call || (deadline && deadline < now) || withdrawn(entry.changes)) continue;
    const { call } = entry;
    open.push({
      id,
      role: call.role,
      title: call.title,
      url: call.url,
      institution: call.institution_name,
      institutionCode: call.institution_code ?? null,
      region: call.region ?? null,
      gsd: call.gsd,
      positions: call.positions ?? null,
      deadline,
      firstSeen: new Date(entry.first_seen),
    });
  }
  const time = (call: SeenCall) => call.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
  return open.sort((a, b) => time(a) - time(b) || a.id.localeCompare(b.id));
}
