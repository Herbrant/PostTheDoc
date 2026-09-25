import { beforeEach, describe, expect, it } from "vitest";
import { preferencesForm } from "../src/scripts/forms/preferences";

// The hooks components/forms/PreferencesForm.astro renders, without the pickers.
const MARKUP = `
  <div data-prefs>
    <input type="checkbox" name="roles" value="phd">
    <input type="checkbox" name="roles" value="researcher">
    <p data-roles-error hidden></p>
    <span data-summary="sectors"></span>
    <input type="checkbox" name="sectors" value="INFO-01">
    <input type="checkbox" name="sectors" value="IINF-05">
    <p data-sectors-error hidden></p>
    <input type="checkbox" name="include_unspecified">
    <span data-summary="location"></span>
    <input type="checkbox" name="regions" value="IT-82">
    <input type="checkbox" name="institutions" value="UNICT">
    <input type="radio" name="locale" value="it" checked>
    <input type="radio" name="locale" value="en">
  </div>`;

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  root = document.querySelector("[data-prefs]") as HTMLElement;
});

const summary = (key: string) => root.querySelector(`[data-summary="${key}"]`)?.textContent;

describe("preferencesForm", () => {
  it("reads and writes every field", () => {
    const form = preferencesForm(root);
    const prefs = {
      locale: "en" as const,
      roles: ["researcher"],
      sectors: ["INFO-01"],
      regions: ["IT-82"],
      institutions: ["UNICT"],
      include_unspecified: true,
    };
    form.set(prefs);
    expect(form.get()).toEqual(prefs);
  });

  it("leaves calls without a sector out by default", () => {
    expect(preferencesForm(root).get().include_unspecified).toBe(false);
  });

  it("summarizes the filters", () => {
    const form = preferencesForm(root);
    expect(summary("sectors")).toBe("");
    form.set({ ...form.get(), sectors: ["INFO-01"] });
    expect(summary("sectors")).toBe("1 selezionato");
    form.set({ ...form.get(), sectors: ["INFO-01", "IINF-05"] });
    expect(summary("sectors")).toBe("Tutti i settori");
    expect(summary("location")).toBe("Tutta Italia");
    form.set({ ...form.get(), regions: ["IT-82"], institutions: ["UNICT"] });
    expect(summary("location")).toBe("2 selezionati");
  });

  it("requires a role and a sector", () => {
    const form = preferencesForm(root);
    const rolesError = root.querySelector("[data-roles-error]") as HTMLElement;
    const sectorsError = root.querySelector("[data-sectors-error]") as HTMLElement;
    expect(form.validate()).toBe(false);
    expect(rolesError.hidden).toBe(false);
    expect(sectorsError.hidden).toBe(false);
    form.set({ ...form.get(), roles: ["phd"] });
    expect(form.validate()).toBe(false);
    expect(rolesError.hidden).toBe(true);
    form.set({ ...form.get(), sectors: ["INFO-01"] });
    expect(form.validate()).toBe(true);
    expect(sectorsError.hidden).toBe(true);
  });
});
