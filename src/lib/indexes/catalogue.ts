import type { Catalogue, WorkEntry } from "../catalogue";
import { fold } from "../text";
import { stripMarkup } from "../markup";
import { CATEGORIES, type Book, type Category } from "../schemas";

export type WorkStatus = "published" | "unpublished" | "lostms";
export type CatalogueRow = { work: WorkEntry; status: WorkStatus[]; q: string };
export type CatalogueModel = {
  books: { book: Book; works: CatalogueRow[] }[];
  categories: Category[];
};

const statusOf = (w: WorkEntry): WorkStatus[] => [
  ...(w.editions.some(e => e.year !== undefined) ? (["published"] as const) : []),
  ...(w.unpublished ? (["unpublished"] as const) : []),
  ...(w.sources && w.sources.status !== "located" ? (["lostms"] as const) : []),
];

const searchText = (w: WorkEntry): string =>
  fold(
    [w.title, w.subtitle, ...w.alt_titles.map(a => a.title), w.scoring.fr, w.opus ? `op ${w.opus}` : undefined]
      .filter((s): s is string => !!s)
      .map(s => stripMarkup(s))
      .join(" "),
  );

export function catalogueModel(cat: Catalogue): CatalogueModel {
  const books = cat.books.map(book => ({
    book,
    works: cat.works.filter(w => w.book === book.number).map(work => ({ work, status: statusOf(work), q: searchText(work) })),
  }));
  const used = new Set(cat.works.flatMap(w => w.categories));
  return { books, categories: CATEGORIES.filter(c => used.has(c)) };
}
