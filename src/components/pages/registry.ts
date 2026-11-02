import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type { PageKey } from "~/lib/i18n";
import Biblio from "./Biblio.astro";
import Catalogue from "./Catalogue.astro";
import Chrono from "./Chrono.astro";
import Disco from "./Disco.astro";
import Editions from "./Editions.astro";
import Indexes from "./Indexes.astro";
import Journal from "./Journal.astro";
import Opus from "./Opus.astro";
import Performances from "./Performances.astro";
import Persons from "./Persons.astro";
import Places from "./Places.astro";
import Scoring from "./Scoring.astro";
import Sources from "./Sources.astro";
import TextIncipits from "./TextIncipits.astro";
import Titles from "./Titles.astro";

/**
 * Pages rendues par `src/pages/[lang]/[...page].astro`. Une page sans entrée ici n'est pas générée.
 * Ce tableau vit hors du fichier .astro : `getStaticPaths` est hissé hors de la portée du frontmatter
 * et ne peut pas lire une constante qui y serait déclarée.
 */
export const PAGE_COMPONENTS: Partial<Record<PageKey, AstroComponentFactory>> = {
  catalogue: Catalogue,
  indexes: Indexes,
  chrono: Chrono,
  opus: Opus,
  titles: Titles,
  incipits: TextIncipits,
  scoring: Scoring,
  persons: Persons,
  places: Places,
  performances: Performances,
  sources: Sources,
  editions: Editions,
  biblio: Biblio,
  disco: Disco,
  journal: Journal,
};
