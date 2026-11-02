// Comportements côté client : filtres du catalogue, filtre des personnes,
// recherche plein texte, citation. Aucune dépendance.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lang = (document.querySelector("[data-lang]") || document.documentElement).dataset.lang || document.documentElement.lang || "fr";

  // ---- Catalogue : filtres
  const fBook = $("#f-book");
  if (fBook) {
    const fCat = $("#f-cat"), fStatus = $("#f-status"), fQ = $("#f-q"), out = $("#f-count");
    const rows = $$("table.cat tbody tr");
    const apply = () => {
      const b = fBook.value, c = fCat.value, s = fStatus.value, q = fold(fQ.value).split(/\s+/).filter(Boolean);
      let n = 0;
      rows.forEach(r => {
        const ok = (!b || r.dataset.book === b) && (!c || r.dataset.cat.split(" ").includes(c)) &&
          (!s || r.dataset.status.split(" ").includes(s)) && q.every(t => r.dataset.q.includes(t));
        r.hidden = !ok; if (ok) n++;
      });
      $$("[data-book-section]").forEach(sec => {
        const any = $$("tbody tr", sec).some(r => !r.hidden);
        sec.hidden = (b && sec.dataset.bookSection !== b) || (!any && (c || s || q.length) );
      });
      out.textContent = lang === "fr" ? `${n} œuvre${n > 1 ? "s" : ""}` : `${n} work${n > 1 ? "s" : ""}`;
    };
    [fBook, fCat, fStatus].forEach(el => el.addEventListener("change", apply));
    fQ.addEventListener("input", apply);
    apply();
  }

  // ---- Personnes : filtre par rôle
  const chips = $$(".chip[data-role]");
  if (chips.length) {
    const items = $$("ul.persons > li");
    chips.forEach(ch => ch.addEventListener("click", () => {
      chips.forEach(c => c.setAttribute("aria-pressed", String(c === ch)));
      const r = ch.dataset.role;
      items.forEach(li => { li.hidden = r !== "all" && !li.dataset.roles.split(" ").includes(r); });
      $$("section.letter").forEach(sec => { sec.hidden = !$$("li", sec).some(li => !li.hidden); });
    }));
  }

  // ---- Citation : URL et date réelles
  const cite = $(".cite-text");
  if (cite) {
    try {
      const d = new Date();
      const date = d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
      cite.textContent = cite.textContent.replace("[URL]", location.href.split("#")[0]).replace(/\((consulté le|accessed) [^)]*\)/, m => m.startsWith("(consulté") ? `(consulté le ${date})` : `(accessed ${date})`);
    } catch (e) { /* aperçu hors ligne */ }
  }
  $$("button[data-copy]").forEach(btn => btn.addEventListener("click", () => {
    const el = $(btn.dataset.copy); if (!el) return;
    const done = () => { const l = btn.textContent; btn.textContent = btn.dataset.labelDone; setTimeout(() => btn.textContent = l, 1600); };
    const select = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent).then(done, select);
    else select();
  }));

  // ---- Recherche
  const sq = $("#sq");
  if (sq) {
    const res = $("#sq-results"), count = $("#sq-count");
    let data = null;
    const params = new URLSearchParams(location.search);
    if (params.get("q")) sq.value = params.get("q");
    const load = () => data ? Promise.resolve(data) : fetch(sq.dataset.index).then(r => r.json()).then(j => {
      data = j.map(d => ({ ...d, ft: fold(d.t + " " + d.s + " " + d.a), fx: fold(d.x) })); return data;
    });
    const escH = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const snippet = (d, terms) => {
      const i = d.fx.indexOf(terms[0]); if (i < 0) return "";
      const a = Math.max(0, i - 70), b = Math.min(d.x.length, i + 130);
      let s = escH((a ? "…" : "") + d.x.slice(a, b) + (b < d.x.length ? "…" : ""));
      terms.forEach(t => { const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"); s = s.replace(re, "<mark>$1</mark>"); });
      return s.replace(/¶/g, "·");
    };
    const run = () => {
      const q = fold(sq.value).trim(); const terms = q.split(/\s+/).filter(Boolean);
      if (!terms.length) { res.innerHTML = ""; count.textContent = ""; return; }
      load().then(all => {
        const hits = all.map(d => {
          let score = 0;
          for (const t of terms) { if (d.ft.includes(t)) score += 10; else if (d.fx.includes(t)) score += 1; else if (("th " + d.th) === q || d.th === t) score += 20; else return null; }
          return { d, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score);
        count.textContent = hits.length ? res.dataset.hint.replace("{n}", hits.length).replace(/entries|notices/, hits.length > 1 ? "$&" : (lang === "fr" ? "notice" : "entry")) : res.dataset.none;
        res.innerHTML = hits.slice(0, 100).map(({ d }) => `<li><div class="r-head"><a class="wref" href="${sq.dataset.workbase}${d.id}.html"><span class="thn">Th&nbsp;${escH(d.th)}</span> <cite class="wt">${escH(d.t)}</cite>${d.s ? ` <span class="wst">« ${escH(d.s)} »</span>` : ""}</a></div><div class="r-meta">${escH(d.sc)}${d.y ? " · " + d.y : ""}${d.a ? " · " + escH(d.a) : ""}</div><div class="r-snip">${snippet(d, terms.filter(t => d.fx.includes(t)))}</div></li>`).join("");
      }).catch(() => { count.textContent = lang === "fr" ? "Index de recherche indisponible." : "Search index unavailable."; });
    };
    let to; sq.addEventListener("input", () => { clearTimeout(to); to = setTimeout(run, 120); });
    run();
  }
})();
