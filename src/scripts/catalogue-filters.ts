// Catalogue : filtres par Livre, effectif, état et texte. Reprend `prototype/assets/app.js`.
import { tn } from "../lib/plural";

const $ = <T extends Element>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends Element>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const fBook = $<HTMLSelectElement>("#f-book");
const fCat = $<HTMLSelectElement>("#f-cat");
const fStatus = $<HTMLSelectElement>("#f-status");
const fQ = $<HTMLInputElement>("#f-q");
const out = $<HTMLElement>("#f-count");

if (fBook && fCat && fStatus && fQ && out) {
  const lang = document.documentElement.lang === "en" ? "en" : "fr";
  const plural = { one: out.dataset.one ?? "{n}", other: out.dataset.other ?? "{n}" };
  const rows = $$<HTMLElement>("table.cat tbody tr");

  const apply = () => {
    const book = fBook.value;
    const category = fCat.value;
    const status = fStatus.value;
    const terms = fold(fQ.value).split(/\s+/).filter(Boolean);
    let n = 0;
    for (const r of rows) {
      const ok =
        (!book || r.dataset.book === book) &&
        (!category || (r.dataset.cat ?? "").split(" ").includes(category)) &&
        (!status || (r.dataset.status ?? "").split(" ").includes(status)) &&
        terms.every(t => (r.dataset.q ?? "").includes(t));
      r.hidden = !ok;
      if (ok) n++;
    }
    for (const section of $$<HTMLElement>("[data-book-section]")) {
      const any = $$<HTMLElement>("tbody tr", section).some(r => !r.hidden);
      section.hidden = (!!book && section.dataset.bookSection !== book) || (!any && !!(category || status || terms.length));
    }
    out.textContent = tn(plural, n, lang);
  };

  for (const el of [fBook, fCat, fStatus]) el.addEventListener("change", apply);
  fQ.addEventListener("input", apply);
  apply();
}
