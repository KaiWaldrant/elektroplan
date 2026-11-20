/** Read a number typed in Belgian notation ("3,5" or "3.5"); null when it isn't one. */
export function parseDecimal(text: string): number | null {
  if (text.trim() === '') return null;
  const v = Number(text.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/** Write a number with `digits` decimals in Belgian notation ("1,50"). */
export function formatDecimal(n: number, digits: number): string {
  return n.toFixed(digits).replace('.', ',');
}

/** Like parseDecimal, but only numbers above zero (lengths, thicknesses). */
export function parsePositiveDecimal(text: string): number | null {
  const v = parseDecimal(text);
  return v !== null && v > 0 ? v : null;
}
