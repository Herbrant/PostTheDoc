/** Fade sections in as they scroll into view ([data-reveal]). */
export function setupReveal() {
  // The "has-reveal" class is set before the first paint, unless motion is reduced.
  if (!document.documentElement.classList.contains("has-reveal")) return;
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
  for (const node of document.querySelectorAll("[data-reveal]")) observer.observe(node);
}
