import { edtfYear } from "./edtf";
import type { Lang } from "./edtf";
import type { BibEntry } from "./schemas";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const name = (n: BibEntry["author"][number]): string => (n.given ? `${n.family}, ${n.given}` : n.family);

/**
 * Référence complète en HTML. Sans titre, la forme courte (`short`) fait foi : c'est le cas
 * des entrées migrées, dont la notice CSL reste à compléter.
 */
export function formatReference(e: BibEntry, lang: Lang): string {
  if (!e.title) return esc(e.short);
  const people = e.author.length > 0 ? e.author : e.editor;
  const role = e.author.length === 0 && e.editor.length > 0 ? (lang === "fr" ? " (dir.)" : " (ed.)") : "";
  const year = edtfYear(e.issued);
  const parts = [
    people.length > 0 ? `${people.map(p => esc(name(p))).join(" ; ")}${role}` : undefined,
    `<em>${esc(e.title)}</em>`,
    e["publisher-place"] && esc(e["publisher-place"]),
    e.publisher && esc(e.publisher),
    year === null ? undefined : String(year),
  ];
  return `${parts.filter(Boolean).join(", ")}.`;
}
