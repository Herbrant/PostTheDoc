import { format } from "../../i18n/format";
import type { ClientStrings } from "../../i18n/types";

/** Text for the scripts, serialized into every page by layouts/Base.astro. */
export const strings: ClientStrings = JSON.parse(
  document.getElementById("client-strings")?.textContent ?? "{}",
);

/** The page's language, from <html lang>. */
export const pageLang = (): string => document.documentElement.lang;

export const selectedText = (n: number) =>
  n === 1 ? strings.selectedOne : format(strings.selectedMany, { n });
