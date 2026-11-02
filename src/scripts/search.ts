import type { Lang } from "../lib/edtf";
import { tn } from "../lib/plural";
import { mergeHits, parseThQuery, renderHit, type SearchHit } from "../lib/search";

/** API Pagefind (génération `npm run build` : /pagefind/* n'existe pas en `astro dev`). */
type PagefindData = { url: string; excerpt: string; meta: Record<string, string> };
type PagefindResult = { data(): Promise<PagefindData> };
type Pagefind = {
  search(query: string | null, options?: { filters?: Record<string, string> }): Promise<{ results: PagefindResult[] }>;
};

const MAX_HITS = 100;
const DEBOUNCE_MS = 120;

const input = document.querySelector<HTMLInputElement>("#sq");
const list = document.querySelector<HTMLOListElement>("#sq-results");
const count = document.querySelector<HTMLElement>("#sq-count");

if (input && list && count) {
  const lang: Lang = document.documentElement.lang === "en" ? "en" : "fr";
  const { hintOne = "", hintOther = "", none = "", unavailable = "" } = list.dataset;
  let pagefind: Promise<Pagefind> | undefined;
  const load = (): Promise<Pagefind> => {
    const url = "/pagefind/pagefind.js";
    return (pagefind ??= import(/* @vite-ignore */ url));
  };

  const toHits = async (results: PagefindResult[]): Promise<SearchHit[]> =>
    (await Promise.all(results.slice(0, MAX_HITS).map(r => r.data()))).map(({ url, excerpt, meta }) => ({ url, excerpt, meta }));

  let current = 0;
  const run = async () => {
    const q = input.value.trim();
    const token = ++current;
    if (!q) {
      list.innerHTML = "";
      count.textContent = "";
      return;
    }
    try {
      const pf = await load();
      const th = parseThQuery(q);
      const [thResults, textResults] = await Promise.all([
        th ? pf.search(null, { filters: { th } }) : Promise.resolve({ results: [] }),
        pf.search(q),
      ]);
      const hits = mergeHits(await toHits(thResults.results), await toHits(textResults.results));
      if (token !== current) return;
      list.innerHTML = hits.map(renderHit).join("");
      count.textContent = hits.length ? tn({ one: hintOne, other: hintOther }, hits.length, lang) : none;
    } catch {
      if (token === current) count.textContent = unavailable;
    }
  };

  let timer: ReturnType<typeof setTimeout>;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  });

  const q = new URLSearchParams(location.search).get("q");
  if (q) input.value = q;
  run();
}
