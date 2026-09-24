/** Typed client of the Worker's JSON API. */
import {
  API_ERROR_CODES,
  API_ROUTES,
  type ApiError,
  type ApiErrorCode,
  type ManageLinkRequest,
  type Preferences,
  type PreferencesResponse,
  type SubscribeRequest,
} from "@postthedoc/shared/api";
import { API_URL } from "../../config/env";

/** Requests give up after this long (ms): the Worker answers in well under a second. */
const TIMEOUT = 20_000;

export type FailureCode = ApiErrorCode | "network";

export interface Failure extends Omit<ApiError, "error"> {
  ok: false;
  error: FailureCode;
  status: number;
}

export type Result<T> = { ok: true; data: T } | Failure;

const isErrorCode = (value: unknown): value is ApiErrorCode =>
  (API_ERROR_CODES as readonly unknown[]).includes(value);

async function failure(resp: Response): Promise<Failure> {
  const body: Partial<ApiError> = await resp.json().catch(() => ({}));
  return {
    ok: false,
    status: resp.status,
    error: isErrorCode(body.error) ? body.error : "internal",
    ...(body.issues ? { issues: body.issues } : {}),
  };
}

async function request<T>(
  path: string,
  init: RequestInit,
  read: (resp: Response) => Promise<T>,
): Promise<Result<T>> {
  let resp: Response;
  try {
    resp = await fetch(API_URL + path, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    return { ok: false, error: "network", status: 0 };
  }
  return resp.ok ? { ok: true, data: await read(resp) } : failure(resp);
}

const json = (method: string, body: unknown, headers: HeadersInit = {}): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const ignore = async () => undefined;

export const api = {
  subscribe: (body: SubscribeRequest) => request(API_ROUTES.subscribe, json("POST", body), ignore),

  requestManageLink: (body: ManageLinkRequest) =>
    request(API_ROUTES.manageLink, json("POST", body), ignore),

  getPreferences: (token: string) =>
    request(
      API_ROUTES.preferences,
      { headers: bearer(token) },
      (resp) => resp.json() as Promise<PreferencesResponse>,
    ),

  savePreferences: (token: string, prefs: Preferences) =>
    request(API_ROUTES.preferences, json("PUT", prefs, bearer(token)), ignore),

  deleteSubscription: (token: string) =>
    request(API_ROUTES.preferences, { method: "DELETE", headers: bearer(token) }, ignore),

  /** Everything stored about the user, as a JSON file. */
  exportData: (token: string) =>
    request(API_ROUTES.export, { headers: bearer(token) }, (resp) => resp.blob()),
};
