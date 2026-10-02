/**
 * The permanent archive of every call seen, written by the pipeline (data/archive/calls.jsonl,
 * see archive.py there): one JSON object per line. The observatory reads it at build time.
 */
import { z } from "zod";

const changeSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  field: z.string(),
  old: z.union([z.string(), z.number()]).nullable(),
  new: z.union([z.string(), z.number()]).nullable(),
});

const lineSchema = z.object({
  id: z.string(),
  deadline: z.iso.datetime({ offset: true }).nullable(),
  first_seen: z.iso.datetime({ offset: true }),
  role: z.string(),
  title: z.string(),
  institution_name: z.string(),
  institution_code: z.string().nullish(),
  region: z.string().nullish(),
  gsd: z.array(z.string()).default([]),
  positions: z.number().int().nullish(),
  published: z.iso.date().nullish(),
  changes: z.array(changeSchema).default([]),
});

export interface ArchivedCall {
  id: string;
  role: string;
  title: string;
  institution: string;
  institutionCode: string | null;
  region: string | null;
  gsd: string[];
  /** Number of positions, when the portal states it. */
  positions: number | null;
  /** Date of the call ("Data del bando"), YYYY-MM-DD, when read from its page. */
  published: string | null;
  deadline: Date | null;
  firstSeen: Date;
  /** Whether it left the open calls before its deadline and is still out. */
  withdrawn: boolean;
}

/** The calls of a calls.jsonl text. Throws on a malformed line. */
export function archivedCalls(text: string): ArchivedCall[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const row = lineSchema.parse(JSON.parse(line));
      const status = row.changes.filter((change) => change.field === "status");
      return {
        id: row.id,
        role: row.role,
        title: row.title,
        institution: row.institution_name,
        institutionCode: row.institution_code ?? null,
        region: row.region ?? null,
        gsd: row.gsd,
        positions: row.positions ?? null,
        published: row.published ?? null,
        deadline: row.deadline ? new Date(row.deadline) : null,
        firstSeen: new Date(row.first_seen),
        withdrawn: status.at(-1)?.new === "withdrawn",
      };
    });
}
