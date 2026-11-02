import { describe, expect, test } from "vitest";
import { createReader } from "@keystatic/core/reader";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dump, load } from "js-yaml";
import { workSchema } from "~/lib/schemas";
import config from "../../keystatic.config";

const works = config.collections!.works.schema;

describe("Keystatic work validation", () => {
  test("requires at least one category before saving", () => {
    expect(() => works.categories.validate([])).toThrow(/catégorie/i);
    expect(works.categories.validate(["piano"])).toEqual(["piano"]);
  });

  test.each([
    ["composition", { date: "1973" }, /Texte/],
    ["text", { authors: [{ person: "heinrich-heine", role: "author" }] }, /Mention du texte/],
    ["sources", { intro: "Manuscrit conservé à Paris" }, /Statut/],
  ])("rejects a partly filled %s without its required field", async (key, value, message) => {
    const dir = mkdtempSync(join(tmpdir(), "greif-cms-validation-"));
    try {
      mkdirSync(join(dir, "content/works"), { recursive: true });
      writeFileSync(join(dir, "content/works/essai.yaml"), dump({
        title: "Essai", th: "999", book: 1, scoring: { fr: "Piano", en: "Piano" }, categories: ["piano"],
        [key as string]: value,
      }));
      const reader = createReader(dir, config);
      await expect(reader.collections.works.read("essai")).rejects.toThrow(message as RegExp);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("keeps empty optional sections valid", () => {
    for (const field of [works.text, works.composition, works.sources]) {
      expect(() => field.validate(field.defaultValue() as never)).not.toThrow();
    }
  });

  test("normalizes null optional values as the native Keystatic parser does", () => {
    const composition = works.composition.parse({ text: "Composée en 1973", date: null });
    expect(works.composition.validate(composition)).toEqual({ text: "Composée en 1973", date: "" });
    const sources = works.sources.parse({ status: "located", institution: null, items: null, papers: null, features: null });
    expect(works.sources.validate(sources)).toEqual({
      status: "located", institution: null, intro: "", items: [], papers: [], features: [],
    });
  });

  test("rejects a partial section at the save validation hook", () => {
    expect(() => works.composition.validate(works.composition.parse({ date: "1973" }))).toThrow(/Texte/);
    expect(() => works.text.validate(works.text.parse({ poem_title: "Ode" }))).toThrow(/Mention du texte/);
    expect(() => works.sources.validate(works.sources.parse({ papers: ["JD"] }))).toThrow(/Statut/);
  });

  test("preserves every current work through reading and optional-section serialization", async () => {
    const reader = createReader(process.cwd(), config);
    const entries = await reader.collections.works.all();
    expect(entries.length).toBeGreaterThan(0);
    for (const { slug, entry } of entries) {
      const raw = load(readFileSync(`content/works/${slug}.yaml`, "utf8")) as Record<string, unknown>;
      const serialized = Object.fromEntries((["text", "composition", "sources"] as const).map(key => {
        const field = works[key];
        const parsed = field.parse(raw[key] as never);
        field.validate(parsed as never);
        return [key, field.serialize(parsed as never).value];
      }));
      const expected = workSchema.parse(raw);
      expect(workSchema.parse(entry), slug).toEqual(expected);
      expect(workSchema.parse({ ...raw, ...serialized }), slug).toEqual(expected);
    }
  });
});
