import type { Catalogue, PerformanceRow, WorkEntry } from "../catalogue";

export function performancesModel(cat: Catalogue): { rows: PerformanceRow[]; withoutPerformance: WorkEntry[] } {
  return { rows: cat.performances, withoutPerformance: cat.works.filter(w => w.performances.length === 0) };
}
