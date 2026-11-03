// Reads and rewrites the Th of the work files, without dependencies, so it runs under plain Node.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readThLine, writeThLine, type ThMap } from "../src/lib/renumber.ts";

export const WORKS_DIR = "content/works";

const idOf = (file: string) => file.replace(/\.yaml$/, "");

/** Work id -> Th, from the working tree. */
export function readWorkThs(dir = WORKS_DIR): ThMap {
  const ths: ThMap = {};
  for (const file of readdirSync(dir).filter(f => f.endsWith(".yaml"))) {
    const th = readThLine(readFileSync(join(dir, file), "utf8"));
    if (th !== undefined) ths[idOf(file)] = th;
  }
  return ths;
}

/** Work id -> Th, from `git grep` output on one commit (`<sha>:content/works/<id>.yaml:th: '4'`). */
export function parseGitGrep(output: string): ThMap {
  const ths: ThMap = {};
  for (const line of output.split("\n")) {
    const m = /^[^:]+:(?:.*\/)?([^/:]+)\.yaml:(th:.*)$/.exec(line);
    const th = m ? readThLine(m[2]) : undefined;
    if (m && th !== undefined) ths[m[1]] = th;
  }
  return ths;
}

export function writeWorkTh(id: string, th: string, dir = WORKS_DIR): void {
  const path = join(dir, `${id}.yaml`);
  writeFileSync(path, writeThLine(readFileSync(path, "utf8"), th));
}
