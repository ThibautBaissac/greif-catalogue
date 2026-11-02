import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { load as loadYaml } from "js-yaml";
import { bookSchema, booksFileSchema, COLLECTION_SCHEMAS } from "./lib/schemas";
import { uiSchema } from "./lib/ui-schema";

const yamlDir = <S extends z.ZodType>(dir: string, schema: S) =>
  defineCollection({ loader: glob({ pattern: "*.yaml", base: `./content/${dir}` }), schema });

/** One collection per entity directory of `COLLECTION_SCHEMAS`, keeping each key and schema type. */
const entityCollections = Object.fromEntries(
  Object.entries(COLLECTION_SCHEMAS).map(([dir, schema]) => [dir, yamlDir(dir, schema)]),
) as {
  [K in keyof typeof COLLECTION_SCHEMAS]: (typeof COLLECTION_SCHEMAS)[K] extends infer S extends z.ZodType
    ? ReturnType<typeof yamlDir<S>>
    : never;
};

export const collections = {
  ...entityCollections,
  books: defineCollection({
    loader: file("content/books.yaml", {
      parser: text => booksFileSchema.parse(loadYaml(text)).books.map(b => ({ ...b, id: String(b.number) })),
    }),
    schema: bookSchema.extend({ id: z.string() }),
  }),
  ui: yamlDir("ui", uiSchema),
  pages: defineCollection({
    loader: glob({ pattern: "**/*.mdoc", base: "./content/pages" }),
    schema: z.object({ title: z.string() }),
  }),
};
