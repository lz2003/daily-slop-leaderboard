export const fmt = (n) => Number(n).toLocaleString();

// YYYY-MM-DD in the player's local timezone, offset by some number of days.
export function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (iso === localDate()) return 'Today';
  if (iso === localDate(-1)) return 'Yesterday';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: y === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
