import { describe, expect, test } from "vitest";
import { mergeHits, parseThQuery, renderHit, type SearchHit } from "~/lib/search";

const hit = (url: string, meta: Record<string, string> = {}, excerpt = ""): SearchHit => ({ url, excerpt, meta });

describe("parseThQuery", () => {
  test.each([
    ["Th 45", "45"],
    ["th45", "45"],
    ["Th. 45", "45"],
    ["35B", "35b"],
    [" 7 ", "7"],
  ])("reads %j as the Th number %j", (q, expected) => {
    expect(parseThQuery(q)).toBe(expected);
  });

  test.each(["Heine", "45 heine", ""])("returns null for %j", q => {
    expect(parseThQuery(q)).toBeNull();
  });
});

describe("mergeHits", () => {
  test("puts Th hits first and keeps the original order otherwise", () => {
    const merged = mergeHits([hit("/b")], [hit("/c"), hit("/a")]);
    expect(merged.map(h => h.url)).toEqual(["/b", "/c", "/a"]);
  });

  test("drops text hits already present as Th hits, and duplicates inside a list", () => {
    const merged = mergeHits([hit("/a"), hit("/b")], [hit("/b"), hit("/c"), hit("/c")]);
    expect(merged.map(h => h.url)).toEqual(["/a", "/b", "/c"]);
  });
});

describe("renderHit", () => {
  const full = hit(
    "/fr/oeuvres/wiener-konzert/",
    { th: "45", title: "Wiener Konzert", subtitle: "Sous-titre", scoring: "Voix et piano", year: "1974", alt: "Autre titre" },
    "un <mark>extrait</mark>",
  );

  test("reproduces the prototype markup exactly", () => {
    expect(renderHit(full)).toBe(
      '<li><div class="r-head"><a class="wref" href="/fr/oeuvres/wiener-konzert/"><span class="thn">Th&nbsp;45</span> <cite class="wt">Wiener Konzert</cite> <span class="wst">«&nbsp;Sous-titre&nbsp;»</span></a></div><div class="r-meta">Voix et piano · 1974 · Autre titre</div><div class="r-snip">un <mark>extrait</mark></div></li>',
    );
  });

  test("escapes meta values", () => {
    const html = renderHit(hit("/x", { th: "1", title: "A <b>&\"</b>", scoring: "S" }));
    expect(html).toContain('<cite class="wt">A &lt;b&gt;&amp;&quot;&lt;/b&gt;</cite>');
    expect(html).not.toContain("<b>");
  });

  test("omits the subtitle span without a subtitle", () => {
    expect(renderHit(hit("/x", { th: "1", title: "T", scoring: "S" }))).not.toContain("wst");
  });

  test("skips the missing parts of the meta line", () => {
    const meta = (m: Record<string, string>) =>
      renderHit(hit("/x", { th: "1", title: "T", ...m })).match(/<div class="r-meta">(.*?)<\/div>/)![1];
    expect(meta({ scoring: "S", year: "1974" })).toBe("S · 1974");
    expect(meta({ scoring: "S", alt: "A" })).toBe("S · A");
    expect(meta({ scoring: "S" })).toBe("S");
    expect(meta({})).toBe("");
  });
});
