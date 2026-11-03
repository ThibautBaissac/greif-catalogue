import { describe, expect, test } from "vitest";
import { parseGitGrep } from "../../scripts/th-files";

describe("parseGitGrep", () => {
  test("maps each work file of a commit to its Th", () => {
    const out = "abc123:content/works/petite-suite.yaml:th: '3'\nabc123:content/works/etude-35b.yaml:th: 35b\n";
    expect(parseGitGrep(out)).toEqual({ "petite-suite": "3", "etude-35b": "35b" });
  });
});
