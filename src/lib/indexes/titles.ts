import { thResolver, type Catalogue, type WorkEntry } from "../catalogue";
import { stripMarkup, type ThResolver } from "../markup";
import { sortTitle } from "../text";
import { letterGroups } from "./letters";

export type TitleItem =
  | { kind: "main"; work: WorkEntry }
  | { kind: "alt"; title: string; source: string; work: WorkEntry };

export type TitlesModel = {
  titles: [string, TitleItem[]][];
  movements: { title: string; work: WorkEntry }[];
};

const byTitle = (a: string, b: string) => a.localeCompare(b, "fr");

/** Même nettoyage que le prototype : numérotation, guillemets et crochets retirés ; un titre vide ou numérique est écarté. */
function cleanMovementTitle(title: string, th: ThResolver): string | undefined {
  const clean = stripMarkup(title, th)
    .replace(/^[«\s]+|[»\s]+$/g, "")
    .replace(/^(-?\s*[IVX\d]+\s*[-.)/]?\s*-?\s*|Nº\s*\d+\.?\s*|\d+\)\s*)/i, "")
    .replace(/^\[|\]$/g, "")
    .trim();
  return clean && !/^\[?\d*\.?\]?$/.test(clean) ? clean : undefined;
}

export function titlesModel(cat: Catalogue): TitlesModel {
  const th = thResolver(cat);
  const items = cat.works
    .flatMap((work): { item: TitleItem; key: string }[] => [
      { item: { kind: "main", work }, key: sortTitle(work.title) },
      ...work.alt_titles.map(a => ({
        item: { kind: "alt" as const, title: a.title, source: a.source, work },
        key: sortTitle(a.title),
      })),
    ])
    .sort((a, b) => byTitle(a.key, b.key));

  const movements = cat.works
    .flatMap(work =>
      work.movements.flatMap(m => {
        const title = m.title === undefined ? undefined : cleanMovementTitle(m.title, th);
        return title ? [{ title, work, key: sortTitle(title) }] : [];
      }),
    )
    .sort((a, b) => byTitle(a.key, b.key));

  return {
    titles: letterGroups(items, i => i.key).map(([letter, group]) => [letter, group.map(i => i.item)]),
    movements: movements.map(({ title, work }) => ({ title, work })),
  };
}
