import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { chronoModel } from "~/lib/indexes/chrono";
import { hubModel } from "~/lib/indexes/hub";
import { letterGroups } from "~/lib/indexes/letters";
import { opusModel } from "~/lib/indexes/opus";
import { scoringModel } from "~/lib/indexes/scoring";
import { textIncipitsModel } from "~/lib/indexes/textIncipits";
import { titlesModel } from "~/lib/indexes/titles";
import { CATEGORIES } from "~/lib/schemas";
import { workSchema } from "~/lib/schemas";
import { fixtureInput } from "../../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);
const ids = (works: { id: string }[]) => works.map(w => w.id);

describe("letterGroups", () => {
  test("groups by uppercase first letter, non A-Z under #, groups sorted", () => {
    const groups = letterGroups(["beta", "alpha", "1st", "bis", "_x"], s => s);
    expect(groups).toEqual([
      ["#", ["1st", "_x"]],
      ["A", ["alpha"]],
      ["B", ["beta", "bis"]],
    ]);
  });
  test("an empty key goes under #", () => {
    expect(letterGroups([""], s => s)).toEqual([["#", [""]]]);
  });
});

describe("hubModel", () => {
  test("13 entries in the briefed order, plus dashboard when editorial", () => {
    expect(hubModel(cat, false).map(e => e.key)).toEqual([
      "chrono", "opus", "titles", "incipits", "persons", "places", "performances", "scoring",
      "sources", "editions", "biblio", "disco", "journal",
    ]);
    expect(hubModel(cat, true).at(-1)?.key).toBe("dashboard");
  });
  test("counts", () => {
    const count = Object.fromEntries(hubModel(cat, false).map(e => [e.key, e.count]));
    expect(count).toMatchObject({
      chrono: 2, opus: 1, titles: 4, incipits: 1, persons: 3, places: 2, performances: 2, scoring: 8,
      sources: 1, editions: 1, biblio: 1, disco: 0, journal: 1,
    });
  });
});

describe("chronoModel", () => {
  const model = chronoModel(cat);
  test("year groups, unknown date last", () => {
    expect(model.groups.map(g => g.year)).toEqual([1972, 1973, null]);
  });
  test("unknown group holds works without a structured date, in catalogue order", () => {
    expect(ids(model.groups[2].works)).toEqual(["etude-c", "zeta-d"]);
  });
  test("strip counts works per year", () => {
    expect(model.strip).toEqual([{ year: 1972, count: 1 }, { year: 1973, count: 1 }]);
  });
  test("strip includes empty years inside the range", () => {
    const sparse = buildCatalogue({
      ...fixtureInput,
      works: [
        ...fixtureInput.works,
        { id: "late-e", data: workSchema.parse({ th: "60", book: 2, title: "Late", scoring: { fr: "Piano", en: "Piano" }, categories: ["piano"], composition: { text: "1975", date: "1975" } }) },
      ],
    });
    expect(chronoModel(sparse).strip.map(s => [s.year, s.count])).toEqual([[1972, 1], [1973, 1], [1974, 0], [1975, 1]]);
  });
  test("within a year, works are sorted by date then catalogue order", () => {
    const same = buildCatalogue({
      ...fixtureInput,
      works: [
        { id: "later", data: workSchema.parse({ th: "1", book: 1, title: "Later", scoring: { fr: "P", en: "P" }, categories: ["piano"], composition: { text: "d", date: "1980-06" } }) },
        { id: "earlier", data: workSchema.parse({ th: "3", book: 1, title: "Earlier", scoring: { fr: "P", en: "P" }, categories: ["piano"], composition: { text: "d", date: "1980-02" } }) },
        { id: "same-1", data: workSchema.parse({ th: "4", book: 1, title: "S1", scoring: { fr: "P", en: "P" }, categories: ["piano"], composition: { text: "d", date: "1980-06" } }) },
      ],
    });
    expect(ids(chronoModel(same).groups[0].works)).toEqual(["earlier", "later", "same-1"]);
  });
});

describe("opusModel", () => {
  test("splits works with and without opus", () => {
    const m = opusModel(cat);
    expect(ids(m.withOpus)).toEqual(["sonate-a"]);
    expect(m.without).toHaveLength(3);
  });
  test("opus sorted numerically", () => {
    const mk = (id: string, th: string, opus: string) => ({
      id,
      data: workSchema.parse({ th, book: 1, title: id, opus, scoring: { fr: "P", en: "P" }, categories: ["piano"] }),
    });
    const m = opusModel(buildCatalogue({ ...fixtureInput, works: [mk("a", "1", "10"), mk("b", "2", "9"), mk("c", "3", "9b")] }));
    expect(ids(m.withOpus)).toEqual(["b", "c", "a"]);
  });
});

describe("titlesModel", () => {
  const model = titlesModel(cat);
  test("letters, article-insensitive (L'Ile under I)", () => {
    expect(model.titles.map(([l]) => l)).toEqual(["E", "I", "S", "Z"]);
  });
  test("movement titles that are only numerals are dropped", () => {
    expect(model.movements).toEqual([]);
  });
  test("sorts main and alternative titles by their plain text, preserving display markup", () => {
    const withMarkup = buildCatalogue({
      ...fixtureInput,
      works: [
        {
          id: "marked-title",
          data: workSchema.parse({
            th: "70", book: 2, title: "*Le Zèbre*", scoring: { fr: "Piano", en: "Piano" }, categories: ["piano"],
            alt_titles: [{ title: "**Adagio**", source: "Ms." }],
          }),
        },
      ],
    });
    const groups = titlesModel(withMarkup).titles;
    expect(groups.map(([letter]) => letter)).toEqual(["A", "Z"]);
    expect(groups[0][1][0]).toMatchObject({ kind: "alt", title: "**Adagio**" });
    expect(groups[1][1][0].work.title).toBe("*Le Zèbre*");
  });
  test("alternative titles are indexed with their source", () => {
    const withAlt = buildCatalogue({
      ...fixtureInput,
      works: [
        ...fixtureInput.works,
        { id: "alt-w", data: workSchema.parse({ th: "70", book: 2, title: "Zoo", alt_titles: [{ title: "Aquarium", source: "carnet" }], scoring: { fr: "P", en: "P" }, categories: ["piano"], movements: [{ title: "« 2) Allegro »" }, { title: "- III - [Finale]" }] }) },
      ],
    });
    const m = titlesModel(withAlt);
    const a = m.titles.find(([l]) => l === "A")![1][0];
    expect(a).toMatchObject({ kind: "alt", title: "Aquarium", source: "carnet" });
    expect(m.movements.map(x => x.title)).toEqual(["Allegro", "Finale"]);
  });
});

describe("textIncipitsModel", () => {
  test("one entry per movement with a text incipit, with the first author", () => {
    expect(textIncipitsModel(cat)).toEqual([
      { text: "Vergiftet sind meine Lieder", work: cat.byId.get("lied-b"), author: "Heinrich Heine" },
    ]);
  });
});

describe("scoringModel", () => {
  const model = scoringModel(cat);
  test("the 8 categories in vocabulary order", () => {
    expect(model.map(m => m.category)).toEqual([...CATEGORIES]);
  });
  test("piano holds 3 works", () => {
    expect(model.find(m => m.category === "piano")?.works).toHaveLength(3);
  });
});
