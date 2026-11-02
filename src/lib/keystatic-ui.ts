import { fields, type ComponentSchema } from "@keystatic/core";
import type { z } from "astro/zod";
import { EDTF_DATE } from "./edtf";

/** EDTF subset of `edtf.ts` as an anchored regex source: one date or an interval of two. */
export const EDTF_PATTERN = `^${EDTF_DATE}(?:/${EDTF_DATE})?$`;

/** Same, for an optional Keystatic text field: Keystatic also tests the pattern against an empty value. */
export const EDTF_FIELD_PATTERN = `^(?:${EDTF_PATTERN.slice(1, -1)})?$`;

/** FR strings longer than this get a multiline field. */
const MULTILINE_FROM = 60;

type Def = { type: string; shape?: Record<string, z.ZodType>; element?: z.ZodType; innerType?: z.ZodType };
const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

function convert(schema: z.ZodType, key: string, sample: unknown): ComponentSchema {
  const def = defOf(schema);
  if (def.type === "default" && def.innerType) return convert(def.innerType, key, sample);
  if (def.type === "object") {
    return fields.object(
      uiToKeystatic(schema as z.ZodObject, sample),
      { label: key },
    );
  }
  if (def.type === "string") {
    return fields.text({ label: key, multiline: typeof sample === "string" && sample.length > MULTILINE_FROM });
  }
  if (def.type === "array" && def.element && defOf(def.element).type === "string") {
    return fields.array(fields.text({ label: key }), { label: key });
  }
  throw new Error(`uiToKeystatic: unsupported type « ${def.type} » at « ${key} »`);
}

/**
 * Converts the interface-strings schema into Keystatic fields. `sample` holds the FR values:
 * it decides which text fields are multiline.
 */
export function uiToKeystatic(schema: z.ZodObject, sample?: unknown): Record<string, ComponentSchema> {
  const shape = defOf(schema).shape ?? {};
  const values = (sample ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(shape).map(([key, child]) => [key, convert(child, key, values[key])]));
}
