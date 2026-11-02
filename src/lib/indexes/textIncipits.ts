import type { Catalogue, WorkEntry } from "../catalogue";
import { fold } from "../text";

export type TextIncipit = { text: string; work: WorkEntry; movementTitle?: string; author?: string };

export function textIncipitsModel(cat: Catalogue): TextIncipit[] {
  return cat.works
    .flatMap(work => {
      const first = work.text?.authors[0];
      const author = first && cat.persons.get(first.person)?.name;
      return work.movements.flatMap(m =>
        m.text_incipit
          ? [{
              text: m.text_incipit,
              work,
              ...(m.title && work.movements.length > 1 ? { movementTitle: m.title } : {}),
              ...(author ? { author } : {}),
            }]
          : [],
      );
    })
    .sort((a, b) => fold(a.text).localeCompare(fold(b.text), "fr"));
}
