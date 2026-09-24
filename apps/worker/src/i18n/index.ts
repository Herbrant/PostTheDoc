// User-facing strings served by the Worker, in every locale of the contract.
import type { Locale } from "@postthedoc/shared/contract";
import { en } from "./en";
import { it } from "./it";
import type { Strings } from "./types";

export type { Strings } from "./types";

export const strings: Record<Locale, Strings> = { it, en };

/** Pick a locale from an Accept-Language header: Italian if preferred, English otherwise. */
export function pickLocale(acceptLanguage: string | undefined): Locale {
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("it") ? "it" : "en";
}
