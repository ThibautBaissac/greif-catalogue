import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const run = (dir: string) => spawnSync("npx", ["tsx", "scripts/validate.ts", dir], { encoding: "utf8" });

describe("scripts/validate.ts", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "greif-content-"));
    cpSync("content", dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("exits 0 on the migrated content", () => {
    const result = run(dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0 erreur");
  });

  test("reports a schema error as `file › path : message` and exits 1", () => {
    const file = join(dir, "works", "wiener-konzert.yaml");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, original.replace(/^th: .*$/m, "th: abc"));
    const result = run(dir);
    writeFileSync(file, original);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/works\/wiener-konzert › th : /);
  });

  test("reports a dangling reference found by validateCatalogue and exits 1", () => {
    const file = join(dir, "works", "wiener-konzert.yaml");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, original.replace("person: heinrich-heine", "person: personne-inconnue"));
    const result = run(dir);
    writeFileSync(file, original);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/works\/wiener-konzert › text\.authors\.0\.person : /);
  });
});
