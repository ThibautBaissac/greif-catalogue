import { describe, expect, test } from "vitest";
import { compareTh, thKey } from "~/lib/th";

describe("thKey", () => {
  test("encodes number and letter suffix", () => {
    expect(thKey("35b")).toBe(352);
    expect(thKey("7")).toBe(70);
  });
  test("is Infinity for a non-conforming value", () => {
    expect(thKey("X")).toBe(Infinity);
  });
});

describe("compareTh", () => {
  test("orders numerically, then by letter", () => {
    expect(["10", "2a", "2", "35b", "35a"].sort(compareTh)).toEqual(["2", "2a", "10", "35a", "35b"]);
  });
});
