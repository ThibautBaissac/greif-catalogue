import { collection, config, fields, singleton } from "@keystatic/core";
import { load as loadYaml } from "js-yaml";
import frYaml from "./content/ui/fr.yaml?raw";
import { EDTF_FIELD_PATTERN, uiToKeystatic } from "./src/lib/keystatic-ui";
import { validatedObject, withValidation } from "./src/lib/keystatic-validation";
import {
  BIB_TYPES,
  BOOK_STATUS,
  CATEGORIES,
  EDITION_STATUS,
  PERSON_KINDS,
  RELATIONS,
  SOURCE_FEATURES,
  SOURCE_STATUS,
  TEXT_ROLES,
  workSchema,
} from "./src/lib/schemas";
import { TH_PATTERN } from "./src/lib/th";
import { uiSchema } from "./src/lib/ui-schema";

const yaml = { data: "yaml" } as const;
const frUi = loadYaml(frYaml);

const SLUG_LABEL = "Identifiant permanent — ne plus modifier après publication";
const slugField = (label: string) => fields.slug({ name: { label, validation: { isRequired: true } }, slug: { label: SLUG_LABEL } });

const text = (label: string, multiline = false) => fields.text({ label, multiline });
const required = (label: string, multiline = false) => fields.text({ label, multiline, validation: { isRequired: true } });
const date = (label: string) =>
  fields.text({
    label,
    description: "Format EDTF : 1973, 1973-11, 1973-11-26, 197X, 1973? ou 1973-11~ ; intervalle : 1973/1974",
    validation: { pattern: { regex: new RegExp(EDTF_FIELD_PATTERN), message: "Date EDTF invalide (ex. 1973-11-26)" } },
  });
const integer = (label: string, min?: number, max?: number) => fields.integer({ label, validation: { min, max } });
const options = <const T extends readonly string[]>(values: T) => values.map(value => ({ label: value, value }));
const optionalSelect = <const T extends readonly string[]>(label: string, values: T) =>
  fields.select({ label, options: [{ label: "—", value: "" }, ...options(values)], defaultValue: "" });
const TEXT_ROLE_LABELS: Record<(typeof TEXT_ROLES)[number], string> = { author: "Auteur", translator: "Traducteur" };
const PERSON_KIND_LABELS: Record<(typeof PERSON_KINDS)[number], string> = { person: "Personne", ensemble: "Ensemble" };
const strings = (label: string, itemLabel?: string) =>
  fields.array(fields.text({ label: itemLabel ?? label, multiline: true }), { label });
const relationship = (label: string, collection: string, isRequired = false) =>
  fields.relationship({ label, collection, validation: { isRequired } });
const relationships = (label: string, collection: string) =>
  fields.array(relationship(label, collection, true), { label, itemLabel: p => String(p.value ?? "") });

// Empty sections remain optional; validatedObject checks partly filled sections before saving.
const performer = fields.object(
  {
    person: relationship("Personne", "persons", true),
    role: relationship("Rôle", "roles"),
    alias: text("Nom tel qu'écrit"),
  },
  { label: "Interprète" },
);

