import { thResolver, type Catalogue } from "./catalogue";
import type { Lang } from "./edtf";
import { stripMarkup, type MarkupOptions } from "./markup";
import type { Plural, Ui } from "./ui-schema";

export type { Plural, Ui };

export type PageKey =
  | "home" | "catalogue" | "indexes" | "chrono" | "opus" | "titles" | "incipits" | "persons"
  | "places" | "performances" | "scoring" | "sources" | "editions" | "biblio" | "disco"
  | "journal" | "search" | "about" | "dashboard";

export const PAGES: Record<PageKey, Record<Lang, string>> = {
  home: { fr: "", en: "" },
  catalogue: { fr: "catalogue", en: "catalogue" },
  indexes: { fr: "index-general", en: "indexes" },
  chrono: { fr: "chronologie", en: "chronology" },
  opus: { fr: "opus", en: "opus" },
  titles: { fr: "titres", en: "titles" },
  incipits: { fr: "incipits-litteraires", en: "text-incipits" },
  persons: { fr: "personnes", en: "people" },
  places: { fr: "lieux", en: "places" },
  performances: { fr: "executions", en: "performances" },
  scoring: { fr: "effectifs", en: "scoring" },
  sources: { fr: "manuscrits", en: "manuscripts" },
  editions: { fr: "editions", en: "editions" },
  biblio: { fr: "bibliographie", en: "bibliography" },
  disco: { fr: "discographie", en: "discography" },
  journal: { fr: "carnet-de-bord", en: "journal" },
  search: { fr: "recherche", en: "search" },
  about: { fr: "a-propos", en: "about" },
  dashboard: { fr: "redaction", en: "editorial" },
};

export const WORK_DIR: Record<Lang, string> = { fr: "oeuvres", en: "works" };

export const pageUrl = (key: PageKey, lang: Lang): string => {
  const slug = PAGES[key][lang];
  return slug ? `/${lang}/${slug}/` : `/${lang}/`;
};

export const workUrl = (id: string, lang: Lang): string => `/${lang}/${WORK_DIR[lang]}/${id}/`;

// Dans un module à part : les scripts navigateur les importent sans tirer `astro:content`.
export { fill, tn } from "./plural";

export async function getUi(lang: Lang): Promise<Ui> {
  const { getEntry } = await import("astro:content");
  const entry = await getEntry("ui", lang);
  if (!entry) throw new Error(`Chaînes d'interface introuvables : content/ui/${lang}.yaml`);
  return entry.data as Ui;
}

export const markupOptions = (ui: Ui, lang: Lang, cat: Catalogue): MarkupOptions => ({
  resolve: id => {
    const work = cat.byId.get(id);
    return work && { th: work.th, title: stripMarkup(work.title, thResolver(cat)), href: workUrl(id, lang) };
  },
  labels: { lineBreak: ui.lineBreak, unresolved: ui.unresolvedRef },
});
