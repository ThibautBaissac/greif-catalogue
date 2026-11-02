// Port of invertName, PARTICLES and NAME_OVERRIDES from prototype/build.mjs:85-104.
const PARTICLES = new Set(["de", "du", "des", "von", "van", "la", "le", "d'"]);
const NAME_OVERRIDES: Record<string, [string, string]> = {
  "Jacques Loiseleur des Longchamps": ["Loiseleur des Longchamps", "Jacques"],
  "Claus Schenk Graf von Stauffenberg": ["Stauffenberg", "Claus Schenk Graf von"],
  "Li Bai": ["Li Bai", ""],
  "Mrs Alexander Liberman": ["Liberman", "Mrs Alexander"],
};

const capitalise = (s: string): string => s[0].toUpperCase() + s.slice(1);

function invertTuple(n: string): [string, string] {
  if (Object.hasOwn(NAME_OVERRIDES, n)) return NAME_OVERRIDES[n];
  if (/\(|^\[|^Mère |^E-D F\.$/.test(n) || !n.includes(" ")) return [n, ""];
  const t = n.split(" ");
  for (let i = 1; i < t.length - 1; i++) {
    if (!PARTICLES.has(t[i])) continue;
    if (t[i] === "de" && (t[i + 1] === "la" || t[i + 1] === "le"))
      return [[capitalise(t[i + 1]), ...t.slice(i + 2)].join(" "), t.slice(0, i + 1).join(" ")];
    if (["de", "von", "van", "d'"].includes(t[i])) return [t.slice(i + 1).join(" "), t.slice(0, i + 1).join(" ")];
    return [[capitalise(t[i]), ...t.slice(i + 1)].join(" "), t.slice(0, i).join(" ")];
  }
  return [t[t.length - 1], t.slice(0, -1).join(" ")];
}

/** Splits a display name into sorting surname and given names. */
export function invertName(name: string): { surname: string; given: string } {
  const [surname, given] = invertTuple(name);
  return { surname, given };
}
