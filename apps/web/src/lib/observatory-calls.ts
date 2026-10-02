// The calls the observatory counts, in a compact form for the browser (/observatory/calls.json):
// one array per call, the repeated names and roles by index.
import type { ArchivedCall } from "@postthedoc/shared/archive";

/** [role, institution name, institution code, positions, published, deadline, first seen]. */
type Row = [number, number, string | null, number | null, string | null, string | null, string];

export interface CompactCalls {
  roles: string[];
  institutions: string[];
  calls: Row[];
}

/** The calls withdrawn before their deadline never count: they are left out. */
export function compact(calls: readonly ArchivedCall[]): CompactCalls {
  const roles: string[] = [];
  const institutions: string[] = [];
  const index = (list: string[], value: string) => {
    const i = list.indexOf(value);
    return i >= 0 ? i : list.push(value) - 1;
  };
  return {
    roles,
    institutions,
    calls: calls
      .filter((call) => !call.withdrawn)
      .map((call) => [
        index(roles, call.role),
        index(institutions, call.institution),
        call.institutionCode,
        call.positions,
        call.published,
        call.deadline?.toISOString() ?? null,
        call.firstSeen.toISOString(),
      ]),
  };
}

/** The calls of a compact list, with what the figures need (no title, sectors, region). */
export function expand(data: CompactCalls): ArchivedCall[] {
  return data.calls.map(([role, institution, code, positions, published, deadline, seen]) => ({
    id: "",
    role: data.roles[role] ?? "",
    title: "",
    institution: data.institutions[institution] ?? "",
    institutionCode: code,
    region: null,
    gsd: [],
    positions,
    published,
    deadline: deadline ? new Date(deadline) : null,
    firstSeen: new Date(seen),
    withdrawn: false,
  }));
}
