/**
 * Contract of the Worker's JSON API, shared with the web app. Only types and constants: the web
 * app imports this module in the browser, so it must not pull in the reference tables.
 */
import type { Locale } from "./contract";

export const API_ROUTES = {
  subscribe: "/api/subscribe",
  manageLink: "/api/manage-link",
  preferences: "/api/preferences",
  export: "/api/preferences/export",
} as const;

/**
 * Turnstile actions of the two forms: the Worker only accepts a challenge solved for the form
 * it is submitted with.
 */
export const CAPTCHA_ACTIONS = {
  subscribe: "subscribe",
  manageLink: "manage-link",
} as const;
export type CaptchaAction = (typeof CAPTCHA_ACTIONS)[keyof typeof CAPTCHA_ACTIONS];

export const API_ERROR_CODES = [
  "invalid",
  "captcha",
  "email",
  "unauthorized",
  "not_found",
  "rate_limited",
  "internal",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

export interface ApiError {
  error: ApiErrorCode;
  /** Only with `error: "invalid"`: what failed validation. */
  issues?: ValidationIssue[];
}

export interface ApiOk {
  ok: true;
}

/** What a subscriber asked to be notified about. */
export interface Preferences {
  locale: Locale;
  roles: string[];
  sectors: string[];
  regions: string[];
  institutions: string[];
  include_unspecified: boolean;
}

export type PreferenceList = "roles" | "sectors" | "regions" | "institutions";

export interface SubscribeRequest extends Preferences {
  email: string;
  turnstileToken: string;
}

export interface ManageLinkRequest {
  email: string;
  turnstileToken: string;
}

export interface PreferencesResponse extends Preferences {
  email: string;
}
