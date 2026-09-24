from datetime import datetime

from pydantic import BaseModel, Field


class Bando(BaseModel):
    id: str  # es. "mur-jobs-152404", stabile tra un'esecuzione e l'altra
    source: str
    role: str  # codice in data/reference/ruoli.json
    title: str
    url: str
    struttura_name: str
    struttura_code: str | None = None
    regione: str | None = None
    ssd: list[str] = Field(default_factory=list)  # es. ["IINF-05/A"]
    gsd: list[str] = Field(default_factory=list)  # es. ["IINF-05"]
    deadline: datetime | None = None
    posti: int | None = None


class User(BaseModel):
    id: str
    email: str
    token_version: int = 0
    roles: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)  # codici G.S.D.
    regions: list[str] = Field(default_factory=list)
    universities: list[str] = Field(default_factory=list)  # codici struttura MUR
    include_unspecified: bool = True
