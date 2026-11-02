import type { Catalogue } from "./catalogue";
import { stripMarkup } from "./markup";
import { workUrl } from "./i18n";

type Json = Record<string, unknown>;

/** Copie profonde sans la clé `editorial_notes` : les notes de rédaction ne sont jamais publiées. */
function withoutNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNotes);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "editorial_notes")
        .map(([key, v]) => [key, withoutNotes(v)]),
    );
  }
  return value;
}

const records = (map: Map<string, object>): Json[] => [...map.values()].map(r => withoutNotes(r) as Json);

export function toOpenData(cat: Catalogue): {
  generated: string;
  works: Json[];
  persons: Json[];
  places: Json[];
  institutions: Json[];
  bibliography: Json[];
} {
  return {
    generated: new Date().toISOString(),
    works: cat.works.map(w => ({
      ...(withoutNotes(w) as Json),
      url: { fr: workUrl(w.id, "fr"), en: workUrl(w.id, "en") },
    })),
    persons: records(cat.persons),
    places: records(cat.places),
    institutions: records(cat.institutions),
    bibliography: records(cat.bibliography),
  };
}

const COLUMNS = [
  "id", "th", "book", "title", "subtitle", "opus", "scoring_fr", "scoring_en", "categories",
  "composition_date", "unpublished", "url_fr",
] as const;

/** RFC 4180 : un champ contenant `,`, `"` ou un saut de ligne est entouré de guillemets, les guillemets sont doublés. */
const field = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function toCsv(cat: Catalogue): string {
  const rows = cat.works.map(w =>
    [
      w.id,
      w.th,
      String(w.book),
      stripMarkup(w.title),
      w.subtitle ? stripMarkup(w.subtitle) : "",
      w.opus ?? "",
      w.scoring.fr,
      w.scoring.en,
      w.categories.join("|"),
      w.composition?.date ?? "",
      String(w.unpublished),
      workUrl(w.id, "fr"),
    ].map(field).join(","),
  );
  return `${[COLUMNS.join(","), ...rows].join("\n")}\n`;
}
