/** Remove the *emphasis* markers, e.g. for <title>. */
export const plain = (text: string) => text.replace(/\*/g, "");

/** Replace {name} placeholders, e.g. format("{n} selected", { n: 3 }). */
export function format(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
