import { edtfSortKey } from "./edtf";
import { extractRefs } from "./markup";
import type {
  BibEntry,
  Book,
  Institution,
  Performance,
  Person,
  Place,
  Relation,
  Role,
  Work,
} from "./schemas";
import { compareTh } from "./th";

/** Résolveur de `stripMarkup` : un renvoi valide donne le numéro Th de l'œuvre visée. */
export const thResolver =
  (cat: { byId: Map<string, { th: string }> }) =>
  (id: string): { th: string } | undefined =>
    cat.byId.get(id);

export type Entry<T> = { id: string; data: T };

export type CatalogueInput = {
  works: Entry<Work>[];
  persons: Entry<Person>[];
  places: Entry<Place>[];
  institutions: Entry<Institution>[];
  roles: Entry<Role>[];
  bibliography: Entry<BibEntry>[];
  books: Book[];
};

export type WorkEntry = Work & { id: string };
export type RelationKey = Relation | `${Relation}:inverse`;
/** `role` is a roleId. */
export type PersonUsage = { work: WorkEntry; role?: string; date?: string };
export type PerformanceRow = { work: WorkEntry; perf: Performance };

type WithId<T> = T & { id: string };

export type Catalogue = {
  works: WorkEntry[];
  byId: Map<string, WorkEntry>;
  persons: Map<string, WithId<Person>>;
  places: Map<string, WithId<Place>>;
  institutions: Map<string, WithId<Institution>>;
  roles: Map<string, WithId<Role>>;
  bibliography: Map<string, WithId<BibEntry>>;
  books: Book[];
  related(id: string): { work: WorkEntry; relation: RelationKey }[];
  neighbours(id: string): { prev?: WorkEntry; next?: WorkEntry };
  performances: PerformanceRow[];
  personUsages: Map<
    string,
    { author: PersonUsage[]; translator: PersonUsage[]; dedicatee: PersonUsage[]; performer: PersonUsage[] }
  >;
};

/** `file` is `"<collection>/<id>"`. */
export type ValidationError = { file: string; path: string; message: string };

const asMap = <T>(entries: Entry<T>[]): Map<string, WithId<T>> =>
  new Map(entries.map(e => [e.id, { ...e.data, id: e.id }]));

/** Every string of `value`, with its dotted path (keys and array indices). */
export function* strings(value: unknown, path: string[] = []): Generator<[string, string]> {
  if (typeof value === "string") yield [path.join("."), value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, [...path, String(i)]);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
  }
}

