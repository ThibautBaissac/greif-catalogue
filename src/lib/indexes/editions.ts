import type { Catalogue, WorkEntry } from "../catalogue";
import type { Work } from "../schemas";

export type EditionItem = { work: WorkEntry; edition: Work["editions"][number] };

const NO_PUBLISHER = "—";
/** Ordre alphabétique ; « — » (éditeur absent) en dernier, comme dans le prototype. */
const byName = (a: string, b: string): number =>
  a === NO_PUBLISHER ? 1 : b === NO_PUBLISHER ? -1 : a.localeCompare(b, "fr");

export function editionsModel(cat: Catalogue): {
  byPublisher: [string, EditionItem[]][];
  unpublished: WorkEntry[];
} {
  const byPublisher = new Map<string, EditionItem[]>();
  for (const work of cat.works) {
    for (const edition of work.editions) {
      const key = edition.publisher ?? NO_PUBLISHER;
      const bucket = byPublisher.get(key);
      if (bucket) bucket.push({ work, edition });
      else byPublisher.set(key, [{ work, edition }]);
    }
  }
  return {
    byPublisher: [...byPublisher.entries()]
      .sort((a, b) => byName(a[0], b[0]))
      .map(([key, items]): [string, EditionItem[]] => [key, items.sort((a, b) => (a.edition.year ?? 0) - (b.edition.year ?? 0))]),
    unpublished: cat.works.filter(w => w.unpublished),
  };
}
