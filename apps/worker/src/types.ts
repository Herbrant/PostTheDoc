import type { Context } from "hono";
import type { QuotaRepository } from "./db/quota";
import type { UserRepository, UserRow } from "./db/users";

/** Hono environment of the app: bindings plus per-request variables set by middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    users: UserRepository;
    quota: QuotaRepository;
    /** The authenticated user, on routes behind requireUser. */
    user: UserRow;
  };
}

export type AppContext = Context<AppEnv>;
