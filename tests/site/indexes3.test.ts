import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index pages, part 3", () => {
  it.each([
    "dist/fr/manuscrits/index.html",
    "dist/en/manuscripts/index.html",
    "dist/fr/editions/index.html",
    "dist/fr/bibliographie/index.html",
    "dist/en/bibliography/index.html",
    "dist/fr/discographie/index.html",
    "dist/en/discography/index.html",
    "dist/fr/carnet-de-bord/index.html",
    "dist/en/journal/index.html",
  ])("%s exists", path => {
    expect(existsSync(path)).toBe(true);
  });

  it("journal has a section per year, anchored #j<year>", () => {
    const html = readFileSync("dist/fr/carnet-de-bord/index.html", "utf8");
    expect(html).toContain('id="j1973"');
    expect(html).toContain('href="#j1973"');
  });

  it("every page of the part is linked from the hub", () => {
    const hub = readFileSync("dist/fr/index-general/index.html", "utf8");
    for (const p of ["manuscrits", "editions", "bibliographie", "discographie", "carnet-de-bord"]) {
      expect(hub).toContain(`/fr/${p}/`);
    }
  });
});
