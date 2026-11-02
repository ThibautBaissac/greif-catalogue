import type { Catalogue, PerformanceRow } from "../catalogue";
import { fold } from "../text";

export type PlaceGroup = { key: string; label: string; rows: PerformanceRow[] };

/** `unknownLabel` : libellé du groupe des exécutions sans lieu (chaîne d'interface, donc fournie par l'appelant). */
export function placesModel(cat: Catalogue, unknownLabel = ""): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const row of cat.performances) {
    const place = row.perf.place === undefined ? undefined : cat.places.get(row.perf.place);
    const key = place ? row.perf.place! : "unknown";
    let group = groups.get(key);
    if (!group) {
      const label = place ? (place.country ? `${place.name} (${place.country})` : place.name) : unknownLabel;
      groups.set(key, (group = { key, label, rows: [] }));
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => fold(a.label).localeCompare(fold(b.label)));
}
