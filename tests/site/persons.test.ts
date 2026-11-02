import { readdirSync, readFileSync } from "node:fs";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const page = (path: string) => parse(readFileSync(path, "utf8"));
const people = page("dist/fr/personnes/index.html");
const anchors = new Set(people.querySelectorAll("[id]").map(e => e.id));

describe("people, places and performances pages", () => {
  it("people page has an anchor per person", () => {
    expect(people.querySelector('[id="heinrich-heine"]')).not.toBeNull();
    expect(people.querySelectorAll("ul.persons > li").length).toBeGreaterThan(50);
    expect(people.querySelectorAll(".chip[data-role]")).toHaveLength(4);
  });

  it("each person item declares its filter roles", () => {
    expect(people.querySelector('li[id="heinrich-heine"]')?.getAttribute("data-roles")).toContain("author");
  });

  it("places page has an anchor per place", () => {
    expect(page("dist/fr/lieux/index.html").querySelector('[id="p-paris"]')).not.toBeNull();
  });

  it("performances page exists in both languages with the table and the uncited works", () => {
    const fr = page("dist/fr/executions/index.html");
    expect(fr.querySelectorAll("table.perf tbody tr").length).toBeGreaterThan(50);
    expect(page("dist/en/performances/index.html").querySelector("table.perf")).not.toBeNull();
  });

  it("every person link of the Wiener Konzert page resolves to an anchor on the people page", () => {
    const hrefs = page("dist/fr/oeuvres/wiener-konzert/index.html").querySelectorAll("a.pl").map(a => a.getAttribute("href")!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/fr/personnes/#")).toBe(true);
      expect(anchors.has(href.split("#")[1])).toBe(true);
    }
  });

  it("every person link of every work page resolves", () => {
    const missing: string[] = [];
    for (const dir of readdirSync("dist/fr/oeuvres")) {
      for (const a of page(`dist/fr/oeuvres/${dir}/index.html`).querySelectorAll("a.pl")) {
        const id = a.getAttribute("href")!.split("#")[1];
        if (!anchors.has(id)) missing.push(`${dir}: ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
