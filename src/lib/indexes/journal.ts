import type { Catalogue, WorkEntry } from "../catalogue";
import { edtfSortKey, edtfYear } from "../edtf";
import type { JournalEntry } from "../schemas";

export type JournalGroup = { year: number | null; entries: { entry: JournalEntry; work: WorkEntry }[] };

/** Ancre d'une section : `#j<année>` ou `#j-unknown`. */
export const journalAnchor = (year: number | null): string => (year === null ? "j-unknown" : `j${year}`);

export function journalModel(cat: Catalogue): JournalGroup[] {
  const all = cat.works
    .flatMap(work => work.journal.map(entry => ({ entry, work })))
    .sort((a, b) => {
      const [ka, kb] = [edtfSortKey(a.entry.date), edtfSortKey(b.entry.date)];
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const groups = new Map<number | null, JournalGroup>();
  for (const item of all) {
    const year = edtfYear(item.entry.date);
    const group = groups.get(year) ?? { year, entries: [] };
    group.entries.push(item);
    groups.set(year, group);
  }
  return [...groups.values()];
}
