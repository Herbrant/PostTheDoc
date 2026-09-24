from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    html: str
    text: str
    headers: dict[str, str] = field(default_factory=dict)


class MailError(Exception):
    """An email could not be delivered to the transport."""


class Mailer(Protocol):
    def send(self, email: Email) -> None:
        """Deliver the email; raise MailError on failure."""
        ...
