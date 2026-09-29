import { describe, expect, it } from "vitest";
import contract from "../../../data/contract.json";
import {
  DONATE_URL,
  INSTITUTION_TYPES,
  isLocale,
  LOCALES,
  sitePath,
  TOKEN_PURPOSES,
} from "../src/contract";

describe("contract", () => {
  it("exposes the values of data/contract.json", () => {
    expect(LOCALES).toEqual(contract.locales);
    expect(INSTITUTION_TYPES).toEqual(contract.institutionTypes);
    expect(TOKEN_PURPOSES).toEqual(Object.keys(contract.tokenTtlSeconds));
    expect(DONATE_URL).toBe(contract.donateUrl);
  });

  it("builds localized site paths", () => {
    expect(sitePath("manage", "en")).toBe("/en/manage/");
    expect(sitePath("support", "it")).toBe("/it/#support");
  });

  it("recognizes locales", () => {
    expect(isLocale("it")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
