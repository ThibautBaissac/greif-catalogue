import type { Catalogue, PersonUsage, WorkEntry } from "../catalogue";
import { edtfYear } from "../edtf";
import { fold } from "../text";
import { letterGroups } from "./letters";

type BlockRole = "author" | "translator" | "dedicatee" | "performer";
type FilterRole = "author" | "dedicatee" | "performer";

export type PersonWork = { work: WorkEntry; roles: string[]; years: string };
export type PersonEntry = {
  id: string;
  surname: string;
  given?: string;
  /** Pour le filtre : `translator` compte comme `author`. */
  roles: FilterRole[];
  blocks: { role: BlockRole; works: PersonWork[] }[];
};

const BLOCK_ORDER: BlockRole[] = ["author", "translator", "dedicatee", "performer"];
const FILTER_ORDER: FilterRole[] = ["author", "dedicatee", "performer"];

function yearsOf(dates: (string | undefined)[]): string {
  const years = dates.flatMap(d => edtfYear(d) ?? []);
  if (years.length === 0) return "";
  const [min, max] = [Math.min(...years), Math.max(...years)];
  return min === max ? String(min) : `${min}–${max}`;
}

/**
 * Une ligne par œuvre, dans l'ordre de première apparition ; rôles et années fusionnés.
 * Comme dans le prototype, seules les exécutions datent un interprète (`dated`) : pour un auteur ou un
 * dédicataire, la date de l'usage est celle de la composition et n'est pas affichée.
 */
function mergeByWork(usages: PersonUsage[], dated: boolean): PersonWork[] {
  const byWork = new Map<string, { work: WorkEntry; roles: Set<string>; dates: (string | undefined)[] }>();
  for (const u of usages) {
    const entry = byWork.get(u.work.id) ?? { work: u.work, roles: new Set<string>(), dates: [] };
    if (u.role) entry.roles.add(u.role);
    entry.dates.push(u.date);
    byWork.set(u.work.id, entry);
  }
  return [...byWork.values()].map(({ work, roles, dates }) => ({ work, roles: [...roles], years: dated ? yearsOf(dates) : "" }));
}

export function personsModel(cat: Catalogue): [string, PersonEntry[]][] {
  const entries: PersonEntry[] = [];
  for (const [id, usages] of cat.personUsages) {
    const person = cat.persons.get(id);
    if (!person) continue;
    const blocks = BLOCK_ORDER.flatMap(role =>
      usages[role].length > 0 ? [{ role, works: mergeByWork(usages[role], role === "performer") }] : [],
    );
    if (blocks.length === 0) continue;
    const present = new Set<FilterRole>(blocks.map(b => (b.role === "translator" ? "author" : b.role)));
    entries.push({
      id,
      surname: person.surname,
      given: person.given,
      roles: FILTER_ORDER.filter(r => present.has(r)),
      blocks,
    });
  }
  const sortKey = (p: PersonEntry) => fold(`${p.surname} ${p.given ?? ""}`);
  entries.sort((a, b) => sortKey(a).localeCompare(sortKey(b), "fr"));
  return letterGroups(entries, p => fold(p.surname));
}
