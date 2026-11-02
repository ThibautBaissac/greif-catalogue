import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("open data", () => {
  it("catalogue.json parses and holds the 82 works", () => {
    const data = JSON.parse(readFileSync("dist/data/catalogue.json", "utf8"));
    expect(data.works).toHaveLength(82);
    expect(Object.keys(data)).toEqual(["generated", "works", "persons", "places", "institutions", "bibliography"]);
  });

  it("catalogue.json never exposes editorial notes", () => {
    expect(readFileSync("dist/data/catalogue.json", "utf8")).not.toContain("editorial_notes");
  });

  it("works.csv has a header and 82 rows", () => {
    const lines = readFileSync("dist/data/works.csv", "utf8").split("\n").filter(l => l.trim() !== "");
    expect(lines[0].startsWith("id,th,")).toBe(true);
    expect(lines).toHaveLength(83);
  });
});
