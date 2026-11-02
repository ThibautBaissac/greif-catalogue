// Générateur du catalogue thématique Olivier Greif.
//   node build.mjs            -> dist/ (site complet, page de rédaction incluse)
//   node build.mjs --public   -> dist/ sans la page de rédaction ni les notes internes
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { LANGS, PAGES, WORK_DIR, T, SCORING_EN, ROLE_EN } from "./i18n.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, "dist");
const PUBLIC = process.argv.includes("--public");
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ données
const works = fs.readdirSync(path.join(ROOT, "data/works"))
  .filter(f => f.endsWith(".yaml"))
  .map(f => yaml.load(fs.readFileSync(path.join(ROOT, "data/works", f), "utf8")));
const books = yaml.load(fs.readFileSync(path.join(ROOT, "data/books.yaml"), "utf8"));
const thKey = th => { const m = String(th).match(/^(\d+)([a-z]?)$/); return m ? +m[1] * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0) : 1e9; };
works.sort((a, b) => thKey(a.th) - thKey(b.th));
const byId = new Map(works.map(w => [w.id, w]));

// ------------------------------------------------------------------ utilitaires
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = s => String(s ?? "").replace(/\^([^^]*)\^/g, "$1").replace(/\*/g, "").replace(/\[\[([^\]]*)\]\]/g, (m, id) => byId.has(id) ? `Th ${byId.get(id).th}` : "Th ?");
const fold = s => strip(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const year = iso => iso ? +String(iso).slice(0, 4) : null;
const ARTICLES = /^(le |la |les |l'|l’|the |die |der |das |un |une |a |an )/i;
const sortTitle = s => fold(s).replace(/^[«"“\[\(\-\d\s\.)]+/, "").replace(ARTICLES, "").trim();

function fmtDate(iso, lang) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  const M = T[lang].months;
  if (lang === "fr") return [d ? (d === 1 ? "1er" : d) : null, m ? M[m - 1] : null, y].filter(Boolean).join(" ");
  if (d) return `${d} ${M[m - 1]} ${y}`;
  return [m ? M[m - 1] : null, y].filter(Boolean).join(" ");
}
function fmtRange(from, to, lang) {
  if (!from) return "";
  if (!to) return fmtDate(from, lang);
  const [y1, m1] = from.split("-"), [y2, m2] = to.split("-");
  if (y1 === y2 && from.length === 4) return y1;
  if (y1 === y2) {
    if (m1 === m2 && from.length === 10) return `${+from.slice(8)}–${fmtDate(to, lang)}`;
    const left = fmtDate(from, lang).replace(new RegExp(`\\s*${y1}$`), "");
    return `${left} – ${fmtDate(to, lang)}`;
  }
  return `${fmtDate(from, lang)} – ${fmtDate(to, lang)}`;
}

// ------------------------------------------------------------------ chemins
// ctx = { lang, depth }  depth : 0 racine, 1 page de langue, 2 notice
const up = ctx => "../".repeat(ctx.depth);
const pageUrl = (ctx, key, lang = ctx.lang) => `${up(ctx)}${lang}/${PAGES[key][lang]}`;
const workUrl = (ctx, id, lang = ctx.lang) => `${up(ctx)}${lang}/${WORK_DIR[lang]}/${id}.html`;
const asset = (ctx, p) => `${up(ctx)}assets/${p}`;

// ------------------------------------------------------------------ texte balisé léger
function md(s, ctx, { block = false } = {}) {
  if (s == null) return "";
  let h = esc(String(s));
  h = h.replace(/\[\[([^\]]*)\]\]/g, (m, id) => {
    if (id && byId.has(id)) { const w = byId.get(id); return `<a class="xref" href="${workUrl(ctx, id)}" title="${esc(strip(w.title))}">Th&nbsp;${esc(w.th)}</a>`; }
    return `<span class="xref unresolved" title="Renvoi à résoudre">Th&nbsp;?</span>`;
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  h = h.replace(/\^([^^\s][^^]*)\^/g, "<sup>$1</sup>");
  h = h.replace(/ \| /g, ' <span class="lb" aria-label="saut de ligne">|</span> ');
  h = h.replace(/\[sic\]/g, "[<em>sic</em>]");
  if (block) return h.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  return h.replace(/\n/g, "<br>");
}
const L = (ctx) => T[ctx.lang];
const orig = (ctx) => ctx.lang === "fr" ? "" : ' lang="fr"';
const scoringLabel = (s, lang) => lang === "en" ? (SCORING_EN[s] || s) : s;
const roleLabel = (r, lang) => lang === "en" ? (ROLE_EN[r] || r) : r;
const workTitleHtml = (w, ctx) => `<cite class="wt">${md(w.title, ctx)}</cite>${w.subtitle ? ` <span class="wst">«&nbsp;${md(w.subtitle, ctx)}&nbsp;»</span>` : ""}`;
const workRef = (w, ctx) => `<a class="wref" href="${workUrl(ctx, w.id)}"><span class="thn">Th&nbsp;${esc(w.th)}</span> ${workTitleHtml(w, ctx)}</a>`;
const opusLabel = (w, ctx) => w.opus ? `${L(ctx).opus}&nbsp;${esc(w.opus)}` : L(ctx).noOpus;

// ------------------------------------------------------------------ personnes
const PARTICLES = new Set(["de", "du", "des", "von", "van", "la", "le", "d'"]);
const NAME_OVERRIDES = {
  "Jacques Loiseleur des Longchamps": ["Loiseleur des Longchamps", "Jacques"],
  "Claus Schenk Graf von Stauffenberg": ["Stauffenberg", "Claus Schenk Graf von"],
  "Li Bai": ["Li Bai", ""], "Mrs Alexander Liberman": ["Liberman", "Mrs Alexander"],
};
function invertName(n) {
  if (NAME_OVERRIDES[n]) return NAME_OVERRIDES[n];
  if (/\(|^\[|^Mère |^E-D F\.$/.test(n) || !n.includes(" ")) return [n, ""];
  const t = n.split(" ");
  for (let i = 1; i < t.length - 1; i++) {
    if (PARTICLES.has(t[i])) {
      if (t[i] === "de" && (t[i + 1] === "la" || t[i + 1] === "le"))
        return [[t[i + 1][0].toUpperCase() + t[i + 1].slice(1), ...t.slice(i + 2)].join(" "), t.slice(0, i + 1).join(" ")];
      if (["de", "von", "van", "d'"].includes(t[i])) return [t.slice(i + 1).join(" "), t.slice(0, i + 1).join(" ")];
      return [[t[i][0].toUpperCase() + t[i].slice(1), ...t.slice(i + 1)].join(" "), t.slice(0, i).join(" ")];
    }
  }
  return [t[t.length - 1], t.slice(0, -1).join(" ")];
}
const persons = new Map();
function addPerson(name, role, w, detail, isEnsemble = false) {
  if (!name || name === "[?]") return;
  const key = slug(name);
  if (!persons.has(key)) {
    const [sur, given] = isEnsemble ? [name, ""] : invertName(name);
    persons.set(key, { key, name, sur, given, sort: fold(sur + " " + given), roles: {} });
  }
  const p = persons.get(key);
  (p.roles[role] ||= []).push({ w, detail });
}
const variants = [];
for (const w of works) {
  for (const a of w.text?.authors || []) addPerson(a.name, a.role === "translator" ? "translator" : "author", w);
  for (const d of w.dedication?.persons || []) addPerson(d, "dedicatee", w);
  const perfs = [...(w.premiere || []).map(p => ({ ...p, kind: "premiere" })), ...(w.performances || []).map(p => ({ ...p, kind: "perf" }))];
  for (const p of perfs) for (const pr of p.performers || []) {
    addPerson(pr.name, "performer", w, { role: pr.role, date: p.date }, pr.role === "ensemble");
    if (pr.as_written) variants.push([pr.as_written, pr.name]);
  }
  JSON.stringify(w, (k, v) => { if (v && typeof v === "object" && v.as_written) variants.push([v.as_written, v.name]); return v; });
}
const personUrl = (ctx, name) => `${pageUrl(ctx, "persons")}#${slug(name)}`;
const personLink = (ctx, name) => name === "[?]" ? `<span class="muted">[?]</span>` : `<a class="pl" href="${personUrl(ctx, name)}">${esc(name)}</a>`;

// ------------------------------------------------------------------ exécutions
const allPerfs = [];
for (const w of works) {
  for (const p of w.premiere || []) allPerfs.push({ ...p, w, kind: "premiere" });
  for (const p of w.performances || []) allPerfs.push({ ...p, w, kind: "perf" });
}
allPerfs.sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));

// ------------------------------------------------------------------ incipits (PNG exportés de Finale)
// Convention : incipits/<id>/<n>.png  (n = numéro d'ordre du mouvement, à partir de 1)
const incipitDir = path.join(ROOT, "incipits");
const incipitPath = (w, i) => `incipits/${w.id}/${i + 1}.png`;
const hasIncipit = (w, i) => fs.existsSync(path.join(ROOT, incipitPath(w, i)));

// ------------------------------------------------------------------ gabarit
function nav(ctx, active) {
  const t = L(ctx);
  const items = ["catalogue", "indexes", "journal", "search", "about"];
  return items.map(k => `<a href="${pageUrl(ctx, k)}"${active === k ? ' aria-current="page"' : ""}>${t.nav[k]}</a>`).join("");
}
function layout(ctx, { title, body, active, alt, desc = "", jsonld = null, bodyClass = "" }) {
  const t = L(ctx);
  const other = ctx.lang === "fr" ? "en" : "fr";
  const altHref = alt ? alt(other) : pageUrl(ctx, "home", other);
  const fullTitle = title ? `${title} · ${t.site}, ${t.siteSub.toLowerCase()}` : `${t.site} · ${t.siteSub}`;
  const head = `<title>${esc(fullTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${esc(desc || t.siteSub)}">
${ctx.noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="alternate" hreflang="${other}" href="${altHref}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${asset(ctx, "style.css")}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}`;
  const html = `<a class="skip" href="#main">${ctx.lang === "fr" ? "Aller au contenu" : "Skip to content"}</a>
<header class="site-head"><div class="wrap head-row">
  <a class="brand" href="${pageUrl(ctx, "home")}"><span class="brand-name">${t.site}</span><span class="brand-sub">${t.siteSub}</span></a>
  <nav class="site-nav" aria-label="${ctx.lang === "fr" ? "Navigation principale" : "Main navigation"}">${nav(ctx, active)}<a class="lang" href="${altHref}" hreflang="${other}" lang="${other}" title="${t.otherLang}">${t.otherLangCode}</a></nav>
</div></header>
<main id="main" class="${bodyClass}">${body}</main>
<footer class="site-foot"><div class="wrap foot-row">
  <p>${t.site} (1950–2000) · ${t.siteSub}</p>
  <p class="muted">${ctx.lang === "fr" ? "Prototype" : "Prototype"} · ${t.sinceDate} ${fmtDate(BUILD_DATE, ctx.lang)} · <a href="${pageUrl(ctx, "about")}">${t.nav.about}</a></p>
</div></footer>
<script src="${asset(ctx, "app.js")}" defer></script>`;
  return { head, html, full: `<!doctype html>\n<html lang="${ctx.lang}">\n<head>\n<meta charset="utf-8">\n${head}\n</head>\n<body data-lang="${ctx.lang}">\n${html}\n</body>\n</html>\n` };
}

const out = (rel, content) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
const pageHead = (eyebrow, h1, lede = "") => `<div class="page-head wrap"><p class="eyebrow">${eyebrow}</p><h1>${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div>`;

// ------------------------------------------------------------------ notice
function section(id, label, inner, cls = "") {
  return inner ? `<section class="field ${cls}" id="${id}" aria-labelledby="${id}-h"><h2 class="field-label" id="${id}-h">${label}</h2><div class="field-body">${inner}</div></section>` : "";
}
function perfRow(p, ctx, showWork = false) {
  const t = L(ctx);
  const date = p.date ? fmtRange(p.date, p.date_end, ctx.lang) : `<span class="muted">${t.unknownDate}</span>`;
  const perf = (p.performers || []).map(pr => `${personLink(ctx, pr.name)}${pr.alias ? ` «&nbsp;${esc(pr.alias)}&nbsp;»` : ""}${pr.role && pr.role !== "ensemble" ? ` <span class="role">(${esc(roleLabel(pr.role, ctx.lang))})</span>` : ""}`).join(", ");
  return `<tr${p.kind === "premiere" ? ' class="is-premiere"' : ""}>
    <td class="c-date">${date}${p.kind === "premiere" ? `<span class="tag tag-red">${ctx.lang === "fr" ? "création" : "premiere"}</span>` : ""}</td>
    ${showWork ? `<td class="c-work">${workRef(p.w, ctx)}</td>` : ""}
    <td class="c-place"${orig(ctx)}>${md(p.place || "", ctx)}</td>
    <td class="c-perf">${perf}</td></tr>`;
}
function perfTable(list, ctx, showWork = false) {
  const t = L(ctx);
  return `<div class="table-scroll"><table class="perf"><thead><tr><th>${t.col.date2}</th>${showWork ? `<th>${t.col.work}</th>` : ""}<th>${t.col.place}</th><th>${t.col.performers}</th></tr></thead><tbody>${list.map(p => perfRow(p, ctx, showWork)).join("")}</tbody></table></div>`;
}

function incipitFigure(w, i, m, ctx) {
  const t = L(ctx);
  const p = incipitPath(w, i);
  const label = m.title ? strip(m.title) : strip(w.title);
  const img = hasIncipit(w, i)
    ? `<img src="${up(ctx)}${p}" alt="Incipit : ${esc(label)}" loading="lazy">`
    : `<div class="staff-ph" role="img" aria-label="${t.incipitMissing}"><span>${t.incipitMissing}${m.incipit_count ? ` (${m.incipit_count})` : ""}</span><code>${p}</code></div>`;
  const bars = m.bars ? `<span class="bars">${m.bars}&nbsp;${t.bars}</span>` : `<span class="bars missing">${t.barsUnknown}</span>`;
  return `<figure class="mvt">
    ${m.title ? `<figcaption class="mvt-title"${orig(ctx)}>${md(m.title, ctx)}</figcaption>` : ""}
    <div class="incipit">${img}</div>
    <div class="mvt-meta">${bars}${m.text_incipit ? `<span class="txt-inc"${orig(ctx)}>${md(m.text_incipit, ctx)}</span>` : ""}</div>
  </figure>`;
}

function workPage(w, idx, lang) {
  const ctx = { lang, depth: 2 };
  const t = L(ctx);
  const prev = works[idx - 1], next = works[idx + 1];
  const book = books.find(b => b.number === w.book);
  // Faits essentiels
  const comp = w.composition ? (lang === "fr" ? md(w.composition.text, ctx) : (fmtRange(w.composition.from, w.composition.to, lang) || md(w.composition.text, ctx))) : "";
  const facts = [
    [t.f.scoring, md(scoringLabel(w.scoring, lang), ctx) + (w.scoring_note ? `<br><span class="muted"${orig(ctx)}>${md(w.scoring_note, ctx)}</span>` : "")],
    [t.f.composition, comp && comp !== "inconnue" ? comp : `<span class="muted">${t.unknownDate}</span>`],
    w.duration ? [t.f.duration, esc(w.duration).replace(/ \| /g, " · ")] : null,
    [t.book, `<a href="${pageUrl(ctx, "catalogue")}#livre-${w.book}">${book?.roman || w.book}</a>`],
  ].filter(Boolean);

  const mv = (w.movements || []);
  const mvHtml = mv.length ? `<div class="mvts${mv.length > 1 ? " multi" : ""}">${mv.map((m, i) => incipitFigure(w, i, m, ctx)).join("")}</div>` : "";

  // Texte
  let textHtml = "";
  if (w.text) {
    const authors = w.text.authors || [];
    const same = authors.length === 1 && strip(w.text.credit) === authors[0].name;
    textHtml = same ? `<p>${personLink(ctx, authors[0].name)}</p>` : `<p${orig(ctx)}>${md(w.text.credit, ctx)}</p>`;
    if (!same && authors.length) textHtml += `<p class="persons-line">${authors.map(a => personLink(ctx, a.name)).join(" · ")}</p>`;
  }
  // Dédicace
  let dedHtml = "";
  if (w.dedication?.text || w.dedication?.persons) {
    dedHtml = w.dedication.text ? `<p${orig(ctx)}>${md(w.dedication.text, ctx)}</p>` : "";
    if (w.dedication.persons) dedHtml += `<p class="persons-line">${w.dedication.persons.map(n => personLink(ctx, n)).join(" · ")}</p>`;
  }
  // Sources
  let srcHtml = "";
  if (w.sources) {
    const s = w.sources;
    const badges = [`<span class="tag ${s.status === "located" ? "" : "tag-red"}">${t.srcStatus[s.status] || s.status}</span>`]
      .concat(s.siglum ? [`<span class="siglum" title="${t.f.siglum}">${esc(s.siglum)}</span>`] : [])
      .concat((s.features || []).filter(f => f !== "autograph").map(f => `<span class="tag tag-ghost">${t.features[f]}</span>`));
    srcHtml = `<div class="badges">${badges.join("")}</div>`;
    if (s.intro) srcHtml += `<p${orig(ctx)}>${md(s.intro, ctx)}</p>`;
    if (s.items) srcHtml += `<ol class="src-items">${s.items.map(it => `<li${orig(ctx)}>${it.label ? `<span class="src-lab">${esc(it.label)}</span>` : ""}<div>${md(it.text, ctx)}</div></li>`).join("")}</ol>`;
  }
  if (w.audio_source) srcHtml += `<p class="sub-label">${t.f.audio}</p><p${orig(ctx)}>${md(w.audio_source, ctx)}</p>`;

  const remarks = (w.remarks || []).map(r => `<p${orig(ctx)}>${md(r, ctx)}</p>`).join("");
  const inter = (w.intertextual || []).map(r => `<p${orig(ctx)}>${md(r, ctx)}</p>`).join("");
  let edHtml = "";
  if (w.editions) edHtml = w.editions.map(e => `<p${orig(ctx)}>${md(e.text, ctx)}${e.status === "forthcoming" ? ` <span class="tag">${t.forthcoming}</span>` : ""}</p>`).join("");
  if (w.unpublished) edHtml = `<p><span class="tag tag-red">${w.unpublished === true ? t.f.unpublished : t.unpublishedUncertain}</span></p>` + edHtml;

  const prem = (w.premiere || []).map(p => ({ ...p, kind: "premiere" }));
  const perfs = (w.performances || []).map(p => ({ ...p, kind: "perf" }));
  let perfHtml = (prem.length || perfs.length) ? perfTable([...prem, ...perfs], ctx) : "";
  if (w.premiere_recording) perfHtml += `<p class="sub-label">${t.f.premiereRec}</p>` + w.premiere_recording.map(p => `<p${orig(ctx)}>${md(p, ctx)}</p>`).join("");

  const journal = (w.journal || []).map(e => journalEntry(e, ctx)).join("");
  const docs = (w.documents || []).map(d => `<div class="doc${/^«/.test(d) ? " quote" : ""}"${orig(ctx)}>${md(d, ctx, { block: true })}</div>`).join("");
  const bib = (w.bibliography || []).map(b => `<li${orig(ctx)}>${md(b.ref, ctx)}${b.pages ? `, p.&nbsp;${esc(b.pages)}` : ""}</li>`).join("");
  const disco = (w.discography || []).map(d => `<li${orig(ctx)}>${md(d.text, ctx)}</li>`).join("");
  const video = (w.videography || []).map(d => `<li${orig(ctx)}>${md(d.text, ctx)}</li>`).join("");
  const related = (w.related || []).filter(r => byId.has(r.id)).map(r => `<li><span class="rel">${t.relation[r.relation] || r.relation}</span> ${workRef(byId.get(r.id), ctx)}</li>`).join("");
  const notes = !PUBLIC && w.editorial_notes ? `<ul class="todo">${w.editorial_notes.map(n => `<li lang="fr">${md(n, ctx)}</li>`).join("")}</ul>` : "";

  const sections = [
    ["textes", t.f.text, textHtml], ["dedicace", t.f.dedication, dedHtml], ["sources", t.f.sources, srcHtml],
    ["remarques", t.f.remarks, remarks], ["intertexte", t.f.intertextual, inter], ["edition", t.f.editions, edHtml],
    ["executions", `${t.f.premiere} · ${t.f.performances}`, perfHtml], ["carnet", t.f.journal, journal ? `<div class="journal">${journal}</div>` : ""],
    ["documents", t.f.documents, docs], ["bibliographie", t.f.bibliography, bib ? `<ul class="plain">${bib}</ul>` : ""],
    ["discographie", t.f.discography, disco ? `<ul class="plain">${disco}</ul>` : ""],
    ["videographie", t.f.videography, video ? `<ul class="plain">${video}</ul>` : ""],
    ["liens", t.f.related, related ? `<ul class="plain rel-list">${related}</ul>` : ""],
    ["redaction", t.f.editorial, notes, "is-editorial"],
  ];
  const toc = sections.filter(s => s[2]).map(([id, lab]) => `<a href="#${id}">${lab}</a>`).join("");
  const cite = `<section class="cite" id="citer"><h2 class="field-label">${t.f.cite}</h2>
    <p class="cite-text" data-th="${esc(w.th)}" data-title="${esc(strip(w.title))}">${esc(t.citeText(w.th, strip(w.title), "[URL]", fmtDate(BUILD_DATE, lang)))}</p>
    <button type="button" class="btn copy" data-copy=".cite-text" data-label-done="${t.copied}">${t.copy}</button></section>`;

  const alt = l => workUrl(ctx, w.id, l);
  const body = `
<nav class="crumbs wrap" aria-label="breadcrumb"><a href="${pageUrl(ctx, "catalogue")}">${t.nav.catalogue}</a> <span>›</span> <a href="${pageUrl(ctx, "catalogue")}#livre-${w.book}">${t.book} ${book?.roman || w.book}</a> <span>›</span> <span>Th ${esc(w.th)}</span></nav>
<article class="notice wrap">
  <header class="notice-head">
    <div class="th-mark" aria-hidden="true"></div>
    <p class="th-big"><span class="th-lab">Th</span>${esc(w.th)}</p>
    <div class="title-block">
      <h1>${workTitleHtml(w, ctx)}</h1>
      <p class="opus-line">${opusLabel(w, ctx)}</p>
      ${w.alt_titles ? `<p class="alt-titles"><span class="sub-label">${t.f.altTitles}</span> ${w.alt_titles.map(a => `<span><cite>${md(a.title, ctx)}</cite> <span class="muted"${orig(ctx)}>(${esc(a.source)})</span></span>`).join(" · ")}</p>` : ""}
    </div>
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  </header>
  ${lang === "en" ? `<p class="lang-note">${t.frOnly}</p>` : ""}
  ${mvHtml ? `<section class="incipits" aria-label="${t.f.movements}">${mvHtml}</section>` : ""}
  <div class="notice-grid">
    <nav class="toc" aria-label="${ctx.lang === "fr" ? "Rubriques de la notice" : "Entry sections"}">${toc}<a href="#citer">${t.f.cite}</a></nav>
    <div class="fields">${sections.map(s => section(...s)).join("")}${cite}</div>
  </div>
  <nav class="pager" aria-label="pager">
    ${prev ? `<a class="pg prev" href="${workUrl(ctx, prev.id)}"><span class="pg-lab">← ${t.prev}</span>${workRef(prev, ctx).replace(/<a[^>]*>|<\/a>/g, "")}</a>` : "<span></span>"}
    ${next ? `<a class="pg next" href="${workUrl(ctx, next.id)}"><span class="pg-lab">${t.next} →</span>${workRef(next, ctx).replace(/<a[^>]*>|<\/a>/g, "")}</a>` : "<span></span>"}
  </nav>
</article>`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "MusicComposition", name: strip(w.title) + (w.subtitle ? ` « ${strip(w.subtitle)} »` : ""),
    identifier: `Th ${w.th}`, composer: { "@type": "Person", name: "Olivier Greif" },
    ...(w.composition?.from ? { dateCreated: w.composition.from } : {}),
    ...(w.opus ? { musicCompositionForm: undefined, alternateName: `op. ${w.opus}` } : {}),
    ...(w.text?.authors?.length ? { lyricist: w.text.authors.map(a => ({ "@type": "Person", name: a.name })) } : {}),
  };
  const page = layout(ctx, { title: `Th ${w.th} ${strip(w.title)}`, body, active: "catalogue", alt, jsonld, desc: `Th ${w.th}, ${strip(w.title)}, ${strip(w.scoring)}${w.composition ? ", " + strip(w.composition.text) : ""}` });
  out(`${lang}/${WORK_DIR[lang]}/${w.id}.html`, page.full);
}

function journalEntry(e, ctx, w = null) {
  const date = ctx.lang === "fr" ? md(e.date_text, ctx) : (e.date ? fmtDate(e.date, "en") : md(e.date_text, ctx));
  return `<div class="j-entry">
    <div class="j-date">${date}${e.context ? `<span class="j-ctx"${orig(ctx)}>${md(e.context, ctx)}</span>` : ""}${w ? `<span class="j-work">${workRef(w, ctx)}</span>` : ""}</div>
    <div class="j-body"${orig(ctx)}>${e.note ? `<p class="muted">${md(e.note, ctx)}</p>` : ""}${(e.quotes || []).map(q => `<blockquote>${md(q, ctx, { block: true })}</blockquote>`).join("")}</div>
  </div>`;
}

// ------------------------------------------------------------------ pages d'index
function letterGroups(items, keyFn) {
  const g = new Map();
  for (const it of items) { const k = (keyFn(it)[0] || "#").toUpperCase(); const kk = /[A-Z]/.test(k) ? k : "#"; (g.get(kk) || g.set(kk, []).get(kk)).push(it); }
  return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
const letterNav = groups => `<nav class="letters" aria-label="A–Z">${groups.map(([l]) => `<a href="#l-${l}">${l}</a>`).join("")}</nav>`;

function stdPage(lang, key, body, { active = "indexes", lede, eyebrow } = {}) {
  const ctx = { lang, depth: 1, noindex: key === "dashboard" };
  const t = L(ctx);
  const [h, d] = t.idx[key] || [t.nav[key] || key, ""];
  const html = typeof body === "function" ? body(ctx) : body;
  const page = layout(ctx, { title: h, body: pageHead(eyebrow ?? (t.idx[key] ? t.nav.indexes : t.siteSub), h, lede ?? d) + `<div class="wrap page-body">${html}</div>`, active, alt: l => pageUrl(ctx, key, l), desc: d });
  out(`${lang}/${PAGES[key][lang]}`, page.full);
}

// -- Catalogue
function catalogue(ctx) {
  const t = L(ctx);
  const cats = [...new Set(works.flatMap(w => w.categories))];
  const filters = `<div class="filters" role="group" aria-label="filters">
    <label class="fl"><span>${t.filterBook}</span><select id="f-book"><option value="">${t.filterAll}</option>${books.map(b => `<option value="${b.number}">${t.book} ${b.roman}</option>`).join("")}</select></label>
    <label class="fl"><span>${t.filterCat}</span><select id="f-cat"><option value="">${t.filterAll}</option>${cats.map(c => `<option value="${c}">${t.cat[c]}</option>`).join("")}</select></label>
    <label class="fl"><span>${t.filterStatus}</span><select id="f-status"><option value="">${t.filterAll}</option>${Object.entries(t.status).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
    <label class="fl grow"><span>${t.nav.search}</span><input id="f-q" type="search" placeholder="${t.searchPlaceholder}"></label>
    <p class="count" id="f-count" aria-live="polite"></p></div>`;
  const rows = w => {
    const status = [w.editions?.some(e => e.year) ? "published" : "", w.unpublished ? "unpublished" : "", w.sources && w.sources.status !== "located" ? "lostms" : ""].filter(Boolean).join(" ");
    return `<tr data-book="${w.book}" data-cat="${w.categories.join(" ")}" data-status="${status}" data-q="${esc(fold([w.title, w.subtitle, ...(w.alt_titles || []).map(a => a.title), w.scoring, w.opus ? "op " + w.opus : ""].join(" ")))}">
      <td class="c-th"><a href="${workUrl(ctx, w.id)}">${esc(w.th)}</a></td>
      <td class="c-title"><a href="${workUrl(ctx, w.id)}">${workTitleHtml(w, ctx)}</a>${w.unpublished ? ` <span class="dot" title="${t.f.unpublished}"></span>` : ""}</td>
      <td class="c-op">${w.opus ? esc(w.opus) : "<span class=muted>—</span>"}</td>
      <td class="c-sc">${md(scoringLabel(w.scoring, ctx.lang), ctx)}</td>
      <td class="c-date">${w.composition?.from ? fmtRange(w.composition.from, w.composition.to, ctx.lang) : `<span class="muted">—</span>`}</td></tr>`;
  };
  const head = `<thead><tr><th>${t.col.th}</th><th>${t.col.title}</th><th>${t.col.opus}</th><th class="c-sc">${t.col.scoring}</th><th>${t.col.date}</th></tr></thead>`;
  return filters + books.map(b => {
    const ws = works.filter(w => w.book === b.number);
    const span = ws.length ? `Th ${ws[0].th}–${ws[ws.length - 1].th}` : "";
    return `<section class="book" id="livre-${b.number}" data-book-section="${b.number}">
      <header class="book-head"><h2><span class="roman">${b.roman}</span> ${t.book} ${b.roman}</h2>
      <p class="book-meta">${ws.length ? `${span} · ${t.worksN(ws.length)}${b.status === "partial" ? ` · ${t.partial}` : ""}` : t.inPreparation}</p></header>
      ${ws.length ? `<div class="table-scroll"><table class="cat">${head}<tbody>${ws.map(rows).join("")}</tbody></table></div>` : ""}
    </section>`;
  }).join("");
}

// -- Chronologie
function chrono(ctx) {
  const t = L(ctx);
  const ys = works.map(w => year(w.composition?.from)).filter(Boolean);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const counts = {}; ys.forEach(y => counts[y] = (counts[y] || 0) + 1);
  const max = Math.max(...Object.values(counts));
  let strip = `<div class="yearstrip" role="img" aria-label="${ctx.lang === "fr" ? "Nombre d'œuvres par année" : "Works per year"}">`;
  for (let y = y0; y <= y1; y++) strip += `<a href="#y${y}" class="yb${counts[y] ? "" : " empty"}" title="${y} : ${counts[y] || 0}"><span class="bar" style="--h:${(counts[y] || 0) / max}"></span><span class="yl">${String(y).slice(2)}</span></a>`;
  strip += `</div>`;
  const groups = new Map();
  for (const w of works) { const y = year(w.composition?.from) || "?"; (groups.get(y) || groups.set(y, []).get(y)).push(w); }
  const sorted = [...groups.entries()].sort((a, b) => (a[0] === "?") - (b[0] === "?") || a[0] - b[0]);
  return strip + sorted.map(([y, ws]) => `<section class="yr" id="y${y}"><h2 class="yr-h">${y === "?" ? t.unknownDate : y}</h2><ul class="wl">${ws.sort((a, b) => String(a.composition?.from || "").localeCompare(String(b.composition?.from || "")) || thKey(a.th) - thKey(b.th)).map(w => `<li>${workRef(w, ctx)} <span class="muted">${w.composition?.from ? fmtRange(w.composition.from, w.composition.to, ctx.lang) : ""} · ${md(scoringLabel(w.scoring, ctx.lang), ctx)}</span></li>`).join("")}</ul></section>`).join("");
}

// -- Opus
function opus(ctx) {
  const t = L(ctx);
  const withOp = works.filter(w => w.opus).sort((a, b) => +a.opus - +b.opus);
  const sans = works.filter(w => !w.opus);
  const row = w => `<tr><td class="c-op">${w.opus ? "op.&nbsp;" + esc(w.opus) : "—"}</td><td class="c-th"><a href="${workUrl(ctx, w.id)}">${esc(w.th)}</a></td><td><a href="${workUrl(ctx, w.id)}">${workTitleHtml(w, ctx)}</a></td><td class="c-date">${w.composition?.from ? year(w.composition.from) : "—"}</td></tr>`;
  const head = `<thead><tr><th>${t.col.opus}</th><th>${t.col.th}</th><th>${t.col.title}</th><th>${t.col.year}</th></tr></thead>`;
  return `<div class="table-scroll"><table class="cat">${head}<tbody>${withOp.map(row).join("")}</tbody></table></div>
  <h2 class="sec-h">${t.noOpus}</h2><div class="table-scroll"><table class="cat">${head}<tbody>${sans.map(row).join("")}</tbody></table></div>`;
}

// -- Titres
function titles(ctx) {
  const t = L(ctx);
  const items = [];
  for (const w of works) {
    items.push({ d: workTitleHtml(w, ctx), k: sortTitle(w.title), w, kind: "main" });
    for (const a of w.alt_titles || []) items.push({ d: `<cite>${md(a.title, ctx)}</cite>`, k: sortTitle(a.title), w, kind: "alt", src: a.source });
  }
  const mitems = [];
  for (const w of works) for (const m of w.movements || []) if (m.title) {
    const clean = strip(m.title).replace(/^[«\s]+|[»\s]+$/g, "").replace(/^(-?\s*[IVX\d]+\s*[-.)/]?\s*-?\s*|Nº\s*\d+\.?\s*|\d+\)\s*)/i, "").replace(/^\[|\]$/g, "").trim();
    if (clean && !/^\[?\d*\.?\]?$/.test(clean)) mitems.push({ d: esc(clean), k: sortTitle(clean), w });
  }
  items.sort((a, b) => a.k.localeCompare(b.k, "fr")); mitems.sort((a, b) => a.k.localeCompare(b.k, "fr"));
  const groups = letterGroups(items, i => i.k);
  return letterNav(groups) + groups.map(([l, its]) => `<section class="letter" id="l-${l}"><h2 class="letter-h">${l}</h2><ul class="idx">${its.map(i => i.kind === "main"
    ? `<li><a href="${workUrl(ctx, i.w.id)}">${i.d}</a> <span class="thn">Th&nbsp;${esc(i.w.th)}</span></li>`
    : `<li class="alt">${i.d} <span class="muted"${orig(ctx)}>(${esc(i.src)})</span> → ${workRef(i.w, ctx)}</li>`).join("")}</ul></section>`).join("")
    + `<h2 class="sec-h">${t.movementTitles}</h2><ul class="idx cols">${mitems.map(i => `<li><span${orig(ctx)}>${i.d}</span> — ${workRef(i.w, ctx)}</li>`).join("")}</ul>`;
}

// -- Incipits littéraires
function incipits(ctx) {
  const items = [];
  for (const w of works) (w.movements || []).forEach((m, i) => { if (m.text_incipit) items.push({ txt: m.text_incipit, w, m, author: w.text?.authors?.[0]?.name }); });
  items.sort((a, b) => fold(a.txt).localeCompare(fold(b.txt), "fr"));
  return `<ul class="idx inc">${items.map(i => `<li><span class="txt-inc"${orig(ctx)}>${md(i.txt, ctx)}</span> <span class="muted">${i.author ? esc(i.author) + " · " : ""}</span>${workRef(i.w, ctx)}${i.m.title && (i.w.movements || []).length > 1 ? ` <span class="muted"${orig(ctx)}>${md(i.m.title, ctx)}</span>` : ""}</li>`).join("")}</ul>`;
}

// -- Personnes
function personsPage(ctx) {
  const t = L(ctx);
  const list = [...persons.values()].sort((a, b) => a.sort.localeCompare(b.sort, "fr"));
  const groups = letterGroups(list, p => fold(p.sur));
  const chips = `<div class="chips" role="group" aria-label="filter">${Object.entries(t.personFilter).map(([k, v], i) => `<button type="button" class="chip" data-role="${k}" aria-pressed="${i === 0}">${v}</button>`).join("")}</div>`;
  const roleBlock = (p, r) => {
    const items = p.roles[r]; if (!items) return "";
    const uniq = new Map(); for (const it of items) { const k = it.w.id; if (!uniq.has(k)) uniq.set(k, []); if (it.detail) uniq.get(k).push(it.detail); }
    return `<div class="p-role"><span class="role-lab">${t.roles[r]}</span> ${[...uniq.entries()].map(([id, ds]) => {
      const w = byId.get(id); const roles = [...new Set(ds.map(d => d.role).filter(x => x && x !== "ensemble"))].map(x => roleLabel(x, ctx.lang));
      const dates = ds.map(d => year(d.date)).filter(Boolean); const yr = dates.length ? (Math.min(...dates) === Math.max(...dates) ? Math.min(...dates) : `${Math.min(...dates)}–${Math.max(...dates)}`) : "";
      return `<span class="p-w">${workRef(w, ctx)}${roles.length || yr ? ` <span class="muted">(${[roles.join(", "), yr].filter(Boolean).join(", ")})</span>` : ""}</span>`;
    }).join("; ")}</div>`;
  };
  return chips + letterNav(groups) + groups.map(([l, ps]) => `<section class="letter" id="l-${l}"><h2 class="letter-h">${l}</h2><ul class="persons">${ps.map(p => {
    const rs = Object.keys(p.roles); const roleAttr = rs.map(r => r === "translator" ? "author" : r).join(" ");
    return `<li id="${p.key}" data-roles="${roleAttr}"><p class="p-name"><strong>${esc(p.sur)}</strong>${p.given ? `, ${esc(p.given)}` : ""}</p>${["author", "translator", "dedicatee", "performer"].map(r => roleBlock(p, r)).join("")}</li>`;
  }).join("")}</ul></section>`).join("");
}

// -- Lieux
function places(ctx) {
  const t = L(ctx);
  const g = new Map();
  for (const p of allPerfs) { const k = p.city ? (p.country ? `${p.city} (${p.country})` : p.city) : t.unknownPlace; (g.get(k) || g.set(k, []).get(k)).push(p); }
  const groups = [...g.entries()].sort((a, b) => fold(a[0]).localeCompare(fold(b[0])));
  return `<nav class="letters wide">${groups.map(([k, ps]) => `<a href="#p-${slug(k)}">${esc(k)} <span class="muted">${ps.length}</span></a>`).join("")}</nav>` +
    groups.map(([k, ps]) => `<section class="place" id="p-${slug(k)}"><h2 class="sec-h">${esc(k)}</h2>${perfTable(ps, ctx, true)}</section>`).join("");
}

// -- Exécutions
function performancesPage(ctx) {
  const t = L(ctx);
  const none = works.filter(w => !w.premiere && !w.performances);
  return perfTable(allPerfs, ctx, true) + `<h2 class="sec-h">${t.notCited}</h2><ul class="wl cols">${none.map(w => `<li>${workRef(w, ctx)}</li>`).join("")}</ul>`;
}

// -- Effectifs
function scoring(ctx) {
  const t = L(ctx);
  const cats = ["piano", "two-pianos", "voice-piano", "vocal-ensemble", "chamber", "choral", "orchestra", "undetermined"];
  return `<nav class="letters wide">${cats.map(c => `<a href="#c-${c}">${t.cat[c]} <span class="muted">${works.filter(w => w.categories.includes(c)).length}</span></a>`).join("")}</nav>` +
    cats.map(c => { const ws = works.filter(w => w.categories.includes(c)); return ws.length ? `<section id="c-${c}"><h2 class="sec-h">${t.cat[c]}</h2><ul class="wl">${ws.map(w => `<li>${workRef(w, ctx)} <span class="muted">${md(scoringLabel(w.scoring, ctx.lang), ctx)}${w.composition?.from ? " · " + year(w.composition.from) : ""}</span></li>`).join("")}</ul></section>` : ""; }).join("");
}

// -- Manuscrits
function sourcesPage(ctx) {
  const t = L(ctx);
  const bySig = new Map(), byPaper = new Map(), byFeat = new Map(), lost = [];
  for (const w of works) {
    const s = w.sources; if (!s) continue;
    if (s.siglum) (bySig.get(s.siglum) || bySig.set(s.siglum, []).get(s.siglum)).push(w);
    for (const p of s.papers || []) (byPaper.get(p) || byPaper.set(p, []).get(p)).push(w);
    for (const f of s.features || []) (byFeat.get(f) || byFeat.set(f, []).get(f)).push(w);
    if (s.status !== "located") lost.push(w);
  }
  const block = (title, map, labelFn = k => esc(k)) => `<h2 class="sec-h">${title}</h2><div class="grid-2">${[...map.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, ws]) => `<section class="card"><h3>${labelFn(k)} <span class="muted">${ws.length}</span></h3><ul class="wl compact">${ws.map(w => `<li>${workRef(w, ctx)}</li>`).join("")}</ul></section>`).join("")}</div>`;
  return block(t.bySiglum, bySig, k => `<span class="siglum">${esc(k)}</span>`) + block(t.papers, byPaper, k => `<span${orig(ctx)}>papier ${esc(k)}</span>`) + block(t.featuresTitle, byFeat, k => t.features[k])
    + `<h2 class="sec-h">${t.lostOrUnlocated}</h2><ul class="wl">${lost.map(w => `<li>${workRef(w, ctx)} <span class="tag tag-red">${t.srcStatus[w.sources.status]}</span></li>`).join("")}</ul>`;
}

// -- Éditions
function editionsPage(ctx) {
  const t = L(ctx);
  const byPub = new Map();
  for (const w of works) for (const e of w.editions || []) { const k = e.publisher || "—"; (byPub.get(k) || byPub.set(k, []).get(k)).push({ w, e }); }
  const unpub = works.filter(w => w.unpublished);
  return `<div class="grid-2">${[...byPub.entries()].sort().map(([k, its]) => `<section class="card"><h3>${esc(k)} <span class="muted">${its.length}</span></h3><ul class="wl compact">${its.sort((a, b) => (a.e.year || 0) - (b.e.year || 0)).map(({ w, e }) => `<li>${workRef(w, ctx)} <span class="muted"${orig(ctx)}>${md(e.text, ctx)}</span></li>`).join("")}</ul></section>`).join("")}</div>
  <h2 class="sec-h">${t.unpublishedList} <span class="muted">${unpub.length}</span></h2><ul class="wl cols">${unpub.map(w => `<li>${workRef(w, ctx)}</li>`).join("")}</ul>`;
}

// -- Bibliographie
function biblio(ctx) {
  const t = L(ctx);
  const byRef = new Map();
  for (const w of works) for (const b of w.bibliography || []) (byRef.get(b.ref) || byRef.set(b.ref, []).get(b.ref)).push({ w, pages: b.pages });
  return [...byRef.entries()].map(([ref, its]) => {
    const pageMap = new Map();
    for (const { w, pages } of its) for (const tok of String(pages || "").split(/,\s*/)) {
      const p = tok.trim(); if (!p) continue; const n = parseInt(p, 10); if (isNaN(n)) continue;
      (pageMap.get(p) || pageMap.set(p, { n, ws: [] }).get(p)).ws.push(w);
    }
    const pages = [...pageMap.entries()].sort((a, b) => a[1].n - b[1].n || a[0].localeCompare(b[0]));
    return `<section><h2 class="sec-h"${orig(ctx)}>${md(ref, ctx)}</h2>
    <div class="table-scroll"><table class="cat"><thead><tr><th>${t.col.th}</th><th>${t.col.title}</th><th>${t.col.pages}</th></tr></thead><tbody>${its.map(({ w, pages }) => `<tr><td class="c-th"><a href="${workUrl(ctx, w.id)}">${esc(w.th)}</a></td><td>${workTitleHtml(w, ctx)}</td><td class="c-pages">p.&nbsp;${esc(pages)}</td></tr>`).join("")}</tbody></table></div>
    <h3 class="sub-h">${ctx.lang === "fr" ? "Index des pages" : "Page index"}</h3>
    <dl class="pageidx">${pages.map(([p, { ws }]) => `<div><dt>p.&nbsp;${esc(p)}</dt><dd>${ws.map(w => `<a href="${workUrl(ctx, w.id)}">Th&nbsp;${esc(w.th)}</a>`).join(", ")}</dd></div>`).join("")}</dl></section>`;
  }).join("");
}

// -- Discographie
function disco(ctx) {
  const t = L(ctx);
  const block = (key, label) => {
    const m = new Map();
    for (const w of works) for (const d of w[key] || []) { const k = d.title || strip(d.text); (m.get(k) || m.set(k, { year: d.year, ws: [] }).get(k)).ws.push({ w, d }); }
    const list = [...m.entries()].sort((a, b) => (a[1].year || 0) - (b[1].year || 0));
    return `<h2 class="sec-h">${label}</h2><div class="grid-2">${list.map(([k, v]) => `<section class="card"><h3><cite>${esc(k)}</cite>${v.year ? ` <span class="muted">${v.year}</span>` : ""}</h3><ul class="wl compact">${v.ws.map(({ w, d }) => `<li>${workRef(w, ctx)}${d.details ? ` <span class="muted"${orig(ctx)}>${md(d.details, ctx)}</span>` : ""}</li>`).join("")}</ul></section>`).join("")}</div>`;
  };
  return block("discography", t.f.discography) + block("videography", t.f.videography);
}

// -- Carnet de bord
function journalPage(ctx) {
  const t = L(ctx);
  const entries = [];
  for (const w of works) for (const e of w.journal || []) entries.push({ e, w });
  entries.sort((a, b) => String(a.e.date || "9999").localeCompare(String(b.e.date || "9999")));
  const g = new Map(); for (const it of entries) { const y = year(it.e.date) || "?"; (g.get(y) || g.set(y, []).get(y)).push(it); }
  const groups = [...g.entries()];
  return `<nav class="letters">${groups.map(([y]) => `<a href="#j${y}">${y === "?" ? "?" : y}</a>`).join("")}</nav>` +
    groups.map(([y, its]) => `<section id="j${y}"><h2 class="yr-h">${y === "?" ? t.unknownDate : y}</h2><div class="journal">${its.map(({ e, w }) => journalEntry(e, ctx, w)).join("")}</div></section>`).join("");
}

// -- Index général
function indexesPage(ctx) {
  const t = L(ctx);
  const keys = ["chrono", "opus", "titles", "incipits", "persons", "places", "performances", "scoring", "sources", "editions", "biblio", "disco", "journal"];
  const counts = {
    chrono: works.filter(w => w.composition?.from).length, opus: works.filter(w => w.opus).length,
    titles: works.length + works.reduce((n, w) => n + (w.alt_titles?.length || 0), 0),
    incipits: works.reduce((n, w) => n + (w.movements || []).filter(m => m.text_incipit).length, 0),
    persons: persons.size, places: new Set(allPerfs.map(p => p.city)).size, performances: allPerfs.length,
    scoring: 8, sources: works.filter(w => w.sources?.status === "located").length,
    editions: works.reduce((n, w) => n + (w.editions?.length || 0), 0),
    biblio: works.filter(w => w.bibliography).length, disco: works.reduce((n, w) => n + (w.discography?.length || 0) + (w.videography?.length || 0), 0),
    journal: works.reduce((n, w) => n + (w.journal?.length || 0), 0),
  };
  const all = PUBLIC ? keys : [...keys, "dashboard"];
  return `<ul class="idx-grid">${all.map(k => `<li><a href="${pageUrl(ctx, k)}"><span class="idx-n">${counts[k] ?? ""}</span><span class="idx-t">${t.idx[k][0]}</span><span class="idx-d">${t.idx[k][1]}</span></a></li>`).join("")}</ul>`;
}

// -- Rédaction
function dashboard(ctx) {
  const t = L(ctx);
  const rows = works.map(w => {
    const mv = w.movements || [];
    const inc = mv.filter((m, i) => hasIncipit(w, i)).length;
    const bars = mv.filter(m => m.bars).length;
    const checks = [w.composition?.from, w.sources?.items || w.sources?.intro || (w.sources && w.sources.status !== "located"), mv.length ? bars === mv.length : true, w.duration];
    const score = checks.filter(Boolean).length / checks.length;
    return `<tr><td class="c-th"><a href="${workUrl(ctx, w.id)}">${esc(w.th)}</a></td><td>${workTitleHtml(w, ctx)}</td>
      <td class="c-num">${inc}/${mv.length}</td><td class="c-num">${bars}/${mv.length}</td>
      <td>${w.composition?.from ? "✓" : "<span class=miss>—</span>"}</td><td>${w.sources ? "✓" : "<span class=miss>—</span>"}</td><td>${w.duration ? "✓" : "<span class=miss>—</span>"}</td>
      <td><span class="meter" style="--v:${score}"></span></td>
      <td lang="fr">${(w.editorial_notes || []).map(n => `<div class="note">${md(n, ctx)}</div>`).join("")}</td></tr>`;
  }).join("");
  const vv = [...new Map(variants.map(v => [v.join("→"), v])).values()];
  return `<p class="warn">${t.dashboardWarn}</p>
  <div class="table-scroll"><table class="cat dash"><thead><tr><th>Th</th><th>${t.col.title}</th><th>${t.incipitsFound}</th><th>${t.barsKnown}</th><th>${t.f.composition}</th><th>${t.f.sources}</th><th>${t.f.duration}</th><th>${t.completeness}</th><th>${t.f.editorial}</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2 class="sec-h">${t.nameVariants}</h2><ul class="plain">${vv.map(([a, b]) => `<li><span class="muted">${esc(a)}</span> → ${esc(b)}</li>`).join("")}</ul>`;
}

// -- Accueil
function home(ctx) {
  const t = L(ctx);
  const fr = ctx.lang === "fr";
  const nJournal = works.reduce((n, w) => n + (w.journal?.length || 0), 0);
  const stats = [[works.length, fr ? "notices" : "entries"], [works.filter(w => w.sources?.status === "located").length, fr ? "manuscrits localisés" : "located manuscripts"], [allPerfs.length, fr ? "exécutions" : "performances"], [nJournal, fr ? "extraits du carnet de bord" : "journal extracts"]];
  const intro = fr
    ? `Olivier Greif a lui-même réparti l'ensemble de sa production en six Livres. Ce catalogue en suit l'ordre et attribue à chaque œuvre un numéro <abbr title="numéro du catalogue thématique">Th</abbr>, chronologique, distinct des numéros d'opus du catalogue autographe (CaG). Chaque notice réunit les incipits musicaux et littéraires, la description des sources, les créations et exécutions, les extraits du carnet de bord et la bibliographie.`
    : `Olivier Greif himself divided his output into six Books. This catalogue follows that order and gives each work a chronological <abbr title="thematic catalogue number">Th</abbr> number, distinct from the opus numbers in the composer's autograph catalogue (CaG). Each entry brings together the musical and text incipits, a description of the sources, first and later performances, extracts from the composer's journal, and the bibliography.`;
  const bookCards = books.map(b => {
    const ws = works.filter(w => w.book === b.number);
    const ys = ws.map(w => year(w.composition?.from)).filter(Boolean);
    return `<li class="bk${ws.length ? "" : " empty"}"><a href="${pageUrl(ctx, "catalogue")}#livre-${b.number}"><span class="bk-roman">${b.roman}</span><span class="bk-t">${t.book} ${b.roman}</span><span class="bk-m">${ws.length ? `Th ${ws[0].th}–${ws[ws.length - 1].th}<br>${ys.length ? Math.min(...ys) + "–" + Math.max(...ys) : ""}<br>${t.worksN(ws.length)}${b.status === "partial" ? ` · ${t.partial}` : ""}` : t.inPreparation}</span></a></li>`;
  }).join("");
  const idxKeys = ["chrono", "opus", "titles", "incipits", "persons", "places", "performances", "scoring", "sources", "editions", "biblio", "disco"];
  return `<section class="hero wrap">
    <div class="hero-text">
      <p class="eyebrow">${fr ? "Catalogue thématique et critique" : "Thematic and critical catalogue"}</p>
      <h1 class="hero-h"><span>Olivier Greif</span><span class="hero-dates">1950–2000</span></h1>
      <p class="lede">${intro}</p>
      <form class="hero-search" action="${pageUrl(ctx, "search")}" role="search"><label class="sr" for="hs">${t.nav.search}</label><input id="hs" name="q" type="search" placeholder="${t.searchPlaceholder}"><button class="btn" type="submit">${t.nav.search}</button></form>
    </div>
    <dl class="stats">${stats.map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join("")}</dl>
  </section>
  <section class="wrap"><h2 class="sec-h">${t.books}</h2><ol class="books">${bookCards}</ol></section>
  <section class="wrap"><h2 class="sec-h">${t.nav.indexes}</h2><ul class="idx-links">${idxKeys.map(k => `<li><a href="${pageUrl(ctx, k)}">${t.idx[k][0]}</a></li>`).join("")}<li><a href="${pageUrl(ctx, "journal")}">${t.idx.journal[0]}</a></li></ul></section>`;
}

// -- Recherche
function searchPage(ctx) {
  const t = L(ctx);
  return `<form class="search-form" role="search" onsubmit="return false"><label class="sr" for="sq">${t.nav.search}</label><input id="sq" type="search" placeholder="${t.searchPlaceholder}" autocomplete="off" data-index="${asset(ctx, `search-${ctx.lang}.json`)}" data-workbase="${up(ctx)}${ctx.lang}/${WORK_DIR[ctx.lang]}/"><p class="count" id="sq-count" aria-live="polite"></p></form><ol class="results" id="sq-results" data-none="${esc(t.searchNone)}" data-hint="${esc(t.searchHint(2).replace("2", "{n}"))}"></ol>`;
}
function searchIndex(lang) {
  const ctx = { lang, depth: 1 };
  return works.map(w => {
    const parts = [w.title, w.subtitle, w.opus ? `op. ${w.opus}` : "", w.scoring, ...(w.alt_titles || []).map(a => a.title),
      ...(w.movements || []).flatMap(m => [m.title, m.text_incipit]), w.text?.credit, w.dedication?.text, ...(w.dedication?.persons || []),
      w.sources?.intro, ...(w.sources?.items || []).map(i => i.text), ...(w.remarks || []), ...(w.intertextual || []),
      ...(w.premiere || []).map(p => p.text), ...(w.performances || []).map(p => p.text),
      ...(w.journal || []).flatMap(e => [e.date_text, e.context, ...(e.quotes || [])]), ...(w.documents || []),
      ...(w.discography || []).map(d => d.text), ...(w.editions || []).map(e => e.text)];
    return { id: w.id, th: w.th, t: strip(w.title), s: w.subtitle ? strip(w.subtitle) : "", a: (w.alt_titles || []).map(a => strip(a.title)).join(" · "), y: w.composition?.from ? year(w.composition.from) : "", sc: strip(scoringLabel(w.scoring, lang)), x: parts.filter(Boolean).map(strip).join(" ¶ ") };
  });
}

// -- À propos
function about(ctx) {
  const fr = ctx.lang === "fr";
  const rows = fr ? [
    ["Th", "Numéro du catalogue thématique. Les lettres (a, b) distinguent les versions ou œuvres dérivées. La numérotation n'est pas encore définitive : chaque notice a un identifiant permanent, utilisé dans l'adresse de la page, et les renvois « Th » sont recalculés automatiquement."],
    ["CaG", "Catalogue autographe d'Olivier Greif."], ["F-Pbmgf", "Paris, Bibliothèque musicale La Grange-Fleuret, fonds Olivier Greif."], ["F-Pmm", "[à préciser]"],
    ["Ms.", "Manuscrit."], ["f.", "Feuillet."], ["rº / vº", "Recto / verso."], ["mes.", "Mesures."], ["mvt", "Mouvement."], ["s. d.", "Sans date."],
    ["« … »", "Transcription diplomatique (page de titre, mentions autographes)."], ["|", "Changement de ligne dans la transcription."], ["[ … ]", "Restitution ou commentaire éditorial."], ["[sic]", "Graphie de l'original."],
  ] : [
    ["Th", "Thematic catalogue number. Letters (a, b) mark versions or derived works. Numbering is not yet final: each entry has a permanent identifier, used in the page address, and “Th” cross-references are recomputed automatically."],
    ["CaG", "Olivier Greif's autograph catalogue."], ["F-Pbmgf", "Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection."], ["F-Pmm", "[to be specified]"],
    ["Ms.", "Manuscript."], ["f.", "Folio."], ["rº / vº", "Recto / verso."], ["mes.", "Bars (mesures)."], ["mvt", "Movement."], ["s. d.", "Undated."],
    ["« … »", "Diplomatic transcription (title page, autograph inscriptions)."], ["|", "Line break in the transcription."], ["[ … ]", "Editorial restoration or comment."], ["[sic]", "Spelling of the original."],
  ];
  return `<div class="prose">
  <p>${fr ? "Ce catalogue est destiné aux chercheurs. Il vise l'exhaustivité et suit le modèle des catalogues thématiques critiques (Nectoux pour Fauré, Kayas pour Ligeti)." : "This catalogue is intended for researchers. It aims to be exhaustive and follows the model of critical thematic catalogues (Nectoux for Fauré, Kayas for Ligeti)."}</p>
  <p class="motif"><span class="th-mark small" aria-hidden="true"></span>${fr ? "Les deux traits rouges qui ouvrent chaque notice reprennent la marque que Greif traçait au crayon rouge dans l'angle supérieur gauche de certains manuscrits." : "The two red strokes that open each entry echo the mark Greif drew in red pencil in the top left corner of some of his manuscripts."}</p>
  <h2 class="sec-h">${fr ? "Abréviations et conventions" : "Abbreviations and conventions"}</h2>
  <dl class="abbr">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  <h2 class="sec-h">${fr ? "Incipits" : "Incipits"}</h2>
  <p>${fr ? "Les incipits musicaux sont gravés avec Finale et exportés en PNG. Chaque fichier est rangé sous <code>incipits/&lt;identifiant&gt;/&lt;n&gt;.png</code>, où <em>n</em> est le numéro d'ordre du mouvement." : "Musical incipits are engraved in Finale and exported as PNG. Each file is stored as <code>incipits/&lt;identifier&gt;/&lt;n&gt;.png</code>, where <em>n</em> is the movement's position."}</p>
  </div>`;
}

// ------------------------------------------------------------------ assemblage
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "assets"))) fs.copyFileSync(path.join(ROOT, "assets", f), path.join(DIST, "assets", f));
if (fs.existsSync(incipitDir)) fs.cpSync(incipitDir, path.join(DIST, "incipits"), { recursive: true, filter: s => !s.endsWith(".md") });

