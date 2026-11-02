import { defineConfig } from "astro/config";
import markdoc from "@astrojs/markdoc";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";

export default defineConfig({
  output: "static",
  // Keystatic appelle /api/keystatic/* et /keystatic/* sans barre finale : "always" les rendrait introuvables.
  // Le site statique est inchangé : build.format "directory" produit toujours des URL terminées par « / ».
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Valeur provisoire, à corriger en tâche 12.
  site: "https://catalogue-greif.netlify.app",
  // Les routes injectées par Keystatic (/keystatic, /api/keystatic) sont les seules rendues à la demande.
  // Aucune edge function : l'émulation Deno de `astro dev` n'est pas nécessaire.
  adapter: netlify({ devFeatures: { environmentVariables: false, images: true, edgeFunctions: false } }),
  integrations: [markdoc(), react(), keystatic()],
});
