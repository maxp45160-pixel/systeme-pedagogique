# Situation — point d'entrée Chief of Staff

Déclencheur : « Où en est Twiny ? », bilan, prochaine action ou reprise du projet.
Lecture seule par défaut ; un bilan ne lance aucun chantier.

## Entrées et collecte

1. Lire [Chief of Staff](../agents/chief-of-staff.md) et
   [contrat commun](../agents/common.md).
2. Lire l'état courant de [PRODUCT](../../PRODUCT.md), les
   [priorités](../company/priorities.md) et l'[état institutionnel](../company/current-state.md).
3. Collecter `git status --short`, `git log -8 --date=short --format=...`,
   `git diff --stat` et `git diff --cached --stat`. Inclure les fichiers non
   suivis et suppressions. Les diff statistiques ne disent pas ce que fait une fonction.
   [Le collecteur local](../scripts/context.mjs) exécute ces commandes en lecture
   seule avec un format défini : `node ai-company/scripts/context.mjs`.
4. Lire seulement les signatures/types/imports utiles et les décisions pertinentes
   avec leurs amendements ; consulter le registre actif du travail récent.
5. Examiner [problèmes](../operations/known-problems.md),
   [dette](../engineering/technical-debt.md), [hypothèses](../research/hypotheses.md),
   résultats de checks datés et contraintes explicites du fondateur.

Un résultat de test historique n'est pas relancé par sa lecture. Ne pas lancer
automatiquement un test payant, un contrôle DB ou un déploiement pour produire
ce bilan. Si une preuve technique nécessaire est accessible, la vérifier avec
les outils appropriés ; sinon limiter la conclusion et proposer ce contrôle.

## Synthèse attendue

```markdown
# Twiny — Situation

Date et périmètre du relevé ; branche, HEAD, état local, validations exécutées.

## Objectif actuel

Priorité humaine et source ; si inconnue, l'indiquer puis distinguer la recommandation.

## Ce qui a changé

Travail committé, changements locaux et effets documentés, séparément.

## État actuel

Ce qui est constaté dans le code ; ce qui est testé ; état déployé connu/inconnu ;
ce qui reste une cible ou une hypothèse. Citer les sources utiles.

## Risques

Au plus les risques qui changent la prochaine action, avec fait déclencheur,
impact et preuve manquante ; inclure la dette pertinente.

## Décisions nécessaires

Question précise, options, recommandation, coût d'attendre. « Aucune » si rien
ne demande un arbitrage. Ne pas réouvrir un accord déjà donné.

## Priorités recommandées

1. Problème → preuve → action bornée → résultat attendu.
2. Seulement si une deuxième action apporte quelque chose.
3. Seulement si utile ; pas de liste de features par défaut.

## Agent à consulter ensuite

Un rôle, une question bornée, les sources à lui donner et son apport attendu,
ou « Aucun : la prochaine action reste simple ».
```

## Sortie et contrôle

Restituer une réponse à la décision, pas un inventaire de fichiers : expliquer
pourquoi l'action proposée est préférable au vu des preuves et ce qui ferait
changer la recommandation. Conserver les désaccords. Un état sauvegardé est un
relevé daté, jamais une priorité validée par défaut. Ne mettre à jour la mémoire
que si demandé ou nécessaire au chantier autorisé, avec sources et date.

Avant de conclure : aucun résultat de test, déploiement, usage ou décision
humaine inventé ; aucun statut promu ; limites de la vérification explicites.
