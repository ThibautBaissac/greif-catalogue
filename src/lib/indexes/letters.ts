/** Regroupe par première lettre en majuscule ; tout ce qui n'est pas A–Z va sous `#`. Groupes triés. */
export function letterGroups<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const first = (key(item)[0] ?? "#").toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : "#";
    const bucket = groups.get(letter);
    if (bucket) bucket.push(item);
    else groups.set(letter, [item]);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
