// Behavior shared by every page: language switcher, light/dark theme, reveal on scroll.

const LOCALE_KEY = "postthedoc-locale";
const THEME_KEY = "postthedoc-theme"; // also read by the inline script in layouts/Base.astro

// Remember the language picked with the switcher (used by the root page redirect) and keep the
// query string and hash when switching, so that the manage link token survives.
for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-lang-link]")) {
  link.addEventListener("click", () => {
    localStorage.setItem(LOCALE_KEY, link.dataset.langLink ?? "");
    link.href = link.href.split(/[?#]/)[0] + location.search + location.hash;
  });
}

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const root = document.documentElement;
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
});

// The "has-reveal" class is set before the first paint by layouts/Base.astro.
if (document.documentElement.classList.contains("has-reveal")) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
}
