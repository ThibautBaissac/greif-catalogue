# Catalogue Greif : refonte Astro + Keystatic

**Date :** 2026-11-02
**Statut :** validée (choix de l'option A, réponses de l'utilisateur du 2026-11-02)

## Objectif

Réécrire le catalogue thématique critique des œuvres d'Olivier Greif (prototype dans `prototype/`)
en site statique bilingue FR/EN généré par Astro, édité via Keystatic. Le dépôt Git est la base
de données. L'hébergement se fait sur Netlify, avec un coût nul.

## Décisions

| Sujet | Décision |
|---|---|
| Générateur | Astro, `output: "static"`. Seules les routes Keystatic sont rendues à la demande. |
| Source de vérité | Fichiers YAML dans `content/`. Pas de base de données. |
| CMS | Keystatic : mode `local` en dev, mode `github` en prod. |
| Rédacteurs | Un seul, le propriétaire du dépôt. Pas de gestion multi-utilisateurs. |
| Flux Word | Abandonné. Migration ponctuelle depuis `prototype/data/`, ensuite saisie dans le CMS uniquement. |
| Bibliographie | Collection interne `content/bibliography/`, champs calqués sur CSL-JSON. Pas de Zotero pour l'instant. |
| Recherche | Pagefind, index statique par langue. |
| Hébergement | Netlify, adapter `@astrojs/netlify`. |
| Apparence | Reprise à l'identique de `prototype/assets/style.css` et de la structure HTML du prototype (mêmes classes CSS). |
| Balisage du texte | Balisage léger du prototype, conservé et formalisé : `*em*`, `**strong**`, `^sup^`, ` \| `, `[sic]`, `[[id]]`, `[[?]]`. |
| Dates | Sous-ensemble EDTF (voir plus bas). |
| Relations entre œuvres | Stockées une seule fois, sur l'œuvre « source ». La relation inverse est dérivée au build. |
| Notes de rédaction | Visibles seulement si `CATALOGUE_EDITORIAL=1` (deploy previews et branch deploys Netlify). Jamais en production. |
| Renommage d'un identifiant | Accepté, au prix de l'URL de l'œuvre : pas de verrou ni de redirection. Pas de redirection non plus depuis les URL `.html` du prototype. Les renvois internes cassés font toujours échouer le build. |
| Versions citables | Fichier `CITATION.cff`, releases GitHub, DOI via l'intégration GitHub de Zenodo (activation manuelle par l'utilisateur). |

## Contraintes globales

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

## Sous-ensemble EDTF accepté

```
date      := YYYY | YYYY-MM | YYYY-MM-DD | YYYX         (X = dernier chiffre de l'année non spécifié)
qualified := date | date "?" | date "~"                  (? incertain, ~ approximatif)
edtf      := qualified | qualified "/" qualified         (intervalle fermé)
```

Regex de référence (une date simple) : `^(\d{3}[\dX])(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?[?~]?$`.
Un `X` interdit mois et jour (`197X-05` est invalide).

## Modèle de données

