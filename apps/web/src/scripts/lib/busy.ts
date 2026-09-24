/** Disable a button while `task` runs, so that a double click does not send twice. */
export async function busy<T>(button: HTMLButtonElement, task: () => Promise<T>): Promise<T> {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
