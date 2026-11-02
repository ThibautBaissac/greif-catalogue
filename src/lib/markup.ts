export type XrefTarget = { th: string; title: string; href: string };

export type MarkupOptions = {
  resolve: (id: string) => XrefTarget | undefined;
  labels: { lineBreak: string; unresolved: string };
};

export class UnknownXrefError extends Error {
  readonly id: string;
  constructor(id: string) {
    super(`Unknown cross-reference: [[${id}]]`);
    this.name = "UnknownXrefError";
    this.id = id;
  }
}

// Diffère du prototype (`[^\]]*`) : dans `[[[id]]`, le premier `[` reste affiché.
const XREF = () => /\[\[([^\[\]]*)\]\]/g;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function transform(src: string, o: MarkupOptions): string {
  let h = esc(src);
  h = h.replace(XREF(), (_m, id: string) => {
    if (id === "?") {
      return `<span class="xref unresolved" title="${esc(o.labels.unresolved)}">Th&nbsp;?</span>`;
    }
    const target = o.resolve(id);
    if (!target) throw new UnknownXrefError(id);
    return `<a class="xref" href="${esc(target.href)}" title="${esc(target.title)}">Th&nbsp;${esc(target.th)}</a>`;
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  h = h.replace(/\^([^^\s][^^]*)\^/g, "<sup>$1</sup>");
  h = h.replace(/ \| /g, ` <span class="lb" aria-label="${esc(o.labels.lineBreak)}">|</span> `);
  h = h.replace(/\[sic\]/g, "[<em>sic</em>]");
  return h;
}

export const renderInline = (src: string, o: MarkupOptions): string =>
  transform(src, o).replace(/\n/g, "<br>");

export const renderBlock = (src: string, o: MarkupOptions): string =>
  transform(src, o)
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

export function stripMarkup(src: string, resolve?: MarkupOptions["resolve"]): string {
  return src
    .replace(/\^([^^]*)\^/g, "$1")
    .replace(/\*/g, "")
    .replace(XREF(), (_m, id: string) => {
      const target = id === "?" ? undefined : resolve?.(id);
      return target ? `Th ${target.th}` : "Th ?";
    });
}

export const extractRefs = (src: string): string[] =>
  Array.from(src.matchAll(XREF()), (m) => m[1]);
