import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { describe, expect, test } from "vitest";
import type { ProtoWork } from "../../scripts/migrate/authorities";
import { migrate } from "../../scripts/migrate/works";
import { workSchema, type Work } from "~/lib/schemas";

const FIXTURES = [
  "wiener-konzert",
  "sonate-violon-piano-02",
  "taking-leave-of-a-friend",
  "light-music",
  "the-spirit-s-song",
  "bomben-auf-engelland",
  "bomben-auf-engelland-1976",
];
const read = (f: string) =>
  load(readFileSync(fileURLToPath(new URL(`../fixtures/prototype/${f}.yaml`, import.meta.url)), "utf8")) as ProtoWork;
const works = FIXTURES.map(read);
const { files, report } = migrate(works);
const work = (id: string) => files[`works/${id}.yaml`] as Work;

/** Minimal valid prototype work, for synthetic cases. */
const proto = (over: Record<string, unknown> = {}): ProtoWork => ({
  id: "synth",
  th: "999",
  book: 1,
  title: "Synthétique",
  scoring: "Piano",
  categories: ["piano"],
  ...over,
});

describe("migrate: fixtures", () => {
  test("wiener-konzert", () => {
    const w = work("wiener-konzert");
    expect(w.scoring).toEqual({ fr: "Voix de femme et piano", en: "Female voice and piano" });
    expect(w.composition?.date).toBe("1973-11-26");
    expect(w.performances[0].premiere).toBe(true);
    expect(w.performances[0].place).toBe("paris");
    expect(w.performances[0].performers[0]).toEqual({ person: "nell-froger", role: "soprano" });
    expect(w.performances).toHaveLength(4);
    expect(w.performances.filter(p => p.premiere)).toHaveLength(1);
    expect(w.sources?.institution).toBe("f-pbmgf");
    expect(w.related).toEqual([]);
    expect(w.bibliography[0].ref).toBe("francois-sappey-nectoux-2013");
    expect("id" in w).toBe(false);
  });

  test("related keeps direct relations only", () => {
    expect(work("light-music").related).toEqual(
      expect.arrayContaining([
        { work: "wiener-konzert", relation: "shared-material" },
        { work: "the-spirit-s-song", relation: "cycle" },
      ]),
    );
    expect(work("the-spirit-s-song").related).toEqual([]);
    expect(work("bomben-auf-engelland").related).toEqual([
      { work: "bomben-auf-engelland-1976", relation: "revision" },
    ]);
  });

  test("sonate-violon-piano-02: unstructured performer dropped with a note", () => {
    const w = work("sonate-violon-piano-02");
    const persons = w.performances.flatMap(p => p.performers.map(x => x.person));
    expect(persons).not.toContain("et-22-fevrier");
    const perf = w.performances.find(p => p.date === "2006-05-11")!;
    expect(perf.note).toBe(perf.text);
    expect(perf.note).toContain("22 février");
    expect(w.editorial_notes.some(n => n.startsWith("[migration] interprète non structuré"))).toBe(true);
  });

  test("light-music: [?] performer dropped, no empty person anywhere", () => {
    const w = work("light-music");
    const perf = w.performances.find(p => p.date === "2021-10-14")!;
    expect(perf.performers).toEqual([{ person: "olivier-cesarini", role: "baryton" }]);
    expect(perf.text).toContain("pianiste ?");
    expect(perf.note).toBe(perf.text);
    expect(w.editorial_notes.some(n => n.startsWith("[migration] interprète non identifié"))).toBe(true);
    const all = Object.entries(files)
      .filter(([k]) => k.startsWith("works/"))
      .flatMap(([, v]) => ((v as Work).performances ?? []).flatMap(p => p.performers.map(x => x.person)));
    expect(all.every(p => p !== "")).toBe(true);
  });

  test("every work passes workSchema", () => {
    for (const [k, v] of Object.entries(files)) {
      if (k.startsWith("works/")) expect(() => workSchema.parse(v), k).not.toThrow();
    }
  });

  test("authority files are emitted", () => {
    expect(files["persons/olivier-greif.yaml"]).toBeDefined();
    expect(files["places/paris.yaml"]).toBeDefined();
    expect(files["institutions/f-pbmgf.yaml"]).toBeDefined();
    expect(files["roles/piano.yaml"]).toBeDefined();
    expect(files["bibliography/francois-sappey-nectoux-2013.yaml"]).toBeDefined();
  });

  test("report mentions the anomalies", () => {
    expect(report.some(l => l.includes("sonate-violon-piano-02") && l.includes("par les mêmes interprètes"))).toBe(true);
    expect(report.some(l => l.includes("light-music") && l.includes("[?]"))).toBe(true);
  });
});

