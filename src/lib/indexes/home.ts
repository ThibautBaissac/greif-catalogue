import type { Catalogue } from "../catalogue";
import { edtfYear } from "../edtf";
import type { Book } from "../schemas";

export type HomeBook = {
  number: number;
  roman: string;
  status: Book["status"];
  count: number;
  thFirst?: string;
  thLast?: string;
  yearFirst?: number;
  yearLast?: number;
};

export type HomeModel = {
  stats: { entries: number; located: number; performances: number; journal: number };
  books: HomeBook[];
};

export function homeModel(cat: Catalogue): HomeModel {
  const stats = {
    entries: cat.works.length,
    located: cat.works.filter(w => w.sources?.status === "located").length,
    performances: cat.performances.length,
    journal: cat.works.reduce((n, w) => n + w.journal.length, 0),
  };

  const books = cat.books.map(({ number, roman, status }): HomeBook => {
    const works = cat.works.filter(w => w.book === number);
    const years = works.flatMap(w => edtfYear(w.composition?.date) ?? []);
    return {
      number,
      roman,
      status,
      count: works.length,
      thFirst: works[0]?.th,
      thLast: works.at(-1)?.th,
      yearFirst: years.length ? Math.min(...years) : undefined,
      yearLast: years.length ? Math.max(...years) : undefined,
    };
  });

  return { stats, books };
}
