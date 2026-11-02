import type { Catalogue, WorkEntry } from "../catalogue";

const num = (opus: string): number => {
  const n = parseInt(opus, 10);
  return Number.isNaN(n) ? Infinity : n;
};

export function opusModel(cat: Catalogue): { withOpus: WorkEntry[]; without: WorkEntry[] } {
  const withOpus = cat.works
    .filter(w => w.opus)
    .sort((a, b) => {
      const [na, nb] = [num(a.opus!), num(b.opus!)];
      return na === nb ? a.opus!.localeCompare(b.opus!) : na < nb ? -1 : 1;
    });
  return { withOpus, without: cat.works.filter(w => !w.opus) };
}
