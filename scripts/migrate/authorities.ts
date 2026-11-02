import { slug } from "../../src/lib/text";
import type { BibEntry, Institution, Person, Place, Role } from "../../src/lib/schemas";
import { invertName } from "./names";

/** A work YAML object as written in the prototype. */
export type ProtoWork = Record<string, any>;

export type Authorities = {
  persons: Map<string, Person>;
  places: Map<string, Place>;
  institutions: Map<string, Institution>;
  roles: Map<string, Role>;
  bibliography: Map<string, BibEntry>;
  report: string[];
};

type RoleEntry = { id: string; fr: string; en: string };

/** Key = raw prototype role. "ensemble": the performer is an ensemble. null: anomaly. */
export const ROLE_MAP: Record<string, RoleEntry | "ensemble" | null> = {
  piano: { id: "piano", fr: "piano", en: "piano" },
  violon: { id: "violon", fr: "violon", en: "violin" },
  violons: { id: "violons", fr: "violons", en: "violins" },
  alto: { id: "alto", fr: "alto", en: "viola" },
  violoncelle: { id: "violoncelle", fr: "violoncelle", en: "cello" },
  baryton: { id: "baryton", fr: "baryton", en: "baritone" },
  chant: { id: "chant", fr: "chant", en: "voice" },
  voix: { id: "voix", fr: "voix", en: "voice" },
  soprano: { id: "soprano", fr: "soprano", en: "soprano" },
  saxophone: { id: "saxophone", fr: "saxophone", en: "saxophone" },
  "flûte": { id: "flute", fr: "flûte", en: "flute" },
  clarinette: { id: "clarinette", fr: "clarinette", en: "clarinet" },
  percussion: { id: "percussion", fr: "percussion", en: "percussion" },
  "pianiste ?": { id: "pianiste-incertain", fr: "pianiste ?", en: "pianist ?" },
  ensemble: "ensemble",
  "par les mêmes interprètes": null,
};

const INSTITUTIONS: Record<string, Institution> = {
  "F-Pbmgf": {
    siglum: "F-Pbmgf",
    name: {
      fr: "Paris, Bibliothèque musicale La Grange-Fleuret, fonds Olivier Greif.",
      en: "Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection.",
    },
  },
  "F-Pmm": { siglum: "F-Pmm", name: { fr: "[à préciser]", en: "[to be specified]" } },
};

const BIB_STUB_NOTE = "[migration] compléter la notice CSL (type, auteurs, titre, éditeur, date)";

const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function extractAuthorities(works: ProtoWork[]): Authorities {
  const out: Authorities = {
    persons: new Map(),
    places: new Map(),
    institutions: new Map(),
    roles: new Map(),
    bibliography: new Map(),
    report: [],
  };

  const addPerson = (name: unknown, asWritten: unknown, isEnsemble: boolean) => {
    if (!isText(name) || name === "[?]") return;
    const id = slug(name);
    let person = out.persons.get(id);
    if (!person) {
      person = { name, surname: name, kind: "person", variants: [] };
      out.persons.set(id, person);
    }
    if (isEnsemble) {
      person.kind = "ensemble";
      person.surname = name;
      delete person.given;
    } else if (person.kind === "person") {
      const { surname, given } = invertName(name);
      person.surname = surname;
      if (given) person.given = given;
    }
    if (isText(asWritten) && asWritten !== name && !person.variants.includes(asWritten))
      person.variants.push(asWritten);
  };

  const addPlace = (city: unknown, country: unknown) => {
    if (!isText(city)) return;
    const id = slug(city);
    const place = out.places.get(id) ?? { name: city };
    if (!place.country && isText(country)) place.country = country;
    out.places.set(id, place);
  };

  for (const w of works) {
    for (const a of w.text?.authors ?? []) addPerson(a.name, a.as_written, false);
    for (const d of w.dedication?.persons ?? []) addPerson(d, undefined, false);

    const performances = [...(w.premiere ?? []), ...(w.performances ?? [])];
    for (const p of performances) {
      addPlace(p.city, p.country);
      for (const pr of p.performers ?? []) {
        const raw: string = pr.role;
        const mapped = Object.hasOwn(ROLE_MAP, raw) ? ROLE_MAP[raw] : undefined;
        if (mapped === null || mapped === undefined) {
          const why = mapped === null ? "rôle non exploitable" : "rôle absent de ROLE_MAP";
          out.report.push(`${w.id}: ${why} « ${raw} » (interprète « ${pr.name} »)`);
          if (mapped === null) continue;
        } else if (mapped !== "ensemble") {
          out.roles.set(mapped.id, { fr: mapped.fr, en: mapped.en });
        }
        addPerson(pr.name, pr.as_written, mapped === "ensemble");
      }
    }

    const siglum = w.sources?.siglum;
    if (isText(siglum)) {
      const inst = INSTITUTIONS[siglum];
      if (inst) out.institutions.set(slug(siglum), structuredClone(inst));
      else out.report.push(`${w.id}: sigle inconnu « ${siglum} »`);
    }

    for (const b of w.bibliography ?? []) {
      if (!isText(b.ref)) continue;
      const id = slug(b.ref);
      const known = out.bibliography.get(id);
      if (known) {
        if (known.short !== b.ref)
          out.report.push(`${w.id}: références « ${known.short} » et « ${b.ref} » ont le même identifiant ${id}`);
        continue;
      }
      out.bibliography.set(id, {
        short: b.ref,
        type: "other",
        author: [],
        editor: [],
        editorial_notes: [BIB_STUB_NOTE],
      });
    }
  }
  return out;
}
