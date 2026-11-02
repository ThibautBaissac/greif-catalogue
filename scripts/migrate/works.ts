import { fromLegacy } from "../../src/lib/edtf";
import { SOURCE_FEATURES, type Work } from "../../src/lib/schemas";
import { slug } from "../../src/lib/text";
import { extractAuthorities, ROLE_MAP, type Authorities, type ProtoWork } from "./authorities";

// Copied from prototype/i18n.mjs.
const SCORING_EN: Record<string, string> = {
  "Piano": "Piano", "Voix et piano": "Voice and piano", "Voix de femme et piano": "Female voice and piano",
  "Voix de femme, voix d'homme et piano": "Female voice, male voice and piano",
  "Soprano, alto, basse et piano": "Soprano, alto, bass and piano", "Flûte et piano": "Flute and piano",
  "Violon et piano": "Violin and piano", "Quatuor à cordes": "String quartet", "Deux pianos": "Two pianos",
  "Piano quatre mains": "Piano four hands", "Version pour violon et piano": "Version for violin and piano",
  "Voix de femme, flûte, clarinette, percussions et piano": "Female voice, flute, clarinet, percussion and piano",
  "Mezzo-soprano, clarinette, quatuor à cordes, piano et percussions": "Mezzo-soprano, clarinet, string quartet, piano and percussion",
  "Voix de femme, voix d'homme et orchestre (version chant, piano)": "Female voice, male voice and orchestra (vocal score)",
  "Fugue pour piano": "Fugue for piano", "Chœur": "Choir", "Instrumentation": "Scoring to be determined",
  "Voix de femme, saxophone alto en *mi* bémol et piano": "Female voice, alto saxophone in E♭ and piano",
  "Saxophone et piano": "Saxophone and piano", "Voix de femme et deux pianos": "Female voice and two pianos",
};

const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const UNIDENTIFIED = "[?]";

export type MigrateOptions = {
  /** True when `prototype/incipits/<id>/<n>.png` exists (n starts at 1). */
  incipitExists?: (id: string, n: number) => boolean;
};

type Result = { id: string; work: Work; report: string[] };

