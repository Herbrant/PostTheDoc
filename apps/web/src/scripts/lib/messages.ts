/** The message box of each form page (#message): outcome of the user's last action. */
import type { ValidationIssue } from "@postthedoc/shared/api";
import { format } from "../../i18n/format";
import type { Failure, FailureCode } from "./api";
import { scrollBehavior } from "./dom";
import { strings } from "./strings";

type Kind = "success" | "error" | "info";

export function showMessage(node: HTMLElement, text: string, kind: Kind) {
  node.textContent = text;
  node.className = `message ${kind}`;
  node.hidden = false;
  node.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
}

export function hideMessage(node: HTMLElement) {
  node.hidden = true;
}

const ERROR_TEXT: Record<FailureCode, string | undefined> = {
  invalid: strings.errorInvalid,
  captcha: strings.errorCaptcha,
  email: strings.errorEmail,
  unauthorized: strings.errorUnauthorized,
  rate_limited: strings.errorRateLimited,
  network: strings.errorNetwork,
  not_found: undefined,
  internal: undefined,
};

/** The localized names of the fields that failed validation. */
function invalidFields(issues: ValidationIssue[]): string[] {
  const fields: Record<string, string> = strings.fields;
  const names = issues.map((issue) => String(issue.path[0] ?? "")).filter((name) => name in fields);
  return [...new Set(names)].map((name) => fields[name] ?? name);
}

/** Localized text for a failed API call. */
export function failureText(failure: Failure): string {
  const fields = failure.issues ? invalidFields(failure.issues) : [];
  if (fields.length) return format(strings.errorFields, { fields: fields.join(", ") });
  return ERROR_TEXT[failure.error] ?? format(strings.errorUnexpected, { status: failure.status });
}

export const showFailure = (node: HTMLElement, failure: Failure) =>
  showMessage(node, failureText(failure), "error");
