import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("dist/index.html redirects to /fr/", () => {
  expect(readFileSync("dist/index.html", "utf8")).toContain("url=/fr/");
});

test("dist/fr/index.html mentions Olivier Greif", () => {
  expect(readFileSync("dist/fr/index.html", "utf8")).toContain("Olivier Greif");
});
