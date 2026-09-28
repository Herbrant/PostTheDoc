/** Starts the daily job (the pipeline's GitHub workflow) from the Worker's cron trigger. */
import { DAILY_JOB_HOUR, DAILY_JOB_TIME_ZONE } from "../config";
import { hourIn } from "../lib/time";

/** The dispatch API answers in well under a second; the cron invocation should not hang. */
const DISPATCH_TIMEOUT_MS = 10_000;

/**
 * Dispatch DAILY_WORKFLOW on main if the trigger fired at DAILY_JOB_HOUR local time; the other
 * trigger is the one for the other half of the year. Throws if GitHub refuses the dispatch.
 */
export async function runDailyJob(controller: ScheduledController, env: Env): Promise<void> {
  if (hourIn(DAILY_JOB_TIME_ZONE, controller.scheduledTime) !== DAILY_JOB_HOUR) return;
  const url = `https://api.github.com/repos/${env.DAILY_WORKFLOW_REPO}/actions/workflows/${env.DAILY_WORKFLOW}/dispatches`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      "content-type": "application/json",
      // GitHub refuses API requests without one.
      "user-agent": "postthedoc-worker",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
    signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`GitHub refused the daily job dispatch: ${resp.status}`);
}
