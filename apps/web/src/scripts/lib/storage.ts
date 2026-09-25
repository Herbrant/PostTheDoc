/**
 * Web Storage that fails quietly: some browsers block it (privacy modes, disabled site data), and
 * a theme, a language or an email to hand over is not worth breaking the page for.
 */
export function quiet(area: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return area().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        area().setItem(key, value);
      } catch {
        // Not remembered: the page works without it.
      }
    },
    remove(key: string): void {
      try {
        area().removeItem(key);
      } catch {
        // Nothing was stored.
      }
    },
  };
}

export const local = quiet(() => localStorage);
export const session = quiet(() => sessionStorage);
