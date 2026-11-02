import { existsSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { WORK_COUNT } from "./helpers";

const page = (path: string) => parse(readFileSync(path, "utf8"));

describe("catalogue page", () => {
  it("lists every work in 6 book sections (FR)", () => {
    const doc = page("dist/fr/catalogue/index.html");
    expect(doc.querySelectorAll("table.cat tbody tr")).toHaveLength(WORK_COUNT);
    expect(doc.querySelectorAll("section.book")).toHaveLength(6);
  });

  it("has the filters and a link to each work", () => {
    const doc = page("dist/fr/catalogue/index.html");
    for (const id of ["f-book", "f-cat", "f-status", "f-q", "f-count"]) expect(doc.querySelector(`#${id}`)).not.toBeNull();
    expect(doc.querySelector('table.cat a[href="/fr/oeuvres/wiener-konzert/"]')).not.toBeNull();
    expect(doc.querySelector("#livre-1")).not.toBeNull();
  });

  it("shows the lede and labels the filter group, in both languages", () => {
    const fr = page("dist/fr/catalogue/index.html");
    expect(fr.querySelector("p.lede")?.text).toBe("Les œuvres dans l'ordre des Livres et des numéros Th.");
    expect(fr.querySelector(".filters")?.getAttribute("aria-label")).toBe("Filtres du catalogue");
    const en = page("dist/en/catalogue/index.html");
    expect(en.querySelector("p.lede")?.text).toBe("Works in the order of the Books and Th numbers.");
    expect(en.querySelector(".filters")?.getAttribute("aria-label")).toBe("Catalogue filters");
  });

  it("marks empty books as in preparation", () => {
    const empty = page("dist/fr/catalogue/index.html").querySelectorAll("section.book").filter(s => !s.querySelector("table"));
    expect(empty.length).toBeGreaterThan(0);
    expect(empty[0].text).toContain("En préparation");
  });

  it("exists in English with English work links", () => {
    expect(existsSync("dist/en/catalogue/index.html")).toBe(true);
    expect(page("dist/en/catalogue/index.html").querySelector('table.cat a[href="/en/works/wiener-konzert/"]')).not.toBeNull();
  });
});

describe("home page", () => {
  it("shows four statistics and six book cards (FR)", () => {
    const doc = page("dist/fr/index.html");
    expect(doc.querySelectorAll(".stats div")).toHaveLength(4);
    expect(doc.querySelectorAll("ol.books li")).toHaveLength(6);
  });

  it("exists in English", () => {
    expect(page("dist/en/index.html").querySelector("html")?.getAttribute("lang")).toBe("en");
  });
});