const workFields = {
  title: slugField("Titre"),
  th: fields.text({
    label: "Th",
    description:
      "Pour insérer ou déplacer une œuvre, ne changer que son numéro : les suivants se décalent seuls après l'enregistrement (une à deux minutes en production).",
    validation: { isRequired: true, pattern: { regex: TH_PATTERN, message: "Un nombre, éventuellement suivi d'une lettre (ex. 45, 45a)" } },
  }),
  book: fields.integer({ label: "Livre", validation: { isRequired: true, min: 1, max: 6 } }),
  subtitle: text("Sous-titre"),
  alt_titles: fields.array(
    fields.object({ title: required("Titre"), source: required("Source") }, { label: "Titre alternatif" }),
    { label: "Titres alternatifs", itemLabel: p => p.fields.title.value },
  ),
  opus: text("Opus"),
  scoring: fields.object(
    { fr: required("Effectif (FR)"), en: required("Effectif (EN)") },
    { label: "Effectif" },
  ),
  scoring_note: text("Note sur l'effectif", true),
  categories: withValidation(
    fields.multiselect({
      label: "Catégories",
      description: "Choisissez au moins une catégorie.",
      options: options(CATEGORIES),
      defaultValue: [],
    }),
    value => value.length === 0 ? "Choisissez au moins une catégorie." : undefined,
  ),
  movements: fields.array(
    fields.object(
      {
        title: text("Titre"),
        bars: integer("Mesures", 1),
        text_incipit: text("Incipit littéraire", true),
        incipit: fields.image({ label: "Incipit musical", directory: "public/incipits", publicPath: "/incipits/" }),
        incipit_count: integer("Nombre d'incipits"),
      },
      { label: "Mouvement" },
    ),
    { label: "Mouvements", itemLabel: p => p.fields.title.value || "Mouvement" },
  ),
  text: validatedObject(fields.object(
    {
      credit: text("Mention du texte"),
      poem_title: text("Titre du poème"),
      authors: fields.array(
        fields.object(
          {
            person: relationship("Personne", "persons", true),
            role: fields.select({
              label: "Rôle",
              options: TEXT_ROLES.map(value => ({ label: TEXT_ROLE_LABELS[value], value })),
              defaultValue: TEXT_ROLES[0],
            }),
            as_written: text("Nom tel qu'écrit"),
          },
          { label: "Auteur du texte" },
        ),
        { label: "Auteurs du texte", itemLabel: p => p.fields.person.value ?? "" },
      ),
    },
    { label: "Texte", description: "Rubrique facultative. Renseignez « Mention du texte » si vous remplissez cette rubrique." },
  ), workSchema.shape.text),
  composition: validatedObject(
    fields.object({ text: text("Texte"), date: date("Date") }, {
      label: "Composition", description: "Rubrique facultative. Renseignez « Texte » si vous indiquez une date.",
    }),
    workSchema.shape.composition,
  ),
  duration: text("Durée"),
  dedication: fields.object(
    { text: text("Texte", true), persons: relationships("Dédicataires", "persons") },
    { label: "Dédicace" },
  ),
  sources: validatedObject(fields.object(
    {
      status: optionalSelect("Statut", SOURCE_STATUS),
      institution: relationship("Fonds", "institutions"),
      intro: text("Introduction", true),
      items: fields.array(
        fields.object({ label: text("Libellé"), text: required("Texte", true) }, { label: "Source" }),
        { label: "Sources", itemLabel: p => p.fields.label.value || p.fields.text.value.slice(0, 60) },
      ),
      papers: strings("Papiers", "Papier"),
      features: fields.multiselect({ label: "Caractéristiques", options: options(SOURCE_FEATURES), defaultValue: [] }),
    },
    { label: "Sources", description: "Rubrique facultative. Choisissez un statut si vous remplissez cette rubrique." },
  ), workSchema.shape.sources),
  audio_source: text("Source audio", true),
  remarks: strings("Remarques", "Remarque"),
  intertextual: strings("Intertextualité", "Élément"),
  documents: strings("Documents", "Document"),
  premiere_recording: strings("Enregistrement de la première", "Élément"),
  editions: fields.array(
    fields.object(
      {
        text: required("Texte", true),
        publisher: text("Éditeur"),
        year: integer("Année"),
        status: optionalSelect("Statut", EDITION_STATUS),
      },
      { label: "Édition" },
    ),
    { label: "Éditions", itemLabel: p => p.fields.text.value.slice(0, 60) },
  ),
  unpublished: fields.checkbox({ label: "Inédit", defaultValue: false }),
  performances: fields.array(
    fields.object(
      {
        premiere: fields.checkbox({ label: "Première", defaultValue: false }),
        date: date("Date"),
        venue: text("Salle"),
        place: relationship("Lieu", "places"),
        performers: fields.array(performer, {
          label: "Interprètes",
          itemLabel: p => p.fields.person.value ?? "",
        }),
        note: text("Remarque", true),
        text: required("Texte", true),
      },
      { label: "Exécution" },
    ),
    {
      label: "Exécutions",
      itemLabel: p => [p.fields.date.value, p.fields.venue.value].filter(Boolean).join(" ") || "Exécution",
    },
  ),
  journal: fields.array(
    fields.object(
      {
        date_text: required("Date (texte)"),
        date: date("Date"),
        context: text("Contexte", true),
        note: text("Note", true),
        quotes: strings("Citations", "Citation"),
      },
      { label: "Entrée du carnet" },
    ),
    { label: "Carnet de bord", itemLabel: p => p.fields.date_text.value },
  ),
  bibliography: fields.array(
    fields.object({ ref: relationship("Référence", "bibliography", true), pages: text("Pages") }, { label: "Référence" }),
    { label: "Bibliographie", itemLabel: p => p.fields.ref.value ?? "" },
  ),
  discography: fields.array(
    fields.object(
      {
        text: required("Texte", true),
        title: text("Titre"),
        year: integer("Année"),
        details: text("Détails", true),
      },
      { label: "Enregistrement" },
    ),
    { label: "Discographie", itemLabel: p => p.fields.text.value.slice(0, 60) },
  ),
  videography: fields.array(fields.object({ text: required("Texte", true) }, { label: "Vidéo" }), {
    label: "Vidéographie",
    itemLabel: p => p.fields.text.value.slice(0, 60),
  }),
  related: fields.array(
    fields.object(
      {
        work: relationship("Œuvre", "works", true),
        relation: fields.select({ label: "Relation", options: options(RELATIONS), defaultValue: RELATIONS[0] }),
      },
      { label: "Œuvre liée" },
    ),
    { label: "Œuvres liées", itemLabel: p => p.fields.work.value ?? "" },
  ),
  editorial_notes: strings("Notes de rédaction", "Note"),
};

