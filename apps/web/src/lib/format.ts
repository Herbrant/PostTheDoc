/** Two-digit ordinal of a zero-based index, as shown before steps and list items: 0 → "01". */
export const ordinal = (index: number) => String(index + 1).padStart(2, "0");
