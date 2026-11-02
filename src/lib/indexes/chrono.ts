import type { Catalogue, WorkEntry } from "../catalogue";
import { edtfSortKey, edtfYear } from "../edtf";

export type ChronoModel = {
  strip: { year: number; count: number }[];
  groups: { year: number | null; works: WorkEntry[] }[];
};

export function chronoModel(cat: Catalogue): ChronoModel {
  const byYear = new Map<number | null, WorkEntry[]>();
  for (const w of cat.works) {
    const year = edtfYear(w.composition?.date);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(w);
    else byYear.set(year, [w]);
  }

  const years = [...byYear.keys()].filter((y): y is number => y !== null).sort((a, b) => a - b);
  const strip =
    years.length === 0
      ? []
      : Array.from({ length: years.at(-1)! - years[0] + 1 }, (_, i) => {
          const year = years[0] + i;
          return { year, count: byYear.get(year)?.length ?? 0 };
        });

  // `cat.works` est dans l'ordre du catalogue et le tri est stable : l'égalité de date garde cet ordre.
  const sortKey = (w: WorkEntry) => edtfSortKey(w.composition?.date);
  const groups = [...years, null].flatMap(year => {
    const works = byYear.get(year);
    return works ? [{ year, works: [...works].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0)) }] : [];
  });
  return { strip, groups };
}
