// One-off export of the prototype's interface strings (T in prototype/i18n.mjs) to content/ui/{fr,en}.yaml.
// Run once: npx tsx scripts/migrate/ui.ts. Afterwards the YAML files are edited in the CMS.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dump } from "js-yaml";
import { T } from "../../prototype/i18n.mjs";
import { uiSchema } from "../../src/lib/ui-schema";

type Lang = "fr" | "en";
type Obj = Record<string, any>;

const NEW_KEYS: Record<Lang, Obj> = {
  fr: {
    lineBreak: "saut de ligne",
    unresolvedRef: "Renvoi à résoudre",
    skipLink: "Aller au contenu",
    mainNav: "Navigation principale",
    entrySections: "Rubriques de la notice",
    premiereTag: "création",
    pageIndex: "Index des pages",
    worksPerYear: "Nombre d'œuvres par année",
    heroEyebrow: "Catalogue thématique et critique",
    stats: { entries: "notices", located: "manuscrits localisés", performances: "exécutions", journal: "extraits du carnet de bord" },
    footerStatus: "Version de travail",
    searchUnavailable: "Index de recherche indisponible.",
  },
  en: {
    lineBreak: "line break",
    unresolvedRef: "Cross-reference to resolve",
    skipLink: "Skip to content",
    mainNav: "Main navigation",
    entrySections: "Entry sections",
    premiereTag: "premiere",
    pageIndex: "Page index",
    worksPerYear: "Works per year",
    heroEyebrow: "Thematic and critical catalogue",
    stats: { entries: "entries", located: "located manuscripts", performances: "performances", journal: "journal extracts" },
    footerStatus: "Working version",
    searchUnavailable: "Search index unavailable.",
  },
};

const PLURALS: Record<Lang, Obj> = {
  fr: { worksCount: { one: "{n} œuvre", other: "{n} œuvres" }, searchHint: { one: "{n} notice", other: "{n} notices" } },
  en: { worksCount: { one: "{n} work", other: "{n} works" }, searchHint: { one: "{n} entry", other: "{n} entries" } },
};

const CITE: Record<Lang, string> = {
  fr: "« Th {th} — {title} », dans Catalogue thématique des œuvres d'Olivier Greif [en ligne], {url} (consulté le {date}).",
  en: "“Th {th} — {title},” in Thematic Catalogue of the Works of Olivier Greif [online], {url} (accessed {date}).",
};

const INVERSE_OVERRIDES: Record<Lang, Obj> = {
  fr: { cycle_inverse: "Cycle", sketch_inverse: "Ébauche" },
  en: { cycle_inverse: "Cycle", sketch_inverse: "Sketch" },
};

export function convertUi(lang: Lang, t: Obj = T[lang]): Obj {
  const out: Obj = {};
  for (const [key, value] of Object.entries(t)) {
    if (key === "worksN") out.worksCount = PLURALS[lang].worksCount;
    else if (key === "searchHint") out.searchHint = PLURALS[lang].searchHint;
    else if (key === "citeText") out.citeTemplate = CITE[lang];
    else if (key === "relation") {
      out.relation = Object.fromEntries(
        Object.entries(value as Obj).map(([k, v]) => [k.replace(":inverse", "_inverse"), v]),
      );
      Object.assign(out.relation, INVERSE_OVERRIDES[lang]);
    } else if (key === "idx") {
      out.idx = Object.fromEntries(
        Object.entries(value as Obj).map(([k, [title, desc]]: [string, any]) => [k, { title, desc }]),
      );
    } else out[key] = value;
  }
  return { ...out, ...NEW_KEYS[lang] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync("content/ui", { recursive: true });
  for (const lang of ["fr", "en"] as const) {
    const ui = uiSchema.parse(convertUi(lang));
    writeFileSync(join("content/ui", `${lang}.yaml`), dump(ui, { lineWidth: -1, noRefs: true }));
  }
}
