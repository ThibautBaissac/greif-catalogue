import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { homeModel } from "~/lib/indexes/home";
import { fixtureInput } from "../../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);

describe("homeModel", () => {
  test("counts entries, located manuscripts, performances and journal extracts", () => {
    expect(homeModel(cat).stats).toEqual({ entries: 4, located: 1, performances: 2, journal: 1 });
  });

  test("summarises a book by Th range and years", () => {
    expect(homeModel(cat).books[0]).toMatchObject({
      number: 1,
      roman: "I",
      count: 3,
      thFirst: "2",
      thLast: "10",
      yearFirst: 1972,
      yearLast: 1973,
    });
  });

  test("an empty book has no range", () => {
    const empty = homeModel(cat).books[2];
    expect(empty.count).toBe(0);
    expect(empty.thFirst).toBeUndefined();
    expect(empty.yearFirst).toBeUndefined();
  });

  test("lists the six books", () => {
    expect(homeModel(cat).books.map(b => b.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
