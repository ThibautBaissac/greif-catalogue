import { extractRefs } from "./markup";
import { strings, type Catalogue, type WorkEntry } from "./catalogue";

/** Mode éditorial : notes de rédaction, tableau de bord et notes `[migration]` visibles. */
export const isEditorial = (): boolean => process.env.CATALOGUE_EDITORIAL === "1";

export type Completeness = {
  incipits: number;
  bars: number;
  movements: number;
  checks: { composition: boolean; sources: boolean; bars: boolean; duration: boolean };
  score: number;
};

export function completeness(w: WorkEntry): Completeness {
  const incipits = w.movements.filter(m => m.incipit).length;
  const bars = w.movements.filter(m => m.bars).length;
  const checks = {
    composition: w.composition?.date !== undefined,
    sources: !!w.sources && (w.sources.items.length > 0 || !!w.sources.intro || w.sources.status !== "located"),
    bars: bars === w.movements.length,
    duration: w.duration !== undefined,
  };
  const score = Object.values(checks).filter(Boolean).length / 4;
  return { incipits, bars, movements: w.movements.length, checks, score };
}

export type DashboardModel = {
  rows: { work: WorkEntry; c: Completeness; notes: string[] }[];
  unresolved: WorkEntry[];
  variants: { person: string; variants: string[] }[];
  incompleteBibliography: string[];
};

export function dashboardModel(cat: Catalogue): DashboardModel {
  const hasUnresolved = (w: WorkEntry) => [...strings(w)].some(([, text]) => extractRefs(text).includes("?"));
  return {
    rows: cat.works.map(work => ({ work, c: completeness(work), notes: work.editorial_notes })),
    unresolved: cat.works.filter(hasUnresolved),
    variants: [...cat.persons.values()]
      .filter(p => p.variants.length > 0)
      .map(p => ({ person: p.name, variants: p.variants })),
    incompleteBibliography: [...cat.bibliography.values()].filter(b => !b.title).map(b => b.id),
  };
}