for (const lang of LANGS) {
  works.forEach((w, i) => workPage(w, i, lang));
  const ctx = { lang, depth: 1 };
  const t = T[lang];
  out(`${lang}/${PAGES.home[lang]}`, layout(ctx, { title: "", body: home(ctx), active: "home", alt: l => pageUrl(ctx, "home", l), bodyClass: "home" }).full);
  stdPage(lang, "catalogue", catalogue, { active: "catalogue", eyebrow: t.siteSub, lede: lang === "fr" ? "Les œuvres dans l'ordre des Livres et des numéros Th." : "Works in the order of the Books and Th numbers." });
  stdPage(lang, "indexes", indexesPage, { eyebrow: t.siteSub, lede: "" });
  stdPage(lang, "chrono", chrono); stdPage(lang, "opus", opus); stdPage(lang, "titles", titles); stdPage(lang, "incipits", incipits);
  stdPage(lang, "persons", personsPage); stdPage(lang, "places", places); stdPage(lang, "performances", performancesPage);
  stdPage(lang, "scoring", scoring); stdPage(lang, "sources", sourcesPage); stdPage(lang, "editions", editionsPage);
  stdPage(lang, "biblio", biblio); stdPage(lang, "disco", disco); stdPage(lang, "journal", journalPage, { active: "journal" });
  stdPage(lang, "search", searchPage, { active: "search", eyebrow: t.siteSub, lede: "" });
  stdPage(lang, "about", about, { active: "about", eyebrow: t.siteSub, lede: "" });
  if (!PUBLIC) stdPage(lang, "dashboard", dashboard);
  out(`assets/search-${lang}.json`, JSON.stringify(searchIndex(lang)));
}
// Page racine : accueil français, liens vers fr/ et en/
{
  const ctx = { lang: "fr", depth: 0 };
  const p = layout(ctx, { title: "", body: home(ctx), active: "home", alt: l => pageUrl(ctx, "home", l), bodyClass: "home" });
  out("index.html", p.full);
  // Variante sans squelette pour l'aperçu hébergé (le squelette HTML est ajouté par l'hôte)
  fs.mkdirSync(path.join(ROOT, "publish"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "publish", "root.html"), `${p.head}\n<div data-lang="fr" class="root-body">${p.html}</div>\n`);
}
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`Site généré : ${count(DIST)} fichiers, ${works.length} notices, ${persons.size} personnes, ${allPerfs.length} exécutions${PUBLIC ? " (version publique)" : ""}.`);
