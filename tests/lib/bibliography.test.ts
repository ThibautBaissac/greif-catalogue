import { describe, expect, test } from "vitest";
import { formatReference } from "~/lib/bibliography";
import { bibliographySchema } from "~/lib/schemas";

const ref = (data: unknown, lang: "fr" | "en" = "fr") => formatReference(bibliographySchema.parse(data), lang);

describe("formatReference", () => {
  test("editor without author gets (dir.) in French", () => {
    expect(
      ref({
        short: "F&N (2013)",
        type: "book",
        title: "Le Rêve du monde",
        editor: [{ family: "François-Sappey", given: "Brigitte" }],
        author: [],
        issued: "2013",
        publisher: "Symétrie",
        "publisher-place": "Lyon",
      }),
    ).toBe("François-Sappey, Brigitte (dir.), <em>Le Rêve du monde</em>, Lyon, Symétrie, 2013.");
  });
  test("editor without author gets (ed.) in English", () => {
    expect(
      ref({ short: "x", type: "book", title: "T", editor: [{ family: "Doe", given: "Jane" }] }, "en"),
    ).toBe("Doe, Jane (ed.), <em>T</em>.");
  });
  test("authors are separated by a semicolon; editors are ignored when authors exist", () => {
    expect(
      ref({
        short: "x",
        type: "book",
        title: "T",
        author: [{ family: "A", given: "a" }, { family: "B" }],
        editor: [{ family: "E" }],
      }),
    ).toBe("A, a ; B, <em>T</em>.");
  });
  test("year comes from the issued EDTF date", () => {
    expect(ref({ short: "x", type: "book", title: "T", issued: "1999-05-03" })).toBe("<em>T</em>, 1999.");
  });
  test("html in fields is escaped", () => {
    expect(ref({ short: "x", type: "book", title: "A <b> & C", publisher: "R&D" })).toBe(
      "<em>A &lt;b&gt; &amp; C</em>, R&amp;D.",
    );
  });
  test("without title the escaped short form is returned", () => {
    expect(ref({ short: "F&N (2013)", type: "other", author: [], editor: [] })).toBe("F&amp;N (2013)");
  });
});
