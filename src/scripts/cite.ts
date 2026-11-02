// Citation : URL et date réelles, puis bouton de copie. Reprend `prototype/assets/app.js`.
const lang = document.documentElement.lang || "fr";
const cite = document.querySelector<HTMLElement>(".cite-text");

if (cite?.dataset.template) {
  try {
    const date = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    cite.textContent = cite.dataset.template
      .replace("{url}", location.href.split("#")[0])
      .replace("{date}", date);
  } catch {
    /* aperçu hors ligne : le texte rendu à la construction reste en place */
  }
}

document.querySelectorAll<HTMLButtonElement>("button[data-copy]").forEach(btn =>
  btn.addEventListener("click", () => {
    const el = document.querySelector(btn.dataset.copy ?? "");
    if (!el) return;
    const done = () => {
      const label = btn.textContent;
      btn.textContent = btn.dataset.labelDone ?? label;
      setTimeout(() => (btn.textContent = label), 1600);
    };
    const select = () => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(el.textContent ?? "").then(done, select);
    else select();
  }),
);
