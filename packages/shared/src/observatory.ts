/**
 * The observatory's reference data, written by the pipeline (sync-denominators, sync-geometry):
 * validated when this module loads, so malformed data fails the build. Kept apart from
 * reference.ts, which the Worker bundles: it does not need a map of Italy.
 */
import { z } from "zod";
import denominatorsJson from "../../../data/reference/denominators.json";
import geometryJson from "../../../data/reference/geometry.json";

const point = z.tuple([z.number(), z.number()]);
const source = z.object({ source: z.string(), url: z.url(), license: z.string() }).loose();

const denominatorsSchema = z.object({
  sources: z.array(source),
  universities: z.record(
    z.string(),
    z.object({
      staff: z.number().int().positive(),
      students: z.number().int().positive().nullable(),
    }),
  ),
  regions: z.record(z.string(), z.object({ residents: z.number().int().positive() })),
});

const geometrySchema = z.object({
  sources: z.array(source),
  /** ISO 3166-2 code -> outer rings of [longitude, latitude]. */
  regions: z.record(z.string(), z.array(z.array(point))),
  /** City -> [longitude, latitude]. */
  cities: z.record(z.string(), point),
  /** University (MUR code) -> city. */
  universities: z.record(z.string(), z.string()),
});

export type Denominators = z.infer<typeof denominatorsSchema>;
export type Geometry = z.infer<typeof geometrySchema>;

export const denominators: Denominators = denominatorsSchema.parse(denominatorsJson);
export const geometry: Geometry = geometrySchema.parse(geometryJson);
