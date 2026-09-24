"""PostTheDoc: email notifications about new academic job calls in Italian institutions."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("postthedoc")
except PackageNotFoundError:  # running from a source tree that was never installed
    __version__ = "0.0.0"
