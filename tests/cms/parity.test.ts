import { describe, expect, test } from "vitest";
import config from "../../keystatic.config";
import {
  bibliographySchema,
  booksFileSchema,
  institutionSchema,
  personSchema,
  placeSchema,
  roleSchema,
  workSchema,
} from "~/lib/schemas";
import { uiSchema } from "~/lib/ui-schema";

type Def = { type: string; shape?: Record<string, unknown>; element?: unknown; innerType?: unknown; out?: unknown };
const defOf = (schema: unknown): Def => (schema as { _zod: { def: Def } })._zod.def;

/** Strips Zod 4 wrappers: optional, nullable, default, and the pipe made by `z.preprocess`. */
function unwrap(schema: unknown): unknown {
  const def = defOf(schema);
  if (def.type === "optional" || def.type === "nullable" || def.type === "default") return unwrap(def.innerType);
  if (def.type === "pipe") return unwrap(def.out);
  return schema;
}

/** Every key path of a Zod schema; arrays contribute `[]`. */
function zodPaths(schema: unknown, prefix = ""): string[] {
  const def = defOf(unwrap(schema));
  if (def.type === "object") {
    return Object.entries(def.shape ?? {}).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...zodPaths(child, path)];
    });
  }
  if (def.type === "array") {
    // An array of enum values is a Keystatic `multiselect`, which is a single leaf field.
    if (defOf(unwrap(def.element)).type === "enum") return [];
    const path = `${prefix}.[]`;
    return [path, ...zodPaths(def.element, path)];
  }
  return [];
}

type KField = { kind: string; fields?: Record<string, KField>; element?: KField };

/** Every key path of a Keystatic schema; a `fields.slug` is a leaf under its own key. */
function keystaticPaths(fields: Record<string, KField>, prefix = ""): string[] {
  return Object.entries(fields).flatMap(([key, field]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...fieldPaths(field, path)];
  });
}

function fieldPaths(field: KField, path: string): string[] {
  if (field.kind === "object") return keystaticPaths(field.fields ?? {}, path);
  if (field.kind === "array") {
    const element = `${path}.[]`;
    return [element, ...fieldPaths(field.element as KField, element)];
  }
  return [];
}

const sorted = (paths: string[]) => [...paths].sort();
const zodSet = (schema: unknown) => sorted(zodPaths(schema));
const keystaticSet = (fields: unknown) => sorted(keystaticPaths(fields as Record<string, KField>));

const collection = (name: string) => (config.collections as Record<string, { schema: unknown }>)[name].schema;
const singleton = (name: string) => (config.singletons as Record<string, { schema: unknown }>)[name].schema;

describe("Zod ↔ Keystatic parity", () => {
  test("works", () => {
    const paths = keystaticSet(collection("works"));
    expect(paths).toEqual(zodSet(workSchema));
    expect(paths).toContain("movements.[].incipit");
    expect(paths).toContain("performances.[].performers.[].role");
  });

  test.each([
    ["persons", personSchema],
    ["places", placeSchema],
    ["institutions", institutionSchema],
    ["roles", roleSchema],
    ["bibliography", bibliographySchema],
  ])("%s", (name, schema) => {
    expect(keystaticSet(collection(name))).toEqual(zodSet(schema));
  });

  test("books singleton matches booksFileSchema", () => {
    expect(keystaticSet(singleton("books"))).toEqual(zodSet(booksFileSchema));
  });

  test.each(["uiFr", "uiEn"])("%s singleton matches uiSchema", name => {
    expect(keystaticSet(singleton(name))).toEqual(zodSet(uiSchema));
  });

  test("the comparison fails when Keystatic has a field Zod lacks", () => {
    const extra = { ...(collection("works") as Record<string, KField>), foo: { kind: "form" } };
    expect(keystaticSet(extra)).not.toEqual(zodSet(workSchema));
  });

  test("the comparison fails when Zod has a field Keystatic lacks", () => {
    const { title: _title, ...rest } = collection("works") as Record<string, KField>;
    expect(keystaticSet(rest)).not.toEqual(zodSet(workSchema));
  });

  test("Markdoc page collections exist and are excluded from the comparison", () => {
    expect(Object.keys(config.collections ?? {})).toEqual(expect.arrayContaining(["pagesFr", "pagesEn"]));
  });
});
