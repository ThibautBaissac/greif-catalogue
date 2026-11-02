import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { describe, expect, test } from "vitest";
import { uiSchema } from "~/lib/ui-schema";
import {
  bibliographySchema,
  booksFileSchema,
  personSchema,
  workSchema,
} from "~/lib/schemas";

const minimal = {
  title: "Adagio",
  th: "7",
  book: 1,
  scoring: { fr: "Piano", en: "Piano" },
  categories: ["piano"],
};

const failedPaths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map(i => i.path.join("."));

describe("workSchema", () => {
  test("accepts a minimal work and fills defaults", () => {
    const r = workSchema.safeParse(minimal);
    expect(r.success).toBe(true);
    expect(r.data?.movements).toEqual([]);
    expect(r.data?.unpublished).toBe(false);
    expect(r.data?.related).toEqual([]);
    expect(r.data?.editorial_notes).toEqual([]);
  });

  test("rejects a Th with a free-form suffix", () => {
    const r = workSchema.safeParse({ ...minimal, th: "7 bis" });
    expect(r.success).toBe(false);
    expect(failedPaths(r)).toContain("th");
  });

  test("rejects an empty categories list", () => {
    expect(workSchema.safeParse({ ...minimal, categories: [] }).success).toBe(false);
  });

  test("rejects an invalid EDTF composition date", () => {
    const r = workSchema.safeParse({ ...minimal, composition: { text: "1973", date: "1973-13" } });
    expect(r.success).toBe(false);
    expect(failedPaths(r)).toContain("composition.date");
  });

  test("rejects an unknown key", () => {
    const r = workSchema.safeParse({ ...minimal, tittle: "oops" });
    expect(r.success).toBe(false);
  });

  test("accepts a performance with performers", () => {
    const r = workSchema.safeParse({
      ...minimal,
      performances: [
        { premiere: true, text: "x", performers: [{ person: "nell-froger", role: "soprano" }] },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("rejects a stored inverse relation", () => {
    const r = workSchema.safeParse({ ...minimal, related: [{ work: "x", relation: "revision:inverse" }] });
    expect(r.success).toBe(false);
  });

  test("treats empty strings and null as absent for optional scalars", () => {
    const r = workSchema.safeParse({
      ...minimal,
      opus: "",
      duration: null,
      composition: { text: "1973", date: "" },
    });
    expect(r.success).toBe(true);
    expect(r.data?.opus).toBeUndefined();
    expect(r.data?.duration).toBeUndefined();
    expect(r.data?.composition?.date).toBeUndefined();
  });

  test("rejects an empty required title", () => {
    expect(workSchema.safeParse({ ...minimal, title: "" }).success).toBe(false);
  });

  test("keeps numeric-looking Th and opus as strings", () => {
    const r = workSchema.safeParse({ ...minimal, opus: "3" });
    expect(r.data?.th).toBe("7");
    expect(r.data?.opus).toBe("3");
    expect(workSchema.safeParse({ ...minimal, th: 7 }).success).toBe(false);
  });

  test("rejects a book outside 1..6", () => {
    expect(workSchema.safeParse({ ...minimal, book: 7 }).success).toBe(false);
  });

  test("requires a source on every alternative title", () => {
    const ok = workSchema.safeParse({ ...minimal, alt_titles: [{ title: "Autre", source: "Ms. 1" }] });
    expect(ok.success).toBe(true);
    const missing = workSchema.safeParse({ ...minimal, alt_titles: [{ title: "Autre" }] });
    expect(missing.success).toBe(false);
    expect(failedPaths(missing)).toContain("alt_titles.0.source");
    expect(workSchema.safeParse({ ...minimal, alt_titles: [{ title: "Autre", source: "" }] }).success).toBe(false);
  });
});

describe("workSchema: what Keystatic writes for untouched fields", () => {
  // Regression: Keystatic always writes the optional objects, with empty values inside.
  test("treats an optional object whose fields are all empty as absent", () => {
    const r = workSchema.safeParse({
      ...minimal,
      text: { credit: "", authors: [] },
      composition: { text: "", date: "" },
      dedication: { text: "", persons: [] },
      sources: { status: "", institution: "", intro: "", items: [], papers: [], features: [] },
    });
    expect(failedPaths(r)).toEqual([]);
    expect(r.data?.text).toBeUndefined();
    expect(r.data?.composition).toBeUndefined();
    expect(r.data?.sources).toBeUndefined();
  });

  test("still reports the required field of a partly filled optional object", () => {
    const r = workSchema.safeParse({ ...minimal, text: { credit: "", poem_title: "Ode" } });
    expect(failedPaths(r)).toContain("text.credit");
  });

  test("a partly filled sources object without status is rejected", () => {
    const r = workSchema.safeParse({ ...minimal, sources: { status: "", features: ["autograph"] } });
    expect(failedPaths(r)).toContain("sources.status");
  });

  test("accepts the empty values Keystatic writes for an untouched edition", () => {
    const r = workSchema.safeParse({ ...minimal, editions: [{ text: "Symétrie", status: "", year: null }] });
    expect(failedPaths(r)).toEqual([]);
  });

  test("accepts an empty identifiers object on a person", () => {
    const r = personSchema.safeParse({ name: "X", surname: "X", identifiers: {} });
    expect(r.success).toBe(true);
  });
});

describe("personSchema", () => {
  test("accepts an ensemble", () => {
    const r = personSchema.safeParse({ name: "Ensemble X", surname: "Ensemble X", kind: "ensemble" });
    expect(r.success).toBe(true);
  });
  test("defaults kind to person and variants to []", () => {
    const r = personSchema.safeParse({ name: "Olivier Greif", surname: "Greif" });
    expect(r.data?.kind).toBe("person");
    expect(r.data?.variants).toEqual([]);
  });
});

describe("bibliographySchema", () => {
  test("accepts a short form and type, author and editor default to []", () => {
    const r = bibliographySchema.safeParse({ short: "François-Sappey & Nectoux (2013)", type: "book" });
    expect(r.success).toBe(true);
    expect(r.data?.author).toEqual([]);
    expect(r.data?.editor).toEqual([]);
  });
});

describe("booksFileSchema", () => {
  const load = () => loadYaml(readFileSync("content/books.yaml", "utf8")) as { books: unknown[] };
  test("accepts content/books.yaml", () => {
    expect(booksFileSchema.safeParse(load()).success).toBe(true);
  });
  test("rejects five Books", () => {
    const file = load();
    expect(booksFileSchema.safeParse({ books: file.books.slice(0, 5) }).success).toBe(false);
  });
  test("rejects a repeated Book number even when six Books remain", () => {
    const file = load();
    file.books[5] = { number: 5, roman: "VI", status: "planned" };
    const result = booksFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    expect(failedPaths(result)).toContain("books.5.number");
  });
});

describe("uiSchema: what Keystatic writes for untouched fields", () => {
  // Regression: Keystatic omits an empty text, and `frOnly` is legitimately empty in content/ui/fr.yaml.
  test("treats a missing frOnly as an empty string", () => {
    const { frOnly: _omitted, ...rest } = loadYaml(readFileSync("content/ui/fr.yaml", "utf8")) as Record<string, unknown>;
    const r = uiSchema.safeParse(rest);
    expect(r.success).toBe(true);
    expect(r.data?.frOnly).toBe("");
  });

  test("still rejects any other missing key", () => {
    const { prev: _omitted, ...rest } = loadYaml(readFileSync("content/ui/fr.yaml", "utf8")) as Record<string, unknown>;
    expect(uiSchema.safeParse(rest).success).toBe(false);
  });
});
