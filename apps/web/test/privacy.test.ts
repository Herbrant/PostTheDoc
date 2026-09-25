// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVACY_VERSION } from "../../worker/src/config";

const MONTHS: Record<string, string[]> = {
  it: "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split(
    " ",
  ),
  en: "January February March April May June July August September October November December".split(
    " ",
  ),
};

/** The "last updated" date at the bottom of the notice, as YYYY-MM-DD. */
function lastUpdated(locale: "it" | "en"): string {
  const text = readFileSync(
    new URL(`../src/content/privacy/${locale}.md`, import.meta.url),
    "utf8",
  );
  const match = text.match(/(?:Ultimo aggiornamento|Last updated): (\d{1,2}) (\p{L}+) (\d{4})\./u);
  if (!match) throw new Error(`No "last updated" date in the ${locale} notice`);
  const [, day, month, year] = match;
  const index = MONTHS[locale]?.indexOf(month ?? "") ?? -1;
  return `${year}-${String(index + 1).padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

describe("privacy notice", () => {
  it.each(["it", "en"] as const)("has the date of PRIVACY_VERSION (%s)", (locale) => {
    // Users consent to PRIVACY_VERSION: it must change together with the notice.
    expect(lastUpdated(locale)).toBe(PRIVACY_VERSION);
  });
});
