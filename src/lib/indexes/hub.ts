import type { Catalogue } from "../catalogue";
import type { PageKey } from "../i18n";
import { CATEGORIES } from "../schemas";
import { INDEX_KEYS } from "../ui-schema";

const KEYS = INDEX_KEYS satisfies readonly PageKey[];

type HubKey = (typeof KEYS)[number];

const sum = (cat: Catalogue, n: (w: Catalogue["works"][number]) => number) =>
  cat.works.reduce((total, w) => total + n(w), 0);

export function hubModel(cat: Catalogue, editorial: boolean): { key: PageKey; count: number }[] {
  const counts: Record<HubKey, number> = {
    chrono: cat.works.filter(w => w.composition?.date).length,
    opus: cat.works.filter(w => w.opus).length,
    titles: sum(cat, w => 1 + w.alt_titles.length),
    incipits: sum(cat, w => w.movements.filter(m => m.text_incipit).length),
    persons: [...cat.personUsages.values()].filter(u => Object.values(u).some(list => list.length > 0)).length,
    places: new Set(cat.performances.map(r => r.perf.place)).size,
    performances: cat.performances.length,
    scoring: CATEGORIES.length,
    sources: cat.works.filter(w => w.sources?.status === "located").length,
    editions: sum(cat, w => w.editions.length),
    biblio: cat.works.filter(w => w.bibliography.length > 0).length,
    disco: sum(cat, w => w.discography.length + w.videography.length),
    journal: sum(cat, w => w.journal.length),
  };
  const entries: { key: PageKey; count: number }[] = KEYS.map(key => ({ key, count: counts[key] }));
  return editorial ? [...entries, { key: "dashboard", count: 0 }] : entries;
}
