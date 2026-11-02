import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { describe, expect, test } from "vitest";
import type { Catalogue, WorkEntry } from "~/lib/catalogue";
import { fill, markupOptions, PAGES, pageUrl, tn, WORK_DIR, workUrl } from "~/lib/i18n";
import { CATEGORIES, RELATIONS, SOURCE_FEATURES, SOURCE_STATUS } from "~/lib/schemas";
import { uiSchema, type Ui } from "~/lib/ui-schema";

const readUi = (lang: "fr" | "en") => loadYaml(readFileSync(`content/ui/${lang}.yaml`, "utf8"));

describe("PAGES and URLs", () => {
  test("declares the 19 pages", () => {
    expect(Object.keys(PAGES)).toHaveLength(19);
  });
  test("slugs follow the prototype file names without .html", () => {
    expect(PAGES.indexes).toEqual({ fr: "index-general", en: "indexes" });
    expect(PAGES.incipits).toEqual({ fr: "incipits-litteraires", en: "text-incipits" });
    expect(PAGES.dashboard).toEqual({ fr: "redaction", en: "editorial" });
    expect(PAGES.home).toEqual({ fr: "", en: "" });
  });
  test("pageUrl", () => {
    expect(pageUrl("persons", "fr")).toBe("/fr/personnes/");
    expect(pageUrl("persons", "en")).toBe("/en/people/");
    expect(pageUrl("home", "en")).toBe("/en/");
  });
  test("workUrl", () => {
    expect(WORK_DIR).toEqual({ fr: "oeuvres", en: "works" });
    expect(workUrl("wiener-konzert", "en")).toBe("/en/works/wiener-konzert/");
    expect(workUrl("wiener-konzert", "fr")).toBe("/fr/oeuvres/wiener-konzert/");
  });
});

describe("fill", () => {
  test("replaces named placeholders", () => {
    expect(fill("Th {th} — {title}", { th: "45", title: "W" })).toBe("Th 45 — W");
  });
  test("replaces every occurrence and accepts numbers", () => {
    expect(fill("{n}/{n}", { n: 3 })).toBe("3/3");
  });
});

describe("tn", () => {
  const fr = { one: "{n} œuvre", other: "{n} œuvres" };
  test("French treats 0 and 1 as singular", () => {
    expect(tn(fr, 0, "fr")).toBe("0 œuvre");
    expect(tn(fr, 1, "fr")).toBe("1 œuvre");
    expect(tn(fr, 2, "fr")).toBe("2 œuvres");
  });
  test("English treats 0 as plural", () => {
    const en = { one: "{n} work", other: "{n} works" };
    expect(tn(en, 0, "en")).toBe("0 works");
    expect(tn(en, 1, "en")).toBe("1 work");
  });
});

describe("content/ui", () => {
  test.each(["fr", "en"] as const)("%s.yaml satisfies uiSchema", lang => {
    expect(() => uiSchema.parse(readUi(lang))).not.toThrow();
  });
  test.each(["fr", "en"] as const)("%s.yaml covers every controlled vocabulary", lang => {
    const ui = uiSchema.parse(readUi(lang));
    for (const r of RELATIONS) {
      expect(ui.relation).toHaveProperty(r);
      expect(ui.relation).toHaveProperty(`${r}_inverse`);
    }
    for (const c of CATEGORIES) expect(ui.cat).toHaveProperty(c);
    for (const f of SOURCE_FEATURES) expect(ui.features).toHaveProperty(f);
    for (const s of SOURCE_STATUS) expect(ui.srcStatus).toHaveProperty(s);
    expect(ui.months).toHaveLength(12);
  });
  test("applies the renamed and new keys", () => {
    const fr = uiSchema.parse(readUi("fr"));
    const en = uiSchema.parse(readUi("en"));
    expect(fr.worksCount).toEqual({ one: "{n} œuvre", other: "{n} œuvres" });
    expect(en.searchHint).toEqual({ one: "{n} entry", other: "{n} entries" });
    expect(fr.relation.cycle_inverse).toBe("Cycle");
    expect(en.relation.sketch_inverse).toBe("Sketch");
    expect(fr.lineBreak).toBe("saut de ligne");
    expect(en.stats.journal).toBe("journal extracts");
    expect(fr.idx.chrono).toEqual({ title: "Chronologie", desc: "Les œuvres classées par date de composition." });
    expect(fill(en.citeTemplate, { th: "7", title: "T", url: "u", date: "d" })).toBe(
      "“Th 7 — T,” in Thematic Catalogue of the Works of Olivier Greif [online], u (accessed d).",
    );
  });
  test("is strict: an unknown key is rejected", () => {
    expect(uiSchema.safeParse({ ...(readUi("fr") as object), bogus: "x" }).success).toBe(false);
  });
  test("is strict: months needs 12 entries", () => {
    expect(uiSchema.safeParse({ ...(readUi("fr") as object), months: ["janvier"] }).success).toBe(false);
  });
});

describe("markupOptions", () => {
  const work = { id: "wiener-konzert", th: "45", title: "*Wiener* Konzert" } as unknown as WorkEntry;
  const cat = { byId: new Map([[work.id, work]]) } as unknown as Catalogue;
  const ui = { lineBreak: "saut de ligne", unresolvedRef: "Renvoi à résoudre" } as Ui;

  test("resolves an id to th, plain title and localised href", () => {
    const o = markupOptions(ui, "en", cat);
    expect(o.resolve("wiener-konzert")).toEqual({
      th: "45",
      title: "Wiener Konzert",
      href: "/en/works/wiener-konzert/",
    });
  });
  test("returns undefined for an unknown id", () => {
    expect(markupOptions(ui, "fr", cat).resolve("nope")).toBeUndefined();
  });
  test("passes the UI labels", () => {
    expect(markupOptions(ui, "fr", cat).labels).toEqual({
      lineBreak: "saut de ligne",
      unresolved: "Renvoi à résoudre",
    });
  });
});
