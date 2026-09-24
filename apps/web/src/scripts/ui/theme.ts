// Light/dark toggle. The saved theme is applied before the first paint by the layout's inline
// script (components/layout/ThemeScript.astro).
import { STORAGE_KEYS } from "../../config/storage-keys";

export function setupThemeToggle() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  });
}
