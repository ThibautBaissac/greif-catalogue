import { describe, expect, test } from "vitest";
import { isConsistent, readThLine, renumber, RenumberError, thChanges, type ThMap, writeThLine } from "~/lib/renumber";

/** `seq(5)` -> { w1: "1", ..., w5: "5" }. */
const seq = (n: number): ThMap => Object.fromEntries(Array.from({ length: n }, (_, i) => [`w${i + 1}`, String(i + 1)]));

describe("isConsistent", () => {
  test("accepts contiguous numbers from 1, with suffix groups", () => {
    expect(isConsistent({})).toBe(true);
    expect(isConsistent(seq(5))).toBe(true);
    expect(isConsistent({ a: "1", b: "2a", c: "2b", d: "3" })).toBe(true);
  });
  test("rejects a duplicate", () => {
    expect(isConsistent({ ...seq(5), x: "3" })).toBe(false);
    expect(isConsistent({ a: "1", b: "2a", c: "2a" })).toBe(false);
    expect(isConsistent({ a: "1", b: "2a", x: "2" })).toBe(false);
  });
  test("rejects a gap or a start other than 1", () => {
    expect(isConsistent({ a: "1", b: "3" })).toBe(false);
    expect(isConsistent({ a: "2", b: "3" })).toBe(false);
  });
});

describe("renumber", () => {
  test("leaves a consistent head untouched", () => {
    expect(renumber(seq(5), seq(5))).toEqual(seq(5));
  });

  test("a new work at Th 3 pushes Th 3 and the following ones up by one", () => {
    expect(renumber(seq(5), { ...seq(5), x: "3" })).toEqual({ w1: "1", w2: "2", x: "3", w3: "4", w4: "5", w5: "6" });
  });

  test("moving a work back closes its old slot and opens the new one", () => {
    expect(renumber(seq(6), { ...seq(6), w5: "2" })).toEqual({ w1: "1", w5: "2", w2: "3", w3: "4", w4: "5", w6: "6" });
  });

  test("moving a work forward pulls the works in between down", () => {
    expect(renumber(seq(6), { ...seq(6), w2: "5" })).toEqual({ w1: "1", w3: "2", w4: "3", w5: "4", w2: "5", w6: "6" });
  });

  test("deleting a work closes the gap", () => {
    const { w3: _, ...head } = seq(5);
    expect(renumber(seq(5), head)).toEqual({ w1: "1", w2: "2", w4: "3", w5: "4" });
  });

  test("a suffix group moves as one block and keeps its letters", () => {
    const base = { a: "1", b: "2a", c: "2b", d: "3" };
    expect(renumber(base, { ...base, x: "2" })).toEqual({ a: "1", x: "2", b: "3a", c: "3b", d: "4" });
  });

  test("a new suffixed work joins the existing group without shifting anything", () => {
    const base = { a: "1", b: "2a", c: "2b", d: "3" };
    expect(renumber(base, { ...base, x: "2c" })).toEqual({ ...base, x: "2c" });
  });

  test("a target past the end lands on the last slot", () => {
    expect(renumber(seq(4), { ...seq(4), w1: "99" })).toEqual({ w2: "1", w3: "2", w4: "3", w1: "4" });
  });

  test("several edits since the base are applied together", () => {
    expect(renumber(seq(4), { ...seq(4), x: "1", w4: "2" })).toEqual({ x: "1", w4: "2", w1: "3", w2: "4", w3: "5" });
  });

  test("refuses two edited works aiming at the same Th", () => {
    expect(() => renumber(seq(3), { ...seq(3), x: "2", y: "2" })).toThrow(RenumberError);
  });

  test("refuses an edited work that takes a suffixed Th already used", () => {
    const base = { a: "1", b: "2a", c: "2b" };
    expect(() => renumber(base, { ...base, x: "2b" })).toThrow(RenumberError);
  });
});

describe("thChanges", () => {
  test("lists the works whose Th differs, in new Th order", () => {
    expect(thChanges({ a: "1", b: "2", c: "3", x: "2" }, { a: "1", x: "2", b: "3", c: "4" })).toEqual([
      { id: "b", from: "2", to: "3" },
      { id: "c", from: "3", to: "4" },
    ]);
  });
});

describe("th line", () => {
  const yaml = "title: Petite Suite\nth: '4'\nbook: 1\nmovements:\n  - th: '9'\n";
  test("reads the top-level Th in Keystatic's quoting", () => {
    expect(readThLine(yaml)).toBe("4");
    expect(readThLine("title: X\nth: 35b\n")).toBe("35b");
    expect(readThLine("title: X\n")).toBeUndefined();
  });
  test("rewrites only that line, quoting digits so YAML keeps a string", () => {
    expect(writeThLine(yaml, "5")).toBe(yaml.replace("th: '4'", "th: '5'"));
    expect(writeThLine(yaml, "36a")).toBe(yaml.replace("th: '4'", "th: 36a"));
  });
});
