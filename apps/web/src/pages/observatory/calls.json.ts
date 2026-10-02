// The calls the observatory counts, for the page's script to compute the figures of the period
// the reader picks (see lib/observatory-calls.ts). Empty before the archive exists.
import type { APIRoute } from "astro";
import { compact } from "../../lib/observatory-calls";
import { loadObservatory } from "../../lib/observatory-data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(compact(loadObservatory("it")?.calls ?? [])), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
