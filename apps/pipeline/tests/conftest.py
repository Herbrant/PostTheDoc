from pathlib import Path

import pytest

from postthedoc.config import data_dir
from postthedoc.contract import Contract
from postthedoc.reference import ReferenceData


@pytest.fixture(scope="session")
def contract() -> Contract:
    return Contract.load(data_dir() / "contract.json")


@pytest.fixture(scope="session")
def reference() -> ReferenceData:
    return ReferenceData.load(data_dir() / "reference")


@pytest.fixture(scope="session")
def fixtures() -> Path:
    return Path(__file__).parent / "fixtures"
