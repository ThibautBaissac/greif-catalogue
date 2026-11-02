import { describe, expect, test } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { performancesModel } from "~/lib/indexes/performances";
import { personsModel } from "~/lib/indexes/persons";
import { placesModel } from "~/lib/indexes/places";
import { workSchema } from "~/lib/schemas";
import { fixtureInput } from "../../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);
const persons = personsModel(cat);
const person = (id: string) => persons.flatMap(([, ps]) => ps).find(p => p.id === id)!;

describe("personsModel", () => {
  test("letters", () => {
    expect(persons.map(([l]) => l)).toEqual(["F", "G", "H"]);
  });

  test("a performer has a performer block with roles and years", () => {
    const froger = person("nell-froger");
    expect(froger.roles).toEqual(["performer"]);
    expect(froger.blocks.map(b => b.role)).toEqual(["performer"]);
    expect(froger.blocks[0].works).toHaveLength(2);
    expect(froger.blocks[0].works[0]).toMatchObject({ roles: ["soprano"], years: "1974" });
    expect(froger.blocks[0].works[0].work.id).toBe("sonate-a");
  });

  test("only performers carry years", () => {
    const heine = person("heinrich-heine");
    expect(heine.blocks.flatMap(b => b.works.map(w => w.years))).toEqual(["", ""]);
  });

  test("a person can be author and dedicatee", () => {
    const heine = person("heinrich-heine");
    expect(heine.roles).toEqual(expect.arrayContaining(["author", "dedicatee"]));
    expect(heine.surname).toBe("Heine");
    expect(heine.given).toBe("Heinrich");
  });

  test("translator counts as author in the filter roles but keeps its own block", () => {
    const withTranslator = buildCatalogue({
      ...fixtureInput,
      works: [
        ...fixtureInput.works,
        {
          id: "trad-e",
          data: workSchema.parse({
            th: "60", book: 2, title: "Trad", scoring: { fr: "P", en: "P" }, categories: ["piano"],
            text: { credit: "tr. Heine", authors: [{ person: "heinrich-heine", role: "translator" }] },
          }),
        },
      ],
    });
    const heine = personsModel(withTranslator).flatMap(([, ps]) => ps).find(p => p.id === "heinrich-heine")!;
    expect(heine.roles.filter(r => r === "author")).toHaveLength(1);
    expect(heine.blocks.map(b => b.role)).toEqual(["author", "translator", "dedicatee"]);
  });

  test("years span a range when the dates differ", () => {
    const froger = person("nell-froger");
    const all = froger.blocks[0].works;
    expect(all.map(w => w.years)).toEqual(["1974", "1976"]);
  });

  test("a work with performances in two years gets a range", () => {
    const two = buildCatalogue({
      ...fixtureInput,
      works: fixtureInput.works.map(w =>
        w.id === "sonate-a"
          ? {
              ...w,
              data: {
                ...w.data,
                performances: [
                  ...w.data.performances,
                  { premiere: false, date: "1976", performers: [{ person: "nell-froger", role: "soprano" }], text: "…" },
                ],
              },
            }
          : w,
      ),
    });
    const froger = personsModel(two).flatMap(([, ps]) => ps).find(p => p.id === "nell-froger")!;
    expect(froger.blocks[0].works[0].years).toBe("1974–1976");
  });
});

describe("placesModel", () => {
  test("label with country, sorted", () => {
    expect(placesModel(cat).map(p => p.label)).toEqual(["Paris", "Prague (République Tchèque)"]);
    expect(placesModel(cat).map(p => p.key)).toEqual(["paris", "prague"]);
  });

  test("performances without a place go to an unknown group", () => {
    const noPlace = buildCatalogue({
      ...fixtureInput,
      works: fixtureInput.works.map(w =>
        w.id === "lied-b" ? { ...w, data: { ...w.data, performances: [{ ...w.data.performances[0], place: undefined }] } } : w,
      ),
    });
    const groups = placesModel(noPlace, "Lieu non précisé");
    // Tri par libellé replié, comme le prototype : « Lieu non précisé » précède « Paris ».
    expect(groups.map(g => g.key)).toEqual(["unknown", "paris"]);
    expect(groups[0].label).toBe("Lieu non précisé");
    expect(groups[0].rows).toHaveLength(1);
  });
});

describe("performancesModel", () => {
  test("lists rows and works without any performance", () => {
    const m = performancesModel(cat);
    expect(m.rows).toHaveLength(2);
    expect(m.withoutPerformance.map(w => w.id)).toEqual(["etude-c", "zeta-d"]);
  });
});
