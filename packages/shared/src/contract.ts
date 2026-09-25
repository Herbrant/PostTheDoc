/**
 * Values shared by the pipeline, the Worker and the web app, read from data/contract.json (the
 * Python pipeline reads the same file).
 */
import contract from "../../../data/contract.json";

/**
 * Narrow a list from the JSON file to the literal type the code is written against, failing
 * loudly (at build time and in tests) if the two drift apart.
 */
function literals<const T extends readonly string[]>(actual: readonly string[], expected: T): T {
  if (actual.length !== expected.length || actual.some((value, i) => value !== expected[i])) {
    throw new Error(`data/contract.json: expected [${expected}], found [${actual}]`);
  }
  return expected;
}

export const LOCALES = literals(contract.locales, ["it", "en"]);
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "it";

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** Lifetime of each kind of signed link, in seconds; 0 means the link never expires. */
export const TOKEN_TTL_SECONDS = contract.tokenTtlSeconds;
export type TokenPurpose = keyof typeof TOKEN_TTL_SECONDS;
export const TOKEN_PURPOSES = Object.keys(TOKEN_TTL_SECONDS) as TokenPurpose[];

/** Unconfirmed addresses are deleted after this many days (see the pipeline's daily purge). */
export const PENDING_RETENTION_DAYS = contract.pendingRetentionDays;

export type SitePage = keyof typeof contract.sitePaths;

/** Path of a page of the web app, relative to its base URL, e.g. `/it/manage/`. */
export function sitePath(page: SitePage, locale: Locale): string {
  return contract.sitePaths[page].replace("{locale}", locale);
}

/** Paths served by the Worker that email links point to. */
export const API_PATHS = contract.apiPaths;

/** Query and fragment parameters of the links sent by email. */
export const LINK_PARAMS = contract.linkParams;

/** Where the emails send people who need help: their replies are not read. */
export const ISSUES_URL = contract.issuesUrl;

export const INSTITUTION_TYPES = literals(contract.institutionTypes, [
  "university",
  "online_university",
  "research_institute",
  "afam",
]);
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];
