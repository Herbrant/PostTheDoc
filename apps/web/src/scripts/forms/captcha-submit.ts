/** The submit flow of the forms protected by the anti-bot check. */
import type { Result } from "../lib/api";
import { busy } from "../lib/busy";
import { showFailure, showMessage } from "../lib/messages";
import { strings } from "../lib/strings";
import { type Captcha, TOKEN_TIMEOUT, UNAVAILABLE } from "../lib/turnstile";

/** The trimmed address, or null (with an error message) if it is not valid. */
export function readEmail(input: HTMLInputElement, message: HTMLElement): string | null {
  input.value = input.value.trim();
  if (input.checkValidity()) return input.value;
  showMessage(message, strings.errorEmailFormat, "error");
  input.focus();
  return null;
}

/** Explain why there is no token: Turnstile missing or failing, or a check still in progress. */
function showCaptchaProblem(message: HTMLElement, captcha: Captcha) {
  const code = captcha.error();
  if (code === UNAVAILABLE) showMessage(message, strings.errorCaptchaUnavailable, "error");
  else if (code) showMessage(message, `${strings.errorCaptcha} (${code})`, "error");
  else showMessage(message, strings.errorCaptchaPending, "info");
  // The widget waits for a click: bring it into view rather than the message.
  if (captcha.element.classList.contains("is-visible")) {
    captcha.element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

interface CaptchaSubmit {
  button: HTMLButtonElement;
  captcha: Promise<Captcha>;
  message: HTMLElement;
  send(turnstileToken: string): Promise<Result<unknown>>;
}

/**
 * Wait for the anti-bot token, then send; the button stays disabled throughout. True on
 * success; otherwise the message box explains what went wrong.
 */
export function submitWithCaptcha({ button, captcha, message, send }: CaptchaSubmit) {
  return busy(button, async () => {
    const widget = await captcha;
    const token = await widget.token(TOKEN_TIMEOUT);
    if (!token) {
      showCaptchaProblem(message, widget);
      return false;
    }
    const result = await send(token);
    widget.reset(); // a token is valid once
    if (!result.ok) showFailure(message, result);
    return result.ok;
  });
}
