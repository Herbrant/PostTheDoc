"""Which calls each subscriber wants to hear about."""

from collections.abc import Iterable, Sequence

from postthedoc.models import Call, User


def matches(call: Call, user: User) -> bool:
    if call.role not in user.roles:
        return False
    return _matches_sector(call, user) and _matches_location(call, user)


def _matches_sector(call: Call, user: User) -> bool:
    # Only subscriptions made before a sector became required have none: they get every sector.
    if not user.sectors:
        return True
    if not call.gsd:
        return user.include_unspecified
    return not set(call.gsd).isdisjoint(user.sectors)


def _matches_location(call: Call, user: User) -> bool:
    # No location filter means the whole of Italy; otherwise a region OR an institution matches.
    if not (user.regions or user.institutions):
        return True
    in_institution = (
        call.institution_code is not None and call.institution_code in user.institutions
    )
    in_region = call.region is not None and call.region in user.regions
    return in_institution or in_region


def match_all(calls: Sequence[Call], users: Iterable[User]) -> dict[str, list[Call]]:
    """user_id -> matching calls (only users with at least one match)."""
    result: dict[str, list[Call]] = {}
    for user in users:
        if found := [call for call in calls if matches(call, user)]:
            result[user.id] = found
    return result
