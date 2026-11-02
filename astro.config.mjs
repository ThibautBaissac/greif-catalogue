import { defineConfig } from "astro/config";
import markdoc from "@astrojs/markdoc";

export default defineConfig({
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // Valeur provisoire, à corriger en tâche 12.
  site: "https://catalogue-greif.netlify.app",
  integrations: [markdoc()],
});
