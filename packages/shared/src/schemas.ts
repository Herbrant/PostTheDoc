/** Validation of the Worker's request bodies (server side only: it loads the reference tables). */
import { z } from "zod";
import type { ManageLinkRequest, Preferences, SubscribeRequest } from "./api";
import { LOCALES } from "./contract";
import { gsdCodes, institutionCodes, regionCodes, roleCodes } from "./reference";

/** A list of known codes, deduplicated; `max` bounds the payload size. */
const codeList = (allowed: ReadonlySet<string>) =>
  z
    .array(z.string())
    .max(allowed.size)
    .refine((xs) => xs.every((x) => allowed.has(x)), "Unknown code")
    .transform((xs) => [...new Set(xs)]);

/** Addresses are compared case-insensitively, so they are stored in lower case. */
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const turnstileToken = z.string().min(1).max(2048); // Turnstile's documented maximum

export const preferencesSchema = z.object({
  locale: z.enum(LOCALES),
  roles: codeList(roleCodes).refine((xs) => xs.length > 0, "Pick at least one role"),
  sectors: codeList(gsdCodes).refine((xs) => xs.length > 0, "Pick at least one field"),
  regions: codeList(regionCodes),
  institutions: codeList(institutionCodes),
  include_unspecified: z.boolean(),
}) satisfies z.ZodType<Preferences>;

export const subscribeSchema = preferencesSchema.extend({
  email,
  turnstileToken,
}) satisfies z.ZodType<SubscribeRequest>;

export const manageLinkSchema = z.object({
  email,
  turnstileToken,
}) satisfies z.ZodType<ManageLinkRequest>;
