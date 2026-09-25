/** The pause button of the home page's scrolling band (WCAG 2.2.2: moving content can be paused). */
export function setupMarquee() {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-marquee-toggle]")) {
    button.addEventListener("click", () => {
      const paused = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(paused));
      button.closest(".proof-bar")?.classList.toggle("is-paused", paused);
    });
  }
}
