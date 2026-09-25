/** Typed DOM lookups that fail loudly when the markup and the scripts drift apart. */

type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** The element matching `selector` within `root`, checked to be an instance of `type`. */
export function required<T extends Element>(
  selector: string,
  type: ElementClass<T>,
  root: ParentNode = document,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Expected a ${type.name} matching ${selector}`);
  }
  return element;
}

/** Every element matching `selector` within `root` that is an instance of `type`. */
export function all<T extends Element>(
  selector: string,
  type: ElementClass<T>,
  root: ParentNode = document,
): T[] {
  return [...root.querySelectorAll(selector)].filter((node): node is T => node instanceof type);
}

/** The submit button of a form. */
export const submitButton = (form: HTMLFormElement) =>
  required('button[type="submit"]', HTMLButtonElement, form);

/** Smooth scrolling, unless the user asked the system to reduce motion. */
export const scrollBehavior = (): ScrollBehavior =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
