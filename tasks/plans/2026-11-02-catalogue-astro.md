# Catalogue Greif (Astro + Keystatic) Implementation Plan

**Goal:** remplacer le prototype par un site Astro statique bilingue, alimenté par des YAML validés, édité via Keystatic, recherché via Pagefind et déployé sur Netlify.

**Architecture:** `content/` contient les données (œuvres et autorités en YAML, textes d'interface, pages Markdoc). `src/lib/` contient la logique métier pure, testée avec Vitest : dates EDTF, balisage, tri Th, construction et validation du catalogue, index. Les pages Astro ne font que mettre en forme les modèles de vue produits par `src/lib/`. Keystatic écrit dans `content/` : sur disque en dev, par commits GitHub en prod.

**Tech stack:** Node 22+, TypeScript strict, Astro 6 (repli : Astro 5, voir la tâche 1), `@astrojs/markdoc`, `@astrojs/react`, `@astrojs/netlify`, `@keystatic/core`, `@keystatic/astro`, Pagefind 1, Vitest, tsx, js-yaml 4, node-html-parser.

**Spec:** `tasks/specs/2026-11-02-catalogue-astro.md`

## Global constraints

- Node 22 ou plus récent.
- Astro en `output: "static"` ; seules les routes injectées par Keystatic (`/keystatic`, `/api/keystatic`) sont rendues à la demande.
- `content/` est la seule source de données ; `prototype/` est en lecture seule et n'est jamais modifié.
- L'identifiant d'une œuvre est le nom de son fichier (`content/works/<id>.yaml`) ; il est permanent et donne l'URL `/fr/oeuvres/<id>/` et `/en/works/<id>/`.
- Toute chaîne d'interface vient de `content/ui/fr.yaml` ou `content/ui/en.yaml` via `t()` ; aucun libellé d'interface en dur dans les composants (sauf « Th », noms propres et le titre du site).
- Le texte descriptif (remarques, sources, citations, lieux) reste en français ; sur les pages EN il porte `lang="fr"`.
- Les classes CSS du prototype sont conservées pour que `src/styles/global.css` (copie de `prototype/assets/style.css`) s'applique sans modification de ses règles existantes.
- Tout renvoi (`[[id]]`, personne, lieu, fonds, rôle, référence bibliographique, œuvre liée) doit se résoudre, sinon `npm run build` échoue ; `[[?]]` est le seul marqueur non résolu autorisé.
- Les dates structurées suivent le sous-ensemble EDTF défini dans la spec ; toute autre forme est rejetée par le schéma.
- Les notes de rédaction, le tableau de bord et les notes `[migration]` n'apparaissent que si `CATALOGUE_EDITORIAL=1` ; la page tableau de bord porte `<meta name="robots" content="noindex">`.
- Aucun secret dans le dépôt ; les variables Keystatic vivent dans les variables d'environnement Netlify et dans `.env` (ignoré par Git).
- Un commit par tâche, message en anglais à l'impératif.

## Testing decisions

- Interface testée : les fonctions pures de `src/lib/` (Vitest, `tests/lib/`).
- Interface testée : `migrate(input)` dans `scripts/migrate/` sur des copies réelles de notices du prototype (`tests/migrate/`).
- Interface testée : `validateCatalogue(input)` et `buildCatalogue(input)` sur le jeu de données de test `tests/fixtures/catalogue.ts`.
- Interface testée : le site généré, en lisant le HTML de `dist/` après `npm run build` (`tests/site/`, commande `npm run test:site`).
- Interface testée : la parité entre schémas Zod et configuration Keystatic (`tests/cms/parity.test.ts`).
- Non testés automatiquement : le rendu CSS, l'interface Keystatic (liste de vérification manuelle), le déploiement Netlify (vérification manuelle).

## File structure

- `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.nvmrc` (create) : projet.
- `netlify.toml`, `public/_redirects` (create) : déploiement, redirection de `/`.
- `keystatic.config.ts` (create) : configuration du CMS.
- `content/` (create, produit par la migration) : `works/`, `persons/`, `places/`, `institutions/`, `roles/`, `bibliography/`, `books.yaml`, `ui/{fr,en}.yaml`, `pages/{fr,en}/*.mdoc`.
- `public/incipits/<id>/<n>.png` : incipits (vide au départ).
- `src/content.config.ts` (create) : déclaration des collections Astro.
- `src/lib/schemas.ts` : schémas Zod et types inférés (`Work`, `Person`…). Partagé par Astro, la migration et les tests.
- `src/lib/text.ts` : `fold`, `slug`, `sortTitle`.
- `src/lib/th.ts` : `thKey`, `compareTh`.
- `src/lib/edtf.ts` : validation, formatage, année, clé de tri.
- `src/lib/markup.ts` : rendu du balisage léger et extraction des renvois.
- `src/lib/catalogue.ts` : `buildCatalogue`, `validateCatalogue` (purs).
- `src/lib/catalogue-astro.ts` : `getCatalogue()`, qui lit `astro:content` et met le résultat en cache.
- `src/lib/ui-schema.ts` : schéma Zod des chaînes d'interface et convertisseur vers Keystatic.
- `src/lib/i18n.ts` : `t`, `tn`, `fill`, routes, URL.
- `src/lib/indexes/*.ts` : un module par index, modèles de vue purs.
- `src/lib/bibliography.ts` : `formatReference`.
- `src/lib/editorial.ts` : drapeau éditorial, complétude.
- `src/lib/opendata.ts` : export JSON et CSV.
- `src/layouts/Base.astro`, `src/components/*.astro` : mise en forme.
- `src/pages/index.astro`, `src/pages/[lang]/index.astro`, `src/pages/[lang]/[...page].astro`, `src/pages/[lang]/[workDir]/[id].astro`, `src/pages/data/*.ts` : routes.
- `src/scripts/*.ts` : comportements côté navigateur (filtres, citation).
- `src/styles/global.css` : copie de `prototype/assets/style.css` (règles ajoutées seulement en fin de fichier).
- `scripts/migrate/*.ts` : migration ponctuelle du prototype.
- `tests/lib/`, `tests/migrate/`, `tests/fixtures/`, `tests/site/`, `tests/cms/` : tests.

### Task 1: Bootstrap du projet

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.nvmrc`, `src/pages/index.astro`, `src/styles/global.css`, `tests/site/smoke.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: scripts npm `dev`, `build`, `test`, `test:site`, `migrate` ; alias TS `~/*` → `src/*` ; Vitest configuré avec deux projets, `unit` (`tests/{lib,migrate,cms}/**`) et `site` (`tests/site/**`)

**Risk:** normal

- [x] **Step 1: Initialiser Git et le projet**

  À la racine `greif-catalogue/` : `git init -b main`. Le dépôt existe déjà, initialisé sur `main` lors de la relecture du plan : ne rien refaire si `.git` est présent. Créer `.nvmrc` (`22`) et `.gitignore` (`node_modules/`, `dist/`, `.astro/`, `.netlify/`, `.env`, `.DS_Store`). Installer `astro`, `@astrojs/markdoc`, `@astrojs/react`, `react`, `react-dom`, `@astrojs/netlify`, `@keystatic/core`, `@keystatic/astro`, `js-yaml` (dépendances ; pas de `zod` direct : on importe `z` depuis `astro/zod` partout, y compris dans les scripts lancés avec tsx) ainsi que `typescript`, `vitest`, `tsx`, `pagefind`, `node-html-parser`, `@types/js-yaml`, `@astrojs/check` (devDependencies).

- [x] **Step 2: Vérifier la compatibilité de Keystatic**

  Lire `peerDependencies` de `@keystatic/astro` (`npm view @keystatic/astro peerDependencies`). Si la plage `astro` n'accepte pas la majeure 6, réinstaller `astro@5` et les `@astrojs/*` de la majeure correspondante. Noter la version retenue dans le message de commit.

- [x] **Step 3: Configurer**

  - `astro.config.mjs` : `output: "static"`, `trailingSlash: "always"`, `build.format: "directory"`, `site: "https://catalogue-greif.netlify.app"` (valeur provisoire, à corriger en tâche 12), intégrations `markdoc()`. React, Keystatic et l'adapter viendront en tâche 10.
  - `tsconfig.json` : étend `astro/tsconfigs/strict`, `paths: { "~/*": ["src/*"] }`.
  - `package.json` scripts, à l'identique :
    ```json
    {
      "dev": "astro dev",
      "build": "astro build && pagefind --site dist",
      "preview": "astro preview",
      "test": "vitest run --project unit",
      "test:site": "vitest run --project site",
      "check": "astro check",
      "migrate": "tsx scripts/migrate/index.ts prototype content"
    }
    ```
  - Copier `prototype/assets/style.css` vers `src/styles/global.css` sans modification.
  - `src/pages/index.astro` : page minimale `<html lang="fr">` contenant `Olivier Greif`. Elle sera remplacée en tâche 12.

- [x] **Step 4: Écrire le test de fumée**

  `tests/site/smoke.test.ts` : lire `dist/index.html` et vérifier qu'il contient `Olivier Greif`.

- [x] **Step 5: Vérifier**

  Run: `npm run build && npm run test:site && npm test -- --passWithNoTests`
  Expected: build OK, 1 test PASS.

- [x] **Step 6: Commit**

  ```bash
  git add -A
  git commit -m "Bootstrap Astro project with Vitest and site smoke test"
  ```
  Le premier commit inclut `prototype/` tel quel, comme référence.

### Task 2: Utilitaires texte et numéros Th

**Files:**
- Create: `src/lib/text.ts`, `src/lib/th.ts`
- Test: `tests/lib/text.test.ts`, `tests/lib/th.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `fold(s: string): string` : retire les accents (NFD + suppression des diacritiques U+0300–U+036F) et met en minuscules.
  - `slug(s: string): string` : `fold`, puis toute suite de `[^a-z0-9]` devient `-`, sans tiret en tête ni en fin. N'enlève pas le balisage, c'est à l'appelant de passer du texte nu.
  - `sortTitle(s: string): string` : `fold`, retire en tête `[«"“\[\(\-\d\s\.)]+`, puis l'article `/^(le |la |les |l'|l’|the |die |der |das |un |une |a |an )/i`, puis `trim`.
  - `thKey(th: string): number` : `^(\d+)([a-z]?)$` → `n*10 + (lettre ? code - 96 : 0)` ; sinon `Infinity`.
  - `compareTh(a: string, b: string): number`

**Risk:** normal

- [x] **Step 1: Écrire les tests**
  - `fold("Éloïse")` → `"eloise"`
  - `slug("Mrs Alexander Liberman")` → `"mrs-alexander-liberman"`
  - `slug("Isabelle Collin-Dufresne")` → `"isabelle-collin-dufresne"`
  - `slug("  La Pèrigourdine ! ")` → `"la-perigourdine"`
  - `sortTitle("Le Tombeau de Ravel")` → `"tombeau de ravel"`
  - `sortTitle("L'Île du docteur Moreau")` → `"ile du docteur moreau"`
  - `sortTitle("« 1) Vergiftet")` → `"vergiftet"`
  - `thKey("35b")` → `352` ; `thKey("7")` → `70` ; `thKey("X")` → `Infinity`
  - `["10","2a","2","35b","35a"].sort(compareTh)` → `["2","2a","10","35a","35b"]`
- [x] **Step 2: Lancer les tests, constater l'échec** : `npm test tests/lib` → FAIL (modules absents).
- [x] **Step 3: Implémenter** `text.ts` et `th.ts` : fonctions pures, sans dépendance.
- [x] **Step 4: Lancer les tests, constater le succès** : `npm test tests/lib` → PASS.
- [x] **Step 5: Commit** : `git add src/lib tests/lib && git commit -m "Add text folding, slug and Th ordering helpers"`

### Task 3: Dates EDTF

**Files:**
- Create: `src/lib/edtf.ts`
- Test: `tests/lib/edtf.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type Lang = "fr" | "en"`, à exporter depuis `src/lib/edtf.ts` et à réutiliser partout.
  - `isEdtf(s: string): boolean`
  - `formatEdtf(s: string, lang: Lang, months: string[]): string` : `months` est la liste des 12 noms de mois venant de l'interface.
  - `edtfYear(s?: string): number | null` : année de début ; `X` est remplacé par `0`.
  - `edtfSortKey(s?: string): string` : partie de début sans qualificatif ; `"9999"` si la date est absente.
  - `fromLegacy(from?: string, to?: string): string | undefined` : `to ? \`${from}/${to}\` : from`.

**Risk:** normal

Regex d'une date simple, à reprendre telle quelle : `^(\d{3}[\dX])(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?[?~]?$`. Une date contenant `X` ne peut avoir ni mois ni jour. Un intervalle est formé de deux dates simples séparées par `/`.

Règles de formatage, reprises de `fmtDate` et `fmtRange` (`prototype/build.mjs:32-53`) :
- Jour en FR : `1` → `1er`. Le format est « jour mois année » en FR comme en EN.
- `?` : FR ajoute `" ?"` (U+00A0 puis `?`) ; EN ajoute `"?"`.
- `~` : FR `"vers <date>"` ; EN `"c. <date>"`.
- `197X` : FR `"années 1970"` ; EN `"1970s"`.
- Intervalle, même année, début réduit à l'année : affiche l'année seule.
- Intervalle, même année et même mois, début avec jour : `"<j1>–<date de fin>"`, tiret demi-cadratin sans espaces.
- Intervalle, même année : `"<début sans l'année> – <fin>"`, tiret demi-cadratin entouré d'espaces.
- Intervalle, années différentes : `"<début> – <fin>"`.

- [x] **Step 1: Écrire les tests** (avec `FR = ["janvier",…,"décembre"]` et `EN = ["January",…,"December"]`)
  - `formatEdtf("1973-11-26","fr",FR)` → `"26 novembre 1973"` ; en EN → `"26 November 1973"`
  - `formatEdtf("1974-05-01","fr",FR)` → `"1er mai 1974"`
  - `formatEdtf("1968-11","en",EN)` → `"November 1968"`
  - `formatEdtf("1973-05/1973-11","fr",FR)` → `"mai – novembre 1973"`
  - `formatEdtf("1973-11-08/1973-11-26","fr",FR)` → `"8–26 novembre 1973"`
  - `formatEdtf("1969-11/1974-02-23","fr",FR)` → `"novembre 1969 – 23 février 1974"`
  - `formatEdtf("1974/1974-06","fr",FR)` → `"1974"`
  - `formatEdtf("1974?","fr",FR)` → `"1974 ?"` ; en EN → `"1974?"`
  - `formatEdtf("1974~","en",EN)` → `"c. 1974"` ; en FR → `"vers 1974"`
  - `formatEdtf("197X","fr",FR)` → `"années 1970"` ; en EN → `"1970s"`
  - `isEdtf("1973-05/1973-11")` → true ; `isEdtf("1974-13")` → false ; `isEdtf("26/11/1973")` → false ; `isEdtf("197X-05")` → false
  - `edtfYear("197X")` → `1970` ; `edtfYear("1973-05/1974")` → `1973` ; `edtfYear(undefined)` → `null`
  - `edtfSortKey("1973-05?/1974")` → `"1973-05"` ; `edtfSortKey(undefined)` → `"9999"`
  - `fromLegacy("1973-05","1973-11")` → `"1973-05/1973-11"` ; `fromLegacy("1970")` → `"1970"` ; `fromLegacy()` → `undefined`
- [x] **Step 2: Échec** : `npm test tests/lib/edtf.test.ts` → FAIL.
- [x] **Step 3: Implémenter** `edtf.ts`, en fonctions pures.
- [x] **Step 4: Succès** : même commande → PASS.
- [x] **Step 5: Commit** : `git add src/lib/edtf.ts tests/lib/edtf.test.ts && git commit -m "Add EDTF subset parsing and formatting"`

### Task 4: Balisage léger

**Files:**
- Create: `src/lib/markup.ts`
- Test: `tests/lib/markup.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type XrefTarget = { th: string; title: string; href: string }` : `title` est déjà débarrassé du balisage.
  - `type MarkupOptions = { resolve: (id: string) => XrefTarget | undefined; labels: { lineBreak: string; unresolved: string } }`
  - `renderInline(src: string, o: MarkupOptions): string` : HTML.
  - `renderBlock(src: string, o: MarkupOptions): string` : paragraphes `<p>` séparés par des lignes vides, `\n` → `<br>`.
  - `stripMarkup(src: string, resolve?: MarkupOptions["resolve"]): string` : texte nu ; `[[id]]` → `Th <th>`, sinon `Th ?`.
  - `extractRefs(src: string): string[]` : les ids entre `[[ ]]`, dans l'ordre, `?` compris.
  - `class UnknownXrefError extends Error` (champ `id`).

**Risk:** normal

Regex des renvois, à reprendre exactement : `/\[\[([^\[\]]*)\]\]/g`. Elle diffère de celle du prototype (`[^\]]*`) : dans `[[[sonate-piano-13]]`, présent dans `wiener-konzert` et `sonate-piano-14`, le premier `[` est un crochet éditorial et doit rester affiché. L'ancienne regex extrayait l'id `[sonate-piano-13`.

Ordre des transformations, repris de `md()` (`prototype/build.mjs:61-74`) : échappement HTML (`& < > "`), puis renvois, puis `**…**` → `<strong>`, puis `*…*` (sans saut de ligne) → `<em>`, puis `^…^` → `<sup>`, puis ` | ` → ` <span class="lb" aria-label="{lineBreak}">|</span> `, puis `[sic]` → `[<em>sic</em>]`.

- [x] **Step 1: Écrire les tests** (`resolve` connaît `wiener-konzert` → `{th:"45", title:"Wiener Konzert", href:"/fr/oeuvres/wiener-konzert/"}`, `labels = {lineBreak:"saut de ligne", unresolved:"Renvoi à résoudre"}`)
  - `renderInline("*Wiener Konzert*")` → `<em>Wiener Konzert</em>`
  - `renderInline("**a**")` → `<strong>a</strong>`
  - `renderInline("778^e^ concert")` → `778<sup>e</sup> concert`
  - `renderInline("a | b")` → `a <span class="lb" aria-label="saut de ligne">|</span> b`
  - `renderInline("poêmes [sic]")` → `poêmes [<em>sic</em>]`
  - `renderInline("<script>")` → `&lt;script&gt;`
  - `renderInline("cf. [[wiener-konzert]]")` → `cf. <a class="xref" href="/fr/oeuvres/wiener-konzert/" title="Wiener Konzert">Th&nbsp;45</a>`
  - `renderInline("[[?]]")` → `<span class="xref unresolved" title="Renvoi à résoudre">Th&nbsp;?</span>`
  - `renderInline("[[nope]]")` → lève `UnknownXrefError`, avec `id === "nope"`
  - `renderBlock("a\n\nb\nc")` → `<p>a</p><p>b<br>c</p>`
  - `stripMarkup("42^nd^ *Street* [[wiener-konzert]] [[?]]", resolve)` → `"42nd Street Th 45 Th ?"`
  - `extractRefs("cf. [[a]] et [[?]], [[b]]")` → `["a","?","b"]`
  - `extractRefs("en quatre mouvements [[[sonate-piano-13]], op.47]")` → `["sonate-piano-13"]`
  - `renderInline("[[[wiener-konzert]], op.40]")` → `[<a class="xref" href="/fr/oeuvres/wiener-konzert/" title="Wiener Konzert">Th&nbsp;45</a>, op.40]`
- [x] **Step 2: Échec** : `npm test tests/lib/markup.test.ts` → FAIL.
- [x] **Step 3: Implémenter** `markup.ts`.
- [x] **Step 4: Succès** : PASS.
- [x] **Step 5: Commit** : `git add src/lib/markup.ts tests/lib/markup.test.ts && git commit -m "Add light markup renderer with cross-references"`

### Task 5: Schémas de contenu

**Files:**
- Create: `src/lib/schemas.ts`, `src/content.config.ts`
- Test: `tests/lib/schemas.test.ts`

**Interfaces:**
- Consumes: `isEdtf` de `src/lib/edtf.ts`
- Produces (depuis `src/lib/schemas.ts`) :
  - Constantes : `CATEGORIES = ["piano","two-pianos","voice-piano","vocal-ensemble","chamber","choral","orchestra","undetermined"] as const` ; `SOURCE_FEATURES = ["autograph","draft","sketch","fair_copy","unfinished","incomplete"] as const` ; `SOURCE_STATUS = ["located","not_located","lost"] as const` ; `RELATIONS = ["revision","extract","version","companion","cycle","shared-material","sketch"] as const` ; `BIB_TYPES = ["book","chapter","article-journal","thesis","webpage","other"] as const`.
  - Schémas Zod (`z` importé depuis `astro/zod`) : `edtf`, `workSchema`, `personSchema`, `placeSchema`, `institutionSchema`, `roleSchema`, `bibliographySchema`, `bookSchema` (un Livre) et `booksFileSchema = z.object({ books: z.array(bookSchema).length(6) }).strict()` (forme du fichier `content/books.yaml`, utilisée aussi par Keystatic).
  - Types : `Work`, `Movement`, `Performance`, `Performer`, `JournalEntry`, `Person`, `Place`, `Institution`, `Role`, `BibEntry`, `Book`, `Category`, `Relation`, `SourceFeature` (via `z.output`).
  - Collections Astro (`src/content.config.ts`), avec le loader `glob({ pattern: "*.yaml", base: "./content/<dir>" })` : `works`, `persons`, `places`, `institutions`, `roles`, `bibliography`. Plus `books`, avec le loader `file("content/books.yaml", { parser: text => booksFileSchema.parse(yaml.load(text)).books.map(b => ({ ...b, id: String(b.number) })) })` et le schéma `bookSchema.extend({ id: z.string() })`. Plus `pages` (`glob({ pattern: "**/*.mdoc", base: "./content/pages" })`, schéma `{ title: z.string() }`). La collection `ui` arrive en tâche 9.

**Risk:** normal

Les champs sont exactement ceux du tableau « Modèle de données » de la spec. Règles supplémentaires :
- Les tableaux optionnels sont `.default([])` ; `unpublished` est `.default(false)` ; `kind` d'une personne est `.default("person")`.
- `th` : `z.string().regex(/^\d+[a-z]?$/)` ; `book` : `z.number().int().min(1).max(6)`.
- `categories` : `z.array(z.enum(CATEGORIES)).min(1)`.
- `edtf` : `z.string().refine(isEdtf, "EDTF invalide")`.
- Les objets sont `.strict()` : une clé inconnue est une erreur, ce qui attrape les fautes de frappe dans le YAML.
- Un nombre écrit entre guillemets dans le YAML est une chaîne : `th` et `opus` restent des chaînes.
- Tolérance aux sorties du CMS : tout champ scalaire **optionnel** (chaîne, nombre, EDTF, id d'autorité) est enveloppé dans un helper `optional(schema)` qui traite `""` et `null` comme absents (`z.preprocess(v => v === "" || v === null ? undefined : v, schema.optional())`). Un champ obligatoire vide reste une erreur.

- [x] **Step 1: Écrire les tests** (au niveau de `workSchema.safeParse` et des autres schémas)
  - minimal `{title:"Adagio", th:"7", book:1, scoring:{fr:"Piano",en:"Piano"}, categories:["piano"]}` → succès ; `movements` vaut `[]` et `unpublished` vaut `false`
  - `th:"7 bis"` → échec sur `th`
  - `categories:[]` → échec
  - `composition:{text:"1973", date:"1973-13"}` → échec sur `composition.date`
  - clé inconnue `tittle` → échec
  - `performances:[{premiere:true, text:"x", performers:[{person:"nell-froger", role:"soprano"}]}]` → succès
  - `related:[{work:"x", relation:"revision:inverse"}]` → échec (les inverses ne sont jamais stockés)
  - `personSchema` `{name:"Ensemble X", surname:"Ensemble X", kind:"ensemble"}` → succès
  - `bibliographySchema` `{short:"François-Sappey & Nectoux (2013)", type:"book"}` → succès, avec `author` et `editor` valant `[]`
  - `booksFileSchema` sur `content/books.yaml` → succès ; avec cinq Livres seulement → échec
  - minimal + `opus: ""`, `duration: null`, `composition: {text: "1973", date: ""}` → succès, et ces trois champs sont `undefined` après parse
  - minimal + `title: ""` → échec
- [x] **Step 2: Échec** : `npm test tests/lib/schemas.test.ts` → FAIL.
- [x] **Step 3: Implémenter** `schemas.ts`, puis `content.config.ts` qui importe les schémas.
- [x] **Step 4: Succès** : PASS. Créer aussi `content/books.yaml` (six Livres, statuts repris de `prototype/data/books.yaml`), puis lancer `npx astro sync` → sans erreur.
- [x] **Step 5: Commit** : `git add src/lib/schemas.ts src/content.config.ts content/books.yaml tests/lib/schemas.test.ts && git commit -m "Define content schemas and Astro collections"`

### Task 6: Domaine catalogue : construction et validation

**Files:**
- Create: `src/lib/catalogue.ts`, `src/lib/catalogue-astro.ts`, `tests/fixtures/catalogue.ts`
- Test: `tests/lib/catalogue.test.ts`

**Interfaces:**
- Consumes: types de `src/lib/schemas.ts` ; `compareTh` ; `extractRefs` ; `edtfSortKey`
- Produces:
  - `type Entry<T> = { id: string; data: T }`
  - `type CatalogueInput = { works: Entry<Work>[]; persons: Entry<Person>[]; places: Entry<Place>[]; institutions: Entry<Institution>[]; roles: Entry<Role>[]; bibliography: Entry<BibEntry>[]; books: Book[] }`
  - `type WorkEntry = Work & { id: string }`
  - `type RelationKey = Relation | \`${Relation}:inverse\``
  - `type PersonUsage = { work: WorkEntry; role?: string; date?: string }` (`role` est un roleId)
  - `type PerformanceRow = { work: WorkEntry; perf: Performance }`
  - `type Catalogue = { works: WorkEntry[]; byId: Map<string, WorkEntry>; persons: Map<string, Person & {id: string}>; places: Map<string, Place & {id: string}>; institutions: Map<string, Institution & {id: string}>; roles: Map<string, Role & {id: string}>; bibliography: Map<string, BibEntry & {id: string}>; books: Book[]; related(id: string): { work: WorkEntry; relation: RelationKey }[]; neighbours(id: string): { prev?: WorkEntry; next?: WorkEntry }; performances: PerformanceRow[]; personUsages: Map<string, { author: PersonUsage[]; translator: PersonUsage[]; dedicatee: PersonUsage[]; performer: PersonUsage[] }> }`
  - `type ValidationError = { file: string; path: string; message: string }` ; `file` vaut `"<collection>/<id>"`.
  - `validateCatalogue(input: CatalogueInput): ValidationError[]`
  - `buildCatalogue(input: CatalogueInput): Catalogue`
  - `getCatalogue(): Promise<Catalogue>` (`catalogue-astro.ts`) : lit toutes les collections via `getCollection` et appelle `validateCatalogue`. S'il y a des erreurs, lève `Error`, avec une ligne `file › path : message` par erreur. Sinon renvoie `buildCatalogue`, mis en cache dans le module.
  - `fixtureInput: CatalogueInput` (`tests/fixtures/catalogue.ts`), réutilisé par les tâches 12 à 15, 17 et 18.

**Risk:** normal

Le jeu de données `fixtureInput`, à créer exactement ainsi :
- personnes : `heinrich-heine` {name "Heinrich Heine", surname "Heine", given "Heinrich"} ; `nell-froger` {name "Nell Froger", surname "Froger", given "Nell"} ; `olivier-greif` {name "Olivier Greif", surname "Greif", given "Olivier"}
- lieux : `paris` {name "Paris"} ; `prague` {name "Prague", country "République Tchèque"}
- fonds : `f-pbmgf` {siglum "F-Pbmgf", name {fr "Paris, Bibliothèque musicale La Grange-Fleuret, fonds Olivier Greif.", en "Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection."}}
- rôles : `soprano` {fr "soprano", en "soprano"} ; `piano` {fr "piano", en "piano"}
- bibliographie : `francois-sappey-nectoux-2013` {short "François-Sappey & Nectoux (2013)", type "book"}
- livres : les six, avec 1 `complete`, 2 `partial`, 3 à 6 `planned`
- œuvres :
  - `sonate-a` : th "2", book 1, title "Sonate", opus "3", scoring Piano/Piano, categories [piano], composition {text "mai – novembre 1973", date "1973-05/1973-11"}, movements [{title "I", bars 40}], sources {status located, institution f-pbmgf, items [{text "Ms. autographe"}], papers ["filigrané JD"], features [autograph, draft]}, editions [{text "Symétrie, 2006", publisher "Symétrie", year 2006}], performances [{premiere true, date "1974-04-24", venue "Paris, salle Cortot", place paris, performers [{person nell-froger, role soprano}, {person olivier-greif, role piano}], text "…"}], journal [{date_text "18 juillet 1973", date "1973-07-18", quotes ["« Je termine. »"]}], bibliography [{ref francois-sappey-nectoux-2013, pages "28, 35"}], related [{work lied-b, relation revision}], dedication {persons [heinrich-heine]}
  - `etude-c` : th "2a", book 1, title "Étude", scoring Piano/Piano, categories [piano], aucune composition
  - `lied-b` : th "10", book 1, title "L'Île", scoring {fr "Voix et piano", en "Voice and piano"}, categories [voice-piano], text {credit "Heinrich Heine", authors [{person heinrich-heine, role author}]}, movements [{title "1", text_incipit "Vergiftet sind meine Lieder", bars 30}], composition {text "1972", date "1972"}, unpublished true, sources {status lost, items [], papers [], features []}, remarks ["cf. [[sonate-a]] et [[?]]"], performances [{premiere false, date "1976-03-18", place prague, performers [{person nell-froger, role soprano}], text "…"}], editorial_notes ["Compléter les mesures"]
  - `zeta-d` : th "50", book 2, title "Zeta", scoring Piano/Piano, categories [piano], composition {text "inconnue"}

- [x] **Step 1: Écrire les tests**
  - `validateCatalogue(fixtureInput)` → `[]`
  - copie avec `lied-b.th = "2"` → une erreur, `{file:"works/lied-b", path:"th"}`, message contenant `sonate-a`
  - copie avec `remarks ["[[inconnu]]"]` dans `etude-c` → erreur `{file:"works/etude-c", path:"remarks.0"}` ; `[[?]]` seul ne produit pas d'erreur
  - performer `person "x"` → erreur `path "performances.0.performers.0.person"` ; `role "tuba"` → erreur sur `.role` ; `place "lyon"` → erreur sur `performances.0.place`
  - `sources.institution "f-xx"` → erreur ; `bibliography[0].ref "y"` → erreur ; `dedication.persons ["z"]` → erreur ; `text.authors[0].person "z"` → erreur
  - `related [{work "sonate-a", relation "revision"}]` sur `sonate-a` lui-même → erreur (renvoi sur soi) ; `related` vers `"absent"` → erreur
  - `lied-b.related [{work "sonate-a", relation "revision"}]` en plus de l'existant → erreur (paire en double)
  - `book: 7` est impossible (rejeté par le schéma) ; mais si `books` ne contient pas le Livre 2 → erreur sur `zeta-d.book`
  - `buildCatalogue(fixtureInput).works.map(w => w.id)` → `["sonate-a","etude-c","lied-b","zeta-d"]`
  - `related("lied-b")` → `[{work: sonate-a, relation: "revision:inverse"}]` ; `related("sonate-a")` → `[{work: lied-b, relation: "revision"}]`
  - `neighbours("etude-c")` → `{prev: sonate-a, next: lied-b}` ; `neighbours("sonate-a").prev` → `undefined`
  - `performances.map(r => r.perf.date)` → `["1974-04-24","1976-03-18"]`
  - `personUsages.get("nell-froger").performer.length` → `2` ; `personUsages.get("heinrich-heine")` → `author` = [lied-b], `dedicatee` = [sonate-a]
- [x] **Step 2: Échec** : `npm test tests/lib/catalogue.test.ts` → FAIL.
- [x] **Step 3: Implémenter.** Les renvois `[[id]]` sont cherchés dans **toutes** les chaînes de l'œuvre : parcours récursif de l'objet, le chemin étant construit avec des points et les indices. `getCatalogue` est le seul module qui importe `astro:content`.
- [x] **Step 4: Succès** : PASS.
- [x] **Step 5: Commit** : `git add src/lib/catalogue*.ts tests/fixtures tests/lib/catalogue.test.ts && git commit -m "Add catalogue domain model and cross-reference validation"`

### Task 7: Migration : autorités

**Files:**
- Create: `scripts/migrate/names.ts`, `scripts/migrate/authorities.ts`
- Test: `tests/migrate/names.test.ts`, `tests/migrate/authorities.test.ts`, `tests/fixtures/prototype/` (copies de `wiener-konzert.yaml`, `sonate-violon-piano-02.yaml`, `taking-leave-of-a-friend.yaml`, `light-music.yaml`, `the-spirit-s-song.yaml`, `bomben-auf-engelland.yaml`, `bomben-auf-engelland-1976.yaml`, prises dans `prototype/data/works/`)

**Interfaces:**
- Consumes: `slug` ; `fold` ; types `Person`, `Place`, `Institution`, `Role`, `BibEntry`
- Produces:
  - `type ProtoWork = Record<string, any>`, qui est un objet YAML du prototype.
  - `invertName(name: string): { surname: string; given: string }`
  - `type Authorities = { persons: Map<string, Person>; places: Map<string, Place>; institutions: Map<string, Institution>; roles: Map<string, Role>; bibliography: Map<string, BibEntry>; report: string[] }`
  - `extractAuthorities(works: ProtoWork[]): Authorities`
  - `ROLE_MAP: Record<string, { id: string; fr: string; en: string } | "ensemble" | null>` : clé = rôle brut du prototype ; `"ensemble"` = le performer est un ensemble ; `null` = anomalie.

**Risk:** high (migration de données)

Règles :
- `invertName` reprend `invertName`, `PARTICLES` et `NAME_OVERRIDES` (`prototype/build.mjs:85-104`) à comportement identique. Un ensemble a `surname = name` et `given = ""`.
- Personnes, id `slug(name)`, extraites de trois endroits : `text.authors[].name`, `dedication.persons[]` et `premiere[]/performances[].performers[].name`. `name` vaut `"[?]"` → ignoré. `as_written` est ajouté à `variants` de la personne. Un performer de rôle `ensemble` → `kind: "ensemble"`.
- `ROLE_MAP`, valeurs exactes : `piano`→{piano, piano, piano} ; `violon`→{violon, violon, violin} ; `violons`→{violons, violons, violins} ; `alto`→{alto, alto, viola} ; `violoncelle`→{violoncelle, violoncelle, cello} ; `baryton`→{baryton, baryton, baritone} ; `chant`→{chant, chant, voice} ; `voix`→{voix, voix, voice} ; `soprano`→{soprano, soprano, soprano} ; `saxophone`→{saxophone, saxophone, saxophone} ; `flûte`→{flute, flûte, flute} ; `clarinette`→{clarinette, clarinette, clarinet} ; `percussion`→{percussion, percussion, percussion} ; `pianiste ?`→{pianiste-incertain, pianiste ?, pianist ?} ; `ensemble`→`"ensemble"` ; `par les mêmes interprètes`→`null`. Un rôle absent de la table est aussi une anomalie : il va au `report`, sans exception.
- Lieux, id `slug(city)`, `name = city`, `country` = premier `country` non vide rencontré pour cette ville.
- Fonds : `f-pbmgf` {siglum "F-Pbmgf", name fr "Paris, Bibliothèque musicale La Grange-Fleuret, fonds Olivier Greif.", en "Paris, Bibliothèque musicale La Grange-Fleuret, Olivier Greif collection."} ; `f-pmm` {siglum "F-Pmm", name fr "[à préciser]", en "[to be specified]"}. Tout autre sigle rencontré → `report`.
- Bibliographie : une entrée par `ref` distinct, id `slug(ref)`, `short = ref`, `type: "other"`, `editorial_notes: ["[migration] compléter la notice CSL (type, auteurs, titre, éditeur, date)"]`.

- [x] **Step 1: Écrire les tests**
  - `invertName("Heinrich Heine")` → `{surname:"Heine", given:"Heinrich"}`
  - `invertName("Jacques Loiseleur des Longchamps")` → `{surname:"Loiseleur des Longchamps", given:"Jacques"}`
  - `invertName("Ludwig van Beethoven")` → `{surname:"Beethoven", given:"Ludwig van"}`
  - `invertName("Jean de La Fontaine")` : appliquer la règle du prototype (particule `de` suivie de `la`/`le`) → `{surname:"La Fontaine", given:"Jean de"}`
  - `invertName("Li Bai")` → `{surname:"Li Bai", given:""}` ; `invertName("Devadip")` → `{surname:"Devadip", given:""}`
  - sur les fixtures : `persons.has("heinrich-heine")`, `persons.has("nell-froger")`, `persons.get("mrs-alexander-liberman").surname === "Liberman"`
  - `taking-leave-of-a-friend` : la personne dont l'`as_written` vaut `"Rihaku"` a `variants` contenant `"Rihaku"`
  - `sonate-violon-piano-02` : `report` contient une ligne avec `sonate-violon-piano-02` et `par les mêmes interprètes` ; aucune personne `et-22-fevrier`
  - `roles.get("violon").en === "violin"` ; `places.get("paris").name === "Paris"`
  - `bibliography.get("francois-sappey-nectoux-2013").short === "François-Sappey & Nectoux (2013)"`
- [x] **Step 2: Échec** : `npm test tests/migrate` → FAIL.
- [x] **Step 3: Implémenter** `names.ts` et `authorities.ts`.
- [x] **Step 4: Succès** : PASS. Chaque autorité produite doit aussi passer son schéma Zod : ajouter cette assertion aux tests.
- [x] **Step 5: Commit** : `git add scripts/migrate tests/migrate tests/fixtures/prototype && git commit -m "Extract authority records from prototype data"`

### Task 8: Migration : œuvres, exécution et contenu initial

**Files:**
- Create: `scripts/migrate/works.ts`, `scripts/migrate/index.ts`
- Test: `tests/migrate/works.test.ts`
- Create (généré) : `content/works/*.yaml`, `content/persons/*.yaml`, `content/places/*.yaml`, `content/institutions/*.yaml`, `content/roles/*.yaml`, `content/bibliography/*.yaml`

**Interfaces:**
- Consumes: `extractAuthorities`, `ROLE_MAP`, `ProtoWork` (tâche 7) ; `fromLegacy` ; `slug` ; `workSchema` et les autres schémas ; `validateCatalogue` (tâche 6)
- Produces:
  - `migrateWork(w: ProtoWork, a: Authorities): { id: string; work: Work; report: string[] }`
  - `migrate(works: ProtoWork[]): { files: Record<string, unknown>; report: string[] }` : clés de la forme `"works/wiener-konzert.yaml"`, `"persons/heinrich-heine.yaml"`, etc.
  - CLI `npm run migrate` : lit `prototype/data/works/*.yaml`, écrit sous `content/` avec `yaml.dump(obj, { lineWidth: -1, noRefs: true })`, affiche le rapport et l'écrit dans `tasks/migration-report.md`. Elle se termine en code 1 si un fichier ne passe pas son schéma ou si `validateCatalogue` renvoie des erreurs.

**Risk:** high (migration de données)

Correspondances (prototype → nouveau) :
- `id` est retiré des données et devient le nom du fichier.
- `scoring: "Piano"` → `scoring: {fr: "Piano", en: SCORING_EN[fr] ?? fr}`. Copier `SCORING_EN` depuis `prototype/i18n.mjs` dans `works.ts`. S'il manque une traduction : ligne au `report` et note `[migration] traduire l'effectif`.
- `composition {text, from, to}` → `{text, date: fromLegacy(from, to)}`.
- `premiere[]` → `performances[]` avec `premiere: true`, placées avant les `performances[]` d'origine (`premiere: false`). Dans chaque exécution : `place` → `venue` ; `city` → `place: slug(city)` ; `date` + `date_end` → `date: fromLegacy(date, date_end)` ; `country` est retiré (il vit désormais dans le lieu). Performers : `name` vaut `"[?]"` → performer retiré + note `[migration] interprète non identifié ([?], <role>)`, l'information restant dans `text` (cas réel : `light-music`, exécution du 14 octobre 2021) ; sinon `name` → `person: slug(name)` ; `role` passe par `ROLE_MAP` (rôle `"ensemble"` → pas de `role`, rôle `null` → performer retiré + note `[migration] interprète non structuré : <name> (<role>)`) ; `alias` est conservé.
- `text.authors[].name` → `person` ; `role` et `as_written` sont conservés ; `credit` et `poem_title` sont conservés.
- `dedication.persons[]` (noms) → ids `slug`. Pour `dedication.persons[]` et `text.authors[]`, un nom `"[?]"` est retiré avec la note `[migration] personne non identifiée ([?]) dans <champ>`. Il n'y en a aucun aujourd'hui, mais la règle est la même que pour les interprètes. Aucune référence vide (`""`) ne doit jamais être écrite.
- `sources.siglum` → `sources.institution: slug(siglum)`. Une valeur de `features` hors `SOURCE_FEATURES` est retirée de `features`, ajoutée à `documents` et accompagnée de la note `[migration] déplacé de sources.features vers documents`.
- `bibliography[].ref` → `slug(ref)`.
- `related[]` : on ne garde que les relations sans suffixe `:inverse` (`{id, relation}` → `{work: id, relation}`). Pour chaque inverse `A: {id: B, relation: "k:inverse"}`, vérifier que `B` porte `{work: A, relation: k}` ; sinon l'ajouter à `B` et l'écrire au `report`.
- `movements[]` reste identique. Ajouter `incipit: "/incipits/<id>/<n>.png"` seulement si le fichier `prototype/incipits/<id>/<n>.png` existe (aucun aujourd'hui).
- Tous les autres champs sont recopiés tels quels.

- [x] **Step 1: Écrire les tests** : on appelle `migrate()` sur l'ensemble des fixtures de `tests/fixtures/prototype/`, puis on lit `files["works/<id>.yaml"]`. Il faut tout le lot, car le contrôle des inverses a besoin des deux œuvres.
  - `wiener-konzert` : `work.scoring` → `{fr:"Voix de femme et piano", en:"Female voice and piano"}` ; `work.composition.date` → `"1973-11-26"` ; `work.performances[0].premiere` → `true` ; `work.performances[0].place` → `"paris"` ; `work.performances[0].performers[0]` → `{person:"nell-froger", role:"soprano"}` ; `work.performances.length` → `4` (1 création + 3 exécutions) ; `work.sources.institution` → `"f-pbmgf"` ; `work.related` → `[]` (son seul lien est un inverse, porté par `light-music`) ; `work.bibliography[0].ref` → `"francois-sappey-nectoux-2013"`
  - `light-music` : `related` contient `{work:"wiener-konzert", relation:"shared-material"}` et `{work:"the-spirit-s-song", relation:"cycle"}`
  - `the-spirit-s-song` : `related` → `[]`
  - `bomben-auf-engelland` : `related` → `[{work:"bomben-auf-engelland-1976", relation:"revision"}]`
  - `sonate-violon-piano-02` : aucun performer `et-22-fevrier` ; `editorial_notes` contient une entrée commençant par `[migration] interprète non structuré`
  - `light-music` : l'exécution du `2021-10-14` n'a qu'un performer (`olivier-cesarini`, rôle `baryton`) ; `editorial_notes` contient une entrée commençant par `[migration] interprète non identifié` ; aucune valeur `person` n'est vide dans tout le lot
  - entrée synthétique (construite dans le test, pas une fixture) avec `sources.features: ["autograph", "« Une citation »"]` → `features` = `["autograph"]`, `documents` contient `« Une citation »`, et une note `[migration] déplacé de sources.features vers documents` est ajoutée
  - chaque `work` produit passe `workSchema.parse`
- [x] **Step 2: Échec** : `npm test tests/migrate/works.test.ts` → FAIL.
- [x] **Step 3: Implémenter** `works.ts`, puis `index.ts` (la CLI).
- [x] **Step 4: Succès et exécution réelle**
  Run: `npm test tests/migrate && npm run migrate && npx astro sync`
  Expected: tests PASS ; 82 fichiers dans `content/works/` ; code de sortie 0 ; `tasks/migration-report.md` liste les anomalies, dont au minimum `sonate-violon-piano-02` (« par les mêmes interprètes ») et `light-music` (`[?]`) ; `validateCatalogue` ne signale aucun renvoi `[[…]]` inconnu (les deux `[[[id]]` de `wiener-konzert` et `sonate-piano-14` sont résolus grâce à la regex de la tâche 4).
- [x] **Step 5: Relecture humaine (action de l'utilisateur)** : relire `tasks/migration-report.md` et un `git diff --stat`, puis ouvrir trois notices au hasard dans `content/works/`.
- [x] **Step 6: Commit** : `git add scripts/migrate tests/migrate content tasks/migration-report.md && git commit -m "Migrate prototype works and authorities to content collections"`

### Task 9: Textes d'interface et i18n

**Files:**
- Create: `src/lib/ui-schema.ts`, `src/lib/i18n.ts`, `content/ui/fr.yaml`, `content/ui/en.yaml`, `scripts/migrate/ui.ts`
- Modify: `src/content.config.ts` (ajout de la collection `ui`)
- Test: `tests/lib/i18n.test.ts`

**Interfaces:**
- Consumes: `Lang` ; `RELATIONS`, `CATEGORIES`, `SOURCE_FEATURES`, `SOURCE_STATUS`
- Produces:
  - `uiSchema` (Zod) et `type Ui = z.infer<typeof uiSchema>`
  - `type Plural = { one: string; other: string }`
  - `PAGES: Record<PageKey, Record<Lang, string>>`, où `PageKey = "home"|"catalogue"|"indexes"|"chrono"|"opus"|"titles"|"incipits"|"persons"|"places"|"performances"|"scoring"|"sources"|"editions"|"biblio"|"disco"|"journal"|"search"|"about"|"dashboard"`
  - `WORK_DIR: Record<Lang, string> = { fr: "oeuvres", en: "works" }`
  - `pageUrl(key: PageKey, lang: Lang): string` → `/<lang>/<slug>/` (pour `home` : `/<lang>/`)
  - `workUrl(id: string, lang: Lang): string` → `/<lang>/<WORK_DIR>/<id>/`
  - `fill(template: string, vars: Record<string, string | number>): string`
  - `tn(p: Plural, n: number, lang: Lang): string` : `Intl.PluralRules(lang)`, puis remplacement de `{n}`
  - `getUi(lang: Lang): Promise<Ui>` : lit la collection `ui` (entrées `fr` et `en`)
  - `markupOptions(ui: Ui, lang: Lang, cat: Catalogue): MarkupOptions` : résolveur de renvois vers `workUrl`, libellés `ui.lineBreak` et `ui.unresolvedRef`
- Collection Astro `ui` : `glob({ pattern: "*.yaml", base: "./content/ui" })`, schéma `uiSchema`

**Risk:** normal

Slugs de `PAGES`, à reprendre exactement (le prototype sans `.html`) : home `""`/`""` ; catalogue `catalogue`/`catalogue` ; indexes `index-general`/`indexes` ; chrono `chronologie`/`chronology` ; opus `opus`/`opus` ; titles `titres`/`titles` ; incipits `incipits-litteraires`/`text-incipits` ; persons `personnes`/`people` ; places `lieux`/`places` ; performances `executions`/`performances` ; scoring `effectifs`/`scoring` ; sources `manuscrits`/`manuscripts` ; editions `editions`/`editions` ; biblio `bibliographie`/`bibliography` ; disco `discographie`/`discography` ; journal `carnet-de-bord`/`journal` ; search `recherche`/`search` ; about `a-propos`/`about` ; dashboard `redaction`/`editorial`.

Contenu de `content/ui/*.yaml`. Le script `scripts/migrate/ui.ts` l'exporte une fois depuis `T` de `prototype/i18n.mjs` en gardant les mêmes clés (camelCase), avec les changements suivants :
- `worksN` → `worksCount: {one:"{n} œuvre", other:"{n} œuvres"}` ; en EN `{one:"{n} work", other:"{n} works"}`
- `searchHint` → `searchHint: {one:"{n} notice", other:"{n} notices"}` ; en EN `{one:"{n} entry", other:"{n} entries"}`
- `citeText` → `citeTemplate` : FR `« Th {th} — {title} », dans Catalogue thématique des œuvres d'Olivier Greif [en ligne], {url} (consulté le {date}).` ; EN `“Th {th} — {title},” in Thematic Catalogue of the Works of Olivier Greif [online], {url} (accessed {date}).`
- `relation` : clés sans `:`, du type `revision`, `revision_inverse`… ; `cycle_inverse` → FR `"Cycle"`, EN `"Cycle"` ; `sketch_inverse` → FR `"Ébauche"`, EN `"Sketch"`
- `roles` (types de personne) est conservé. Les libellés des rôles d'interprète viennent désormais de `content/roles/`.
- Nouvelles clés (FR / EN) : `lineBreak` « saut de ligne » / « line break » ; `unresolvedRef` « Renvoi à résoudre » / « Cross-reference to resolve » ; `skipLink` « Aller au contenu » / « Skip to content » ; `mainNav` « Navigation principale » / « Main navigation » ; `entrySections` « Rubriques de la notice » / « Entry sections » ; `premiereTag` « création » / « premiere » ; `pageIndex` « Index des pages » / « Page index » ; `worksPerYear` « Nombre d'œuvres par année » / « Works per year » ; `heroEyebrow` « Catalogue thématique et critique » / « Thematic and critical catalogue » ; `stats` {entries « notices » / « entries », located « manuscrits localisés » / « located manuscripts », performances « exécutions » / « performances », journal « extraits du carnet de bord » / « journal extracts »} ; `footerStatus` « Version de travail » / « Working version » ; `searchUnavailable` « Index de recherche indisponible. » / « Search index unavailable. »
- `idx.*` est conservé sous forme d'objets `{title, desc}`.

`uiSchema` : objets imbriqués, feuilles `z.string()`, `months: z.array(z.string()).length(12)`, pluriels `z.object({one: z.string(), other: z.string()})`, tous en `.strict()`.

- [ ] **Step 1: Écrire les tests**
  - `pageUrl("persons","fr")` → `"/fr/personnes/"` ; `pageUrl("home","en")` → `"/en/"`
  - `workUrl("wiener-konzert","en")` → `"/en/works/wiener-konzert/"`
  - `fill("Th {th} — {title}", {th:"45", title:"W"})` → `"Th 45 — W"`
  - `tn({one:"{n} œuvre", other:"{n} œuvres"}, 1, "fr")` → `"1 œuvre"` ; avec `0` → `"0 œuvre"` (règle française) ; avec `2` → `"2 œuvres"`
  - `tn({one:"{n} work", other:"{n} works"}, 0, "en")` → `"0 works"`
  - `uiSchema.parse(yaml.load(content/ui/fr.yaml))` et la même chose pour `en.yaml` → succès
  - `Object.keys(PAGES).length` → `19`
- [ ] **Step 2: Échec** : `npm test tests/lib/i18n.test.ts` → FAIL.
- [ ] **Step 3: Implémenter** `ui-schema.ts`, `i18n.ts`, le script `ui.ts` (exécuté une fois : `npx tsx scripts/migrate/ui.ts`) et la collection `ui`.
- [ ] **Step 4: Succès** : PASS, et `npx astro sync` sans erreur.
- [ ] **Step 5: Commit** : `git add src/lib content/ui scripts/migrate/ui.ts src/content.config.ts tests/lib/i18n.test.ts && git commit -m "Move interface strings to editable content with i18n helpers"`

### Task 10: CMS Keystatic

**Files:**
- Create: `keystatic.config.ts`, `src/lib/keystatic-ui.ts`, `scripts/validate.ts`, `.env.example`
- Modify: `astro.config.mjs` (intégrations `react()`, `keystatic()`, `adapter: netlify()`), `package.json` (script `validate`)
- Test: `tests/cms/parity.test.ts`

**Interfaces:**
- Consumes: tous les schémas de `src/lib/schemas.ts` (dont `booksFileSchema`), `uiSchema`, `CATEGORIES`, `SOURCE_FEATURES`, `SOURCE_STATUS`, `RELATIONS`, `BIB_TYPES`, `validateCatalogue` et `CatalogueInput` (tâche 6)
- Produces:
  - `uiToKeystatic(schema: ZodObject): Record<string, Field>` : `z.object` → `fields.object` ; `z.string` → `fields.text({ multiline: true })` si la valeur FR dépasse 60 caractères, sinon `fields.text` ; `z.array(z.string())` → `fields.array(fields.text)`. Le libellé du champ est le nom de la clé.
  - `keystatic.config.ts`, avec en export par défaut `config({...})`

**Risk:** high (authentification et secrets)

Configuration, à reprendre exactement :
- `storage` : `import.meta.env.PROD ? { kind: "github", repo: { owner: "ThibautBaissac", name: "greif-catalogue" } } : { kind: "local" }`.
- Collections (`format: { data: "yaml" }`) :
  - `works` : `path: "content/works/*"`, `slugField: "title"` (`fields.slug`, libellé du slug : « Identifiant permanent — ne plus modifier après publication »). Les autres collections suivent le même principe : `persons` (`slugField: "name"`), `places` (`name`), `institutions` (`siglum`), `roles` (`fr`), `bibliography` (`short`), toutes sous `content/<dir>/*`.
- Singletons : `books` (`path: "content/books"`), `uiFr` (`content/ui/fr`), `uiEn` (`content/ui/en`), ces deux derniers via `uiToKeystatic(uiSchema)`.
- Pages Markdoc : collections `pagesFr` (`content/pages/fr/*`) et `pagesEn` (`content/pages/en/*`), `format: { contentField: "body" }`, `body: fields.markdoc`, `title` en `fields.slug`.
- Champs des œuvres : enums → `fields.select` (catégories : `fields.multiselect`) ; ids d'autorité → `fields.relationship({ collection: "persons" | "places" | "institutions" | "roles" | "bibliography" | "works" })` ; dates → `fields.text`, avec une `validation.pattern` reprenant la regex EDTF de la tâche 3 sous forme d'intervalle optionnel ; tableaux → `fields.array(…, { itemLabel })`. `itemLabel` affiche `date_text` pour le carnet, `date + venue` pour une exécution, `title` pour un mouvement. `movements[].incipit` → `fields.image({ directory: "public/incipits", publicPath: "/incipits/" })`.
- Libellés des champs en français.

- [ ] **Step 1: Écrire le test de parité**
  Écrire un parcours récursif des deux arbres : forme Zod (en déballant les wrappers optionnel, défaut et refine selon l'API de la version de Zod fournie par `astro/zod`) et champs Keystatic (`kind: "object"` → `fields`, `kind: "array"` → `element`, sinon feuille). Pour chaque collection et chaque singleton, l'ensemble des chemins de clés doit être identique ; un `fields.slug` compte comme sa clé. Cas :
  - `works` : chemins Zod = chemins Keystatic (avec `movements.[].incipit`, `performances.[].performers.[].role`, etc.)
  - `persons`, `places`, `institutions`, `roles`, `bibliography` : même égalité ; `books` comparé à `booksFileSchema` ; `uiFr` et `uiEn` comparés à `uiSchema`. Les collections Markdoc `pagesFr` et `pagesEn` sont exclues.
  - test négatif : un champ factice `foo` ajouté à une copie de la forme `works` fait échouer la comparaison
- [ ] **Step 2: Échec** : `npm test tests/cms` → FAIL.
- [ ] **Step 3: Implémenter** `keystatic.config.ts` et `keystatic-ui.ts`, puis brancher les intégrations.
- [ ] **Step 4: Succès** : `npm test && npm run build` → PASS. Le build reste statique ; seules les routes Keystatic sont rendues à la demande.
- [ ] **Step 5: Script de validation hors Astro**
  Créer `scripts/validate.ts` et le script npm `"validate": "tsx scripts/validate.ts"`. Le script lit `content/` avec js-yaml, parse chaque fichier avec son schéma, construit un `CatalogueInput` et appelle `validateCatalogue`. Il affiche une ligne par erreur, au format `fichier › chemin : message`, et se termine en code 1 s'il y en a au moins une. Run: `npm run validate` → code 0 sur le contenu migré.
- [ ] **Step 6: Aller-retour CMS → YAML → schéma (vérification manuelle, avant toute page)**
  Dans `npm run dev` → `http://localhost:4321/keystatic`, faire chaque essai, puis `npm run validate` et `git diff content` :
  1. **Notice existante complète** : ouvrir `Wiener Konzert`, modifier une seule virgule dans `remarks`, enregistrer. `validate` → 0 erreur ; le diff ne retire aucune clé ni aucune valeur (seule la mise en forme YAML peut changer).
  2. **Notice minimale** : créer `Essai CMS` avec seulement les champs obligatoires. `validate` → 0 erreur ; le fichier ne contient ni `""` ni `null` pour un champ optionnel (ou bien les schémas les acceptent grâce à la règle de la tâche 5).
  3. **Notice pleine** : créer `Essai CMS 2` avec un élément dans chaque tableau (exécution avec date `2026-11-02`, lieu Paris, interprète Nell Froger / soprano ; entrée de carnet ; référence bibliographique ; relation vers `wiener-konzert`). `validate` → 0 erreur.
  4. **Effacement** : dans `Essai CMS 2`, vider `duration` et supprimer l'entrée de carnet. `validate` → 0 erreur.
  5. Saisir une date invalide `2026-13` : le formulaire la refuse.
  6. Modifier `ui fr › nav › catalogue` et enregistrer. `uiSchema.parse` doit toujours réussir (vérifié par `npm test tests/lib/i18n.test.ts`).
  Pour chaque échec, corriger le schéma (tâche 5) ou la configuration Keystatic, et ajouter le YAML fautif comme cas de régression dans `tests/lib/schemas.test.ts`. Enfin, annuler les essais avec `git checkout content && git clean -fd content`.
- [ ] **Step 7: Commit** : `git add -A keystatic.config.ts src scripts/validate.ts astro.config.mjs tests .env.example package*.json && git commit -m "Add Keystatic CMS with schema parity test and content validation"`
  `.env.example` liste les quatre noms de variables (`KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`), sans valeur. Le passage en mode GitHub de production se fait en tâche 12, après le premier déploiement.

### Task 11: Gabarit et page d'œuvre

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/WorkTitle.astro`, `src/components/WorkRef.astro`, `src/components/Incipit.astro`, `src/components/PerfTable.astro`, `src/components/JournalEntry.astro`, `src/components/Field.astro`, `src/components/Markup.astro`, `src/pages/[lang]/[workDir]/[id].astro`, `src/scripts/cite.ts`
- Test: `tests/site/work.test.ts`

**Interfaces:**
- Consumes: `getCatalogue`, `Catalogue`, `WorkEntry` ; `getUi`, `pageUrl`, `workUrl`, `fill`, `markupOptions` ; `renderInline`, `renderBlock`, `stripMarkup` ; `formatEdtf`
- Produces:
  - `Base.astro`, props `{ lang: Lang; title?: string; desc?: string; alt: string; active?: PageKey; jsonld?: object; noindex?: boolean; bodyClass?: string }` : l'en-tête, la navigation, le pied de page et le lien de langue reprennent `layout()` (`prototype/build.mjs:150-177`). On garde le même `<link>` Google Fonts et on importe `~/styles/global.css`.
  - `Markup.astro`, props `{ src: string; block?: boolean; lang: Lang; ui: Ui; cat: Catalogue; orig?: boolean }` : `orig` ajoute `lang="fr"` si `lang === "en"`.
  - `WorkRef.astro`, props `{ work: WorkEntry; lang: Lang; ui; cat }` : `<a class="wref" href=…><span class="thn">Th&nbsp;N</span> <cite class="wt">…</cite></a>`
  - `PerfTable.astro`, props `{ rows: PerformanceRow[]; showWork: boolean; lang; ui; cat }`

**Risk:** normal

La page reproduit `workPage()` (`prototype/build.mjs:216-328`) avec les nouvelles données :
- `getStaticPaths` : pour chaque œuvre et chaque langue, `{ lang, workDir: WORK_DIR[lang], id }`.
- Ordre et ids des sections : `textes`, `dedicace`, `sources`, `remarques`, `intertexte`, `edition`, `executions`, `carnet`, `documents`, `bibliographie`, `discographie`, `videographie`, `liens`, puis `citer`. Une section vide n'est pas rendue. La section `redaction` arrive en tâche 17.
- La composition affiche `composition.text` en FR ; en EN, `formatEdtf(date)` ou à défaut `text`. Le texte `"inconnue"` ou une composition absente affiche `ui.unknownDate` dans `<span class="muted">`.
- Effectif : `scoring[lang]`.
- Personnes (auteurs, dédicataires, interprètes) : lien `<a class="pl" href="{pageUrl(persons)}#{personId}">{person.name}</a>`.
- Fonds : `<span class="siglum" title="{ui.f.siglum}">{institution.siglum}</span>`.
- Interprète : `role` affiché via `roles.get(role)[lang]`.
- Bibliographie : `{bib.short}, p.&nbsp;{pages}`.
- Liens : `cat.related(id)`, libellé `ui.relation[key.replace(":inverse","_inverse")]`.
- Incipit : `<img src="{movement.incipit}">` si défini, sinon le bloc `staff-ph` avec `ui.incipitMissing` et le chemin attendu `public/incipits/<id>/<n>.png`.
- Citation : `fill(ui.citeTemplate, {th, title: stripMarkup(title), url: "[URL]", date: <date du build formatée>})`. `src/scripts/cite.ts` reprend le bloc « Citation » de `prototype/assets/app.js:45-62` (URL réelle et bouton de copie).
- JSON-LD `MusicComposition`, comme dans `prototype/build.mjs:319-325`, avec `dateCreated` = début EDTF.
- `data-pagefind-body` sur `<article class="notice">` ; `data-pagefind-filter="book"` (valeur `"<ui.book> <roman>"`) et un `data-pagefind-filter="category"` par catégorie (libellé `ui.cat[c]`) dans des éléments cachés ; `data-pagefind-meta="th"`.

- [ ] **Step 1: Écrire les tests** (`tests/site/work.test.ts`, sur `dist/`)
  - `dist/fr/oeuvres/wiener-konzert/index.html` existe ; `<h1>` contient `Wiener Konzert` ; `.th-big` contient `45`
  - la page contient les sections `#textes`, `#dedicace`, `#sources`, `#executions`, `#carnet`, `#bibliographie`, `#liens`, `#citer`, dans cet ordre
  - `#executions tbody tr.is-premiere` → 1 ligne, contenant `24 avril 1974`
  - `#liens` contient un lien vers `/fr/oeuvres/light-music/` avec le libellé `Matériau partagé`
  - `dist/en/works/wiener-konzert/index.html` : `<html lang="en">`, `.lang-note` présent, la composition affiche `26 November 1973`, l'effectif vaut `Female voice and piano`
  - aucune page d'œuvre ne contient `is-editorial` : assertion écrite `it.skipIf(process.env.CATALOGUE_EDITORIAL === "1")`, car `test:site` sera aussi lancé sur le build éditorial à partir de la tâche 17
  - le nombre de pages d'œuvre est de 82 pour chaque langue
- [ ] **Step 2: Échec** : `npm run build && npm run test:site` → FAIL.
- [ ] **Step 3: Implémenter** le gabarit, les composants et la route.
- [ ] **Step 4: Succès** : même commande → PASS. Ouvrir `npm run dev` → `/fr/oeuvres/wiener-konzert/` et comparer visuellement avec `prototype/dist/fr/oeuvres/wiener-konzert.html` (régénérer le prototype avec `cd prototype && npm i && npm run build` si nécessaire).
- [ ] **Step 5: Commit** : `git add src tests/site && git commit -m "Render work entries with shared layout"`

### Task 12: Accueil, catalogue et premier déploiement

**Files:**
- Create: `src/pages/[lang]/index.astro`, `src/pages/[lang]/[...page].astro`, `src/components/pages/Catalogue.astro`, `src/scripts/catalogue-filters.ts`, `src/lib/indexes/home.ts`, `src/lib/indexes/catalogue.ts`, `public/_redirects`, `netlify.toml`
- Modify: `src/pages/index.astro` (redirection), `astro.config.mjs` (`site`), `tests/site/smoke.test.ts`
- Test: `tests/lib/indexes/home.test.ts`, `tests/lib/indexes/catalogue.test.ts`, `tests/site/catalogue.test.ts`

**Interfaces:**
- Consumes: `Catalogue`, `fixtureInput`, `buildCatalogue`, `pageUrl`, `workUrl`, `tn`, `edtfYear`, `fold`, `stripMarkup`
- Produces:
  - `homeModel(cat: Catalogue): { stats: { entries: number; located: number; performances: number; journal: number }; books: { number: number; roman: string; status: string; count: number; thFirst?: string; thLast?: string; yearFirst?: number; yearLast?: number }[] }`
  - `catalogueModel(cat: Catalogue): { books: { book: Book; works: { work: WorkEntry; status: ("published"|"unpublished"|"lostms")[]; q: string }[] }[]; categories: Category[] }` : `q` = `fold` de `[title, subtitle, alt titles, scoring.fr, "op " + opus]` passés par `stripMarkup` et joints par un espace.
  - Route `[...page].astro` : `getStaticPaths` produit `{lang, page: PAGES[key][lang]}` pour toute `key` ≠ `home` ayant un composant enregistré dans la table `PAGE_COMPONENTS: Partial<Record<PageKey, AstroComponent>>`. Les tâches suivantes y ajoutent leur composant.

**Risk:** normal

Règles :
- `status` : `published` si une édition a un `year` ; `unpublished` si `work.unpublished` ; `lostms` si `sources` existe et que `sources.status !== "located"`.
- La page catalogue reproduit `catalogue()` (`prototype/build.mjs:356-385`) : filtres `#f-book`, `#f-cat`, `#f-status`, `#f-q`, `#f-count`, une section `#livre-<n>` par Livre, et `ui.inPreparation` si le Livre est vide.
- `catalogue-filters.ts` reprend le bloc « Catalogue : filtres » de `prototype/assets/app.js:9-31`. Le compteur passe par `tn(ui.worksCount)`, les libellés étant injectés par des attributs `data-*`.
- L'accueil reproduit `home()` (`prototype/build.mjs:597-623`). L'introduction est provisoire (`ui.siteSub`) ; le texte définitif arrive en tâche 16.
- `public/_redirects` :
  ```
  /  /en/  302!  Language=en
  /  /fr/  302!
  ```
- `src/pages/index.astro` : `<meta http-equiv="refresh" content="0; url=/fr/">`, pour le dev.
- `netlify.toml` :
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"
  [build.environment]
    NODE_VERSION = "22"
  [context.deploy-preview.environment]
    CATALOGUE_EDITORIAL = "1"
  [context.branch-deploy.environment]
    CATALOGUE_EDITORIAL = "1"
  ```

- [ ] **Step 1: Écrire les tests**
  - `homeModel(buildCatalogue(fixtureInput)).stats` → `{entries:4, located:1, performances:2, journal:1}`
  - `homeModel(...).books[0]` → `{number:1, count:3, thFirst:"2", thLast:"10", yearFirst:1972, yearLast:1973}` ; `books[2].count` → `0`
  - `catalogueModel(...)` : statut de `sonate-a` → `["published"]` ; de `lied-b` → `["unpublished","lostms"]` ; `q` de `lied-b` contient `"l'ile"` et `"voix et piano"`
  - site : `dist/fr/catalogue/index.html` a 82 lignes `table.cat tbody tr` et 6 sections `.book` ; `dist/en/catalogue/index.html` existe ; `dist/fr/index.html` contient 4 `.stats div`
  - modifier `tests/site/smoke.test.ts` : `dist/index.html` contient `url=/fr/`, et `dist/fr/index.html` contient `Olivier Greif`
- [ ] **Step 2: Échec** : `npm test tests/lib/indexes && npm run build && npm run test:site` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Succès** : PASS ; dans `npm run dev`, filtrer par Livre II puis taper « sonate » : le compteur se met à jour.
- [ ] **Step 5: Commit** : `git add -A src public netlify.toml tests astro.config.mjs && git commit -m "Add home and catalogue pages with Netlify config"`
- [ ] **Step 6: Premier déploiement (action de l'utilisateur)**
  1. Créer le dépôt GitHub `ThibautBaissac/greif-catalogue` (privé ou public), puis `git remote add origin … && git push -u origin main`.
  2. Sur Netlify : « Add new site » → « Import from GitHub » → ce dépôt. Les réglages viennent de `netlify.toml`.
  3. Reporter l'URL obtenue dans `astro.config.mjs` (`site`), puis commit `Set production site URL` et push.
  4. Vérifier que `/` redirige vers `/fr/` et que `/fr/oeuvres/wiener-konzert/` s'affiche.
- [ ] **Step 7: Keystatic en mode GitHub de production (action de l'utilisateur)**
  1. En local, passer temporairement `storage` en `github`, lancer `npm run dev`, ouvrir `/keystatic` et suivre l'assistant de création de la GitHub App (nom `greif-catalogue-keystatic`, installée sur ce seul dépôt). L'assistant écrit les quatre variables de `.env.example` dans `.env`. Remettre ensuite `storage` comme indiqué en tâche 10.
  2. Dans la GitHub App, ajouter l'URL de callback de production `https://<site>/api/keystatic/github/oauth/callback`.
  3. Copier les quatre variables dans Netlify (Site configuration → Environment variables), puis redéployer.
  4. Vérifier : `https://<site>/keystatic` → connexion GitHub ; une modification de test crée un commit sur `main`, Netlify redéploie, la notice reflète la modification. Annuler ensuite ce commit de test.

### Task 13: Index, partie 1 : hub, chronologie, opus, titres, incipits littéraires, effectifs

**Files:**
- Create: `src/lib/indexes/{hub,chrono,opus,titles,textIncipits,scoring,letters}.ts`, `src/components/pages/{Indexes,Chrono,Opus,Titles,TextIncipits,Scoring,StdPage}.astro`
- Modify: table `PAGE_COMPONENTS` dans `src/pages/[lang]/[...page].astro`
- Test: `tests/lib/indexes/part1.test.ts`, `tests/site/indexes.test.ts`

**Interfaces:**
- Consumes: `Catalogue`, `fixtureInput`, `buildCatalogue`, `edtfYear`, `edtfSortKey`, `sortTitle`, `fold`, `stripMarkup`
- Produces:
  - `letterGroups<T>(items: T[], key: (t: T) => string): [string, T[]][]` : première lettre en majuscule ; tout ce qui n'est pas A–Z devient `#` ; groupes triés.
  - `hubModel(cat: Catalogue, editorial: boolean): { key: PageKey; count: number }[]` : les clés dans l'ordre `chrono, opus, titles, incipits, persons, places, performances, scoring, sources, editions, biblio, disco, journal`, plus `dashboard` si `editorial`. Les compteurs se calculent comme dans `indexesPage()` (`prototype/build.mjs:558-574`).
  - `chronoModel(cat): { strip: { year: number; count: number }[]; groups: { year: number | null; works: WorkEntry[] }[] }`
  - `opusModel(cat): { withOpus: WorkEntry[]; without: WorkEntry[] }`
  - `titlesModel(cat): { titles: [string, ({ kind: "main"; work: WorkEntry } | { kind: "alt"; title: string; source: string; work: WorkEntry })[]][]; movements: { title: string; work: WorkEntry }[] }`
  - `textIncipitsModel(cat): { text: string; work: WorkEntry; movementTitle?: string; author?: string }[]`
  - `scoringModel(cat): { category: Category; works: WorkEntry[] }[]` : les 8 catégories dans l'ordre de `CATEGORIES`.
  - `StdPage.astro`, props `{ key: PageKey; lang; ui }` : en-tête `page-head` avec `ui.idx[key].title` et `.desc`, comme `stdPage()` (`prototype/build.mjs:346-354`).

**Risk:** normal

Règles reprises du prototype :
- Chronologie : `prototype/build.mjs:387-401`. L'année vient de `edtfYear(composition.date)`. Le groupe `null` (date inconnue) va en dernier. À l'intérieur d'une année, tri par `edtfSortKey` puis par ordre du catalogue. Ancres `#y<année>` et `#y-unknown`.
- Opus : tri par `parseInt(opus)` puis `localeCompare`.
- Titres : `prototype/build.mjs:414-433`. Le nettoyage des titres de mouvements se fait **exactement** ainsi :
  ```js
  clean = stripMarkup(m.title).replace(/^[«\s]+|[»\s]+$/g, "").replace(/^(-?\s*[IVX\d]+\s*[-.)/]?\s*-?\s*|Nº\s*\d+\.?\s*|\d+\)\s*)/i, "").replace(/^\[|\]$/g, "").trim();
  keep = clean && !/^\[?\d*\.?\]?$/.test(clean);
  ```
  Tri `localeCompare(…, "fr")` sur `sortTitle`.
- Incipits littéraires : tri `fold(text).localeCompare(…, "fr")`. `author` = nom de la première personne de `text.authors`. `movementTitle` seulement si l'œuvre a plus d'un mouvement.

- [ ] **Step 1: Écrire les tests** (fixture)
  - `hubModel(cat,false).length` → `13` ; `hubModel(cat,true).at(-1).key` → `"dashboard"` ; compteur de `performances` → `2`
  - `chronoModel(cat).groups.map(g => g.year)` → `[1972, 1973, null]` ; le groupe `null` contient `etude-c` et `zeta-d` ; `strip` → `[{year:1972,count:1},{year:1973,count:1}]`
  - `opusModel(cat).withOpus.map(w => w.id)` → `["sonate-a"]` ; `without.length` → `3`
  - `titlesModel(cat).titles.map(([l]) => l)` → `["E","I","S","Z"]` (« L'Île » est rangé sous I)
  - `titlesModel(cat).movements` → `[]` (« I » et « 1 » sont filtrés)
  - `textIncipitsModel(cat)` → `[{text:"Vergiftet sind meine Lieder", work: lied-b, author:"Heinrich Heine"}]`
  - `scoringModel(cat)` → 8 entrées ; `piano` contient 3 œuvres
  - site : `dist/fr/chronologie/index.html`, `dist/en/chronology/index.html`, `dist/fr/titres/index.html`, `dist/fr/opus/index.html`, `dist/fr/incipits-litteraires/index.html`, `dist/fr/effectifs/index.html` et `dist/fr/index-general/index.html` existent ; le hub n'a pas de lien vers `/fr/redaction/` (assertion `it.skipIf(process.env.CATALOGUE_EDITORIAL === "1")`)
- [ ] **Step 2: Échec** → FAIL.
- [ ] **Step 3: Implémenter** les modèles purs, puis les composants enregistrés dans `PAGE_COMPONENTS`. `editorial` vaut provisoirement `process.env.CATALOGUE_EDITORIAL === "1"` ; il sera remplacé par `isEditorial()` en tâche 17.
- [ ] **Step 4: Succès** : `npm test && npm run build && npm run test:site` → PASS.
- [ ] **Step 5: Commit** : `git add src tests && git commit -m "Add chronology, opus, titles, text incipit and scoring indexes"`

### Task 14: Index, partie 2 : personnes, lieux, exécutions

**Files:**
- Create: `src/lib/indexes/{persons,places,performances}.ts`, `src/components/pages/{Persons,Places,Performances}.astro`, `src/scripts/persons-filter.ts`
- Modify: `PAGE_COMPONENTS`
- Test: `tests/lib/indexes/part2.test.ts`, `tests/site/persons.test.ts`

**Interfaces:**
- Consumes: `Catalogue.personUsages`, `Catalogue.performances`, `Catalogue.places`, `letterGroups`, `edtfYear`, `PerfTable.astro`
- Produces:
  - `personsModel(cat): [string, { id: string; surname: string; given?: string; roles: ("author"|"dedicatee"|"performer")[]; blocks: { role: "author"|"translator"|"dedicatee"|"performer"; works: { work: WorkEntry; roles: string[]; years: string }[] }[] }[]][]`. Le tri se fait par `fold(surname + " " + given)` avec `localeCompare` en `fr`. `roles` sert au filtre : `translator` y est compté comme `author`. `years` vaut `"1974"`, `"1974–1976"` ou `""`.
  - `placesModel(cat): { key: string; label: string; rows: PerformanceRow[] }[]` : `key` = placeId ou `"unknown"` ; `label` = `name`, suivi de ` (country)` si le pays est connu ; tri `fold(label)`.
  - `performancesModel(cat): { rows: PerformanceRow[]; withoutPerformance: WorkEntry[] }`

**Risk:** normal

Le rendu reproduit `personsPage()`, `places()` et `performancesPage()` (`prototype/build.mjs:443-479`). Les ancres sont `id="<personId>"` pour une personne et `#p-<key>` pour un lieu. `persons-filter.ts` reprend le bloc « Personnes : filtre par rôle » de `prototype/assets/app.js:33-43`.

- [ ] **Step 1: Écrire les tests** (fixture)
  - `personsModel(cat)` donne les lettres `["F","G","H"]` ; Froger a `roles: ["performer"]` et un bloc `performer` avec 2 œuvres, la première ayant `roles: ["soprano"]` et `years: "1974"`
  - Heine a `roles` contenant `author` et `dedicatee`
  - `placesModel(cat).map(p => p.label)` → `["Paris","Prague (République Tchèque)"]`
  - `performancesModel(cat).withoutPerformance.map(w => w.id)` → `["etude-c","zeta-d"]`
  - site : `dist/fr/personnes/index.html` contient `id="heinrich-heine"` ; `dist/fr/lieux/index.html` contient `id="p-paris"` ; tous les liens `.pl` de `dist/fr/oeuvres/wiener-konzert/index.html` pointent vers une ancre qui existe dans `dist/fr/personnes/index.html`
- [ ] **Step 2: Échec** → FAIL. **Step 3: Implémenter.** **Step 4: Succès** : `npm test && npm run build && npm run test:site` → PASS.
- [ ] **Step 5: Commit** : `git add src tests && git commit -m "Add people, places and performances indexes"`

### Task 15: Index, partie 3 : manuscrits, éditions, bibliographie, discographie, carnet de bord

**Files:**
- Create: `src/lib/indexes/{sources,editions,biblio,disco,journal}.ts`, `src/lib/bibliography.ts`, `src/components/pages/{Sources,Editions,Biblio,Disco,Journal}.astro`
- Modify: `PAGE_COMPONENTS`
- Test: `tests/lib/indexes/part3.test.ts`, `tests/lib/bibliography.test.ts`, `tests/site/indexes3.test.ts`

**Interfaces:**
- Consumes: `Catalogue`, `fixtureInput`, `JournalEntry.astro`, `edtfSortKey`, `edtfYear`
- Produces:
  - `sourcesModel(cat): { byInstitution: [string, WorkEntry[]][]; byPaper: [string, WorkEntry[]][]; byFeature: [SourceFeature, WorkEntry[]][]; lost: WorkEntry[] }` : chaque groupe est trié par effectif décroissant.
  - `editionsModel(cat): { byPublisher: [string, { work: WorkEntry; edition: Work["editions"][number] }[]][]; unpublished: WorkEntry[] }` : éditeur absent → `"—"` ; tri alphabétique des éditeurs, puis par année.
  - `biblioModel(cat): { entry: BibEntry & {id: string}; citations: { work: WorkEntry; pages?: string }[]; pageIndex: { page: string; works: WorkEntry[] }[] }[]` : `pageIndex` reprend la logique de `biblio()` (`prototype/build.mjs:515-532`), avec tri numérique `parseInt` puis texte.
  - `discoModel(cat, key: "discography"|"videography"): { title: string; year?: number; items: { work: WorkEntry; details?: string }[] }[]` : regroupement par `title ?? stripMarkup(text)`, tri par année.
  - `journalModel(cat): { year: number | null; entries: { entry: JournalEntry; work: WorkEntry }[] }[]` : tri `edtfSortKey`, ancres `#j<année>` et `#j-unknown`.
  - `formatReference(e: BibEntry, lang: Lang): string` : HTML. Les auteurs sont formés `Family, Given` et séparés par ` ; `. Avec un `editor` et sans auteur, on ajoute ` (dir.)` en FR et ` (ed.)` en EN. Viennent ensuite `, <em>title</em>`, `, publisher-place`, `, publisher`, `, <année de issued>`, puis un point final. Si `title` est absent, la fonction renvoie `short` échappé.

**Risk:** normal

- [ ] **Step 1: Écrire les tests**
  - `sourcesModel(cat).byInstitution` → `[["f-pbmgf", [sonate-a]]]` ; `lost` → `[lied-b]` ; `byFeature` contient `draft` → `[sonate-a]`
  - `editionsModel(cat).byPublisher` → `[["Symétrie", [{work: sonate-a, …}]]]` ; `unpublished` → `[lied-b]`
  - `biblioModel(cat)[0].pageIndex.map(p => p.page)` → `["28","35"]`
  - `journalModel(cat)` → `[{year:1973, entries:[{work: sonate-a, …}]}]`
  - les objets passés à `formatReference` sont d'abord validés par `bibliographySchema.parse` (valeurs par défaut)
  - `formatReference({short:"F&N (2013)", type:"book", title:"Le Rêve du monde", editor:[{family:"François-Sappey", given:"Brigitte"}], author:[], issued:"2013", publisher:"Symétrie", "publisher-place":"Lyon"}, "fr")` → `"François-Sappey, Brigitte (dir.), <em>Le Rêve du monde</em>, Lyon, Symétrie, 2013."` (données de test, pas une vraie référence)
  - `formatReference({short:"F&N (2013)", type:"other", author:[], editor:[]}, "fr")` → `"F&amp;N (2013)"`
  - site : `dist/fr/manuscrits/`, `dist/fr/editions/`, `dist/fr/bibliographie/`, `dist/fr/discographie/` et `dist/fr/carnet-de-bord/` existent ; `dist/fr/carnet-de-bord/index.html` contient `id="j1973"`
- [ ] **Step 2: Échec** → FAIL. **Step 3: Implémenter.** **Step 4: Succès** : `npm test && npm run build && npm run test:site` → PASS.
- [ ] **Step 5: Commit** : `git add src tests && git commit -m "Add manuscripts, editions, bibliography, discography and journal indexes"`

### Task 16: Pages éditoriales (Markdoc) et recherche Pagefind

**Files:**
- Create: `content/pages/fr/home.mdoc`, `content/pages/en/home.mdoc`, `content/pages/fr/about.mdoc`, `content/pages/en/about.mdoc`, `src/components/pages/{About,Search}.astro`, `src/scripts/search.ts`
- Modify: `src/pages/[lang]/index.astro` (introduction lue dans `pages`), `PAGE_COMPONENTS`, `src/styles/global.css` (bloc ajouté **en fin de fichier**, `/* Pagefind */`)
- Test: `tests/site/pages.test.ts`

**Interfaces:**
- Consumes: collection `pages` (ids `fr/home`, `en/home`, `fr/about`, `en/about`), `getEntry`, `render`
- Produces: pages `/fr/a-propos/`, `/en/about/`, `/fr/recherche/`, `/en/search/` ; introduction de l'accueil éditable

**Risk:** normal

- Contenu initial : `home.mdoc` = la variable `intro` de `home()` (`prototype/build.mjs:600-602`) ; `about.mdoc` = le contenu de `about()` (`prototype/build.mjs:643-664`), le tableau des abréviations devenant un tableau Markdoc. Le frontmatter `title` vaut « À propos » / « About » (« Accueil » / « Home » pour `home`).
- Recherche : on charge `/pagefind/pagefind-ui.js` et `/pagefind/pagefind-ui.css` (générés au build). `new PagefindUI({ element: "#search", showSubResults: true, showImages: false })`, puis si `?q=` est présent : `ui.triggerSearch(q)`. Pagefind choisit l'index de la langue d'après `<html lang>`. Le formulaire de l'accueil (`.hero-search`) envoie `q` vers `pageUrl("search", lang)`.
- CSS Pagefind : seulement les variables `--pagefind-ui-font`, `--pagefind-ui-primary`, `--pagefind-ui-text`, `--pagefind-ui-border`, alignées sur les tokens existants de `global.css`.

- [ ] **Step 1: Écrire les tests**
  - `dist/fr/a-propos/index.html` contient `F-Pbmgf` et un `<table>` ; `dist/en/about/index.html` contient `Abbreviations`
  - `dist/fr/index.html` contient `six Livres`
  - `dist/pagefind/pagefind-ui.js` existe ; `dist/pagefind/` contient un fichier `.pf_meta` dont le nom commence par `pagefind.fr` et un autre qui commence par `pagefind.en`
  - `dist/fr/recherche/index.html` contient `id="search"`
- [ ] **Step 2: Échec** → FAIL. **Step 3: Implémenter.**
- [ ] **Step 4: Succès** : `npm run build && npm run test:site` → PASS ; `npm run preview` → `/fr/recherche/?q=Heine` doit lister Wiener Konzert. La recherche ne fonctionne qu'après le build, pas en `dev`.
- [ ] **Step 5: Commit** : `git add content/pages src tests && git commit -m "Add editable home and about pages and Pagefind search"`

### Task 17: Mode éditorial et tableau de bord

**Files:**
- Create: `src/lib/editorial.ts`, `src/components/pages/Dashboard.astro`
- Modify: `src/pages/[lang]/[workDir]/[id].astro` (section `redaction`), `src/lib/indexes/hub.ts` (appel), `src/pages/[lang]/[...page].astro` (route `dashboard` conditionnelle), `src/layouts/Base.astro` (texte du pied de page)
- Test: `tests/lib/editorial.test.ts`, `tests/site/editorial.test.ts`

**Interfaces:**
- Consumes: `Catalogue`, `fixtureInput`, `extractRefs`
- Produces:
  - `isEditorial(): boolean` → `process.env.CATALOGUE_EDITORIAL === "1"`
  - `completeness(w: WorkEntry): { incipits: number; bars: number; movements: number; checks: { composition: boolean; sources: boolean; bars: boolean; duration: boolean }; score: number }`. Les contrôles reprennent `dashboard()` (`prototype/build.mjs:576-595`) : composition = `composition.date` défini ; sources = `items.length > 0` ou `intro` ou `status !== "located"` ; bars = tous les mouvements ont `bars` (vrai s'il n'y a aucun mouvement) ; duration = `duration` défini. `score` = nombre de contrôles vrais divisé par 4.
  - `dashboardModel(cat): { rows: { work: WorkEntry; c: ReturnType<typeof completeness>; notes: string[] }[]; unresolved: WorkEntry[]; variants: { person: string; variants: string[] }[]; incompleteBibliography: string[] }` : `unresolved` = œuvres dont une chaîne contient `[[?]]` ; `incompleteBibliography` = ids sans `title`.

**Risk:** normal

- [ ] **Step 1: Écrire les tests**
  - `completeness(sonate-a)` → `checks {composition:true, sources:true, bars:true, duration:false}`, `score 0.75`
  - `completeness(zeta-d).checks.composition` → `false`
  - `dashboardModel(cat).unresolved.map(w => w.id)` → `["lied-b"]` ; `incompleteBibliography` → `["francois-sappey-nectoux-2013"]`
  - site, build normal (assertions `it.skipIf(process.env.CATALOGUE_EDITORIAL === "1")`) : `dist/fr/redaction/` n'existe pas ; aucune page ne contient `class="field is-editorial"`
  - site, build avec `CATALOGUE_EDITORIAL=1` : le test est écrit sous la forme `it.runIf(process.env.CATALOGUE_EDITORIAL === "1")`. `dist/fr/redaction/index.html` existe et contient `<meta name="robots" content="noindex">` ; `dist/fr/oeuvres/wiener-konzert/index.html` contient `#redaction`
- [ ] **Step 2: Échec** → FAIL.
- [ ] **Step 3: Implémenter.** Remplacer la lecture directe de `process.env` de la tâche 13 par `isEditorial()`.
- [ ] **Step 4: Succès** : `npm test && npm run build && npm run test:site && CATALOGUE_EDITORIAL=1 npm run build && CATALOGUE_EDITORIAL=1 npm run test:site` → PASS.
- [ ] **Step 5: Commit** : `git add src tests && git commit -m "Add editorial mode with dashboard and editorial notes"`

### Task 18: Données ouvertes, citation et documentation

**Files:**
- Create: `src/lib/opendata.ts`, `src/pages/data/catalogue.json.ts`, `src/pages/data/works.csv.ts`, `CITATION.cff`, `README.md`
- Test: `tests/lib/opendata.test.ts`, `tests/site/opendata.test.ts`

**Interfaces:**
- Consumes: `Catalogue`, `fixtureInput`, `stripMarkup`, `formatEdtf`, `isEditorial`
- Produces:
  - `toOpenData(cat: Catalogue): { generated: string; works: object[]; persons: object[]; places: object[]; institutions: object[]; bibliography: object[] }` : œuvres avec `id`, `th`, `url` FR et EN, ids d'autorité non résolus. Les `editorial_notes` (œuvres et bibliographie) sont **retirées**.
  - `toCsv(cat: Catalogue): string` : colonnes `id,th,book,title,subtitle,opus,scoring_fr,scoring_en,categories,composition_date,unpublished,url_fr`. Le titre est passé par `stripMarkup`, `categories` est joint par `|`. Séparateur `,`, guillemets RFC 4180, fin de ligne `\n`.
  - Endpoints statiques `/data/catalogue.json` et `/data/works.csv`.

**Risk:** normal

- [ ] **Step 1: Écrire les tests**
  - `toOpenData(cat).works.length` → `4` ; aucune clé `editorial_notes` à aucun niveau ; `works[0].url.fr` → `"/fr/oeuvres/sonate-a/"`
  - `toCsv(cat).split("\n")[0]` → l'en-tête exacte ci-dessus ; la ligne de `lied-b` contient le texte L'Île et `voice-piano`
  - un titre contenant `,` est entouré de guillemets
  - site : `dist/data/catalogue.json` se parse en JSON et contient 82 œuvres ; `dist/data/works.csv` a 83 lignes non vides
- [ ] **Step 2: Échec** → FAIL. **Step 3: Implémenter.**
- [ ] **Step 4: `CITATION.cff`** (`cff-version: 1.2.0`, `title: "Catalogue thématique des œuvres d'Olivier Greif"`, `type: dataset`, `authors` = l'utilisateur, à faire compléter par lui, `license` à faire choisir par l'utilisateur, `repository-code` = l'URL GitHub) et **`README.md`** (lancement, structure, saisie via Keystatic, mode éditorial, publication d'une version citable : release GitHub `vX.Y.Z`, puis DOI Zenodo une fois l'intégration activée par l'utilisateur sur zenodo.org). Remplacer `prototype/README.md` n'est pas nécessaire.
- [ ] **Step 5: Succès** : `npm test && npm run build && npm run test:site` → PASS.
- [ ] **Step 6: Commit** : `git add src tests CITATION.cff README.md && git commit -m "Publish open data exports and citation metadata"`

## End of tasks

### Ordre et parallélisme

1 → 2, 3, 4 (en parallèle) → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18. La tâche 14 consomme `letterGroups`, créée en tâche 13. La tâche 15 n'en dépend pas : elle peut être menée en parallèle de la 14, une fois la 13 terminée ; seule la table `PAGE_COMPONENTS` est partagée, d'où un conflit possible sur une ligne.

Le CMS (tâche 10) vient avant toute page, pour que l'aller-retour Keystatic → YAML → schéma soit vérifié avant que du rendu ne repose sur la forme des données.

### Points laissés à l'utilisateur

- Licence des données (CC BY 4.0 ? CC BY-NC ?) et auteurs de `CITATION.cff`.
- Complétion des notices CSL de la bibliographie (tableau de bord, liste « bibliographie incomplète »).
- Nom de domaine éventuel (remplace l'URL Netlify dans `astro.config.mjs`).
- Renommer l'identifiant d'une œuvre casse son URL : choix assumé, sans verrou ni redirection. Pas de redirection non plus depuis les anciennes URL `.html` du prototype.

### Hors périmètre de ce plan (pistes futures)

- Incipits en Plaine & Easie rendus par Verovio, et recherche mélodique.
- Synchronisation avec Zotero.
- Identifiants d'autorité (BnF, VIAF) remplis automatiquement.
- Export MEI ou TEI.
