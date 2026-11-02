import { getCollection } from "astro:content";
import { buildCatalogue, validateCatalogue, type Catalogue, type CatalogueInput } from "./catalogue";

let cached: Promise<Catalogue> | undefined;

async function load(): Promise<Catalogue> {
  const input = {
    works: await getCollection("works"),
    persons: await getCollection("persons"),
    places: await getCollection("places"),
    institutions: await getCollection("institutions"),
    roles: await getCollection("roles"),
    bibliography: await getCollection("bibliography"),
    books: (await getCollection("books")).map(({ data: { number, roman, status } }) => ({ number, roman, status })),
  } satisfies CatalogueInput;

  const errors = validateCatalogue(input);
  if (errors.length > 0) {
    throw new Error(
      `Catalogue invalide (${errors.length}) :\n${errors.map(e => `${e.file} › ${e.path} : ${e.message}`).join("\n")}`,
    );
  }
  return buildCatalogue(input);
}

export const getCatalogue = (): Promise<Catalogue> => (cached ??= load());
