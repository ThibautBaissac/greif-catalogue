import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const page = (path: string) => parse(readFileSync(path, "utf8"));

describe("editable pages", () => {
  it("French about page lists abbreviations in a table", () => {
    const html = readFileSync("dist/fr/a-propos/index.html", "utf8");
    expect(html).toContain("F-Pbmgf");
    expect(page("dist/fr/a-propos/index.html").querySelector("table")).not.toBeNull();
  });

  it("English about page has the abbreviations heading", () => {
    expect(readFileSync("dist/en/about/index.html", "utf8")).toContain("Abbreviations");
  });

  it("the home introduction comes from the pages collection", () => {
    expect(page("dist/fr/index.html").querySelector(".hero .lede")?.text).toContain("six Livres");
    expect(page("dist/en/index.html").querySelector(".hero .lede")?.text).toContain("six Books");
  });
});

describe("not found page", () => {
  it("provides a custom error page in the generated site", () => {
    const root = page("dist/404.html");

    expect(root.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(root.querySelector('[data-not-found-page="fr"] h1')?.text.trim()).toBe("Page introuvable");
    expect(root.querySelector('[data-not-found-page="en"] h1')?.text.trim()).toBe("Page not found");
  });

  it("offers localized routes back into the catalogue", () => {
    const root = page("dist/404.html");

    expect(root.querySelector('[data-not-found-page="fr"] .error-actions .btn')?.getAttribute("href")).toBe("/fr/");
    expect(root.querySelector('[data-not-found-page="fr"] .error-search')?.getAttribute("href")).toBe("/fr/recherche/");
    expect(root.querySelector('[data-not-found-page="en"] .error-actions .btn')?.getAttribute("href")).toBe("/en/");
    expect(root.querySelector('[data-not-found-page="en"] .error-search')?.getAttribute("href")).toBe("/en/search/");
  });
});

describe("search", () => {
  it("builds a Pagefind index per language and the JS API", () => {
    expect(existsSync("dist/pagefind/pagefind.js")).toBe(true);
    const metas = readdirSync("dist/pagefind").filter(f => f.endsWith(".pf_meta"));
    expect(metas.some(f => f.startsWith("pagefind.fr"))).toBe(true);
    expect(metas.some(f => f.startsWith("pagefind.en"))).toBe(true);
  });

  it.each([
    ["dist/fr/recherche/index.html", "fr"],
    ["dist/en/search/index.html", "en"],
  ])("%s has the custom search form and no default UI", (path, lang) => {
    const root = page(path);
    expect(root.querySelector("form.search-form #sq")).not.toBeNull();
    expect(root.querySelector("#sq-count")).not.toBeNull();
    expect(root.querySelector("ol.results#sq-results")).not.toBeNull();
    expect(readFileSync(path, "utf8")).not.toContain("pagefind-ui");
    expect(root.querySelector("html")?.getAttribute("lang")).toBe(lang);
  });

  it("the home search form targets the search page", () => {
    expect(page("dist/fr/index.html").querySelector("form.hero-search")?.getAttribute("action")).toBe("/fr/recherche/");
  });
});
