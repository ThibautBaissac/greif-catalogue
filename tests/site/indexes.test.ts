import { existsSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const page = (path: string) => parse(readFileSync(path, "utf8"));

describe("index pages, part 1", () => {
  it.each([
    "dist/fr/index-general/index.html",
    "dist/fr/chronologie/index.html",
    "dist/en/chronology/index.html",
    "dist/fr/opus/index.html",
    "dist/fr/titres/index.html",
    "dist/fr/incipits-litteraires/index.html",
    "dist/fr/effectifs/index.html",
    "dist/en/indexes/index.html",
  ])("%s exists", path => {
    expect(existsSync(path)).toBe(true);
  });

  it("hub lists the 13 public indexes", () => {
    expect(page("dist/fr/index-general/index.html").querySelectorAll("ul.idx-grid li")).toHaveLength(
      process.env.CATALOGUE_EDITORIAL === "1" ? 14 : 13,
    );
  });

  it.skipIf(process.env.CATALOGUE_EDITORIAL === "1")("hub has no link to the editorial dashboard", () => {
    expect(page("dist/fr/index-general/index.html").querySelector('a[href="/fr/redaction/"]')).toBeNull();
  });

  it("chronology has one section per year and an unknown-date section last", () => {
    const sections = page("dist/fr/chronologie/index.html").querySelectorAll("section.yr");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.at(-1)?.id).toBe("y-unknown");
    expect(page("dist/fr/chronologie/index.html").querySelectorAll(".yearstrip a").length).toBeGreaterThan(10);
  });

  it("opus page has two tables", () => {
    expect(page("dist/fr/opus/index.html").querySelectorAll("table.cat")).toHaveLength(2);
  });

  it("titles page has letter sections and a letter nav", () => {
    const doc = page("dist/fr/titres/index.html");
    expect(doc.querySelectorAll("section.letter").length).toBeGreaterThan(5);
    expect(doc.querySelector('nav.letters a[href="#l-W"]')).not.toBeNull();
  });

  it("text incipits list Wiener Konzert", () => {
    expect(page("dist/fr/incipits-litteraires/index.html").text).toContain("Vergiftet sind meine Lieder");
  });

  it("scoring page lists the categories", () => {
    expect(page("dist/fr/effectifs/index.html").querySelector("#c-voice-piano")).not.toBeNull();
  });
});
