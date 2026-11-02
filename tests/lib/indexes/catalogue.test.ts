import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { catalogueModel } from "~/lib/indexes/catalogue";
import { fixtureInput } from "../../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);
const rows = catalogueModel(cat).books.flatMap(b => b.works);
const row = (id: string) => rows.find(r => r.work.id === id)!;

describe("catalogueModel", () => {
  test("one group per book, works in catalogue order", () => {
    const { books } = catalogueModel(cat);
    expect(books).toHaveLength(6);
    expect(books[0].works.map(r => r.work.id)).toEqual(["sonate-a", "etude-c", "lied-b"]);
    expect(books[2].works).toEqual([]);
  });

  test("status: an edition with a year means published", () => {
    expect(row("sonate-a").status).toEqual(["published"]);
  });

  test("status: unpublished and manuscript not located", () => {
    expect(row("lied-b").status).toEqual(["unpublished", "lostms"]);
  });

  test("status: nothing to say gives an empty list", () => {
    expect(row("etude-c").status).toEqual([]);
  });

  test("search text is folded and includes title, scoring and opus", () => {
    expect(row("lied-b").q).toContain("l'ile");
    expect(row("lied-b").q).toContain("voix et piano");
    expect(row("sonate-a").q).toContain("op 3");
  });

  test("categories present, in vocabulary order", () => {
    expect(catalogueModel(cat).categories).toEqual(["piano", "voice-piano"]);
  });
});
