import { z } from "zod";
import { LOCALES } from "./i18n";
import { gsdCodes, institutionCodes, regionCodes, roleCodes } from "./reference";

const codes = (allowed: Set<string>, max: number) =>
  z
    .array(z.string())
    .max(max)
    .refine((xs) => xs.every((x) => allowed.has(x)), "Unknown code")
    .transform((xs) => [...new Set(xs)]);

export const preferencesSchema = z.object({
  locale: z.enum(LOCALES),
  roles: codes(roleCodes, roleCodes.size).refine((xs) => xs.length > 0, "Pick at least one role"),
  sectors: codes(gsdCodes, gsdCodes.size),
  regions: codes(regionCodes, regionCodes.size),
  institutions: codes(institutionCodes, institutionCodes.size),
  include_unspecified: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const subscribeSchema = preferencesSchema.extend({
  email: z.email().max(254),
  turnstileToken: z.string().min(1),
});

export const manageLinkSchema = z.object({
  email: z.email().max(254),
  turnstileToken: z.string().min(1),
});
