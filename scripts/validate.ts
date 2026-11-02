import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { load } from "js-yaml";
import type { z } from "astro/zod";
import { assembleCatalogueInput, validateCatalogue, type Entry, type ValidationError } from "../src/lib/catalogue";
import { booksFileSchema, COLLECTION_SCHEMAS, type CollectionDir } from "../src/lib/schemas";
import { uiSchema } from "../src/lib/ui-schema";

const contentDir = process.argv[2] ?? "content";

const errors: ValidationError[] = [];
const report = (file: string, issues: z.core.$ZodIssue[]) => {
  for (const issue of issues) errors.push({ file, path: issue.path.join("."), message: issue.message });
};

function parseFile<S extends z.ZodType>(file: string, label: string, schema: S): z.output<S> | undefined {
  let raw: unknown;
  try {
    raw = load(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push({ file: label, path: "", message: `YAML illisible : ${(e as Error).message.split("\n")[0]}` });
    return undefined;
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  report(label, parsed.error.issues);
  return undefined;
}

const entries = (dir: CollectionDir): Entry<unknown>[] =>
  readdirSync(join(contentDir, dir))
    .filter(f => f.endsWith(".yaml"))
    .sort()
    .flatMap(f => {
      const id = basename(f, ".yaml");
      const data = parseFile(join(contentDir, dir, f), `${dir}/${id}`, COLLECTION_SCHEMAS[dir]);
      return data === undefined ? [] : [{ id, data }];
    });

const input = await assembleCatalogueInput(
  entries,
  parseFile(join(contentDir, "books.yaml"), "books", booksFileSchema)?.books ?? [],
);
for (const lang of ["fr", "en"]) parseFile(join(contentDir, "ui", `${lang}.yaml`), `ui/${lang}`, uiSchema);

// Cross-reference checks need every file to parse: a schema error already explains the rest.
if (errors.length === 0) errors.push(...validateCatalogue(input));

for (const e of errors) console.log(`${e.file} › ${e.path} : ${e.message}`);
console.log(`${errors.length} erreur${errors.length > 1 ? "s" : ""}`);
process.exit(errors.length > 0 ? 1 : 0);
