import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { dump, load } from "js-yaml";
import type { z } from "astro/zod";
import { validateCatalogue, type Entry } from "../../src/lib/catalogue";
import {
  bibliographySchema,
  booksFileSchema,
  institutionSchema,
  personSchema,
  placeSchema,
  roleSchema,
  workSchema,
} from "../../src/lib/schemas";
import type { ProtoWork } from "./authorities";
import { migrate } from "./works";

const [protoDir = "prototype", contentDir = "content"] = process.argv.slice(2);
const REPORT_PATH = "tasks/migration-report.md";

const SCHEMAS: Record<string, z.ZodType> = {
  works: workSchema,
  persons: personSchema,
  places: placeSchema,
  institutions: institutionSchema,
  roles: roleSchema,
  bibliography: bibliographySchema,
};

const worksDir = join(protoDir, "data", "works");
const works: ProtoWork[] = readdirSync(worksDir)
  .filter(f => f.endsWith(".yaml"))
  .sort()
  .map(f => {
    const w = load(readFileSync(join(worksDir, f), "utf8")) as ProtoWork;
    if (w.id !== basename(f, ".yaml")) throw new Error(`${f}: id « ${w.id} » différent du nom de fichier`);
    return w;
  });

const { files, report } = migrate(works, {
  incipitExists: (id, n) => existsSync(join(protoDir, "incipits", id, `${n}.png`)),
});

// Each generated file must pass its own schema; the schemas are the source of truth.
const problems: string[] = [];
const entries: Record<string, Entry<any>[]> = Object.fromEntries(Object.keys(SCHEMAS).map(d => [d, []]));
for (const [path, obj] of Object.entries(files)) {
  const [dir, file] = path.split("/");
  const id = basename(file, ".yaml");
  const parsed = SCHEMAS[dir].safeParse(obj);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) problems.push(`${path}: ${issue.path.join(".")} : ${issue.message}`);
  } else entries[dir].push({ id, data: parsed.data });
}

const books = booksFileSchema.parse(load(readFileSync(join(contentDir, "books.yaml"), "utf8"))).books;
for (const e of validateCatalogue({
  works: entries.works,
  persons: entries.persons,
  places: entries.places,
  institutions: entries.institutions,
  roles: entries.roles,
  bibliography: entries.bibliography,
  books,
})) {
  problems.push(`${e.file}: ${e.path} : ${e.message}`);
}

// Regenerate from scratch: stale generated files must not survive a rerun. books.yaml is never touched.
for (const dir of Object.keys(SCHEMAS)) {
  const target = join(contentDir, dir);
  mkdirSync(target, { recursive: true });
  for (const f of readdirSync(target)) if (f.endsWith(".yaml")) rmSync(join(target, f));
}
for (const [path, obj] of Object.entries(files)) {
  writeFileSync(join(contentDir, path), dump(obj, { lineWidth: -1, noRefs: true }));
}

const counts = Object.keys(SCHEMAS).map(d => `${d}: ${Object.keys(files).filter(p => p.startsWith(`${d}/`)).length}`);
const section = (title: string, lines: string[]) =>
  lines.length ? `## ${title}\n\n${lines.map(l => `- ${l}`).join("\n")}\n` : `## ${title}\n\nAucune.\n`;
const markdown = [
  "# Rapport de migration",
  "",
  `Fichiers générés : ${counts.join(", ")}.`,
  "",
  section("Erreurs (schéma et renvois)", problems),
  section("Anomalies", report),
].join("\n");
mkdirSync("tasks", { recursive: true });
writeFileSync(REPORT_PATH, markdown);

console.log(`${counts.join(", ")}`);
console.log(markdown);
console.log(`Rapport écrit dans ${REPORT_PATH}`);
process.exit(problems.length > 0 ? 1 : 0);
