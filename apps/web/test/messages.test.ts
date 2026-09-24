import { describe, expect, it } from "vitest";
import { failureText } from "../src/scripts/lib/messages";

describe("failureText", () => {
  it("names the invalid fields in the page's language", () => {
    const issues = [
      { path: ["roles"], message: "Pick at least one role" },
      { path: ["sectors", 0], message: "Unknown code" },
      { path: ["roles"], message: "again" },
    ];
    expect(failureText({ ok: false, status: 400, error: "invalid", issues })).toBe(
      "Controlla: posizioni, settori.",
    );
  });

  it("explains known errors", () => {
    expect(failureText({ ok: false, status: 0, error: "network" })).toContain("connessione");
    expect(failureText({ ok: false, status: 400, error: "captcha" })).toContain("anti-bot");
  });

  it("falls back to the status for unexpected errors", () => {
    expect(failureText({ ok: false, status: 500, error: "internal" })).toBe(
      "Errore inatteso (500).",
    );
  });
});
