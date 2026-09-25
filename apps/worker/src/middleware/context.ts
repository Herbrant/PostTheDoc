import { createMiddleware } from "hono/factory";
import { createQuotaRepository } from "../db/quota";
import { createUserRepository } from "../db/users";
import type { AppEnv } from "../types";

/** Expose the data access objects to the handlers. */
export const repositories = createMiddleware<AppEnv>(async (c, next) => {
  c.set("users", createUserRepository(c.env.DB));
  c.set("quota", createQuotaRepository(c.env.DB));
  await next();
});
