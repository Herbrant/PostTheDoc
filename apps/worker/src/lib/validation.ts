import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import { apiError } from "./http";

/** Validate the JSON body; failures answer 400 `{ error: "invalid", issues }`. */
export const jsonBody = <T extends ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues.map(({ path, message }) => ({ path, message }));
      return apiError(c, "invalid", 400, issues);
    }
  });
