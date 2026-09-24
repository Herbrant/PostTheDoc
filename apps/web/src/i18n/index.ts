// User-facing text of the web app, in every locale of the contract.
import { LOCALES, type Locale } from "@postthedoc/shared/contract";
import { en } from "./en";
import { it } from "./it";
import type { Strings } from "./types";

export { DEFAULT_LOCALE, LOCALES, type Locale } from "@postthedoc/shared/contract";
export { format, plain } from "./format";
export type { ClientStrings, Strings } from "./types";

export const strings: Record<Locale, Strings> = { it, en };

/** getStaticPaths() of the pages under [lang]/. */
export const localePaths = () => LOCALES.map((lang) => ({ params: { lang } }));
