"""The bandi.mur.gov.it portal."""

from postthedoc.sources.mur.parser import MurParser, parse_detail_page
from postthedoc.sources.mur.sections import SECTIONS, SECTIONS_BY_KEY, Section
from postthedoc.sources.mur.source import MurSource

__all__ = ["SECTIONS", "SECTIONS_BY_KEY", "MurParser", "MurSource", "Section", "parse_detail_page"]
