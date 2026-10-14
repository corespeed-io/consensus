/*
 * Answer colours come from CSS variables (--o0 ... --o7, --o-other) so light and dark themes each get their own
 * validated step of the same hue. Hues are assigned in a fixed order by option index, never by rank.
 */
export const OPTION_SLOTS = 8;

/** Below this many counted opinions a share means little, so the legend and the donut show counts only. */
export const MIN_FOR_SHARES = 15;

export function optionColor(id: string | null | undefined): string {
  if (!id || id === 'other') return 'var(--o-other)';
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return `var(--o${n % OPTION_SLOTS})`;
}

/** A translucent tint of a colour (hex or var()), for backgrounds behind a selected row. */
export function alpha(color: string, a: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
}

const QUESTION_START = /^(is|are|do|does|did|should|would|could|can|will|what|which|who|why|how|where|when|was|were|has|have)\b/i;

/** "is hubspot worth it" -> "Is hubspot worth it?" */
export function headline(q: string): string {
  const t = q.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const cased = t[0]!.toUpperCase() + t.slice(1);
  return /[?!.]$/.test(cased) || !QUESTION_START.test(cased) ? cased : `${cased}?`;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'consensus';
