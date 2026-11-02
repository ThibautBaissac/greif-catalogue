import type { Catalogue, WorkEntry } from "../catalogue";
import type { BibEntry } from "../schemas";

export type BiblioBlock = {
  entry: BibEntry & { id: string };
  citations: { work: WorkEntry; pages?: string }[];
  pageIndex: { page: string; works: WorkEntry[] }[];
};

/** Un bloc par référence citée, dans l'ordre de première citation. */
export function biblioModel(cat: Catalogue): BiblioBlock[] {
  const blocks = new Map<string, BiblioBlock["citations"]>();
  for (const work of cat.works) {
    for (const { ref, pages } of work.bibliography) {
      const bucket = blocks.get(ref);
      if (bucket) bucket.push({ work, pages });
      else blocks.set(ref, [{ work, pages }]);
    }
  }
  return [...blocks.entries()].flatMap(([id, citations]) => {
    const entry = cat.bibliography.get(id);
    if (!entry) return [];
    const byPage = new Map<string, { n: number; works: WorkEntry[] }>();
    for (const { work, pages } of citations) {
      for (const token of (pages ?? "").split(/,\s*/)) {
        const page = token.trim();
        const n = parseInt(page, 10);
        if (!page || Number.isNaN(n)) continue;
        const slot = byPage.get(page);
        if (slot) slot.works.push(work);
        else byPage.set(page, { n, works: [work] });
      }
    }
    const pageIndex = [...byPage.entries()]
      .sort((a, b) => a[1].n - b[1].n || a[0].localeCompare(b[0]))
      .map(([page, { works }]) => ({ page, works }));
    return [{ entry, citations, pageIndex }];
  });
}
