import type { ApiError, ApiErrorCode, ApiOk } from "@postthedoc/shared/api";
import { LINK_PARAMS } from "@postthedoc/shared/contract";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ok = (c: Context) => c.json<ApiOk>({ ok: true });

export const apiError = (
  c: Context,
  error: ApiErrorCode,
  status: ContentfulStatusCode,
  issues?: ApiError["issues"],
) => c.json<ApiError>(issues ? { error, issues } : { error }, status);

/** The token carried by an email link. */
export const linkToken = (c: Context): string => c.req.query(LINK_PARAMS.token) ?? "";
