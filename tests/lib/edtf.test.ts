import { describe, expect, test } from "vitest";
import { edtfSortKey, edtfYear, formatEdtf, fromLegacy, isEdtf } from "~/lib/edtf";

const FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

describe("formatEdtf", () => {
  test("full date, FR and EN", () => {
    expect(formatEdtf("1973-11-26", "fr", FR)).toBe("26 novembre 1973");
    expect(formatEdtf("1973-11-26", "en", EN)).toBe("26 November 1973");
  });
  test("first of the month is 1er in FR only", () => {
    expect(formatEdtf("1974-05-01", "fr", FR)).toBe("1er mai 1974");
    expect(formatEdtf("1974-05-01", "en", EN)).toBe("1 May 1974");
  });
  test("month and year", () => {
    expect(formatEdtf("1968-11", "en", EN)).toBe("November 1968");
  });
  test("interval within one year", () => {
    expect(formatEdtf("1973-05/1973-11", "fr", FR)).toBe("mai – novembre 1973");
  });
  test("interval within one month", () => {
    expect(formatEdtf("1973-11-08/1973-11-26", "fr", FR)).toBe("8–26 novembre 1973");
  });
  test("interval across years", () => {
    expect(formatEdtf("1969-11/1974-02-23", "fr", FR)).toBe("novembre 1969 – 23 février 1974");
  });
  test("interval in one year starting at year precision shows the year alone", () => {
    expect(formatEdtf("1974/1974-06", "fr", FR)).toBe("1974");
  });
  test("uncertain date", () => {
    expect(formatEdtf("1974?", "fr", FR)).toBe("1974 ?");
    expect(formatEdtf("1974?", "en", EN)).toBe("1974?");
  });
  test("approximate date", () => {
    expect(formatEdtf("1974~", "en", EN)).toBe("c. 1974");
    expect(formatEdtf("1974~", "fr", FR)).toBe("vers 1974");
  });
  test("decade", () => {
    expect(formatEdtf("197X", "fr", FR)).toBe("années 1970");
    expect(formatEdtf("197X", "en", EN)).toBe("1970s");
  });
});

describe("isEdtf", () => {
  test("accepts an interval of simple dates", () => {
    expect(isEdtf("1973-05/1973-11")).toBe(true);
  });
  test("rejects an invalid month", () => {
    expect(isEdtf("1974-13")).toBe(false);
  });
  test("rejects a day-first date", () => {
    expect(isEdtf("26/11/1973")).toBe(false);
  });
  test("rejects X combined with a month", () => {
    expect(isEdtf("197X-05")).toBe(false);
  });
});

describe("edtfYear", () => {
  test("replaces X by 0", () => {
    expect(edtfYear("197X")).toBe(1970);
  });
  test("takes the start of an interval", () => {
    expect(edtfYear("1973-05/1974")).toBe(1973);
  });
  test("is null when absent", () => {
    expect(edtfYear(undefined)).toBeNull();
  });
});

describe("edtfSortKey", () => {
  test("keeps the start without qualifier", () => {
    expect(edtfSortKey("1973-05?/1974")).toBe("1973-05");
  });
  test("is 9999 when absent", () => {
    expect(edtfSortKey(undefined)).toBe("9999");
  });
});

describe("fromLegacy", () => {
  test("builds an interval, a single date, or nothing", () => {
    expect(fromLegacy("1973-05", "1973-11")).toBe("1973-05/1973-11");
    expect(fromLegacy("1970")).toBe("1970");
    expect(fromLegacy()).toBeUndefined();
  });
});
