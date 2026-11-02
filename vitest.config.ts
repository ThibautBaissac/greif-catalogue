import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "~": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/{lib,migrate,cms}/**/*.test.ts"] },
      },
      {
        resolve: { alias },
        test: { name: "site", include: ["tests/site/**/*.test.ts"] },
      },
    ],
  },
});
