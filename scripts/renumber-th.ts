// Renumbers the Th after an edit made in Keystatic: run by the GitHub Action on every push to main.
// The base is the most recent commit whose Th are consistent; the working tree is the head.
// Usage: node scripts/renumber-th.ts [--commit]
import { execFileSync } from "node:child_process";
import { isConsistent, renumber, RenumberError, thChanges, type ThMap } from "../src/lib/renumber.ts";
import { parseGitGrep, readWorkThs, WORKS_DIR, writeWorkTh } from "./th-files.ts";

const MAX_DEPTH = 200;
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

function thsAt(sha: string): ThMap {
  try {
    return parseGitGrep(git("grep", "-e", "^th:", sha, "--", WORKS_DIR));
  } catch {
    return {}; // git grep exits 1 when nothing matches
  }
}

function findBase(): { sha: string; ths: ThMap } {
  for (const sha of git("rev-list", "--first-parent", `--max-count=${MAX_DEPTH}`, "HEAD").split("\n").filter(Boolean)) {
    const ths = thsAt(sha);
    if (isConsistent(ths)) return { sha, ths };
  }
  throw new RenumberError(`aucun commit aux Th cohérents dans les ${MAX_DEPTH} derniers`);
}

const head = readWorkThs();
if (isConsistent(head)) {
  console.log("Th cohérents : rien à renuméroter.");
  process.exit(0);
}

try {
  const base = findBase();
  const result = renumber(base.ths, head);
  const changes = thChanges(head, result);
  for (const { id, to } of changes) writeWorkTh(id, to);

  const edited = Object.keys(head).filter(id => base.ths[id] !== head[id]).sort();
  const lines = changes.map(c => `${c.id}: Th ${c.from} -> Th ${c.to}`);
  console.log(`Base ${base.sha.slice(0, 7)}, œuvres éditées : ${edited.join(", ")}`);
  console.log(lines.join("\n"));

  if (process.argv.includes("--commit")) {
    git("add", WORKS_DIR);
    git("commit", "-m", `Renumber Th after editing ${edited.join(", ")}`, "-m", lines.join("\n"));
  }
} catch (e) {
  if (!(e instanceof RenumberError)) throw e;
  console.error(`Renumérotation impossible : ${e.message}`);
  process.exit(1);
}
