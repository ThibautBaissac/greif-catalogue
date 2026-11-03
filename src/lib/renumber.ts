// Automatic Th renumbering. The editor changes only the Th of the work being inserted or moved;
// every other work is shifted so that the numbers stay contiguous from 1, like a reordered list.
// Imports carry the `.ts` extension so the scripts can run under plain Node (type stripping, no install).
import { compareTh, TH_PATTERN } from "./th.ts";

/** Work id -> Th. */
export type ThMap = Record<string, string>;
export type ThChange = { id: string; from: string; to: string };

export class RenumberError extends Error {}

type Slot = { members: { id: string; suffix: string }[] };

function split(th: string): [number, string] {
  const m = TH_PATTERN.exec(th);
  if (!m) throw new RenumberError(`Th invalide : « ${th} »`);
  return [Number(m[1]), m[2]];
}

/**
 * True when every Th is unique, a number is either bare (`2`) or only suffixed (`2a`, `2b`),
 * and the numbers run from 1 without a gap.
 */
export function isConsistent(ths: ThMap): boolean {
  const values = Object.values(ths);
  if (new Set(values).size !== values.length || !values.every(v => TH_PATTERN.test(v))) return false;
  const suffixed = new Map<number, boolean>();
  for (const [n, suffix] of values.map(split)) {
    if (suffixed.has(n) && (!suffix || !suffixed.get(n))) return false;
    suffixed.set(n, !!suffix);
  }
  return [...suffixed.keys()].every(n => n >= 1 && n <= suffixed.size);
}

/**
 * Renumbers `head` against `base`, the last consistent state. Works whose Th changed since `base`
 * (or that are new) are pinned at the number they were given; the untouched works keep their order
 * and fill the remaining numbers. A suffixed Th (`35c`) joins the untouched group of that number.
 */
export function renumber(base: ThMap, head: ThMap): ThMap {
  if (isConsistent(head)) return { ...head };
  const edited = (id: string) => base[id] !== head[id];
  const byTh = (a: string, b: string) => compareTh(head[a], head[b]) || (a < b ? -1 : 1);
  const ids = Object.keys(head).sort(byTh);

  const kept = new Map<number, Slot>();
  for (const id of ids.filter(id => !edited(id))) {
    const [n, suffix] = split(head[id]);
    if (!kept.has(n)) kept.set(n, { members: [] });
    kept.get(n)!.members.push({ id, suffix });
  }

  const pinned = new Map<number, Slot>();
  for (const id of ids.filter(edited)) {
    const [n, suffix] = split(head[id]);
    const group = suffix ? kept.get(n) : undefined;
    const slot = group ?? pinned.get(n);
    // Inside an untouched group only the same letter clashes; between edited works a bare Th clashes with anything.
    const clash = slot?.members.find(m => (group ? m.suffix === suffix : !suffix || !m.suffix || m.suffix === suffix));
    if (clash) throw new RenumberError(`Th ${head[id]} demandé à la fois pour ${id} et ${clash.id}`);
    if (slot) slot.members.push({ id, suffix });
    else pinned.set(n, { members: [{ id, suffix }] });
  }

  const keptSlots = [...kept].sort(([a], [b]) => a - b).map(([, slot]) => slot);
  const pinnedSlots = [...pinned].sort(([a], [b]) => a - b);
  const total = keptSlots.length + pinnedSlots.length;
  const order: Slot[] = new Array(total);
  let prev = 0;
  pinnedSlots.forEach(([n, slot], i) => {
    const pos = Math.min(Math.max(n, prev + 1), total - (pinnedSlots.length - 1 - i));
    order[pos - 1] = slot;
    prev = pos;
  });
  let next = 0;
  for (let i = 0; i < total; i++) order[i] ??= keptSlots[next++];

  return Object.fromEntries(order.flatMap((slot, i) => slot.members.map(m => [m.id, `${i + 1}${m.suffix}`])));
}

/** The works whose Th differs between `head` and `result`, in new Th order. */
export function thChanges(head: ThMap, result: ThMap): ThChange[] {
  return Object.keys(result)
    .filter(id => head[id] !== result[id])
    .sort((a, b) => compareTh(result[a], result[b]))
    .map(id => ({ id, from: head[id], to: result[id] }));
}

const TH_LINE = /^th:[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|([^\s#]+))[ \t]*$/m;

/** Reads the top-level `th:` of a work file, as Keystatic writes it (`th: '4'`, `th: 35b`). */
export function readThLine(yaml: string): string | undefined {
  const m = TH_LINE.exec(yaml);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** Rewrites only the `th:` line, quoting an all-digit Th so YAML keeps it a string. */
export function writeThLine(yaml: string, th: string): string {
  if (!TH_LINE.test(yaml)) throw new RenumberError("ligne th: introuvable");
  return yaml.replace(TH_LINE, /^\d+$/.test(th) ? `th: '${th}'` : `th: ${th}`);
}
