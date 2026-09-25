import { STORAGE_KEYS } from "../../config/storage-keys";
import { all } from "../lib/dom";
import { local } from "../lib/storage";

/**
 * Remember the language picked with the switcher (used by the root page redirect), and keep the
 * query string and hash when switching (the manage token itself lives in sessionStorage).
 */
export function setupLanguageSwitch() {
  for (const link of all("[data-lang-link]", HTMLAnchorElement)) {
    link.addEventListener("click", () => {
      local.set(STORAGE_KEYS.locale, link.dataset.langLink ?? "");
      link.href = link.href.split(/[?#]/)[0] + location.search + location.hash;
    });
  }
}
