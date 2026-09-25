import pytest

from postthedoc.matching import match_all, matches
from tests.factories import make_call, make_user

SICILY = "IT-82"
LAZIO = "IT-62"


@pytest.mark.parametrize(
    ("call", "user", "expected"),
    [
        (make_call(), make_user(), True),
        (make_call(role="phd"), make_user(), False),
        (make_call(), make_user(sectors=["INFO-01", "IINF-05"]), True),
        (make_call(), make_user(sectors=["IINF-05"]), False),
        (make_call(gsd=[], ssd=[]), make_user(sectors=["INFO-01"]), False),
        (
            make_call(gsd=[], ssd=[]),
            make_user(sectors=["INFO-01"], include_unspecified=True),
            True,
        ),
        (make_call(), make_user(regions=[SICILY]), True),
        (make_call(), make_user(regions=[LAZIO]), False),
        (make_call(), make_user(institutions=["UNICT"]), True),
        (make_call(), make_user(regions=[LAZIO], institutions=["UNICT"]), True),
        (make_call(region=None, institution_code=None), make_user(regions=[SICILY]), False),
        (make_call(region=None, institution_code=None), make_user(), True),
    ],
)
def test_matches(call, user, expected):
    assert matches(call, user) is expected


def test_match_all_skips_users_without_results():
    users = [make_user("u1"), make_user("u2", roles=["technologist"])]
    assert list(match_all([make_call()], users)) == ["u1"]
