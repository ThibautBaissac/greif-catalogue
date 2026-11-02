import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type { PageKey } from "~/lib/i18n";
import Catalogue from "./Catalogue.astro";

/**
 * Pages rendues par `src/pages/[lang]/[...page].astro`. Une page sans entrée ici n'est pas générée.
 * Ce tableau vit hors du fichier .astro : `getStaticPaths` est hissé hors de la portée du frontmatter
 * et ne peut pas lire une constante qui y serait déclarée.
 */
export const PAGE_COMPONENTS: Partial<Record<PageKey, AstroComponentFactory>> = {
  catalogue: Catalogue,
};