const nameFields = {
  family: required("Nom de famille"),
  given: text("Prénom"),
};

const person = (label: string) => fields.object(nameFields, { label });

const pages = (label: string, path: `${string}/*`) =>
  collection({
    label,
    path,
    slugField: "title",
    format: { contentField: "body" },
    schema: {
      title: slugField("Titre"),
      body: fields.markdoc({ label: "Contenu" }),
    },
  });

export default config({
  storage: import.meta.env.PROD
    ? { kind: "github", repo: { owner: "ThibautBaissac", name: "greif-catalogue" } }
    : { kind: "local" },
  collections: {
    works: collection({
      label: "Œuvres",
      path: "content/works/*",
      slugField: "title",
      format: yaml,
      schema: workFields,
    }),
    persons: collection({
      label: "Personnes",
      path: "content/persons/*",
      slugField: "name",
      format: yaml,
      schema: {
        name: slugField("Nom"),
        surname: required("Nom de famille"),
        given: text("Prénom"),
        kind: fields.select({
          label: "Nature",
          options: PERSON_KINDS.map(value => ({ label: PERSON_KIND_LABELS[value], value })),
          defaultValue: PERSON_KINDS[0],
        }),
        dates: date("Dates"),
        identifiers: fields.object(
          { bnf: text("BnF"), viaf: text("VIAF"), isni: text("ISNI"), wikidata: text("Wikidata") },
          { label: "Identifiants" },
        ),
        variants: strings("Variantes", "Variante"),
        note: text("Note", true),
      },
    }),
    places: collection({
      label: "Lieux",
      path: "content/places/*",
      slugField: "name",
      format: yaml,
      schema: { name: slugField("Nom"), country: text("Pays"), note: text("Note", true) },
    }),
    institutions: collection({
      label: "Fonds et institutions",
      path: "content/institutions/*",
      slugField: "siglum",
      format: yaml,
      schema: {
        siglum: slugField("Sigle"),
        name: fields.object({ fr: required("Nom (FR)"), en: required("Nom (EN)") }, { label: "Nom" }),
        city: text("Ville"),
      },
    }),
    roles: collection({
      label: "Rôles",
      path: "content/roles/*",
      slugField: "fr",
      format: yaml,
      schema: { fr: slugField("Libellé (FR)"), en: required("Libellé (EN)") },
    }),
    bibliography: collection({
      label: "Bibliographie",
      path: "content/bibliography/*",
      slugField: "short",
      format: yaml,
      schema: {
        short: slugField("Référence courte"),
        type: fields.select({ label: "Type", options: options(BIB_TYPES), defaultValue: "book" }),
        title: text("Titre", true),
        author: fields.array(person("Auteur"), { label: "Auteurs", itemLabel: p => p.fields.family.value }),
        editor: fields.array(person("Éditeur scientifique"), {
          label: "Éditeurs scientifiques",
          itemLabel: p => p.fields.family.value,
        }),
        issued: date("Date de publication"),
        publisher: text("Éditeur"),
        "publisher-place": text("Lieu d'édition"),
        "container-title": text("Titre du conteneur"),
        page: text("Pages"),
        URL: text("URL"),
        editorial_notes: strings("Notes de rédaction", "Note"),
      },
    }),
    pagesFr: pages("Pages (FR)", "content/pages/fr/*"),
    pagesEn: pages("Pages (EN)", "content/pages/en/*"),
  },
  singletons: {
    books: singleton({
      label: "Livres",
      path: "content/books",
      format: yaml,
      schema: {
        books: fields.array(
          fields.object(
            {
              number: fields.integer({ label: "Numéro", validation: { isRequired: true, min: 1, max: 6 } }),
              roman: required("Chiffre romain"),
              status: fields.select({
                label: "Statut",
                options: options(BOOK_STATUS),
                defaultValue: "planned",
              }),
            },
            { label: "Livre" },
          ),
          { label: "Livres", validation: { length: { min: 6, max: 6 } }, itemLabel: p => p.fields.roman.value },
        ),
      },
    }),
    uiFr: singleton({
      label: "Interface (FR)",
      path: "content/ui/fr",
      format: yaml,
      schema: uiToKeystatic(uiSchema, frUi),
    }),
    uiEn: singleton({
      label: "Interface (EN)",
      path: "content/ui/en",
      format: yaml,
      schema: uiToKeystatic(uiSchema, frUi),
    }),
  },
});
