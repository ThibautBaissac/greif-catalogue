# Catalogue thématique des œuvres d'Olivier Greif — prototype

Site statique bilingue (français / anglais), généré à partir d'un fichier YAML par œuvre.
Aucun framework : Node + `js-yaml` pour la génération, HTML/CSS/JS simples pour le site.

## Démarrage

```sh
npm install
npm run build          # -> dist/ (site complet, page « État de la rédaction » incluse)
node build.mjs --public  # -> dist/ sans la page de rédaction ni les notes internes
npm run serve          # aperçu sur http://localhost:8080
```

`dist/` se dépose tel quel sur n'importe quel hébergement statique.

## Arborescence

```
data/works/<id>.yaml   une notice par fichier (source de référence)
data/books.yaml        les six Livres et leur état
incipits/<id>/<n>.png  incipits musicaux exportés de Finale (n = n° du mouvement, dès 1)
i18n.mjs               interface FR/EN, vocabulaire contrôlé (effectifs, rôles, rubriques)
build.mjs              générateur : notices, index, recherche
assets/                style.css, app.js (filtres, recherche, citation)
tools/import_docx.py   migration Word -> YAML (pandoc --wrap=none, puis analyse)
tools/enrich.py        apports éditoriaux saisis à la main (titres alternatifs, dédicataires,
                       catégories d'effectif, relations entre œuvres, normalisation des lieux et des noms)
```

## Principes

- **Identifiant permanent ≠ numéro Th.** Chaque notice a un `id` (ex. `wiener-konzert`) qui sert
  d'adresse de page et de nom de dossier d'incipits. Le champ `th` peut changer librement.
- **Renvois automatiques.** Dans le texte, écrire `[[wiener-konzert]]` : le site affiche
  « Th 45 » avec le lien, recalculé à chaque génération. `[[?]]` marque un renvoi à résoudre.
- **Texte balisé léger** dans tous les champs : `*italique*`, `**gras**`, `^exposant^`,
  ` | ` pour les changements de ligne des transcriptions diplomatiques.
- **Dates structurées** (`from`, `to`, `date` au format ISO partiel : `1974`, `1974-05`,
  `1974-05-12`) à côté du libellé d'origine : tri, chronologie et affichage anglais en dépendent.
- **Notes de rédaction** (`editorial_notes`) : visibles sur la notice et dans « État de la
  rédaction », exclues avec `--public`.

## Flux de travail

Tant que la rédaction se poursuit dans Word :

```sh
pandoc CAT_LIVRE1.docx -t markdown --wrap=none -o tools/L1.nw.md
pandoc CAT_LIVRE2.docx -t markdown --wrap=none -o tools/L2.nw.md
npm run import && npm run build
```

Dès que les YAML deviennent la source de référence, on les édite directement et on n'utilise plus
que `npm run build` (les deux scripts de `tools/` servent alors de mémoire de la migration).
