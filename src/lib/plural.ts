import type { Lang } from "./edtf";
import type { Plural } from "./ui-schema";

export const fill = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export const tn = (p: Plural, n: number, lang: Lang): string =>
  fill(new Intl.PluralRules(lang).select(n) === "one" ? p.one : p.other, { n });
