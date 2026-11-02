import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORK_COUNT } from "./helpers";

describe("open data", () => {
  it("catalogue.json parses and holds every work", () => {
    const data = JSON.parse(readFileSync("dist/data/catalogue.json", "utf8"));
    expect(data.works).toHaveLength(WORK_COUNT);
    expect(Object.keys(data)).toEqual(["generated", "works", "persons", "places", "institutions", "bibliography"]);
  });

  it("catalogue.json never exposes editorial notes", () => {
    expect(readFileSync("dist/data/catalogue.json", "utf8")).not.toContain("editorial_notes");
  });

  it("works.csv has a header and one row per work", () => {
    const lines = readFileSync("dist/data/works.csv", "utf8").split("\n").filter(l => l.trim() !== "");
    expect(lines[0].startsWith("id,th,")).toBe(true);
    expect(lines).toHaveLength(WORK_COUNT + 1);
  });
});