describe("migrate: synthetic cases", () => {
  test("a features value outside SOURCE_FEATURES moves to documents", () => {
    const out = migrate([
      proto({ sources: { status: "located", siglum: "F-Pbmgf", features: ["autograph", "« Une citation »"] } }),
    ]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.sources?.features).toEqual(["autograph"]);
    expect(w.documents).toContain("« Une citation »");
    expect(w.editorial_notes).toContain("[migration] déplacé de sources.features vers documents");
    expect(() => workSchema.parse(w)).not.toThrow();
  });

  test("a sources item with an empty text keeps its label as text, with a note", () => {
    const out = migrate([
      proto({ sources: { status: "located", items: [{ label: "Inédit ?", text: "" }, { text: "Ms." }] } }),
    ]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.sources?.items).toEqual([{ text: "Inédit ?" }, { text: "Ms." }]);
    expect(w.editorial_notes).toContain("[migration] item de sources sans texte : étiquette reprise comme texte");
    expect(out.report.some(l => l.includes("synth") && l.includes("Inédit ?"))).toBe(true);
    expect(() => workSchema.parse(w)).not.toThrow();
  });

  test("[?] in dedication and text authors is dropped with a note", () => {
    const out = migrate([
      proto({
        text: { credit: "X", authors: [{ name: "[?]", role: "author" }] },
        dedication: { text: "À ?", persons: ["[?]"] },
      }),
    ]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.text?.authors).toEqual([]);
    expect(w.dedication?.persons).toEqual([]);
    expect(w.editorial_notes).toContain("[migration] personne non identifiée ([?]) dans text.authors");
    expect(w.editorial_notes).toContain("[migration] personne non identifiée ([?]) dans dedication.persons");
  });

  test("a missing inverse is added to the target and reported", () => {
    const a = proto({ id: "a", th: "1", related: [{ id: "b", relation: "cycle:inverse" }] });
    const b = proto({ id: "b", th: "2" });
    const out = migrate([a, b]);
    expect((out.files["works/b.yaml"] as Work).related).toEqual([{ work: "a", relation: "cycle" }]);
    expect((out.files["works/a.yaml"] as Work).related).toEqual([]);
    expect(out.report.some(l => l.includes("a") && l.includes("b") && l.includes("cycle"))).toBe(true);
  });

  test("an inverse already carried by the target adds nothing", () => {
    const a = proto({ id: "a", th: "1", related: [{ id: "b", relation: "cycle:inverse" }] });
    const b = proto({ id: "b", th: "2", related: [{ id: "a", relation: "cycle" }] });
    const out = migrate([a, b]);
    expect((out.files["works/b.yaml"] as Work).related).toEqual([{ work: "a", relation: "cycle" }]);
    expect(out.report.filter(l => l.includes("cycle"))).toEqual([]);
  });

  test("an unknown scoring keeps the French text, is reported and noted", () => {
    const out = migrate([proto({ scoring: "Effectif inédit" })]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.scoring).toEqual({ fr: "Effectif inédit", en: "Effectif inédit" });
    expect(w.editorial_notes).toContain("[migration] traduire l'effectif");
    expect(out.report.some(l => l.includes("synth") && l.includes("Effectif inédit"))).toBe(true);
  });

  test("a performer with a null role is dropped with a note", () => {
    const out = migrate([
      proto({
        premiere: [
          {
            date: "2000-01-01",
            city: "Paris",
            text: "t",
            performers: [{ name: "Jean Dupont", role: "par les mêmes interprètes" }],
          },
        ],
      }),
    ]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.performances[0].performers).toEqual([]);
    expect(w.performances[0].note).toBe("t");
    expect(w.editorial_notes).toContain(
      "[migration] interprète non structuré : Jean Dupont (par les mêmes interprètes)",
    );
  });

  test("an ensemble performer has no role; country moves out; venue and date range convert", () => {
    const out = migrate([
      proto({
        performances: [
          {
            date: "2004-01-06",
            date_end: "2004-01-08",
            place: "Salle Gaveau",
            city: "Paris",
            country: "France",
            text: "t",
            performers: [{ name: "Quatuor Ébène", role: "ensemble", alias: "QE" }],
          },
        ],
      }),
    ]);
    const w = out.files["works/synth.yaml"] as Work;
    expect(w.performances[0]).toEqual({
      premiere: false,
      date: "2004-01-06/2004-01-08",
      venue: "Salle Gaveau",
      place: "paris",
      text: "t",
      performers: [{ person: "quatuor-ebene", alias: "QE" }],
    });
  });
});
