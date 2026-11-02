import { describe, expect, test } from "vitest";
import { serializeJsonLd } from "~/lib/jsonld";

describe("serializeJsonLd", () => {
  test("a title containing </script> cannot close the script element", () => {
    const out = serializeJsonLd({ name: "Foo </script><img src=x onerror=alert(1)> & bar" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
  });
  test("round-trips through JSON.parse", () => {
    const data = { name: "a </script> b > c & d", n: 3 };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
