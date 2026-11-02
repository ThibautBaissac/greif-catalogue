import { describe, expect, test } from "vitest";
import { fold, slug, sortTitle } from "~/lib/text";

describe("fold", () => {
  test("removes accents and lowercases", () => {
    expect(fold("Éloïse")).toBe("eloise");
  });
});

describe("slug", () => {
  test("joins words with hyphens", () => {
    expect(slug("Mrs Alexander Liberman")).toBe("mrs-alexander-liberman");
  });
  test("keeps existing hyphens as separators", () => {
    expect(slug("Isabelle Collin-Dufresne")).toBe("isabelle-collin-dufresne");
  });
  test("trims leading and trailing separators and folds accents", () => {
    expect(slug("  La Pèrigourdine ! ")).toBe("la-perigourdine");
  });
});

describe("sortTitle", () => {
  test("drops a leading article", () => {
    expect(sortTitle("Le Tombeau de Ravel")).toBe("tombeau de ravel");
  });
  test("drops an elided article and folds accents", () => {
    expect(sortTitle("L'Île du docteur Moreau")).toBe("ile du docteur moreau");
  });
  test("drops leading punctuation, digits and spaces", () => {
    expect(sortTitle("« 1) Vergiftet")).toBe("vergiftet");
  });
});
