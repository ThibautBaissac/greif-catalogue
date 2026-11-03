# Actions restant à l'utilisateur après l'exécution du plan

Plan : `tasks/plans/2026-11-02-catalogue-astro.md`. Toutes les tâches sont implémentées sur la branche `astro-rebuild`. Il reste ce qui demande une décision ou un compte de l'auteur.

## 1. Relire la migration (tâche 8, étape 5)

Lire `tasks/migration-report.md`, puis ouvrir quelques notices de `content/works/` et les comparer avec `prototype/data/works/`. Trois cas sont à trancher dans Keystatic :

- **`sonate-violon-piano-02`** : l'exécution « Paris, L'Archipel, 11 mai 2006 et 22 février, par les mêmes interprètes » a perdu l'interprète factice « et 22 février ». La formulation d'origine est désormais affichée en remarque (champ `note`). Pour structurer : créer une seconde exécution datée (année à confirmer), avec les mêmes interprètes.
- **`light-music`** (exécution du 14 octobre 2021) : le pianiste non identifié `[?]` a été retiré, et la formulation d'origine est affichée en remarque. Il faut l'ajouter comme personne si son nom est connu, sinon le laisser tel quel.
- **`la-chanson-de-gaspard-hauser`** : l'élément de source vide portant l'étiquette « Inédit ? » a été converti en texte de source. Il est peut-être préférable de supprimer cet élément et de garder l'information en note de rédaction.

Les notes `[migration]` correspondantes s'affichent dans le tableau de bord, en mode rédaction.

## 2. Tester les allers-retours restants dans Keystatic

Le contrôle a déjà été fait sur les œuvres : un enregistrement dans Keystatic est relu sans erreur et sans perte de données. Il reste à vérifier les autres collections :

1. Lancer `npm run dev`, puis ouvrir `http://127.0.0.1:4321/keystatic/`.
2. Pour chaque collection (personnes, lieux, fonds, rôles, bibliographie, Livres, interface EN) : ouvrir une entrée, modifier un caractère, enregistrer.
3. Après chaque enregistrement, lancer `npm run validate` (le résultat doit être « 0 erreur »), puis `git diff content` (aucune perte).
4. Annuler les essais avec `git checkout content`.
5. Incipit : téléverser un PNG sur un mouvement, enregistrer, puis vérifier le fichier sous `public/incipits/` et la page de l'œuvre.
6. Choisir Nell Froger / soprano dans la liste d'interprètes, à la main.

## 3. Publier (tâche 12, étapes 6 et 7)

1. Créer le dépôt GitHub `ThibautBaissac/greif-catalogue`, puis pousser `main`.
2. Sur Netlify, importer le dépôt (la configuration vient de `netlify.toml`), puis reporter l'URL obtenue dans `astro.config.mjs` (`site`).
3. Pour Keystatic en production : passer temporairement `storage` en `github` en local, puis suivre l'assistant de création de la GitHub App. Copier les quatre variables de `.env.example` dans Netlify. Ajouter la callback `https://<site>/api/keystatic/github/oauth/callback`.

## 4. Renumérotation automatique des Th

Après le premier push qui contient `.github/workflows/renumber-th.yml`, vérifier sur GitHub (onglet Actions) que l'Action « Renumber Th » tourne. Si le push de l'Action est refusé, activer « Read and write permissions » dans Settings → Actions → General → Workflow permissions. Premier essai conseillé : créer dans Keystatic la nouvelle œuvre à Th 3, puis contrôler le commit « Renumber Th » et le déploiement Netlify qui suit.

## 5. Décisions éditoriales

- `CITATION.cff` : auteurs et licence (marqueurs `TODO(user)`).
- Bibliographie : compléter la notice CSL « François-Sappey & Nectoux (2013) » dans Keystatic.
- Plus tard : `npm audit` signale 17 vulnérabilités (dépendances transitives), à trier.
