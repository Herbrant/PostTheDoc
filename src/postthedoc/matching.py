from postthedoc.models import Bando, User


def matches(bando: Bando, user: User) -> bool:
    if bando.role not in user.roles:
        return False

    if user.sectors:
        if not bando.gsd:
            if not user.include_unspecified:
                return False
        elif not set(bando.gsd) & set(user.sectors):
            return False

    # Nessun filtro geografico = tutta Italia.
    if user.regions or user.universities:
        in_university = (
            bando.struttura_code is not None and bando.struttura_code in user.universities
        )
        in_region = bando.regione is not None and bando.regione in user.regions
        if not (in_university or in_region):
            return False

    return True


def match_all(bandi: list[Bando], users: list[User]) -> dict[str, list[Bando]]:
    """user_id -> bandi corrispondenti (solo utenti con almeno un bando)."""
    result: dict[str, list[Bando]] = {}
    for user in users:
        found = [b for b in bandi if matches(b, user)]
        if found:
            result[user.id] = found
    return result
