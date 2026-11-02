import { thResolver, type Catalogue, type WorkEntry } from "../catalogue";
import { stripMarkup } from "../markup";

export type DiscoGroup = { title: string; year?: number; items: { work: WorkEntry; details?: string }[] };

type Item = { text: string; title?: string; year?: number; details?: string };

/** La vidéographie n'a que `text` : titre, année et détails y sont absents. */
export function discoModel(cat: Catalogue, key: "discography" | "videography"): DiscoGroup[] {
  const th = thResolver(cat);
  const groups = new Map<string, DiscoGroup>();
  for (const work of cat.works) {
    for (const item of work[key] as Item[]) {
      const title = item.title ?? stripMarkup(item.text, th);
      const group = groups.get(title) ?? { title, year: item.year, items: [] };
      group.items.push({ work, details: item.details });
      groups.set(title, group);
    }
  }
  return [...groups.values()].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}
