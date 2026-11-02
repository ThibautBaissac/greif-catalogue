import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { shouldRefuse } from "../../scripts/migrate/guard";

const tmp = () => mkdtempSync(join(tmpdir(), "guard-"));
const withWorks = (files: string[]) => {
  const content = tmp();
  mkdirSync(join(content, "works"));
  for (const f of files) writeFileSync(join(content, "works", f), "");
  return content;
};

describe("shouldRefuse", () => {
  test("allows a missing content/works", () => {
    expect(shouldRefuse(tmp(), [])).toBeUndefined();
  });
  test("allows an empty content/works", () => {
    expect(shouldRefuse(withWorks([]), [])).toBeUndefined();
  });
  test("ignores non-yaml files", () => {
    expect(shouldRefuse(withWorks([".gitkeep"]), [])).toBeUndefined();
  });
  test("refuses when a work file exists, and says why", () => {
    const msg = shouldRefuse(withWorks(["a.yaml"]), []);
    expect(msg).toContain("CMS");
    expect(msg).toContain("--force");
  });
  test("--force lifts the refusal", () => {
    expect(shouldRefuse(withWorks(["a.yaml"]), ["--force"])).toBeUndefined();
  });
});
