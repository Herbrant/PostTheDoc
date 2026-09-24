import { z } from "zod";
import { gsdCodes, regionCodes, roleCodes, strutturaCodes } from "./reference";

const codes = (allowed: Set<string>, max: number) =>
  z
    .array(z.string())
    .max(max)
    .refine((xs) => xs.every((x) => allowed.has(x)), "Codice non valido")
    .transform((xs) => [...new Set(xs)]);

export const preferencesSchema = z.object({
  roles: codes(roleCodes, roleCodes.size).refine((xs) => xs.length > 0, "Scegli almeno un ruolo"),
  sectors: codes(gsdCodes, gsdCodes.size),
  regions: codes(regionCodes, regionCodes.size),
  universities: codes(strutturaCodes, strutturaCodes.size),
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
