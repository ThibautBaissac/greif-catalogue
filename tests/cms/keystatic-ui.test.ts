import { z } from "astro/zod";
import { describe, expect, test } from "vitest";
import { EDTF_FIELD_PATTERN, EDTF_PATTERN, uiToKeystatic } from "~/lib/keystatic-ui";
import { isEdtf } from "~/lib/edtf";

type F = { kind: string; label?: string; fields?: Record<string, F>; element?: F; Input?: (p: object) => { props: { multiline?: boolean } } };

const schema = z.object({
  short: z.string(),
  long: z.string(),
  nested: z.object({ inner: z.string() }),
  list: z.array(z.string()),
});
const sample = { short: "Court", long: "x".repeat(61), nested: { inner: "y".repeat(61) }, list: ["a"] };

describe("uiToKeystatic", () => {
  const fields = uiToKeystatic(schema, sample) as Record<string, F>;

  test("maps object, string and string-array to Keystatic fields", () => {
    expect(fields.nested.kind).toBe("object");
    expect(Object.keys(fields.nested.fields!)).toEqual(["inner"]);
    expect(fields.list.kind).toBe("array");
    expect(fields.list.element!.kind).toBe("form");
    expect(fields.short.kind).toBe("form");
  });

  test("labels a field with its key", () => {
    expect(fields.short.label).toBe("short");
    expect(fields.nested.fields!.inner.label).toBe("inner");
  });

  test("uses a multiline text only when the FR value exceeds 60 characters", () => {
    expect(fields.short.Input!({}).props.multiline).toBe(false);
    expect(fields.long.Input!({}).props.multiline).toBe(true);
    expect(fields.nested.fields!.inner.Input!({}).props.multiline).toBe(true);
  });

  test("a value of exactly 60 characters stays single line", () => {
    const f = uiToKeystatic(z.object({ a: z.string() }), { a: "x".repeat(60) }) as Record<string, F>;
    expect(f.a.Input!({}).props.multiline).toBe(false);
  });

  test("sees through a default wrapper", () => {
    const f = uiToKeystatic(z.object({ a: z.string().default("") })) as Record<string, F>;
    expect(f.a.kind).toBe("form");
  });

  test("rejects an unsupported Zod type", () => {
    expect(() => uiToKeystatic(z.object({ n: z.number() }))).toThrow(/n/);
  });
});

describe("EDTF_PATTERN", () => {
  const re = new RegExp(EDTF_PATTERN);
  test.each([
    "1973", "1973-11", "1973-11-26", "197X", "1973?", "1973-11~", "1973/1974", "1973-11-26/1973-12", "1973?/1974~",
  ])("accepts %s", s => {
    expect(re.test(s)).toBe(true);
    expect(isEdtf(s)).toBe(true);
  });
  test.each(["2026-13", "2026-00", "2026-11-32", "1973/", "/1973", "1973/1974/1975", "abc", "19", "1973-11-26T10"])(
    "rejects %s",
    s => {
      expect(re.test(s)).toBe(false);
      expect(isEdtf(s)).toBe(false);
    },
  );
});

describe("EDTF_FIELD_PATTERN", () => {
  // Keystatic tests its pattern even on an empty text field: an optional date must accept "".
  const re = new RegExp(EDTF_FIELD_PATTERN);
  test("accepts an empty value and a valid date", () => {
    expect(re.test("")).toBe(true);
    expect(re.test("1973-11-26/1974")).toBe(true);
  });
  test("rejects an invalid date", () => {
    expect(re.test("2026-13")).toBe(false);
  });
});
