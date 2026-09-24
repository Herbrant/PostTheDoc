import type { Locale } from "../i18n";

// BASE_URL is "/PostTheDoc/" on GitHub Pages and "/" with a custom domain.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Path of a site file, e.g. asset("favicon.svg"). */
export const asset = (path: string) => `${BASE}/${path}`;

/** Path of a page, e.g. href("it", "subscribe/"). */
export const href = (lang: Locale, page = "") => `${BASE}/${lang}/${page}`;
