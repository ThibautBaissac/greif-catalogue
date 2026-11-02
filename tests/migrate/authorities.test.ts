import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { describe, expect, test } from "vitest";
import { extractAuthorities, ROLE_MAP, type ProtoWork } from "../../scripts/migrate/authorities";
import {
  bibliographySchema,
  institutionSchema,
  personSchema,
  placeSchema,
  roleSchema,
} from "~/lib/schemas";

const FIXTURES = [
  "wiener-konzert",
  "sonate-violon-piano-02",
  "taking-leave-of-a-friend",
  "light-music",
  "the-spirit-s-song",
  "bomben-auf-engelland",
  "bomben-auf-engelland-1976",
];
const works: ProtoWork[] = FIXTURES.map(
  f =>
    load(
      readFileSync(fileURLToPath(new URL(`../fixtures/prototype/${f}.yaml`, import.meta.url)), "utf8"),
    ) as ProtoWork,
);
const auth = extractAuthorities(works);

describe("extractAuthorities on prototype fixtures", () => {
  test("persons come from authors, dedicatees and performers", () => {
    expect(auth.persons.has("heinrich-heine")).toBe(true);
    expect(auth.persons.has("nell-froger")).toBe(true);
    expect(auth.persons.has("devy-erlih")).toBe(true);
    expect(auth.persons.has("esther-galil")).toBe(true);
    expect(auth.persons.get("mrs-alexander-liberman")?.surname).toBe("Liberman");
  });

  test("as_written becomes a variant of the person", () => {
    const rihaku = [...auth.persons.values()].find(p => p.name === "Li Bai");
    expect(rihaku?.variants).toContain("Rihaku");
  });

  test("the [?] performer of light-music is ignored", () => {
    expect(auth.persons.has("")).toBe(false);
    expect([...auth.persons.values()].some(p => p.name.includes("?"))).toBe(false);
  });

  test("a role mapped to null is reported and creates no person", () => {
    expect(
      auth.report.some(l => l.includes("sonate-violon-piano-02") && l.includes("par les mêmes interprètes")),
    ).toBe(true);
    expect(auth.persons.has("et-22-fevrier")).toBe(false);
  });

  test("roles carry their French and English labels", () => {
    expect(auth.roles.get("violon")?.en).toBe("violin");
  });

  test("places use the city as name and the first country met", () => {
    expect(auth.places.get("paris")?.name).toBe("Paris");
    expect(auth.places.get("libreville")?.country).toBe("Gabon");
  });

  test("institutions come from sources.siglum", () => {
    const inst = auth.institutions.get("f-pbmgf");
    expect(inst?.siglum).toBe("F-Pbmgf");
    expect(inst?.name.en).toBe("Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection.");
  });

  test("bibliography has one stub entry per distinct ref", () => {
    const b = auth.bibliography.get("francois-sappey-nectoux-2013");
    expect(b?.short).toBe("François-Sappey & Nectoux (2013)");
    expect(b?.type).toBe("other");
    expect(b?.editorial_notes).toEqual(["[migration] compléter la notice CSL (type, auteurs, titre, éditeur, date)"]);
  });

  test("every produced authority passes its Zod schema", () => {
    for (const p of auth.persons.values()) expect(() => personSchema.parse(p)).not.toThrow();
    for (const p of auth.places.values()) expect(() => placeSchema.parse(p)).not.toThrow();
    for (const i of auth.institutions.values()) expect(() => institutionSchema.parse(i)).not.toThrow();
    for (const r of auth.roles.values()) expect(() => roleSchema.parse(r)).not.toThrow();
    for (const b of auth.bibliography.values()) expect(() => bibliographySchema.parse(b)).not.toThrow();
  });
});

describe("extractAuthorities on synthetic works", () => {
  const perf = (performers: object[], city?: string, country?: string) => ({
    date: "2000-01-01",
    city,
    country,
    performers,
    text: "x",
  });

  test("an ensemble performer gets kind ensemble, surname = name, no given name", () => {
    const a = extractAuthorities([
      { id: "w1", performances: [perf([{ name: "Quatuor Debussy", role: "ensemble" }])] },
    ]);
    const p = a.persons.get("quatuor-debussy");
    expect(p?.kind).toBe("ensemble");
    expect(p?.surname).toBe("Quatuor Debussy");
    expect(p?.given).toBeUndefined();
    expect(a.report).toEqual([]);
  });

  test("a role missing from ROLE_MAP is reported", () => {
    const a = extractAuthorities([
      { id: "w2", performances: [perf([{ name: "Jean Dupont", role: "théorbe" }])] },
    ]);
    expect(a.report.some(l => l.includes("w2") && l.includes("théorbe"))).toBe(true);
  });

  test("a role id is the slug-safe form of the raw role", () => {
    const a = extractAuthorities([
      { id: "w0", performances: [perf([{ name: "Jean Dupont", role: "flûte" }])] },
    ]);
    expect(a.roles.get("flute")).toEqual({ fr: "flûte", en: "flute" });
    expect(a.persons.has("jean-dupont")).toBe(true);
  });

  test("an unknown siglum is reported and creates no institution", () => {
    const a = extractAuthorities([{ id: "w3", sources: { status: "located", siglum: "GB-Lbl" } }]);
    expect(a.report.some(l => l.includes("w3") && l.includes("GB-Lbl"))).toBe(true);
    expect(a.institutions.size).toBe(0);
  });

  test("the first non-empty country for a city wins", () => {
    const a = extractAuthorities([
      { id: "w4", performances: [perf([], "Lyon"), perf([], "Lyon", "France"), perf([], "Lyon", "Autre")] },
    ]);
    expect(a.places.get("lyon")?.country).toBe("France");
  });

  test("two refs with the same slug are reported", () => {
    const a = extractAuthorities([
      { id: "w5", bibliography: [{ ref: "Dupont (2000)" }, { ref: "Dupont, 2000" }] },
    ]);
    expect(a.report.some(l => l.includes("w5") && l.includes("dupont-2000"))).toBe(true);
  });
});

describe("ROLE_MAP", () => {
  test("holds the agreed values", () => {
    expect(ROLE_MAP["flûte"]).toEqual({ id: "flute", fr: "flûte", en: "flute" });
    expect(ROLE_MAP["pianiste ?"]).toEqual({ id: "pianiste-incertain", fr: "pianiste ?", en: "pianist ?" });
    expect(ROLE_MAP["ensemble"]).toBe("ensemble");
    expect(ROLE_MAP["par les mêmes interprètes"]).toBeNull();
    expect(Object.keys(ROLE_MAP)).toHaveLength(16);
  });
});
