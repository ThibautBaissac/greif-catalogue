export type Lang = "fr" | "en";

const SIMPLE = /^(\d{3}[\dX])(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?[?~]?$/;

type Parsed = {
  year: string;
  month?: number;
  day?: number;
  qualifier: "" | "?" | "~";
};

function parseSimple(s: string): Parsed | null {
  const m = SIMPLE.exec(s);
  if (!m) return null;
  const [, year, month, day] = m;
  if (year.includes("X") && month) return null;
  const last = s[s.length - 1];
  return {
    year,
    month: month ? Number(month) : undefined,
    day: day ? Number(day) : undefined,
    qualifier: last === "?" || last === "~" ? last : "",
  };
}

function parse(s: string): Parsed[] | null {
  const parts = s.split("/");
  if (parts.length > 2) return null;
  const parsed = parts.map(parseSimple);
  return parsed.every((p): p is Parsed => p !== null) ? parsed : null;
}

export const isEdtf = (s: string): boolean => parse(s) !== null;

function formatSimple(p: Parsed, lang: Lang, months: string[], withYear = true): string {
  let text: string;
  if (p.year.includes("X")) {
    const decade = p.year.replace("X", "0");
    text = lang === "fr" ? `années ${decade}` : `${decade}s`;
  } else {
    const day = p.day === undefined ? null : lang === "fr" && p.day === 1 ? "1er" : String(p.day);
    text = [day, p.month === undefined ? null : months[p.month - 1], withYear ? p.year : null]
      .filter(Boolean)
      .join(" ");
  }
  if (p.qualifier === "?") return lang === "fr" ? `${text} ?` : `${text}?`;
  if (p.qualifier === "~") return lang === "fr" ? `vers ${text}` : `c. ${text}`;
  return text;
}

const isPlain = (p: Parsed): boolean => p.qualifier === "" && !p.year.includes("X");

export function formatEdtf(s: string, lang: Lang, months: string[]): string {
  const parsed = parse(s);
  if (!parsed) return s;
  const fmt = (p: Parsed, withYear = true) => formatSimple(p, lang, months, withYear);
  if (parsed.length === 1) return fmt(parsed[0]);

  const [from, to] = parsed;
  if (isPlain(from) && isPlain(to) && from.year === to.year) {
    if (from.month === undefined) return from.year;
    if (from.month === to.month && from.day !== undefined) return `${from.day}–${fmt(to)}`;
    return `${fmt(from, false)} – ${fmt(to)}`;
  }
  return `${fmt(from)} – ${fmt(to)}`;
}

const start = (s?: string): string | undefined => s?.split("/")[0];

export function edtfYear(s?: string): number | null {
  const first = start(s);
  if (!first) return null;
  const year = Number(first.slice(0, 4).replace("X", "0"));
  return Number.isNaN(year) ? null : year;
}

export function edtfSortKey(s?: string): string {
  const first = start(s);
  return first ? first.replace(/[?~]$/, "") : "9999";
}

export function fromLegacy(from?: string, to?: string): string | undefined {
  if (!from) return undefined;
  return to ? `${from}/${to}` : from;
}
