import pytest

from postthedoc.matching import match_all, matches
from postthedoc.models import Bando, User


def bando(**kw) -> Bando:
    base = dict(
        id="mur-jobs-1",
        source="mur",
        role="ricercatore",
        title="RTT",
        url="https://example.org",
        struttura_name="Univ. CATANIA",
        struttura_code="UNICT",
        regione="sicilia",
        ssd=["INFO-01/A"],
        gsd=["INFO-01"],
    )
    return Bando(**(base | kw))


def user(**kw) -> User:
    return User(**({"id": "u1", "email": "a@example.org", "roles": ["ricercatore"]} | kw))


@pytest.mark.parametrize(
    ("b", "u", "expected"),
    [
        (bando(), user(), True),
        (bando(role="dottorato"), user(), False),
        (bando(), user(sectors=["INFO-01", "IINF-05"]), True),
        (bando(), user(sectors=["IINF-05"]), False),
        (bando(gsd=[], ssd=[]), user(sectors=["INFO-01"]), True),
        (bando(gsd=[], ssd=[]), user(sectors=["INFO-01"], include_unspecified=False), False),
        (bando(), user(regions=["sicilia"]), True),
        (bando(), user(regions=["lazio"]), False),
        (bando(), user(universities=["UNICT"]), True),
        (bando(), user(regions=["lazio"], universities=["UNICT"]), True),
        (bando(regione=None, struttura_code=None), user(regions=["sicilia"]), False),
        (bando(regione=None, struttura_code=None), user(), True),
    ],
)
def test_matches(b, u, expected):
    assert matches(b, u) is expected


def test_match_all_skips_users_without_results():
    users = [user(id="u1"), user(id="u2", roles=["tecnologo"])]
    assert list(match_all([bando()], users)) == ["u1"]
