import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { toCsv, toOpenData } from "~/lib/opendata";
import { workSchema } from "~/lib/schemas";
import { fixtureInput } from "../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);

/** Every key of `value`, at any depth. */
const keys = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keys)
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)])
      : [];

describe("toOpenData", () => {
  const data = toOpenData(cat);

  test("lists every work with id, th and urls in both languages", () => {
    expect(data.works).toHaveLength(4);
    expect(data.works[0]).toMatchObject({
      id: "sonate-a",
      th: "2",
      url: { fr: "/fr/oeuvres/sonate-a/", en: "/en/works/sonate-a/" },
    });
  });

  test("editorial notes are removed at every level, from works and bibliography", () => {
    expect(fixtureInput.works.some(w => w.data.editorial_notes.length > 0)).toBe(true);
    expect(keys(data)).not.toContain("editorial_notes");
  });

  test("authority references stay as ids", () => {
    const sonate = data.works[0] as { dedication: { persons: string[] }; sources: { institution: string } };
    expect(sonate.dedication.persons).toEqual(["heinrich-heine"]);
    expect(sonate.sources.institution).toBe("f-pbmgf");
  });

  test("exports the authorities with their ids", () => {
    expect(data.persons).toHaveLength(3);
    expect(data.places).toHaveLength(2);
    expect(data.institutions).toMatchObject([{ id: "f-pbmgf", siglum: "F-Pbmgf" }]);
    expect(data.bibliography).toMatchObject([{ id: "francois-sappey-nectoux-2013" }]);
  });

  test("generated is an ISO timestamp", () => {
    expect(data.generated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("toCsv", () => {
  const lines = toCsv(cat).split("\n");

  test("header", () => {
    expect(lines[0]).toBe(
      "id,th,book,title,subtitle,opus,scoring_fr,scoring_en,categories,composition_date,unpublished,url_fr",
    );
  });

  test("one line per work plus the header, ending with a newline", () => {
    expect(lines).toHaveLength(6);
    expect(lines.at(-1)).toBe("");
  });

  test("a row carries the stripped title, categories joined by | and the url", () => {
    const row = lines.find(l => l.startsWith("lied-b,"))!;
    expect(row).toContain("L'Île");
    expect(row).toContain("voice-piano");
    expect(row).toBe("lied-b,10,1,L'Île,,,Voix et piano,Voice and piano,voice-piano,1972,true,/fr/oeuvres/lied-b/");
  });

  test("markup is stripped from titles and several categories are joined", () => {
    const input = {
      ...fixtureInput,
      works: [
        {
          id: "w",
          data: workSchema.parse({
            th: "1",
            book: 1,
            title: "Op. *Neuf* nº^2^",
            subtitle: "*sous-titre*",
            scoring: { fr: "Piano", en: "Piano" },
            categories: ["piano", "chamber"],
          }),
        },
      ],
    };
    expect(toCsv(buildCatalogue(input)).split("\n")[1]).toBe(
      "w,1,1,Op. Neuf nº2,sous-titre,,Piano,Piano,piano|chamber,,false,/fr/oeuvres/w/",
    );
  });

  test("a field with a comma, a quote or a newline is quoted, quotes doubled", () => {
    const input = {
      ...fixtureInput,
      works: [
        {
          id: "w",
          data: workSchema.parse({
            th: "1",
            book: 1,
            title: 'Un, deux "trois"\nquatre',
            scoring: { fr: "Piano", en: "Piano" },
            categories: ["piano"],
          }),
        },
      ],
    };
    expect(toCsv(buildCatalogue(input))).toContain('w,1,1,"Un, deux ""trois""\nquatre",,');
  });

  test("a cross-reference in a title is written with the referenced Th number", () => {
    const work = (id: string, th: string, title: string) => ({
      id,
      data: workSchema.parse({ th, book: 1, title, scoring: { fr: "Piano", en: "Piano" }, categories: ["piano"] }),
    });
    const input = { ...fixtureInput, works: [work("a", "45", "Wiener"), work("b", "46", "Variations sur [[a]]")] };
    const rows = toCsv(buildCatalogue(input)).split("\n");
    expect(rows[2]).toBe("b,46,1,Variations sur Th 45,,,Piano,Piano,piano,,false,/fr/oeuvres/b/");
  });
});
