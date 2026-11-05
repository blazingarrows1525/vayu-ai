const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". Small clock skew never reads as the future. */
export function timeAgo(value: Date | string | number, now: number = Date.now()): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  const seconds = Math.min(0, Math.round((t - now) / 1000));
  const abs = -seconds;
  if (abs < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size || unit === "minute") return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "1 document", "3 documents". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}

/** "$0", "<$0.01", "$1.25" — sub-cent AI costs shouldn't read as precise accounting. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value < 0.01) return "<$0.01";
  return `$${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
