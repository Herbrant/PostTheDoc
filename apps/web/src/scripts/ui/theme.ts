// Light/dark toggle. The saved theme is applied before the first paint by the layout's inline
// script (components/layout/ThemeScript.astro).
import { STORAGE_KEYS } from "../../config/storage-keys";
import { local } from "../lib/storage";

export function setupThemeToggle() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    local.set(STORAGE_KEYS.theme, theme);
  });
}
