import { z } from "astro/zod";
import { isEdtf } from "./edtf";

export const CATEGORIES = [
  "piano",
  "two-pianos",
  "voice-piano",
  "vocal-ensemble",
  "chamber",
  "choral",
  "orchestra",
  "undetermined",
] as const;
export const SOURCE_FEATURES = ["autograph", "draft", "sketch", "fair_copy", "unfinished", "incomplete"] as const;
export const SOURCE_STATUS = ["located", "not_located", "lost"] as const;
export const RELATIONS = [
  "revision",
  "extract",
  "version",
  "companion",
  "cycle",
  "shared-material",
  "sketch",
] as const;
export const BIB_TYPES = ["book", "chapter", "article-journal", "thesis", "webpage", "other"] as const;

/** Optional scalar: the CMS writes "" or null for an empty field, both mean absent. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(v => (v === "" || v === null ? undefined : v), schema.optional());

/** Required text: an empty value is an error. */
const text = z.string().min(1);

export const edtf = z.string().refine(isEdtf, "EDTF invalide");

const authorityId = text;

const movementSchema = z
  .object({
    title: optional(z.string()),
    bars: optional(z.number().int().positive()),
    text_incipit: optional(z.string()),
    incipit: optional(z.string()),
    incipit_count: optional(z.number().int()),
  })
  .strict();

const performerSchema = z
  .object({
    person: authorityId,
    role: optional(z.string()),
    alias: optional(z.string()),
  })
  .strict();

const performanceSchema = z
  .object({
    premiere: z.boolean(),
    date: optional(edtf),
    venue: optional(z.string()),
    place: optional(z.string()),
    performers: z.array(performerSchema).default([]),
    text,
  })
  .strict();

const journalSchema = z
  .object({
    date_text: text,
    date: optional(edtf),
    context: optional(z.string()),
    note: optional(z.string()),
    quotes: z.array(z.string()).default([]),
  })
  .strict();

export const workSchema = z
  .object({
    title: text,
    th: z.string().regex(/^\d+[a-z]?$/),
    book: z.number().int().min(1).max(6),
    subtitle: optional(z.string()),
    alt_titles: z
      .array(z.object({ title: text, source: text }).strict())
      .default([]),
    opus: optional(z.string()),
    scoring: z.object({ fr: text, en: text }).strict(),
    scoring_note: optional(z.string()),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    movements: z.array(movementSchema).default([]),
    text: z
      .object({
        credit: text,
        poem_title: optional(z.string()),
        authors: z
          .array(
            z
              .object({
                person: authorityId,
                role: z.enum(["author", "translator"]),
                as_written: optional(z.string()),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .optional(),
    composition: z.object({ text, date: optional(edtf) }).strict().optional(),
    duration: optional(z.string()),
    dedication: z
      .object({ text: optional(z.string()), persons: z.array(authorityId).default([]) })
      .strict()
      .optional(),
    sources: z
      .object({
        status: z.enum(SOURCE_STATUS),
        institution: optional(authorityId),
        intro: optional(z.string()),
        items: z.array(z.object({ label: optional(z.string()), text }).strict()).default([]),
        papers: z.array(z.string()).default([]),
        features: z.array(z.enum(SOURCE_FEATURES)).default([]),
      })
      .strict()
      .optional(),
    audio_source: optional(z.string()),
    remarks: z.array(z.string()).default([]),
    intertextual: z.array(z.string()).default([]),
    documents: z.array(z.string()).default([]),
    premiere_recording: z.array(z.string()).default([]),
    editions: z
      .array(
        z
          .object({
            text,
            publisher: optional(z.string()),
            year: optional(z.number().int()),
            status: optional(z.enum(["uncertain", "forthcoming"])),
          })
          .strict(),
      )
      .default([]),
    unpublished: z.boolean().default(false),
    performances: z.array(performanceSchema).default([]),
    journal: z.array(journalSchema).default([]),
    bibliography: z
      .array(z.object({ ref: authorityId, pages: optional(z.string()) }).strict())
      .default([]),
    discography: z
      .array(
        z
          .object({
            text,
            title: optional(z.string()),
            year: optional(z.number().int()),
            details: optional(z.string()),
          })
          .strict(),
      )
      .default([]),
    videography: z.array(z.object({ text }).strict()).default([]),
    related: z
      .array(z.object({ work: authorityId, relation: z.enum(RELATIONS) }).strict())
      .default([]),
    editorial_notes: z.array(z.string()).default([]),
  })
  .strict();

export const personSchema = z
  .object({
    name: text,
    surname: text,
    given: optional(z.string()),
    kind: z.enum(["person", "ensemble"]).default("person"),
    dates: optional(edtf),
    identifiers: z
      .object({
        bnf: optional(z.string()),
        viaf: optional(z.string()),
        isni: optional(z.string()),
        wikidata: optional(z.string()),
      })
      .strict()
      .optional(),
    variants: z.array(z.string()).default([]),
    note: optional(z.string()),
  })
  .strict();

export const placeSchema = z
  .object({ name: text, country: optional(z.string()), note: optional(z.string()) })
  .strict();

export const institutionSchema = z
  .object({
    siglum: text,
    name: z.object({ fr: text, en: text }).strict(),
    city: optional(z.string()),
  })
  .strict();

export const roleSchema = z.object({ fr: text, en: text }).strict();

const nameSchema = z.object({ family: text, given: optional(z.string()) }).strict();

export const bibliographySchema = z
  .object({
    short: text,
    type: z.enum(BIB_TYPES),
    title: optional(z.string()),
    author: z.array(nameSchema).default([]),
    editor: z.array(nameSchema).default([]),
    issued: optional(edtf),
    publisher: optional(z.string()),
    "publisher-place": optional(z.string()),
    "container-title": optional(z.string()),
    page: optional(z.string()),
    URL: optional(z.string()),
    editorial_notes: z.array(z.string()).default([]),
  })
  .strict();

export const bookSchema = z
  .object({
    number: z.number().int().min(1).max(6),
    roman: text,
    status: z.enum(["complete", "partial", "planned"]),
  })
  .strict();

export const booksFileSchema = z.object({ books: z.array(bookSchema).length(6) }).strict();

export type Work = z.output<typeof workSchema>;
export type Movement = Work["movements"][number];
export type Performance = Work["performances"][number];
export type Performer = Performance["performers"][number];
export type JournalEntry = Work["journal"][number];
export type Person = z.output<typeof personSchema>;
export type Place = z.output<typeof placeSchema>;
export type Institution = z.output<typeof institutionSchema>;
export type Role = z.output<typeof roleSchema>;
export type BibEntry = z.output<typeof bibliographySchema>;
export type Book = z.output<typeof bookSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Relation = (typeof RELATIONS)[number];
export type SourceFeature = (typeof SOURCE_FEATURES)[number];
