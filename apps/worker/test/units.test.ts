import { describe, expect, it } from "vitest";
import { confirmationEmail } from "../src/email/templates";
import { pickLocale } from "../src/i18n";
import { isTestSecret } from "../src/services/captcha";

describe("pickLocale", () => {
  it.each([
    ["it-IT,it;q=0.9,en;q=0.8", "it"],
    ["IT", "it"],
    ["en-GB,en;q=0.9,it;q=0.8", "en"],
    ["fr", "en"],
    ["", "en"],
    [undefined, "en"],
  ])("%s → %s", (header, locale) => {
    expect(pickLocale(header)).toBe(locale);
  });
});

describe("emails", () => {
  it("escape the values they interpolate", () => {
    const email = confirmationEmail("en", "a@example.org", {
      url: 'https://x.test/?a="><script>',
      privacyUrl: "https://x.test/privacy/",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
    expect(email.text).toContain('https://x.test/?a="><script>'); // plain text needs no escaping
  });
});

describe("isTestSecret", () => {
  it("recognizes Cloudflare's dummy keys only", () => {
    expect(isTestSecret("1x0000000000000000000000000000000AA")).toBe(true);
    expect(isTestSecret("2x0000000000000000000000000000000AA")).toBe(true);
    expect(isTestSecret("0x4AAAAAAABkMYinukE8nzY")).toBe(false);
  });
});
