/** Starts the daily job (the pipeline's GitHub workflow) from the Worker's cron trigger. */
import { DAILY_JOB_HOUR, DAILY_JOB_RETRY_HOURS, DAILY_JOB_TIME_ZONE } from "../config";
import { createDeliveryRepository } from "../db/deliveries";
import { hourIn } from "../lib/time";

/** The dispatch API answers in well under a second; the cron invocation should not hang. */
const GITHUB_TIMEOUT_MS = 10_000;

function githubRequest(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `https://api.github.com/repos/${env.DAILY_WORKFLOW_REPO}/actions/workflows/${env.DAILY_WORKFLOW}/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      "content-type": "application/json",
      // GitHub refuses API requests without one.
      "user-agent": "postthedoc-worker",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
}

/** A run still going or cancelled by hand has no conclusion to act on. */
async function latestRunFailed(env: Env): Promise<boolean> {
  const resp = await githubRequest(env, "runs?branch=main&per_page=1");
  if (!resp.ok) throw new Error(`GitHub refused the daily job's runs: ${resp.status}`);
  const { workflow_runs: runs } = await resp.json<{
    workflow_runs: { conclusion: string | null }[];
  }>();
  const conclusion = runs.at(0)?.conclusion;
  return conclusion === "failure" || conclusion === "timed_out";
}

/**
 * Subscribers get at most one digest a day, so a failed run is only worth repeating if it sent
 * none: a run that stopped midway leaves the others to tomorrow's digest, as it always did.
 */
async function retryDue(env: Env, scheduledTime: number): Promise<boolean> {
  const day = new Date(scheduledTime).toISOString().slice(0, 10);
  if (await createDeliveryRepository(env.DB).sentSince(day)) return false;
  return latestRunFailed(env);
}

/**
 * Dispatch DAILY_WORKFLOW on main at DAILY_JOB_HOUR local time, and at DAILY_JOB_RETRY_HOURS if its
 * latest run failed without sending a digest: the MUR portal has outages that last a morning.
 * Other hours do nothing: the cron covers the whole span in both summer and winter time. Throws if
 * GitHub or D1 refuses a request, and then nothing is dispatched.
 */
export async function runDailyJob(controller: ScheduledController, env: Env): Promise<void> {
  const { scheduledTime } = controller;
  const hour = hourIn(DAILY_JOB_TIME_ZONE, scheduledTime);
  const due =
    hour === DAILY_JOB_HOUR ||
    (DAILY_JOB_RETRY_HOURS.includes(hour) && (await retryDue(env, scheduledTime)));
  if (!due) return;
  const resp = await githubRequest(env, "dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  });
  if (!resp.ok) throw new Error(`GitHub refused the daily job dispatch: ${resp.status}`);
}
