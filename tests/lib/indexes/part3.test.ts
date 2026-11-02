import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { biblioModel } from "~/lib/indexes/biblio";
import { discoModel } from "~/lib/indexes/disco";
import { editionsModel } from "~/lib/indexes/editions";
import { journalModel } from "~/lib/indexes/journal";
import { sourcesModel } from "~/lib/indexes/sources";
import { workSchema } from "~/lib/schemas";
import { fixtureInput } from "../../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);
const ids = (works: { id: string }[]) => works.map(w => w.id);

/** Fixture plus extra works, to exercise ordering, grouping and the fallbacks. */
const extra = (data: Record<string, unknown>, id: string) => ({
  id,
  data: workSchema.parse({
    book: 2,
    title: id,
    scoring: { fr: "Piano", en: "Piano" },
    categories: ["piano"],
    ...data,
  }),
});
const bigger = buildCatalogue({
  ...fixtureInput,
  works: [
    ...fixtureInput.works,
    extra(
      {
        th: "60",
        sources: { status: "located", institution: "f-pbmgf", papers: ["filigrané JD"], features: ["draft"] },
        editions: [{ text: "Sans éditeur" }, { text: "Z 2001", publisher: "Zeta", year: 2001 }],
        bibliography: [{ ref: "francois-sappey-nectoux-2013", pages: "7, 28, 12bis, s.p." }],
        discography: [
          { text: "CD « Un », 2010", title: "Un", year: 2010 },
          { text: "Disque sans titre *Deux*, 1990", year: 1990, details: "plage 3" },
        ],
        videography: [{ text: "DVD *Trois*" }],
        journal: [{ date_text: "s. d.", quotes: [] }, { date_text: "1960", date: "1960", quotes: [] }],
      },
      "extra-e",
    ),
    extra(
      {
        th: "61",
        sources: { status: "not_located", papers: ["filigrané JD"], features: [] },
        editions: [{ text: "A 1999", publisher: "Alpha", year: 1999 }, { text: "A 1980", publisher: "Alpha", year: 1980 }],
        discography: [{ text: "CD « Un », 2010", title: "Un", year: 2010 }],
      },
      "extra-f",
    ),
  ],
});

describe("sourcesModel", () => {
  const m = sourcesModel(cat);
  test("groups located works by institution id", () => {
    expect(m.byInstitution.map(([k, ws]) => [k, ids(ws)])).toEqual([["f-pbmgf", ["sonate-a"]]]);
  });
  test("groups by paper and by feature", () => {
    expect(m.byPaper.map(([k, ws]) => [k, ids(ws)])).toEqual([["filigrané JD", ["sonate-a"]]]);
    expect(m.byFeature.map(([k, ws]) => [k, ids(ws)])).toEqual(
      expect.arrayContaining([["draft", ["sonate-a"]], ["autograph", ["sonate-a"]]]),
    );
  });
  test("lost lists works whose sources are not located", () => {
    expect(ids(m.lost)).toEqual(["lied-b"]);
  });
  test("groups are sorted by decreasing size", () => {
    const b = sourcesModel(bigger);
    expect(b.byInstitution[0][0]).toBe("f-pbmgf");
        expect(ids(b.byPaper[0][1])).toEqual(["sonate-a", "extra-e", "extra-f"]);
    expect(ids(b.lost)).toEqual(["lied-b", "extra-f"]);
  });
});

describe("editionsModel", () => {
  test("groups by publisher, unpublished apart", () => {
    const m = editionsModel(cat);
    expect(m.byPublisher.map(([k, items]) => [k, items.map(i => i.work.id)])).toEqual([["Symétrie", ["sonate-a"]]]);
    expect(m.byPublisher[0][1][0].edition.year).toBe(2006);
    expect(ids(m.unpublished)).toEqual(["lied-b"]);
  });
  test("a missing publisher becomes an em dash; publishers sorted, then by year", () => {
    const m = editionsModel(bigger);
    expect(m.byPublisher.map(([k]) => k)).toEqual(["Alpha", "Symétrie", "Zeta", "—"]);
    expect(m.byPublisher[0][1].map(i => i.edition.year)).toEqual([1980, 1999]);
  });
});

describe("biblioModel", () => {
  test("one block per cited reference, with citations and page index", () => {
    const m = biblioModel(cat);
    expect(m).toHaveLength(1);
    expect(m[0].entry.id).toBe("francois-sappey-nectoux-2013");
    expect(m[0].citations.map(c => [c.work.id, c.pages])).toEqual([["sonate-a", "28, 35"]]);
    expect(m[0].pageIndex.map(p => p.page)).toEqual(["28", "35"]);
    expect(ids(m[0].pageIndex[0].works)).toEqual(["sonate-a"]);
  });
  test("page index sorts numerically, then text, and skips non numeric tokens", () => {
    const pages = biblioModel(bigger)[0].pageIndex.map(p => p.page);
    expect(pages).toEqual(["7", "12bis", "28", "35"]);
  });
});

describe("discoModel", () => {
  test("empty on the fixture", () => {
    expect(discoModel(cat, "discography")).toEqual([]);
  });
  test("groups by title (or stripped text), sorted by year, details kept", () => {
    const groups = discoModel(bigger, "discography");
    expect(groups.map(g => [g.title, g.year])).toEqual([["Disque sans titre Deux, 1990", 1990], ["Un", 2010]]);
    expect(groups[0].items[0].details).toBe("plage 3");
    expect(ids(groups[1].items.map(i => i.work))).toEqual(["extra-e", "extra-f"]);
  });
  test("videography has no title nor year", () => {
    const [g] = discoModel(bigger, "videography");
    expect(g.title).toBe("DVD Trois");
    expect(g.year).toBeUndefined();
  });
});

describe("journalModel", () => {
  test("groups by year of the date", () => {
    const m = journalModel(cat);
    expect(m).toMatchObject([{ year: 1973, entries: [{ work: { id: "sonate-a" } }] }]);
  });
  test("sorts by date; entries without date go last in a null-year group", () => {
    const m = journalModel(bigger);
    expect(m.map(g => g.year)).toEqual([1960, 1973, null]);
    expect(m[2].entries[0].entry.date_text).toBe("s. d.");
  });
});
