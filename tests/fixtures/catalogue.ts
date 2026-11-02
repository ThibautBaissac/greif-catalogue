import type { CatalogueInput } from "~/lib/catalogue";
import {
  bibliographySchema,
  bookSchema,
  institutionSchema,
  personSchema,
  placeSchema,
  roleSchema,
  workSchema,
} from "~/lib/schemas";

/**
 * Jeu de données partagé par les tests du domaine, des index et des pages.
 * Chaque entrée passe par son schéma : les valeurs par défaut sont remplies
 * et le jeu de données ne peut pas dériver du schéma.
 */
export const fixtureInput: CatalogueInput = {
  persons: [
    { id: "heinrich-heine", data: personSchema.parse({ name: "Heinrich Heine", surname: "Heine", given: "Heinrich" }) },
    { id: "nell-froger", data: personSchema.parse({ name: "Nell Froger", surname: "Froger", given: "Nell" }) },
    { id: "olivier-greif", data: personSchema.parse({ name: "Olivier Greif", surname: "Greif", given: "Olivier" }) },
  ],
  places: [
    { id: "paris", data: placeSchema.parse({ name: "Paris" }) },
    { id: "prague", data: placeSchema.parse({ name: "Prague", country: "République Tchèque" }) },
  ],
  institutions: [
    {
      id: "f-pbmgf",
      data: institutionSchema.parse({
        siglum: "F-Pbmgf",
        name: {
          fr: "Paris, Bibliothèque musicale La Grange-Fleuret, fonds Olivier Greif.",
          en: "Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection.",
        },
      }),
    },
  ],
  roles: [
    { id: "soprano", data: roleSchema.parse({ fr: "soprano", en: "soprano" }) },
    { id: "piano", data: roleSchema.parse({ fr: "piano", en: "piano" }) },
  ],
  bibliography: [
    {
      id: "francois-sappey-nectoux-2013",
      data: bibliographySchema.parse({ short: "François-Sappey & Nectoux (2013)", type: "book" }),
    },
  ],
  books: [
    { number: 1, roman: "I", status: "complete" },
    { number: 2, roman: "II", status: "partial" },
    { number: 3, roman: "III", status: "planned" },
    { number: 4, roman: "IV", status: "planned" },
    { number: 5, roman: "V", status: "planned" },
    { number: 6, roman: "VI", status: "planned" },
  ].map(b => bookSchema.parse(b)),
  works: [
    {
      id: "sonate-a",
      data: workSchema.parse({
        th: "2",
        book: 1,
        title: "Sonate",
        opus: "3",
        scoring: { fr: "Piano", en: "Piano" },
        categories: ["piano"],
        composition: { text: "mai – novembre 1973", date: "1973-05/1973-11" },
        movements: [{ title: "I", bars: 40 }],
        sources: {
          status: "located",
          institution: "f-pbmgf",
          items: [{ text: "Ms. autographe" }],
          papers: ["filigrané JD"],
          features: ["autograph", "draft"],
        },
        editions: [{ text: "Symétrie, 2006", publisher: "Symétrie", year: 2006 }],
        performances: [
          {
            premiere: true,
            date: "1974-04-24",
            venue: "Paris, salle Cortot",
            place: "paris",
            performers: [
              { person: "nell-froger", role: "soprano" },
              { person: "olivier-greif", role: "piano" },
            ],
            text: "…",
          },
        ],
        journal: [{ date_text: "18 juillet 1973", date: "1973-07-18", quotes: ["« Je termine. »"] }],
        bibliography: [{ ref: "francois-sappey-nectoux-2013", pages: "28, 35" }],
        related: [{ work: "lied-b", relation: "revision" }],
        dedication: { persons: ["heinrich-heine"] },
      }),
    },
    {
      id: "etude-c",
      data: workSchema.parse({
        th: "2a",
        book: 1,
        title: "Étude",
        scoring: { fr: "Piano", en: "Piano" },
        categories: ["piano"],
      }),
    },
    {
      id: "lied-b",
      data: workSchema.parse({
        th: "10",
        book: 1,
        title: "L'Île",
        scoring: { fr: "Voix et piano", en: "Voice and piano" },
        categories: ["voice-piano"],
        text: {
          credit: "Heinrich Heine",
          authors: [{ person: "heinrich-heine", role: "author" }],
        },
        movements: [{ title: "1", text_incipit: "Vergiftet sind meine Lieder", bars: 30 }],
        composition: { text: "1972", date: "1972" },
        unpublished: true,
        sources: { status: "lost", items: [], papers: [], features: [] },
        remarks: ["cf. [[sonate-a]] et [[?]]"],
        performances: [
          {
            premiere: false,
            date: "1976-03-18",
            place: "prague",
            performers: [{ person: "nell-froger", role: "soprano" }],
            text: "…",
          },
        ],
        editorial_notes: ["Compléter les mesures"],
      }),
    },
    {
      id: "zeta-d",
      data: workSchema.parse({
        th: "50",
        book: 2,
        title: "Zeta",
        scoring: { fr: "Piano", en: "Piano" },
        categories: ["piano"],
        composition: { text: "inconnue" },
      }),
    },
  ],
};
