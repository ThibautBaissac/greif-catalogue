import type { Catalogue, WorkEntry } from "../catalogue";
import { CATEGORIES, type Category } from "../schemas";

export function scoringModel(cat: Catalogue): { category: Category; works: WorkEntry[] }[] {
  return CATEGORIES.map(category => ({ category, works: cat.works.filter(w => w.categories.includes(category)) }));
}
