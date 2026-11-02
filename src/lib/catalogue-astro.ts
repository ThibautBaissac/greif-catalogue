import { getCollection } from "astro:content";
import { assembleCatalogueInput, buildCatalogue, validateCatalogue, type Catalogue } from "./catalogue";

let cached: Promise<Catalogue> | undefined;

async function load(): Promise<Catalogue> {
  const books = (await getCollection("books")).map(({ data: { number, roman, status } }) => ({ number, roman, status }));
  const input = await assembleCatalogueInput(dir => getCollection(dir), books);

  const errors = validateCatalogue(input);
  if (errors.length > 0) {
    throw new Error(
      `Catalogue invalide (${errors.length}) :\n${errors.map(e => `${e.file} › ${e.path} : ${e.message}`).join("\n")}`,
    );
  }
  return buildCatalogue(input);
}

export const getCatalogue = (): Promise<Catalogue> => (cached ??= load());
