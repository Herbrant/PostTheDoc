import { describe, expect, it } from "vitest";
import { quiet } from "../src/scripts/lib/storage";

/** A Storage backed by a Map. */
function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("storage", () => {
  it("reads and writes", () => {
    const area = memory();
    const store = quiet(() => area);
    store.set("k", "v");
    expect(store.get("k")).toBe("v");
    store.remove("k");
    expect(store.get("k")).toBeNull();
  });

  it("fails quietly where the browser blocks storage", () => {
    const blocked = quiet(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => blocked.set("k", "v")).not.toThrow();
    expect(blocked.get("k")).toBeNull();
    expect(() => blocked.remove("k")).not.toThrow();
  });
});
