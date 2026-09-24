from postthedoc.models import Call, User


def matches(call: Call, user: User) -> bool:
    if call.role not in user.roles:
        return False

    if user.sectors:
        if not call.gsd:
            if not user.include_unspecified:
                return False
        elif not set(call.gsd) & set(user.sectors):
            return False

    # No location filter means the whole of Italy.
    if user.regions or user.institutions:
        in_institution = (
            call.institution_code is not None and call.institution_code in user.institutions
        )
        in_region = call.region is not None and call.region in user.regions
        if not (in_institution or in_region):
            return False

    return True


def match_all(calls: list[Call], users: list[User]) -> dict[str, list[Call]]:
    """user_id -> matching calls (only users with at least one match)."""
    result: dict[str, list[Call]] = {}
    for user in users:
        found = [c for c in calls if matches(c, user)]
        if found:
            result[user.id] = found
    return result
