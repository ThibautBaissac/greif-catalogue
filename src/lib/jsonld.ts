const ESCAPES: Record<string, string> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" };

/** JSON for an inline `<script type="application/ld+json">`: `<`, `>` and `&` are unicode-escaped so no value can close the element. */
export const serializeJsonLd = (data: object): string =>
  JSON.stringify(data).replace(/[<>&]/g, (c) => ESCAPES[c]);
