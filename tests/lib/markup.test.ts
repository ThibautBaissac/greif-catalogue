import { describe, expect, test } from "vitest";
import {
  UnknownXrefError,
  extractRefs,
  renderBlock,
  renderInline,
  stripMarkup,
  type MarkupOptions,
} from "~/lib/markup";

const resolve: MarkupOptions["resolve"] = (id) =>
  id === "wiener-konzert"
    ? { th: "45", title: "Wiener Konzert", href: "/fr/oeuvres/wiener-konzert/" }
    : undefined;
const labels = { lineBreak: "saut de ligne", unresolved: "Renvoi à résoudre" };
const o: MarkupOptions = { resolve, labels };

const XREF = '<a class="xref" href="/fr/oeuvres/wiener-konzert/" title="Wiener Konzert">Th&nbsp;45</a>';

describe("renderInline", () => {
  test("emphasis", () => {
    expect(renderInline("*Wiener Konzert*", o)).toBe("<em>Wiener Konzert</em>");
  });
  test("strong", () => {
    expect(renderInline("**a**", o)).toBe("<strong>a</strong>");
  });
  test("superscript", () => {
    expect(renderInline("778^e^ concert", o)).toBe("778<sup>e</sup> concert");
  });
  test("line break marker", () => {
    expect(renderInline("a | b", o)).toBe('a <span class="lb" aria-label="saut de ligne">|</span> b');
  });
  test("sic", () => {
    expect(renderInline("poêmes [sic]", o)).toBe("poêmes [<em>sic</em>]");
  });
  test("escapes HTML", () => {
    expect(renderInline("<script>", o)).toBe("&lt;script&gt;");
  });
  test("resolved cross-reference", () => {
    expect(renderInline("cf. [[wiener-konzert]]", o)).toBe(`cf. ${XREF}`);
  });
  test("[[?]] renders as unresolved", () => {
    expect(renderInline("[[?]]", o)).toBe(
      '<span class="xref unresolved" title="Renvoi à résoudre">Th&nbsp;?</span>',
    );
  });
  test("unknown id throws UnknownXrefError carrying the id", () => {
    let error: unknown;
    try {
      renderInline("[[nope]]", o);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(UnknownXrefError);
    expect((error as UnknownXrefError).id).toBe("nope");
  });
  test("a referenced title containing \" | \" does not corrupt the title attribute", () => {
    const pipe: MarkupOptions["resolve"] = () => ({ th: "7", title: "A | B", href: "/fr/oeuvres/ab/" });
    const out = renderInline("cf. [[ab]] et c | d", { resolve: pipe, labels });
    expect(out).toContain('<a class="xref" href="/fr/oeuvres/ab/" title="A | B">Th&nbsp;7</a>');
    expect(out).toContain('c <span class="lb" aria-label="saut de ligne">|</span> d');
  });
  test("an editorial bracket before a reference stays visible", () => {
    expect(renderInline("[[[wiener-konzert]], op.40]", o)).toBe(`[${XREF}, op.40]`);
  });
});

describe("renderBlock", () => {
  test("blank line separates paragraphs, newline is a <br>", () => {
    expect(renderBlock("a\n\nb\nc", o)).toBe("<p>a</p><p>b<br>c</p>");
  });
});

describe("stripMarkup", () => {
  test("plain text with Th numbers", () => {
    expect(stripMarkup("42^nd^ *Street* [[wiener-konzert]] [[?]]", resolve)).toBe("42nd Street Th 45 Th ?");
  });
});

describe("stripMarkup with a resolver", () => {
  test("a valid reference gives its Th number, never \"Th ?\"", () => {
    expect(stripMarkup("Variations sur [[wiener-konzert]]", resolve)).toBe("Variations sur Th 45");
  });
});

describe("extractRefs", () => {
  test("ids in order, ? included", () => {
    expect(extractRefs("cf. [[a]] et [[?]], [[b]]")).toEqual(["a", "?", "b"]);
  });
  test("an editorial bracket before a reference is not part of the id", () => {
    expect(extractRefs("en quatre mouvements [[[sonate-piano-13]], op.47]")).toEqual(["sonate-piano-13"]);
  });
});