### `content/works/<id>.yaml`

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `title` | markup | oui | |
| `th` | string `^\d+[a-z]?$` | oui | unique |
| `book` | 1..6 | oui | |
| `subtitle` | markup | non | |
| `alt_titles` | `{title, source}[]` | défaut `[]` | |
| `opus` | string | non | |
| `scoring` | `{fr: markup, en: markup}` | oui | |
| `scoring_note` | markup | non | |
| `categories` | enum[] (≥1) | oui | `piano, two-pianos, voice-piano, vocal-ensemble, chamber, choral, orchestra, undetermined` |
| `movements` | `{title?, bars?: int>0, text_incipit?, incipit?: string, incipit_count?: int}[]` | défaut `[]` | `incipit` = chemin public de l'image sous `/incipits/` (le nom de fichier est choisi par Keystatic au téléversement) |
| `text` | `{credit: markup, poem_title?, authors: {person: personId, role: author\|translator, as_written?}[]}` | non | |
| `composition` | `{text: markup, date?: EDTF}` | non | |
| `duration` | string | non | |
| `dedication` | `{text?: markup, persons: personId[]}` | non | |
| `sources` | `{status: located\|not_located\|lost, institution?: institutionId, intro?: markup, items: {label?, text: markup}[], papers: string[], features: enum[]}` | non | features : `autograph, draft, sketch, fair_copy, unfinished, incomplete` |
| `audio_source` | markup | non | |
| `remarks`, `intertextual`, `documents`, `premiere_recording` | markup[] | défaut `[]` | |
| `editions` | `{text: markup, publisher?, year?: int, status?: uncertain\|forthcoming}[]` | défaut `[]` | |
| `unpublished` | boolean | défaut `false` | |
| `performances` | `{premiere: boolean, date?: EDTF, venue?: markup, place?: placeId, performers: {person: personId, role?: roleId, alias?}[], text: markup}[]` | défaut `[]` | remplace `premiere` + `performances` |
| `journal` | `{date_text, date?: EDTF, context?: markup, note?: markup, quotes: markup[]}[]` | défaut `[]` | |
| `bibliography` | `{ref: bibId, pages?: string}[]` | défaut `[]` | |
| `discography` | `{text: markup, title?, year?: int, details?: markup}[]` | défaut `[]` | |
| `videography` | `{text: markup}[]` | défaut `[]` | |
| `related` | `{work: workId, relation: enum}[]` | défaut `[]` | `revision, extract, version, companion, cycle, shared-material, sketch` |
| `editorial_notes` | string[] | défaut `[]` | |

### Autorités

- `content/persons/<id>.yaml` : `name` (forme d'affichage), `surname`, `given?`, `kind: person|ensemble` (défaut `person`), `dates?` (EDTF), `identifiers?: {bnf?, viaf?, isni?, wikidata?}`, `variants: string[]` (défaut `[]`), `note?`.
- `content/places/<id>.yaml` : `name`, `country?`, `note?`.
- `content/institutions/<id>.yaml` : `siglum` (RISM, ex. `F-Pbmgf`), `name: {fr, en}`, `city?`.
- `content/roles/<id>.yaml` : `fr`, `en`. Ce sont les rôles d'interprète, par exemple piano, soprano, violon.
- `content/bibliography/<id>.yaml` : `short` (forme abrégée citée dans les notices), `type: book|chapter|article-journal|thesis|webpage|other`, `title?`, `author: {family, given?}[]`, `editor: {family, given?}[]`, `issued?` (EDTF), `publisher?`, `publisher-place?`, `container-title?`, `page?`, `URL?`, `editorial_notes: string[]`.
- `content/books.yaml` : `books: {number: 1..6, roman, status: complete|partial|planned}[]`.

### Contenus éditables

- `content/ui/fr.yaml`, `content/ui/en.yaml` : toutes les chaînes d'interface. Les pluriels sont au format `{one, other}`, les gabarits utilisent `{var}`.
- `content/pages/{fr,en}/{home,about}.mdoc` : texte d'introduction de l'accueil et page « À propos » (Markdoc).

## Décisions de test

- Interface testée : les fonctions pures de `src/lib/` (Vitest, `tests/lib/`).
- Interface testée : `migrate(input)` dans `scripts/migrate/` sur des copies réelles de notices du prototype (`tests/migrate/`).
- Interface testée : `validateCatalogue(input)` et `buildCatalogue(input)` sur le jeu de données de test `tests/fixtures/catalogue.ts`.
- Interface testée : le site généré, en lisant le HTML de `dist/` après `npm run build` (`tests/site/`, commande `npm run test:site`).
- Interface testée : la parité entre schémas Zod et configuration Keystatic (`tests/cms/parity.test.ts`).
- Non testés automatiquement : le rendu CSS, l'interface Keystatic (liste de vérification manuelle), le déploiement Netlify (vérification manuelle).