export function migrateWork(w: ProtoWork, a: Authorities, opts: MigrateOptions = {}): Result {
  const id: string = w.id;
  const report: string[] = [];
  const notes = new Set<string>();
  const note = (n: string) => notes.add(n);
  const out: Record<string, unknown> = {};

  const migratePerformance = (p: ProtoWork, premiere: boolean) => {
    const perf: Record<string, unknown> = { premiere };
    const date = fromLegacy(p.date, p.date_end);
    if (date !== undefined) perf.date = date;
    if (p.place !== undefined) perf.venue = p.place;
    if (isText(p.city)) perf.place = slug(p.city);
    const performers: Record<string, unknown>[] = [];
    let dropped = false;
    for (const pr of p.performers ?? []) {
      if (!isText(pr.name) || pr.name === UNIDENTIFIED) {
        dropped = true;
        note(`[migration] interprète non identifié (${UNIDENTIFIED}, ${pr.role})`);
        report.push(`${id}: interprète non identifié (${pr.name || "nom vide"}, ${pr.role}) retiré`);
        continue;
      }
      const raw: string = pr.role;
      const mapped = Object.hasOwn(ROLE_MAP, raw) ? ROLE_MAP[raw] : undefined;
      if (mapped === null) {
        dropped = true;
        note(`[migration] interprète non structuré : ${pr.name} (${raw})`);
        report.push(`${id}: interprète non structuré « ${pr.name} » (${raw}) retiré`);
        continue;
      }
      const performer: Record<string, unknown> = { person: slug(pr.name) };
      if (mapped === undefined) {
        note(`[migration] rôle non reconnu : ${raw} (${pr.name})`);
        report.push(`${id}: rôle « ${raw} » absent de ROLE_MAP (interprète « ${pr.name} »), rôle omis`);
      } else if (mapped !== "ensemble") performer.role = mapped.id;
      if (pr.alias !== undefined) performer.alias = pr.alias;
      performers.push(performer);
    }
    perf.performers = performers;
    // A removed performer leaves its trace only in the free-text wording: keep that as the note.
    if (dropped) perf.note = p.text;
    perf.text = p.text;
    return perf;
  };

  const dropUnidentified = (names: unknown[], field: string): string[] =>
    names.flatMap(n => {
      if (isText(n) && n !== UNIDENTIFIED) return [slug(n)];
      note(`[migration] personne non identifiée (${UNIDENTIFIED}) dans ${field}`);
      report.push(`${id}: personne non identifiée (${UNIDENTIFIED}) retirée de ${field}`);
      return [];
    });

  let performancesDone = false;
  for (const [key, value] of Object.entries(w)) {
    switch (key) {
      case "id":
      case "related":
      case "editorial_notes":
        break;
      case "scoring": {
        const en = Object.hasOwn(SCORING_EN, value) ? SCORING_EN[value] : undefined;
        if (en === undefined) {
          note("[migration] traduire l'effectif");
          report.push(`${id}: effectif sans traduction anglaise « ${value} »`);
        }
        out.scoring = { fr: value, en: en ?? value };
        break;
      }
      case "composition": {
        const { text, from, to, ...rest } = value;
        const date = fromLegacy(from, to);
        out.composition = { text, ...(date !== undefined ? { date } : {}), ...rest };
        break;
      }
      case "premiere":
      case "performances":
        if (performancesDone) break;
        performancesDone = true;
        out.performances = [
          ...(w.premiere ?? []).map((p: ProtoWork) => migratePerformance(p, true)),
          ...(w.performances ?? []).map((p: ProtoWork) => migratePerformance(p, false)),
        ];
        break;
      case "text": {
        const { authors, ...rest } = value;
        const kept = (authors ?? []).filter((au: ProtoWork) => {
          if (isText(au.name) && au.name !== UNIDENTIFIED) return true;
          dropUnidentified([au.name], "text.authors");
          return false;
        });
        out.text = {
          ...rest,
          authors: kept.map(({ name, ...r }: ProtoWork) => ({ person: slug(name), ...r })),
        };
        break;
      }
      case "dedication": {
        const { persons, ...rest } = value;
        out.dedication = { ...rest, persons: dropUnidentified(persons ?? [], "dedication.persons") };
        break;
      }
      case "sources": {
        const { siglum, features, items, ...rest } = value;
        const src: Record<string, unknown> = { ...rest };
        if (items !== undefined) {
          src.items = items.flatMap((it: ProtoWork) => {
            if (isText(it.text)) return [it];
            // The schema requires a text: keep the label as text rather than lose it.
            if (isText(it.label)) {
              const { label, text: _empty, ...others } = it;
              note("[migration] item de sources sans texte : étiquette reprise comme texte");
              report.push(`${id}: item de sources sans texte, étiquette « ${label} » reprise comme texte`);
              return [{ text: label, ...others }];
            }
            note("[migration] item de sources vide retiré");
            report.push(`${id}: item de sources vide (ni texte ni étiquette) retiré`);
            return [];
          });
        }
        if (isText(siglum)) {
          if (a.institutions.has(slug(siglum))) src.institution = slug(siglum);
          else {
            note(`[migration] sigle inconnu : ${siglum}`);
            report.push(`${id}: sigle inconnu « ${siglum} », fonds omis`);
          }
        }
        if (features !== undefined) {
          const known: string[] = [];
          for (const f of features) {
            if ((SOURCE_FEATURES as readonly string[]).includes(f)) known.push(f);
            else {
              out.documents = [...((out.documents as string[] | undefined) ?? w.documents ?? []), f];
              note("[migration] déplacé de sources.features vers documents");
              report.push(`${id}: valeur de sources.features déplacée vers documents « ${f} »`);
            }
          }
          src.features = known;
        }
        out.sources = src;
        break;
      }
      case "documents":
        out.documents = out.documents ?? value;
        break;
      case "bibliography":
        out.bibliography = value.map(({ ref, ...r }: ProtoWork) => ({ ref: slug(ref), ...r }));
        break;
      case "movements":
        out.movements = value.map((m: ProtoWork, i: number) =>
          opts.incipitExists?.(id, i + 1) ? { ...m, incipit: `/incipits/${id}/${i + 1}.png` } : m,
        );
        break;
      default:
        out[key] = value;
    }
  }

  out.related = (w.related ?? [])
    .filter((r: ProtoWork) => !String(r.relation).endsWith(":inverse"))
    .map((r: ProtoWork) => ({ work: r.id, relation: r.relation }));
  const editorial = [...(w.editorial_notes ?? []), ...notes];
  if (editorial.length > 0) out.editorial_notes = editorial;

  return { id, work: out as Work, report };
}

/** Pure part of the migration: prototype works in, `content/` file tree out. */
export function migrate(
  works: ProtoWork[],
  opts: MigrateOptions = {},
): { files: Record<string, unknown>; report: string[] } {
  const a = extractAuthorities(works);
  const report = [...a.report];
  const migrated = new Map<string, Result>();
  for (const w of works) {
    const r = migrateWork(w, a, opts);
    report.push(...r.report);
    migrated.set(r.id, r);
  }

  // Every `k:inverse` link A -> B requires B to carry `k` towards A.
  for (const w of works) {
    for (const r of w.related ?? []) {
      const m = /^(.+):inverse$/.exec(r.relation);
      if (!m) continue;
      const target = migrated.get(r.id);
      if (!target) {
        report.push(`${w.id}: lien inverse ${m[1]} vers « ${r.id} », œuvre absente du lot`);
        continue;
      }
      const related = target.work.related;
      if (!related.some(x => x.work === w.id && x.relation === m[1])) {
        related.push({ work: w.id, relation: m[1] as Work["related"][number]["relation"] });
        report.push(`${r.id}: relation « ${m[1]} » vers ${w.id} ajoutée (absente, l'inverse figurait sur ${w.id})`);
      }
    }
  }

  const files: Record<string, unknown> = {};
  for (const { id, work } of migrated.values()) files[`works/${id}.yaml`] = work;
  for (const [id, v] of a.persons) files[`persons/${id}.yaml`] = v;
  for (const [id, v] of a.places) files[`places/${id}.yaml`] = v;
  for (const [id, v] of a.institutions) files[`institutions/${id}.yaml`] = v;
  for (const [id, v] of a.roles) files[`roles/${id}.yaml`] = v;
  for (const [id, v] of a.bibliography) files[`bibliography/${id}.yaml`] = v;
  return { files, report };
}
