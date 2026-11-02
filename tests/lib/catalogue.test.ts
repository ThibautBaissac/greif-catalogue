import { describe, expect, test } from "vitest";
import { buildCatalogue, validateCatalogue, type CatalogueInput } from "~/lib/catalogue";
import { fixtureInput } from "../fixtures/catalogue";

const copy = (): CatalogueInput => structuredClone(fixtureInput);
const work = (input: CatalogueInput, id: string) => input.works.find(w => w.id === id)!.data;

describe("validateCatalogue", () => {
  test("accepts the fixture", () => {
    expect(validateCatalogue(fixtureInput)).toEqual([]);
  });

  test("reports a duplicate Th on the later work and names the first", () => {
    const input = copy();
    work(input, "lied-b").th = "2";
    const errors = validateCatalogue(input);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: "works/lied-b", path: "th" });
    expect(errors[0].message).toContain("sonate-a");
  });

  test("reports an unknown [[id]] with its path, but accepts [[?]]", () => {
    const input = copy();
    work(input, "etude-c").remarks = ["[[inconnu]]"];
    expect(validateCatalogue(input)).toEqual([
      expect.objectContaining({ file: "works/etude-c", path: "remarks.0" }),
    ]);
    work(input, "etude-c").remarks = ["[[?]]"];
    expect(validateCatalogue(input)).toEqual([]);
  });

  test("finds [[id]] in nested strings", () => {
    const input = copy();
    work(input, "sonate-a").journal[0].quotes = ["voir [[nulle-part]]"];
    expect(validateCatalogue(input)).toEqual([
      expect.objectContaining({ file: "works/sonate-a", path: "journal.0.quotes.0" }),
    ]);
  });

  test("reports unknown performer, role and place", () => {
    const person = copy();
    work(person, "sonate-a").performances[0].performers[0].person = "x";
    expect(validateCatalogue(person)).toEqual([
      expect.objectContaining({ file: "works/sonate-a", path: "performances.0.performers.0.person" }),
    ]);

    const role = copy();
    work(role, "sonate-a").performances[0].performers[0].role = "tuba";
    expect(validateCatalogue(role)).toEqual([
      expect.objectContaining({ path: "performances.0.performers.0.role" }),
    ]);

    const place = copy();
    work(place, "sonate-a").performances[0].place = "lyon";
    expect(validateCatalogue(place)).toEqual([expect.objectContaining({ path: "performances.0.place" })]);
  });

  test("reports unknown institution, bibliography ref, dedicatee and text author", () => {
    const a = copy();
    work(a, "sonate-a").sources!.institution = "f-xx";
    expect(validateCatalogue(a)).toEqual([expect.objectContaining({ path: "sources.institution" })]);

    const b = copy();
    work(b, "sonate-a").bibliography[0].ref = "y";
    expect(validateCatalogue(b)).toEqual([expect.objectContaining({ path: "bibliography.0.ref" })]);

    const c = copy();
    work(c, "sonate-a").dedication!.persons = ["z"];
    expect(validateCatalogue(c)).toEqual([expect.objectContaining({ path: "dedication.persons.0" })]);

    const d = copy();
    work(d, "lied-b").text!.authors[0].person = "z";
    expect(validateCatalogue(d)).toEqual([
      expect.objectContaining({ file: "works/lied-b", path: "text.authors.0.person" }),
    ]);
  });

  test("reports a self relation and a relation to an absent work", () => {
    const self = copy();
    work(self, "sonate-a").related = [{ work: "sonate-a", relation: "revision" }];
    expect(validateCatalogue(self)).toEqual([
      expect.objectContaining({ file: "works/sonate-a", path: "related.0.work" }),
    ]);

    const absent = copy();
    work(absent, "sonate-a").related = [{ work: "absent", relation: "revision" }];
    expect(validateCatalogue(absent)).toEqual([
      expect.objectContaining({ file: "works/sonate-a", path: "related.0.work" }),
    ]);
  });

  test("reports a relation pair stored twice, even with another relation", () => {
    const same = copy();
    work(same, "lied-b").related = [{ work: "sonate-a", relation: "revision" }];
    expect(validateCatalogue(same)).toEqual([
      expect.objectContaining({ file: "works/lied-b", path: "related.0" }),
    ]);

    const other = copy();
    work(other, "lied-b").related = [{ work: "sonate-a", relation: "companion" }];
    expect(validateCatalogue(other)).toHaveLength(1);
  });

  test("reports a work whose Book is missing from books", () => {
    const input = copy();
    input.books = input.books.filter(b => b.number !== 2);
    expect(validateCatalogue(input)).toEqual([
      expect.objectContaining({ file: "works/zeta-d", path: "book" }),
    ]);
  });
});

describe("buildCatalogue", () => {
  const cat = buildCatalogue(fixtureInput);
  const ids = (rows: { work: { id: string } }[]) => rows.map(r => r.work.id);

  test("lists works in Th order whatever the input order", () => {
    expect(cat.works.map(w => w.id)).toEqual(["sonate-a", "etude-c", "lied-b", "zeta-d"]);
    const reversed = { ...copy(), works: copy().works.reverse() };
    expect(buildCatalogue(reversed).works.map(w => w.id)).toEqual(["sonate-a", "etude-c", "lied-b", "zeta-d"]);
  });

  test("indexes works and authorities by id", () => {
    expect(cat.byId.get("lied-b")?.title).toBe("L'Île");
    expect(cat.persons.get("nell-froger")).toMatchObject({ id: "nell-froger", surname: "Froger" });
    expect(cat.books.map(b => b.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("derives the inverse relation, stores the direct one once", () => {
    expect(cat.related("lied-b")).toEqual([
      { work: cat.byId.get("sonate-a"), relation: "revision:inverse" },
    ]);
    expect(cat.related("sonate-a")).toEqual([{ work: cat.byId.get("lied-b"), relation: "revision" }]);
    expect(cat.related("etude-c")).toEqual([]);
  });

  test("gives previous and next work in Th order", () => {
    expect(cat.neighbours("etude-c")).toEqual({
      prev: cat.byId.get("sonate-a"),
      next: cat.byId.get("lied-b"),
    });
    expect(cat.neighbours("sonate-a").prev).toBeUndefined();
    expect(cat.neighbours("zeta-d").next).toBeUndefined();
  });

  test("flattens performances in date order", () => {
    expect(cat.performances.map(r => r.perf.date)).toEqual(["1974-04-24", "1976-03-18"]);
    expect(cat.performances.map(r => r.work.id)).toEqual(["sonate-a", "lied-b"]);
  });

  test("orders performances by date, not by work, and puts undated last", () => {
    const input = copy();
    work(input, "sonate-a").performances[0].date = "1980";
    work(input, "zeta-d").performances = [{ premiere: false, performers: [], text: "x" }];
    expect(buildCatalogue(input).performances.map(r => r.perf.date)).toEqual(["1976-03-18", "1980", undefined]);
  });

  test("collects usages per person", () => {
    const nell = cat.personUsages.get("nell-froger")!;
    expect(nell.performer).toHaveLength(2);
    expect(nell.performer[0]).toMatchObject({ role: "soprano", date: "1974-04-24" });
    expect(nell.performer.map(u => u.work.id)).toEqual(["sonate-a", "lied-b"]);

    const heine = cat.personUsages.get("heinrich-heine")!;
    expect(ids(heine.author)).toEqual(["lied-b"]);
    expect(ids(heine.dedicatee)).toEqual(["sonate-a"]);
    expect(heine.translator).toEqual([]);
    expect(heine.performer).toEqual([]);
  });
});
