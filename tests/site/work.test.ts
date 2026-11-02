import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { WORK_COUNT } from "./helpers";

const page = (path: string) => parse(readFileSync(path, "utf8"));
const FR = "dist/fr/oeuvres/wiener-konzert/index.html";
const EN = "dist/en/works/wiener-konzert/index.html";

describe("work entry, FR", () => {
  it("exists with the title and the Th number", () => {
    expect(existsSync(FR)).toBe(true);
    const doc = page(FR);
    expect(doc.querySelector("h1")?.text).toContain("Wiener Konzert");
    expect(doc.querySelector(".th-big")?.text).toContain("45");
  });

  it("renders the sections in order", () => {
    const ids = page(FR)
      .querySelectorAll("section.field, section.cite")
      .map(s => s.id);
    const expected = ["textes", "dedicace", "sources", "executions", "carnet", "bibliographie", "liens", "citer"];
    expect(ids.filter(id => expected.includes(id))).toEqual(expected);
    const known = ["textes", "dedicace", "sources", "remarques", "intertexte", "edition", "executions", "carnet",
      "documents", "bibliographie", "discographie", "videographie", "liens", "redaction", "citer"];
    expect(ids.every(id => known.includes(id))).toBe(true);
    expect(known.filter(id => ids.includes(id))).toEqual(ids);
  });

  it("marks exactly one premiere row", () => {
    const rows = page(FR).querySelectorAll("#executions tbody tr.is-premiere");
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain("24 avril 1974");
  });

  it("links related works with their relation label", () => {
    const link = page(FR).querySelector('#liens a[href="/fr/oeuvres/light-music/"]');
    expect(link).not.toBeNull();
    expect(page(FR).querySelector("#liens")?.text).toContain("Matériau partagé");
  });

  it("links persons to their anchor on the people page", () => {
    const hrefs = page(FR).querySelectorAll("a.pl").map(a => a.getAttribute("href"));
    expect(hrefs).toContain("/fr/personnes/#heinrich-heine");
  });

  it("renders the placeholder for a missing incipit, without a file path", () => {
    const ph = page(FR).querySelector(".staff-ph");
    expect(ph?.text).toContain("Incipit à venir");
    expect(ph?.querySelector("code")).toBeNull();
  });

  it("carries the Pagefind markers and JSON-LD", () => {
    const doc = page(FR);
    expect(doc.querySelector("article.notice")?.getAttribute("data-pagefind-body")).not.toBeUndefined();
    expect(doc.querySelector('[data-pagefind-filter="Livre"]')?.text).toBe("Livre I");
    expect(doc.querySelector('[data-pagefind-filter="Effectif"]')?.text).toBe("Voix et piano");
    expect(page(EN).querySelector('[data-pagefind-filter="Scoring"]')?.text).toBe("Voice and piano");
    expect(doc.querySelector('[data-pagefind-meta="th"]')?.text).toBe("45");
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.text);
    expect(ld["@type"]).toBe("MusicComposition");
    expect(ld.dateCreated).toBe("1973-11-26");
  });

  it("has a citation with the Th number", () => {
    expect(page(FR).querySelector("#citer .cite-text")?.text).toContain("Th 45");
  });
});

describe("work entry, EN", () => {
  it("is an English page with the French-text note", () => {
    const doc = page(EN);
    expect(doc.querySelector("html")?.getAttribute("lang")).toBe("en");
    expect(doc.querySelector(".lang-note")).not.toBeNull();
  });

  it("formats the composition date and shows the English scoring", () => {
    const facts = page(EN).querySelector(".facts")!.text;
    expect(facts).toContain("26 November 1973");
    expect(facts).toContain("Female voice and piano");
  });

  it("flags French descriptive text with lang=fr", () => {
    expect(page(EN).querySelectorAll('#sources [lang="fr"]').length).toBeGreaterThan(0);
  });

  it("links to the French page as the other language", () => {
    expect(page(EN).querySelector("a.lang")?.getAttribute("href")).toBe("/fr/oeuvres/wiener-konzert/");
  });
});

describe("work entry labels come from content/ui", () => {
  it.each([[FR, "Fil d'Ariane", "Notice précédente et suivante"], [EN, "Breadcrumb", "Previous and next entry"]])(
    "%s names its breadcrumb and pager",
    (path, crumbs, pager) => {
      const doc = page(path);
      expect(doc.querySelector("nav.crumbs")?.getAttribute("aria-label")).toBe(crumbs);
      expect(doc.querySelector("nav.pager")?.getAttribute("aria-label")).toBe(pager);
    },
  );
});

describe("all work pages", () => {
  it.each([["fr", "oeuvres"], ["en", "works"]])("has one page per work for %s", (lang, dir) => {
    const dirs = readdirSync(`dist/${lang}/${dir}`).filter(d => existsSync(`dist/${lang}/${dir}/${d}/index.html`));
    expect(dirs).toHaveLength(WORK_COUNT);
  });

  it.skipIf(process.env.CATALOGUE_EDITORIAL === "1")("hides editorial notes in the public build", () => {
    const bad = readdirSync("dist/fr/oeuvres").filter(d =>
      readFileSync(`dist/fr/oeuvres/${d}/index.html`, "utf8").includes("is-editorial"),
    );
    expect(bad).toEqual([]);
  });
});
