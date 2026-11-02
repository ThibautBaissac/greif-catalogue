const ARTICLES = /^(le |la |les |l'|l’|the |die |der |das |un |une |a |an )/i;

/** Retire les accents et met en minuscules. */
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Texte nu en entrée : le balisage n'est pas retiré ici. */
export const slug = (s: string): string =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const sortTitle = (s: string): string =>
  fold(s)
    .replace(/^[«"“\[\(\-\d\s\.)]+/, "")
    .replace(ARTICLES, "")
    .trim();
