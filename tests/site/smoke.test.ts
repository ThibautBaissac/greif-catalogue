import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("dist/index.html mentions Olivier Greif", () => {
  const html = readFileSync("dist/index.html", "utf8");
  expect(html).toContain("Olivier Greif");
});
