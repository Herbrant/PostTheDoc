"""Aggregate figures about the platform, for the operator: `postthedoc stats`.

Read-only: the queries only SELECT, and nothing that identifies a subscriber leaves D1 (no ids,
no addresses). A snapshot of the current state: unsubscribing deletes the user and their
deliveries, and calls are known only while they stay in seen.json.
"""

import json
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta

from postthedoc.reference import ReferenceData
from postthedoc.sources.mur import SECTIONS_BY_KEY
from postthedoc.storage import D1Client, SeenStore
from postthedoc.storage.seen import SeenEntry

WINDOWS = (1, 7, 30)  # days
DAILY_DAYS = 14
ANY = "(any)"  # label of an empty preference list: no filter
TOP_SECTORS = 20  # in the text output; the JSON output lists them all

USERS_BY_STATUS = "SELECT status, COUNT(*) AS n FROM users GROUP BY status"
# Preferences only, no id or address: aggregated here rather than in SQL to count each user once
# per sector area.
ACTIVE_PREFERENCES = (
    "SELECT locale, roles, sectors, regions, institutions, include_unspecified,"
    " COALESCE(confirmed_at, created_at) AS since FROM users WHERE status = 'active'"
)
# One digest per user per day.
DELIVERIES_SINCE = (
    "SELECT COUNT(DISTINCT user_id || ' ' || substr(sent_at, 1, 10)) AS digests,"
    " COUNT(*) AS notifications, COUNT(DISTINCT user_id) AS users,"
    " COUNT(DISTINCT call_id) AS calls FROM deliveries WHERE sent_at >= ?"
)
DELIVERIES_BY_DAY = (
    "SELECT substr(sent_at, 1, 10) AS day, COUNT(DISTINCT user_id) AS digests,"
    " COUNT(*) AS notifications FROM deliveries WHERE sent_at >= ? GROUP BY day ORDER BY day"
)


@dataclass(frozen=True)
class Row:
    code: str
    label: str
    count: int


@dataclass(frozen=True)
class UserStats:
    active: int
    pending: int  # unconfirmed, purged after contract.pending_retention_days
    new: dict[str, int]  # active users confirmed in the last N days, e.g. {"7d": 3}
    include_unspecified: int
    with_institutions: int
    locales: list[Row]
    roles: list[Row]
    areas: list[Row]
    sectors: list[Row]
    regions: list[Row]


@dataclass(frozen=True)
class DeliveryWindow:
    days: int
    digests: int
    notifications: int  # (user, call) pairs
    users: int
    calls: int


@dataclass(frozen=True)
class Day:
    day: str
    digests: int
    notifications: int


@dataclass(frozen=True)
class SectionRow:
    code: str
    role: str  # role code, "professors" for the section of professor calls
    open: int
    new: dict[str, int]  # first seen in the last N days


@dataclass(frozen=True)
class CallStats:
    tracked: int
    open: int
    new: dict[str, int]
    sections: list[SectionRow]


@dataclass(frozen=True)
class Stats:
    generated_at: str
    users: UserStats
    deliveries: list[DeliveryWindow]
    daily: list[Day]
    calls: CallStats | None  # None without seen.json


def collect(d1: D1Client, seen: SeenStore | None, reference: ReferenceData, now: datetime) -> Stats:
    return Stats(
        generated_at=now.isoformat(timespec="seconds"),
        users=_users(d1, reference, now),
        deliveries=[_deliveries(d1, days, now) for days in WINDOWS],
        daily=[
            Day(row["day"], row["digests"], row["notifications"])
            for row in d1.query(DELIVERIES_BY_DAY, [_since(now, DAILY_DAYS - 1, midnight=True)])
        ],
        calls=_calls(seen.entries(), now) if seen and seen.exists else None,
    )


def _since(now: datetime, days: int, *, midnight: bool = False) -> str:
    """Lower bound in the format of deliveries.sent_at."""
    start = now - timedelta(days=days)
    if midnight:
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat(timespec="seconds")


def _users(d1: D1Client, reference: ReferenceData, now: datetime) -> UserStats:
    by_status = {row["status"]: row["n"] for row in d1.query(USERS_BY_STATUS)}
    rows = d1.query(ACTIVE_PREFERENCES)
    lists = {
        column: [json.loads(row[column]) for row in rows]
        for column in ("roles", "sectors", "regions", "institutions")
    }
    # users.created_at and confirmed_at are SQLite datetime('now'): UTC, without a zone.
    since = [datetime.fromisoformat(row["since"]).replace(tzinfo=UTC) for row in rows]

    area_of = {group.code: group.area for group in reference.sectors.groups}
    areas = [{area_of.get(code, "?") for code in sectors} for sectors in lists["sectors"]]
    area_names = {area.code: area.name.en for area in reference.sectors.areas}
    group_names = {group.code: group.name for group in reference.sectors.groups}

    return UserStats(
        active=by_status.get("active", 0),
        pending=by_status.get("pending", 0),
        new={f"{d}d": sum(s >= now - timedelta(days=d) for s in since) for d in WINDOWS},
        include_unspecified=sum(bool(row["include_unspecified"]) for row in rows),
        with_institutions=sum(bool(codes) for codes in lists["institutions"]),
        locales=_rows(Counter(row["locale"] for row in rows), {}),
        roles=_rows(_tally(lists["roles"]), reference.role_names("en")),
        areas=_rows(_tally(areas), area_names),
        sectors=_rows(_tally(lists["sectors"]), group_names),
        regions=_rows(_tally(lists["regions"]), reference.region_names("en")),
    )


