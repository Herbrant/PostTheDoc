// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LOCALES, strings } from "../src/i18n";

describe("page metadata", () => {
  // Bing Webmaster Tools flags descriptions outside 25-160 characters; Google cuts them near 155.
  it.each(LOCALES)("keeps the %s description short enough for search results", (lang) => {
    const { description } = strings[lang].meta;
    expect(description.length).toBeGreaterThanOrEqual(25);
    expect(description.length).toBeLessThanOrEqual(155);
  });
});
