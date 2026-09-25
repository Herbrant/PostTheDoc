import { it } from "../src/i18n/it";

// What layouts/Base.astro serializes into every page for the browser scripts (DOM tests only:
// some tests run in the node environment).
if (typeof document !== "undefined") {
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = "client-strings";
  script.textContent = JSON.stringify(it.client);
  document.head.append(script);
  document.documentElement.lang = "it";
}
