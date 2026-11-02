/** Logique pure de la page de recherche (sans import Astro : chargée aussi par le navigateur). */

export type SearchHit = { url: string; excerpt: string; meta: Record<string, string> };

const TH_QUERY = /^\s*(?:th\.?\s*)?(\d+[a-z]?)\s*$/i;

/** « Th 45 », « th45 », « 35B » ou « 7 » : le numéro Th en minuscules ; toute autre requête : null. */
export const parseThQuery = (q: string): string | null => TH_QUERY.exec(q)?.[1].toLowerCase() ?? null;

/** Résultats par numéro Th d'abord, puis résultats textuels, sans doublon d'URL. */
export function mergeHits(thHits: SearchHit[], textHits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return [...thHits, ...textHits].filter(h => !seen.has(h.url) && !!seen.add(h.url));
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string): string => s.replace(/[&<>"]/g, c => ESCAPES[c]);

/** Balisage d'un résultat, identique à celui du prototype. L'extrait est déjà échappé par Pagefind (seul `<mark>` s'y ajoute). */
export function renderHit({ url, excerpt, meta }: SearchHit): string {
  const subtitle = meta.subtitle ? ` <span class="wst">«&nbsp;${esc(meta.subtitle)}&nbsp;»</span>` : "";
  const line = [meta.scoring, meta.year, meta.alt].filter(Boolean).map(esc).join(" · ");
  return `<li><div class="r-head"><a class="wref" href="${esc(url)}"><span class="thn">Th&nbsp;${esc(meta.th ?? "")}</span> <cite class="wt">${esc(meta.title ?? "")}</cite>${subtitle}</a></div><div class="r-meta">${line}</div><div class="r-snip">${excerpt}</div></li>`;
}