def _tally(lists: Iterable[Iterable[str]]) -> Counter[str]:
    """How many users chose each code; an empty list (no filter) counts as ""."""
    counts: Counter[str] = Counter()
    for codes in lists:
        counts.update(set(codes) or {""})
    return counts


def _rows(counts: Counter[str], labels: Mapping[str, str]) -> list[Row]:
    return [
        Row(code, labels.get(code, code) if code else ANY, n)
        for code, n in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _deliveries(d1: D1Client, days: int, now: datetime) -> DeliveryWindow:
    [row] = d1.query(DELIVERIES_SINCE, [_since(now, days)])
    return DeliveryWindow(days, row["digests"], row["notifications"], row["users"], row["calls"])


def _calls(entries: Mapping[str, SeenEntry], now: datetime) -> CallStats:
    def is_open(entry: SeenEntry) -> bool:
        return entry.deadline is None or entry.deadline >= now

    def new(items: Sequence[SeenEntry]) -> dict[str, int]:
        return {
            f"{d}d": sum(e.first_seen >= now - timedelta(days=d) for e in items) for d in WINDOWS
        }

    by_section: dict[str, list[SeenEntry]] = {}
    for call_id, entry in entries.items():
        by_section.setdefault(_section(call_id), []).append(entry)
    sections = [
        SectionRow(key, _section_role(key), sum(map(is_open, items)), new(items))
        for key, items in sorted(by_section.items(), key=lambda item: (-len(item[1]), item[0]))
    ]
    values = list(entries.values())
    return CallStats(len(values), sum(map(is_open, values)), new(values), sections)


def _section(call_id: str) -> str:
    """The MUR section of a call id, e.g. "mur-jobs-152404" -> "jobs"."""
    return call_id.removeprefix("mur-").rpartition("-")[0] or call_id


def _section_role(key: str) -> str:
    section = SECTIONS_BY_KEY.get(key)
    if section is None:
        return key
    return section.role or "professors"


def to_json(stats: Stats) -> str:
    return json.dumps(asdict(stats), indent=2, ensure_ascii=False)


def to_text(stats: Stats, reference: ReferenceData) -> str:
    users = stats.users
    role_names = reference.role_names("en")
    windows = [f"{d}d" for d in WINDOWS]
    out = [
        f"PostTheDoc stats, {stats.generated_at}",
        "",
        f"Users: {users.active} active, {users.pending} pending confirmation",
        "New active users: " + ", ".join(f"{users.new[w]} in {w}" for w in windows),
        f"Receiving calls without a sector: {users.include_unspecified}",
        f"Filtering by institution: {users.with_institutions}",
    ]
    out += _table("Locales", ["locale", "users"], [[r.label, r.count] for r in users.locales])
    out += _table("Roles", ["role", "users"], [[r.label, r.count] for r in users.roles])
    out += _table("Sector areas", ["area", "users"], [[_coded(r), r.count] for r in users.areas])
    top = users.sectors[:TOP_SECTORS]
    out += _table(
        f"Sectors (top {len(top)} of {len(users.sectors)})",
        ["G.S.D.", "users"],
        [[_coded(r), r.count] for r in top],
    )
    out += _table("Regions", ["region", "users"], [[r.label, r.count] for r in users.regions])
    out += _table(
        "Deliveries",
        ["period", "digests", "calls sent", "users reached", "distinct calls"],
        [[f"{w.days}d", w.digests, w.notifications, w.users, w.calls] for w in stats.deliveries],
    )
    out += _table(
        f"Daily digests (last {DAILY_DAYS} days)",
        ["day", "digests", "calls sent"],
        [[d.day, d.digests, d.notifications] for d in stats.daily],
    )
    if stats.calls is None:
        out += ["", "Calls: seen.json not found (git pull to get the daily job's copy)"]
    else:
        calls = stats.calls
        out += [
            "",
            f"Calls: {calls.tracked} tracked, {calls.open} still open, new: "
            + ", ".join(f"{calls.new[w]} in {w}" for w in windows),
        ]
        out += _table(
            "Calls by section",
            ["section", "role", "open", *(f"new {w}" for w in windows)],
            [
                [s.code, role_names.get(s.role, s.role), s.open, *(s.new[w] for w in windows)]
                for s in calls.sections
            ],
        )
    return "\n".join(out) + "\n"


def _coded(row: Row) -> str:
    return f"{row.code} {row.label}" if row.code and row.label != row.code else row.label


def _table(title: str, headers: Sequence[str], rows: Sequence[Sequence[object]]) -> list[str]:
    cells = [[str(c) for c in row] for row in [headers, *rows]]
    widths = [max(len(row[i]) for row in cells) for i in range(len(headers))]

    def line(row: Sequence[str]) -> str:
        # Text left-aligned, numbers right-aligned.
        return "  ".join(
            c.rjust(w) if c.isdigit() else c.ljust(w) for c, w in zip(row, widths, strict=True)
        ).rstrip()

    return ["", f"{title}:", *(f"  {line(row)}" for row in cells)] if rows else ["", f"{title}: -"]