export function validateCatalogue(input: CatalogueInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const workIds = new Set(input.works.map(w => w.id));
  const personIds = new Set(input.persons.map(p => p.id));
  const placeIds = new Set(input.places.map(p => p.id));
  const institutionIds = new Set(input.institutions.map(i => i.id));
  const roleIds = new Set(input.roles.map(r => r.id));
  const bibIds = new Set(input.bibliography.map(b => b.id));
  const bookNumbers = new Set(input.books.map(b => b.number));
  const thOwner = new Map<string, string>();
  const relatedPairs = new Set<string>();

  for (const { id, data: w } of input.works) {
    const file = `works/${id}`;
    const fail = (path: string, message: string) => errors.push({ file, path, message });
    const known = (set: Set<string>, value: string | undefined, path: string, what: string) => {
      if (value !== undefined && !set.has(value)) fail(path, `${what} inconnu : « ${value} »`);
    };

    const owner = thOwner.get(w.th);
    if (owner) fail("th", `Th ${w.th} déjà utilisé par ${owner}`);
    else thOwner.set(w.th, id);

    if (!bookNumbers.has(w.book)) fail("book", `Livre ${w.book} absent de books.yaml`);

    for (const [path, text] of strings(w)) {
      for (const ref of extractRefs(text)) {
        if (ref !== "?" && !workIds.has(ref)) fail(path, `Renvoi inconnu : [[${ref}]]`);
      }
    }

    w.text?.authors.forEach((a, i) => known(personIds, a.person, `text.authors.${i}.person`, "Personne"));
    w.dedication?.persons.forEach((p, i) => known(personIds, p, `dedication.persons.${i}`, "Personne"));
    known(institutionIds, w.sources?.institution, "sources.institution", "Fonds");
    w.bibliography.forEach((b, i) => known(bibIds, b.ref, `bibliography.${i}.ref`, "Référence bibliographique"));
    w.performances.forEach((perf, i) => {
      known(placeIds, perf.place, `performances.${i}.place`, "Lieu");
      perf.performers.forEach((p, j) => {
        known(personIds, p.person, `performances.${i}.performers.${j}.person`, "Personne");
        known(roleIds, p.role, `performances.${i}.performers.${j}.role`, "Rôle");
      });
    });

    w.related.forEach((r, i) => {
      if (r.work === id) return fail(`related.${i}.work`, "Une œuvre ne peut pas être liée à elle-même");
      if (!workIds.has(r.work)) return fail(`related.${i}.work`, `Œuvre inconnue : « ${r.work} »`);
      const pair = [id, r.work].sort().join("\u0000");
      if (relatedPairs.has(pair)) {
        fail(`related.${i}`, `Relation déjà déclarée entre ${id} et ${r.work} (la relation inverse est dérivée)`);
      }
      relatedPairs.add(pair);
    });
  }
  return errors;
}

const emptyUsages = () => ({
  author: [] as PersonUsage[],
  translator: [] as PersonUsage[],
  dedicatee: [] as PersonUsage[],
  performer: [] as PersonUsage[],
});

export function buildCatalogue(input: CatalogueInput): Catalogue {
  const works: WorkEntry[] = input.works
    .map(({ id, data }) => ({ ...data, id }))
    .sort((a, b) => compareTh(a.th, b.th));
  const byId = new Map(works.map(w => [w.id, w]));
  const persons = asMap(input.persons);

  const performances: PerformanceRow[] = works
    .flatMap(work => work.performances.map(perf => ({ work, perf })))
    .sort((a, b) => {
      const [ka, kb] = [edtfSortKey(a.perf.date), edtfSortKey(b.perf.date)];
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  const personUsages: Catalogue["personUsages"] = new Map();
  const usagesOf = (person: string) => {
    let u = personUsages.get(person);
    if (!u) personUsages.set(person, (u = emptyUsages()));
    return u;
  };
  for (const person of persons.keys()) usagesOf(person);
  for (const work of works) {
    const date = work.composition?.date;
    for (const a of work.text?.authors ?? []) usagesOf(a.person)[a.role].push({ work, date });
    for (const p of work.dedication?.persons ?? []) usagesOf(p).dedicatee.push({ work, date });
  }
  for (const { work, perf } of performances) {
    for (const p of perf.performers) usagesOf(p.person).performer.push({ work, role: p.role, date: perf.date });
  }

  const index = (id: string) => works.findIndex(w => w.id === id);

  return {
    works,
    byId,
    persons,
    places: asMap(input.places),
    institutions: asMap(input.institutions),
    roles: asMap(input.roles),
    bibliography: asMap(input.bibliography),
    books: [...input.books].sort((a, b) => a.number - b.number),
    related(id) {
      const direct = (byId.get(id)?.related ?? []).flatMap(r => {
        const target = byId.get(r.work);
        return target ? [{ work: target, relation: r.relation as RelationKey }] : [];
      });
      const inverse = works.flatMap(w =>
        w.related.filter(r => r.work === id).map(r => ({ work: w, relation: `${r.relation}:inverse` as RelationKey })),
      );
      return [...direct, ...inverse];
    },
    neighbours(id) {
      const i = index(id);
      return i < 0 ? {} : { prev: works[i - 1], next: works[i + 1] };
    },
    performances,
    personUsages,
  };
}
