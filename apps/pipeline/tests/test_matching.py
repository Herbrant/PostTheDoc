import pytest

from postthedoc.matching import match_all, matches
from postthedoc.models import Call, User

SICILY = "IT-82"
LAZIO = "IT-62"


def call(**kw) -> Call:
    base = dict(
        id="mur-jobs-1",
        source="mur",
        role="researcher",
        title="RTT",
        url="https://example.org",
        institution_name="Univ. CATANIA",
        institution_code="UNICT",
        region=SICILY,
        ssd=["INFO-01/A"],
        gsd=["INFO-01"],
    )
    return Call(**(base | kw))


def user(**kw) -> User:
    return User(**({"id": "u1", "email": "a@example.org", "roles": ["researcher"]} | kw))


@pytest.mark.parametrize(
    ("c", "u", "expected"),
    [
        (call(), user(), True),
        (call(role="phd"), user(), False),
        (call(), user(sectors=["INFO-01", "IINF-05"]), True),
        (call(), user(sectors=["IINF-05"]), False),
        (call(gsd=[], ssd=[]), user(sectors=["INFO-01"]), True),
        (call(gsd=[], ssd=[]), user(sectors=["INFO-01"], include_unspecified=False), False),
        (call(), user(regions=[SICILY]), True),
        (call(), user(regions=[LAZIO]), False),
        (call(), user(institutions=["UNICT"]), True),
        (call(), user(regions=[LAZIO], institutions=["UNICT"]), True),
        (call(region=None, institution_code=None), user(regions=[SICILY]), False),
        (call(region=None, institution_code=None), user(), True),
    ],
)
def test_matches(c, u, expected):
    assert matches(c, u) is expected


def test_match_all_skips_users_without_results():
    users = [user(id="u1"), user(id="u2", roles=["technologist"])]
    assert list(match_all([call()], users)) == ["u1"]
