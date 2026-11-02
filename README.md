# Catalogue thématique des œuvres d'Olivier Greif

Site statique bilingue (français / anglais) généré par [Astro](https://astro.build), édité avec [Keystatic](https://keystatic.com). Le dépôt Git est la base de données : tout le contenu vit dans `content/`. L'ancien prototype (`prototype/`) est conservé en lecture seule.

## Lancement

Prérequis : Node 22 ou plus récent (`.nvmrc`).

```sh
npm install
npm run dev          # http://localhost:4321, Keystatic sur /keystatic (stockage local)
npm run build        # astro build, puis index de recherche Pagefind dans dist/
npm run preview      # aperçu du build
npm test             # tests unitaires (src/lib, migration, parité Keystatic)
npm run test:site    # tests du site généré : à lancer après npm run build
npm run check        # astro check (TypeScript)
npm run validate     # valide content/ contre les schémas et les renvois
```

- La recherche (Pagefind) n'existe qu'après `npm run build` ; elle ne fonctionne pas en `npm run dev`.
- Si l'adaptateur Netlify empêche `npm run preview` de démarrer, servir `dist/` avec un serveur statique quelconque.

## Structure

```
content/
  works/<id>.yaml        une notice par fichier ; <id> est permanent et donne l'URL
  persons/ places/ institutions/ roles/ bibliography/   autorités, référencées par identifiant
  books.yaml             les six Livres
  ui/{fr,en}.yaml        toutes les chaînes d'interface
  pages/{fr,en}/*.mdoc   pages éditoriales (introduction de l'accueil, à propos)
public/incipits/<id>/<n>.png   incipits musicaux
src/lib/                 domaine (schémas Zod, catalogue, EDTF, balisage, index, export)
src/pages/ src/components/ src/layouts/   routes et mise en forme
scripts/migrate/         migration ponctuelle depuis le prototype
tests/                   lib, migrate, cms, site
```

Une œuvre est à `/fr/oeuvres/<id>/` et `/en/works/<id>/`. Renommer un fichier change l'URL ; il n'y a ni verrou ni redirection. Tout renvoi qui ne se résout pas (`[[id]]`, personne, lieu, fonds, rôle, référence bibliographique, œuvre liée) fait échouer le build ; `[[?]]` est le seul marqueur non résolu admis. Les dates structurées suivent le sous-ensemble EDTF défini dans `tasks/specs/2026-11-02-catalogue-astro.md`.

## Saisie avec Keystatic

- En local : `npm run dev`, puis ouvrir `/keystatic`. Les modifications sont écrites directement dans `content/`.
- En production : Keystatic passe par GitHub (mode `github`, dépôt déclaré dans `keystatic.config.ts`). Les variables à fournir, dans Netlify et dans un `.env` local ignoré par Git, sont listées dans `.env.example`. Aucun secret ne doit être commité.
- Chaque enregistrement est un commit ; Netlify reconstruit le site à chaque push.
- Les pages `home` et `about` sont des fichiers Markdoc (`content/pages/<lang>/*.mdoc`) éditables dans Keystatic (« Pages (FR) », « Pages (EN) »).

## Mode éditorial

`CATALOGUE_EDITORIAL=1` ajoute au build les notes de rédaction des notices (rubrique « Notes de rédaction »), la page « État de la rédaction » (`/fr/redaction/`, `/en/editorial/`, en `noindex`) et un pied de page « Version éditoriale ». Sans cette variable (build de production), rien de tout cela n'est généré. `netlify.toml` l'active pour les deploy previews et les branch deploys, pas pour la production.

```sh
CATALOGUE_EDITORIAL=1 npm run build
```

## Données ouvertes

Chaque build publie :

- `/data/catalogue.json` : œuvres, personnes, lieux, fonds et bibliographie (identifiants d'autorité non résolus ; les notes de rédaction en sont toujours exclues) ;
- `/data/works.csv` : une ligne par œuvre (`id,th,book,title,subtitle,opus,scoring_fr,scoring_en,categories,composition_date,unpublished,url_fr`).

## Citer et publier une version

`CITATION.cff` décrit comment citer le catalogue. Il contient des espaces réservés marqués `TODO(user)` qui attendent vos décisions :

1. **Auteurs** : l'entrée actuelle n'est pas une personne réelle.
2. **Licence** : aucune n'est déclarée ; choisir un identifiant SPDX et l'ajouter à `CITATION.cff`, puis ajouter le fichier de licence correspondant.
3. **URL du dépôt** : déduite de `keystatic.config.ts`, à confirmer.

Pour publier une version citable :

1. Mettre à jour `version` et `date-released` dans `CITATION.cff`.
2. Créer une release GitHub nommée `vX.Y.Z`.
3. Une fois l'intégration GitHub activée par vos soins sur [zenodo.org](https://zenodo.org), Zenodo archive la release et lui attribue un DOI, à reporter dans `CITATION.cff`.

## À faire par le propriétaire du dépôt

- Valeur `site` d'`astro.config.mjs` (provisoire).
- Auteurs et licence (voir plus haut).
- Mise en ligne Netlify et configuration de Keystatic en production.
