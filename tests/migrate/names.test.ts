import { describe, expect, test } from "vitest";
import { invertName } from "../../scripts/migrate/names";

describe("invertName", () => {
  test.each([
    ["Heinrich Heine", "Heine", "Heinrich"],
    ["Jacques Loiseleur des Longchamps", "Loiseleur des Longchamps", "Jacques"],
    ["Ludwig van Beethoven", "Beethoven", "Ludwig van"],
    ["Jean de La Fontaine", "La Fontaine", "Jean de"],
    ["Claus Schenk Graf von Stauffenberg", "Stauffenberg", "Claus Schenk Graf von"],
    ["Mrs Alexander Liberman", "Liberman", "Mrs Alexander"],
    ["Li Bai", "Li Bai", ""],
    ["Devadip", "Devadip", ""],
    ["Mère Teresa", "Mère Teresa", ""],
    ["Jean Dupont (pseudonyme)", "Jean Dupont (pseudonyme)", ""],
    ["Jean Le Houx", "Houx", "Jean Le"],
  ])("%s", (name, surname, given) => {
    expect(invertName(name)).toEqual({ surname, given });
  });
});
