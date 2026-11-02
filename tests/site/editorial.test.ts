import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORK_COUNT } from "./helpers";

const editorial = process.env.CATALOGUE_EDITORIAL === "1";

describe("public build", () => {
  it.skipIf(editorial)("has no dashboard", () => {
    expect(existsSync("dist/fr/redaction")).toBe(false);
    expect(existsSync("dist/en/editorial")).toBe(false);
  });

  it.skipIf(editorial)("has no editorial note on any work page", () => {
    const bad = readdirSync("dist/fr/oeuvres").filter(d =>
      readFileSync(`dist/fr/oeuvres/${d}/index.html`, "utf8").includes('class="field is-editorial"'),
    );
    expect(bad).toEqual([]);
  });

  it.skipIf(editorial)("shows the public footer status", () => {
    expect(readFileSync("dist/fr/index.html", "utf8")).toContain("Version de travail");
  });
});

describe("editorial build", () => {
  it.runIf(editorial)("has a noindex dashboard in both languages", () => {
    for (const path of ["dist/fr/redaction/index.html", "dist/en/editorial/index.html"]) {
      expect(readFileSync(path, "utf8")).toContain('<meta name="robots" content="noindex">');
    }
  });

  it.runIf(editorial)("the dashboard has one row per work", () => {
    const html = readFileSync("dist/fr/redaction/index.html", "utf8");
    expect(html.match(/<tr>/g)?.length).toBe(WORK_COUNT + 1);
  });

  it.runIf(editorial)("work pages carry editorial notes and link to them", () => {
    const html = readFileSync("dist/fr/oeuvres/wiener-konzert/index.html", "utf8");
    expect(html).toContain("#redaction");
    expect(html).toContain('class="field is-editorial"');
  });

  it.runIf(editorial)("the footer says the build is editorial", () => {
    expect(readFileSync("dist/fr/index.html", "utf8")).toContain("Version éditoriale");
  });
});
