import { z } from "astro/zod";
import { CATEGORIES, RELATIONS, SOURCE_FEATURES, SOURCE_STATUS } from "./schemas";

const str = z.string();
/** Empty in the FR file: Keystatic omits an empty text, so a missing key reads as "". */
const maybeEmpty = z.string().default("");
const plural = z.object({ one: str, other: str }).strict();
const strings = <K extends string>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map(k => [k, str])) as Record<K, typeof str>).strict();
const entries = <K extends string>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map(k => [k, z.object({ title: str, desc: str }).strict()])) as Record<
    K,
    z.ZodObject<{ title: typeof str; desc: typeof str }, z.core.$strict>
  >).strict();

/** Index pages listed on the hub and the home page; the editorial dashboard is not one of them. */
export const INDEX_KEYS = [
  "chrono", "opus", "titles", "incipits", "persons", "places", "performances", "scoring",
  "sources", "editions", "biblio", "disco", "journal",
] as const;
export const IDX_KEYS = [...INDEX_KEYS, "dashboard"] as const;

const relationKeys = RELATIONS.flatMap(r => [r, `${r}_inverse`] as const);

export const uiSchema = z
  .object({
    site: str,
    siteSub: str,
    skipLink: str,
    mainNav: str,
    nav: strings(["catalogue", "indexes", "journal", "search", "about"]),
    otherLang: str,
    otherLangCode: str,
    footerStatus: str,
    footerEditorial: str,
    notFound: strings(["eyebrow", "title", "desc", "home", "search"]),
    heroEyebrow: str,
    stats: strings(["entries", "located", "performances", "journal"]),
    book: str,
    books: str,
    work: str,
    works: str,
    worksCount: plural,
    th: str,
    opus: str,
    noOpus: str,
    bars: str,
    barsUnknown: str,
    inPreparation: str,
    partial: str,
    f: strings([
      "scoring", "composition", "duration", "text", "dedication", "sources", "audio", "remarks",
      "intertextual", "editions", "unpublished", "premiere", "premiereRec", "performances", "journal",
      "documents", "bibliography", "discography", "videography", "related", "altTitles", "movements",
      "cite", "editorial", "siglum", "performers", "place", "date",
    ]),
    entrySections: str,
    premiereTag: str,
    pageIndex: str,
    worksPerYear: str,
    unpublishedUncertain: str,
    srcStatus: strings(SOURCE_STATUS),
    features: strings(SOURCE_FEATURES),
    relation: strings(relationKeys),
    cat: strings(CATEGORIES),
    roles: strings(["author", "translator", "dedicatee", "performer"]),
    personFilter: strings(["all", "author", "dedicatee", "performer"]),
    months: z.array(str).length(12),
    unknownDate: str,
    unknownPlace: str,
    incipitMissing: str,
    frOnly: maybeEmpty,
    prev: str,
    next: str,
    citeTemplate: str,
    copy: str,
    copied: str,
    searchPlaceholder: str,
    searchHint: plural,
    searchNone: str,
    searchUnavailable: str,
    filterAll: str,
    filterBook: str,
    filterCat: str,
    filterStatus: str,
    filtersLabel: str,
    personFilterLabel: str,
    catalogueLede: str,
    breadcrumb: str,
    pager: str,
    pageAbbr: str,
    editorAbbr: str,
    status: strings(["published", "unpublished", "lostms"]),
    sortBy: str,
    sortTh: str,
    sortTitle: str,
    sortDate: str,
    col: strings([
      "th", "title", "opus", "scoring", "date", "year", "work", "performers", "place", "date2", "pages", "count",
    ]),
    idx: entries(IDX_KEYS),
    notCited: str,
    lostOrUnlocated: str,
    papers: str,
    featuresTitle: str,
    bySiglum: str,
    unpublishedList: str,
    forthcoming: str,
    movementTitles: str,
    altTitleOf: str,
    entryOf: str,
    seeWork: str,
    sinceDate: str,
    dashboardWarn: str,
    nameVariants: str,
    unresolved: str,
    incompleteBibliography: str,
    completeness: str,
    incipitsFound: str,
    barsKnown: str,
    lineBreak: str,
    unresolvedRef: str,
  })
  .strict();

export type Ui = z.infer<typeof uiSchema>;
export type Plural = z.infer<typeof plural>;
