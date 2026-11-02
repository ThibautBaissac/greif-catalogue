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

describe("search", () => {
  it("builds a Pagefind index per language and the UI assets", () => {
    expect(existsSync("dist/pagefind/pagefind-ui.js")).toBe(true);
    expect(existsSync("dist/pagefind/pagefind-ui.css")).toBe(true);
    const metas = readdirSync("dist/pagefind").filter(f => f.endsWith(".pf_meta"));
    expect(metas.some(f => f.startsWith("pagefind.fr"))).toBe(true);
    expect(metas.some(f => f.startsWith("pagefind.en"))).toBe(true);
  });

  it.each([
    ["dist/fr/recherche/index.html", "fr"],
    ["dist/en/search/index.html", "en"],
  ])("%s has the search container", (path, lang) => {
    const root = page(path);
    expect(root.querySelector("#search")).not.toBeNull();
    expect(root.querySelector("html")?.getAttribute("lang")).toBe(lang);
  });

  it("the home search form targets the search page", () => {
    expect(page("dist/fr/index.html").querySelector("form.hero-search")?.getAttribute("action")).toBe("/fr/recherche/");
  });
});
