import { existsSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const page = (path: string) => parse(readFileSync(path, "utf8"));

describe("catalogue page", () => {
  it("lists the 82 works in 6 book sections (FR)", () => {
    const doc = page("dist/fr/catalogue/index.html");
    expect(doc.querySelectorAll("table.cat tbody tr")).toHaveLength(82);
    expect(doc.querySelectorAll("section.book")).toHaveLength(6);
  });

  it("has the filters and a link to each work", () => {
    const doc = page("dist/fr/catalogue/index.html");
    for (const id of ["f-book", "f-cat", "f-status", "f-q", "f-count"]) expect(doc.querySelector(`#${id}`)).not.toBeNull();
    expect(doc.querySelector('table.cat a[href="/fr/oeuvres/wiener-konzert/"]')).not.toBeNull();
    expect(doc.querySelector("#livre-1")).not.toBeNull();
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
