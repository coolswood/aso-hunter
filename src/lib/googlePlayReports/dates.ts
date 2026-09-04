/** Shifts a "YYYY-MM-DD" date by N days (negative = back in time). Stays in
 * UTC so the arithmetic never drifts across timezones; an unparseable input
 * is passed through unchanged rather than throwing - report dates come from
 * external CSV files. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
