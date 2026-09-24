"""For dry runs: write digests to disk instead of sending them."""

import logging
import re
from pathlib import Path

from postthedoc.mail.message import Email, MailError

log = logging.getLogger(__name__)


class FileMailer:
    def __init__(self, out_dir: Path) -> None:
        self._out_dir = out_dir

    def send(self, email: Email) -> None:
        name = re.sub(r"[^\w.-]", "_", email.to)
        try:
            self._out_dir.mkdir(parents=True, exist_ok=True)
            (self._out_dir / f"{name}.html").write_text(email.html, encoding="utf-8")
            (self._out_dir / f"{name}.txt").write_text(
                f"To: {email.to}\nSubject: {email.subject}\n\n{email.text}", encoding="utf-8"
            )
        except OSError as exc:
            raise MailError(f"Cannot write the digest for {email.to}: {exc}") from exc
        log.info("Digest for %s written to %s", email.to, self._out_dir)
