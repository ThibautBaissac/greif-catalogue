import type { Catalogue, WorkEntry } from "../catalogue";
import type { SourceFeature } from "../schemas";

type Groups<K> = [K, WorkEntry[]][];

/** Plus grands groupes d'abord ; à effectif égal, l'ordre d'insertion (ordre Th) est conservé. */
function group<K>(entries: [K, WorkEntry][]): Groups<K> {
  const map = new Map<K, WorkEntry[]>();
  for (const [key, work] of entries) {
    const bucket = map.get(key);
    if (bucket) bucket.push(work);
    else map.set(key, [work]);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export type SourcesModel = {
  /** Clés : identifiants de fonds. */
  byInstitution: Groups<string>;
  byPaper: Groups<string>;
  byFeature: Groups<SourceFeature>;
  lost: WorkEntry[];
};

export function sourcesModel(cat: Catalogue): SourcesModel {
  const withSources = cat.works.flatMap(work => (work.sources ? [{ work, sources: work.sources }] : []));
  return {
    byInstitution: group(
      withSources.flatMap(({ work, sources }): [string, WorkEntry][] =>
        sources.institution ? [[sources.institution, work]] : [],
      ),
    ),
    byPaper: group(withSources.flatMap(({ work, sources }) => sources.papers.map((p): [string, WorkEntry] => [p, work]))),
    byFeature: group(
      withSources.flatMap(({ work, sources }) => sources.features.map((f): [SourceFeature, WorkEntry] => [f, work])),
    ),
    lost: withSources.filter(({ sources }) => sources.status !== "located").map(({ work }) => work),
  };
}
