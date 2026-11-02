import { afterEach, describe, expect, test, vi } from "vitest";
import { buildCatalogue } from "~/lib/catalogue";
import { completeness, dashboardModel, isEditorial } from "~/lib/editorial";
import { personSchema, workSchema } from "~/lib/schemas";
import { fixtureInput } from "../fixtures/catalogue";

const cat = buildCatalogue(fixtureInput);
const work = (id: string) => cat.byId.get(id)!;

describe("isEditorial", () => {
  afterEach(() => vi.unstubAllEnvs());
  test("is on only when CATALOGUE_EDITORIAL is exactly 1", () => {
    vi.stubEnv("CATALOGUE_EDITORIAL", "1");
    expect(isEditorial()).toBe(true);
    vi.stubEnv("CATALOGUE_EDITORIAL", "true");
    expect(isEditorial()).toBe(false);
    vi.stubEnv("CATALOGUE_EDITORIAL", "");
    expect(isEditorial()).toBe(false);
  });
});

describe("completeness", () => {
  test("a work with composition, sources and bars but no duration scores 0.75", () => {
    expect(completeness(work("sonate-a"))).toEqual({
      incipits: 0,
      bars: 1,
      movements: 1,
      checks: { composition: true, sources: true, bars: true, duration: false },
      score: 0.75,
    });
  });
  test("composition without a structured date fails the composition check", () => {
    expect(completeness(work("zeta-d")).checks.composition).toBe(false);
  });
  test("no movement passes the bars check; no sources fails the sources check", () => {
    const c = completeness(work("zeta-d"));
    expect(c.checks).toMatchObject({ bars: true, sources: false });
    expect(c.score).toBe(0.25);
  });
  test("lost sources count as documented even without items", () => {
    expect(completeness(work("lied-b")).checks.sources).toBe(true);
  });
  test("a movement without bars fails the bars check; incipit images are counted", () => {
    const w = {
      ...workSchema.parse({
        th: "9",
        book: 1,
        title: "T",
        scoring: { fr: "P", en: "P" },
        categories: ["piano"],
        duration: "5 min",
        movements: [{ bars: 10, incipit: "/incipits/t/1.png" }, {}],
      }),
      id: "t",
    };
    const c = completeness(w);
    expect(c).toMatchObject({ incipits: 1, bars: 1, movements: 2 });
    expect(c.checks.bars).toBe(false);
    expect(c.checks.duration).toBe(true);
  });
});

describe("dashboardModel", () => {
  test("one row per work with its editorial notes", () => {
    const { rows } = dashboardModel(cat);
    expect(rows.map(r => r.work.id)).toEqual(["sonate-a", "etude-c", "lied-b", "zeta-d"]);
    expect(rows.find(r => r.work.id === "lied-b")!.notes).toEqual(["Compléter les mesures"]);
    expect(rows[0].c.score).toBe(0.75);
  });
  test("unresolved lists works holding [[?]]", () => {
    expect(dashboardModel(cat).unresolved.map(w => w.id)).toEqual(["lied-b"]);
  });
  test("incompleteBibliography lists entries without a title", () => {
    expect(dashboardModel(cat).incompleteBibliography).toEqual(["francois-sappey-nectoux-2013"]);
  });
  test("variants lists persons whose name variants were merged", () => {
    expect(dashboardModel(cat).variants).toEqual([]);
    const withVariants = buildCatalogue({
      ...fixtureInput,
      persons: [
        ...fixtureInput.persons,
        { id: "jean-x", data: personSchema.parse({ name: "Jean X", surname: "X", variants: ["J. X", "Jean Xavier"] }) },
      ],
    });
    expect(dashboardModel(withVariants).variants).toEqual([{ person: "Jean X", variants: ["J. X", "Jean Xavier"] }]);
  });
});
