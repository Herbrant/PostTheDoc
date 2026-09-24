import { describe, expect, it } from "vitest";
import { manageLinkSchema, preferencesSchema, subscribeSchema } from "../src/schemas";

const PREFS = {
  locale: "it",
  roles: ["researcher"],
  sectors: ["INFO-01"],
  regions: ["IT-82"],
  institutions: [],
  include_unspecified: true,
};

describe("preferencesSchema", () => {
  it("accepts known codes and removes duplicates", () => {
    const parsed = preferencesSchema.parse({ ...PREFS, roles: ["phd", "phd", "researcher"] });
    expect(parsed.roles).toEqual(["phd", "researcher"]);
  });

  it("rejects unknown codes, unknown locales and empty roles", () => {
    expect(preferencesSchema.safeParse({ ...PREFS, sectors: ["NOPE-99"] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...PREFS, locale: "fr" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...PREFS, roles: [] }).success).toBe(false);
  });
});

describe("email", () => {
  it("is trimmed and lower-cased", () => {
    const parsed = subscribeSchema.parse({
      ...PREFS,
      email: " Alice@Example.ORG ",
      turnstileToken: "t",
    });
    expect(parsed.email).toBe("alice@example.org");
  });

  it("must be a valid address", () => {
    for (const email of ["", "alice", "alice@", `${"a".repeat(250)}@x.it`]) {
      expect(manageLinkSchema.safeParse({ email, turnstileToken: "t" }).success).toBe(false);
    }
  });
});

describe("turnstileToken", () => {
  it("is required and bounded", () => {
    const body = { email: "a@example.org" };
    expect(manageLinkSchema.safeParse({ ...body, turnstileToken: "" }).success).toBe(false);
    expect(manageLinkSchema.safeParse({ ...body, turnstileToken: "x".repeat(2049) }).success).toBe(
      false,
    );
  });
});
