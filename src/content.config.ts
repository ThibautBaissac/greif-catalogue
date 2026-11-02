import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";
import { load as loadYaml } from "js-yaml";
import {
  bibliographySchema,
  bookSchema,
  booksFileSchema,
  institutionSchema,
  personSchema,
  placeSchema,
  roleSchema,
  workSchema,
} from "./lib/schemas";

const yamlDir = <S extends z.ZodType>(dir: string, schema: S) =>
  defineCollection({ loader: glob({ pattern: "*.yaml", base: `./content/${dir}` }), schema });

export const collections = {
  works: yamlDir("works", workSchema),
  persons: yamlDir("persons", personSchema),
  places: yamlDir("places", placeSchema),
  institutions: yamlDir("institutions", institutionSchema),
  roles: yamlDir("roles", roleSchema),
  bibliography: yamlDir("bibliography", bibliographySchema),
  books: defineCollection({
    loader: file("content/books.yaml", {
      parser: text => booksFileSchema.parse(loadYaml(text)).books.map(b => ({ ...b, id: String(b.number) })),
    }),
    schema: bookSchema.extend({ id: z.string() }),
  }),
  pages: defineCollection({
    loader: glob({ pattern: "**/*.mdoc", base: "./content/pages" }),
    schema: z.object({ title: z.string() }),
  }),
};
