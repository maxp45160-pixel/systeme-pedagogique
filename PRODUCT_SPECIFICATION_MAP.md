# PRODUCT_SPECIFICATION_MAP.md — la carte des briques

**Version 0.1 — 11/08/2026.** Complète `PRODUCT.md` (le *pourquoi*) et
`ARCHITECTURE_DECISIONS.md` (le *comment tranché*). Ce document dit **où vit
chaque brique** et **dans quel état elle est**.

Statuts, au sens de `PRODUCT.md` §0 : ✅ **construit et décidé** ·
🔬 **construit, hypothèse non réfutée** · ❓ **non construit, arbitrage ouvert** ·
🗑️ **écarté**.

> **Règle de lecture.** Une brique se range dans une couche. Une brique qui ne
> se range nulle part n'est pas une brique : c'est une envie. Elle descend en
> annexe avec son test de décision, pas dans le corps du document.

---

## Les six couches

| # | Couche | Question | Nature |
|---|---|---|---|
| **0** | Ce qu'elle **ignore** | Que refuse-t-elle d'affirmer ? | Garde-fou |
| **1** | Ce qu'elle **connaît** | Qu'est-ce qui est déclaré ? | Stocké, jamais calculé |
| **2** | Ce qu'elle **observe** | Qu'est-ce qui a été constaté ? | Stocké, jamais fabriqué |
| **3** | Ce qu'elle **décide** | Qu'en déduit-elle ? | Dérivé, recalculable |
| **4** | Ce qu'elle **fait faire** | Quel geste demande-t-elle ? | Interface |
| **5** | Ce qu'elle **fait des données** | Où vont-elles, qui y accède ? | Infrastructure |

L'ordre n'est pas décoratif : **1 et 2 ne se recalculent pas**, **3 ne se stocke
pas**. Toute brique qui viole cette frontière est un défaut, pas une variante.

---

## Couche 0 — Ce qu'elle ignore

La couche que le schéma visuel n'a pas, et qui porte l'identité du produit :
un instrument dont la fonction première est de **refuser d'affirmer ce qu'il ne
peut pas prouver**.

| Brique | Garantie | Code | Statut |
|---|---|---|---|
| Non mesuré ≠ zéro | Le score et la couverture portent sur les seules compétences mesurées | `engine/skill-state.ts`, `calculerEtatGlobal` | ✅ ADR-006 |
| Incertitude affichée | Niveau / confiance / robustesse sont trois axes distincts, jamais fondus en un chiffre | `domain/types.ts` (`Confiance`), `engine/maitrise.ts` | ✅ |
| Refus de recommander | Le moteur sait rendre « je ne recommande rien », avec sa raison | `engine/recommend.ts` (`RefusRecommandation`) | ✅ ADR-054 |
| Une faiblesse survit | Rien ne l'efface sans nouvelle démonstration | `engine/preuve.ts`, `engine/maitrise.ts` | ✅ P4 |
| Abandon ≠ mesure | Une tentative `abandonnee` ne produit aucune preuve | `domain/tentative.ts` | ✅ ADR-030 |
| Aucune comparaison entre comptes | Pas de classement, pas de benchmark | absence assumée | ✅ |

**À remplir :** la garantie « le tuteur n'écrit aucune mesure » (P5, ADR-037)
est vraie dans le code mais n'est **visible nulle part dans l'interface**.
Question ouverte : faut-il la montrer à l'utilisateur, et où ?

---

## Couche 1 — Ce qu'elle connaît (déclaré)

| Brique | Contenu | Code | Statut |
|---|---|---|---|
| **11. Modèle de connaissances** — référentiel | `Domaine`, `Skill` (palier, importance, `active`, `archive`) ; propriété du compte, démarrage à vide | `domain/referentiel.ts`, `domain/referentiel-compte.ts` | ✅ ADR-026 |
| **11.** Thèmes / sous-thèmes | Portée modulaire pour composer une séance libre | `domain/theme.ts`, `store/themes.ts` | 🔬 ADR-055 |
| **11.** Notions / noties | Niveau de granularité sous le thème | — | ❓ non construit |
| **6.** Corpus d'exercices | Énoncé, données, indices, correction, critères par dimension, difficulté, `origine`, `intention` | `domain/exercice.ts` | ✅ |
| **5.** Besoin déclaré | Ce que la personne dit vouloir travailler — fait stocké, l'écart est dérivé | `domain/seance.ts` (`BesoinDeclare`) | ✅ ADR-050 |
| **8.** Protocoles du tuteur | Les instructions sont la spécification (P6) | `app/data/00_instructions/` | ✅ |
| **11.** Notes markdown liées (« tout est une note ») | Chaque entité éditable comme note reliée | — | ❓ non construit — arbitrage : sert-il la boucle ou est-ce un second produit ? |
| **1.** Widgets modulables du tableau de bord | Composition libre de l'accueil | — | ❓ non construit |

**Invariant de couche :** rien de dérivable ici (P1). Ni niveau, ni score, ni
date de prochaine révision.

---

## Couche 2 — Ce qu'elle observe (constaté)

| Brique | Fait observé | Code | Statut |
|---|---|---|---|
| **7. Performance & évidences** — tentative | `debut`, `fin`, `dureeMin`, `indicesUtilises`, `reponse`, `statut` | `domain/types.ts` (`ExerciseAttempt`) | ✅ |
| **7.** Évaluation assistée validée | Le tuteur propose critère par critère, la personne valide ; le champ ne s'appelle plus `autoEvaluation` | `domain/bilan.ts`, `formulaire-bilan.tsx` | ✅ ADR-046 |
| **7.** Aide extérieure reçue | Fait constatable (documentation / assistant IA / correction), pas une auto-note ; le moteur en dérive le palier d'autonomie | `domain/bilan.ts`, `PLAFOND_AIDE` | 🔬 ADR-033 / ADR-038 — barème jamais confronté à l'usage |
| **8.** Verdict du tuteur archivé | Ce qu'il proposait, conservé à côté de ce qui a été validé ; l'écart est une observation sur la personne | `domain/types.ts` (`VerdictTuteur`) | 🔬 ADR-046 |
| **7.** Preuve | Dimensions démontrées, `contexte` (condition du transfert), `source.{kind,ref}` obligatoire | `engine/preuve.ts`, `SkillEvidence` | ✅ P3 |
| **7.** Hésitations, stratégies utilisées | Promis par le schéma visuel | — | ❓ **non observable aujourd'hui** — arbitrage : instrumenter, ou retirer de la vision |
| **7.** Détection de triche | Promis par le schéma visuel | — | ❓ arbitrage — en tension avec la couche 0 : un système qui ne prouve pas ne doit pas accuser |
| **9.** Erreurs récurrentes / motifs | Le maillon manquant a été posé (verdicts archivés) ; la détection reste à écrire | `tutor/correction.ts` | ❓ partiellement construit |

**Invariant de couche :** aucune valeur sans source (P3). Une observation
absente reste absente — on n'en fabrique pas la valeur par défaut (P2).

---

## Couche 3 — Ce qu'elle décide (dérivé)

| Brique | Décision | Code | Statut |
|---|---|---|---|
| **9. Mise à jour du modèle** | Niveau, confiance, robustesse, couverture par compétence | `engine/skill-state.ts` | ✅ |
| **9.** Maîtrise | Prédicat dérivé (`NIVEAU_MAITRISE = 4`) ; l'évolution est proposée, jamais appliquée | `engine/maitrise.ts` | 🔬 ADR-042 |
| **5.** Calibration | `trop-facile` / `calibre` / `trop-difficile` / `non-tentee`, durée de référence observée, dimension la plus faible, difficulté visée | `engine/calibration.ts` | 🔬 ADR-045 |
| **5.** Révision espacée | Intervalle heuristique ; `estDue` | `engine/spaced.ts` (`modeleFsrs = null`) | 🔬 — le modèle FSRS a un emplacement réservé, aucune donnée ne justifie encore d'y passer |
| **5.** Recommandation + explication | `Recommandation` transporte ses `Facteur[]` : chaque conseil porte son « Pourquoi ? » | `engine/recommend.ts` | ✅ ADR-054 |
| **5.** Plan de séance | Composition par portée, séance étendue jamais recréée | `domain/seance.ts`, `engine/caf.ts` | ✅ ADR-048 / ADR-049 |
| **4.** Graphe de connaissances | Vue dérivée : nœuds typés, liens réels, aucune arête fabriquée | `domain/graphe.ts` | ✅ ADR-056 |
| **10.** Tendances longitudinales | Activité et évènements récents | `engine/historique.ts` | 🔬 partiel |
| **5.** Replanification automatique | Le système réorganise le plan sans geste humain | — | ❓ non construit — en tension avec « proposé, jamais appliqué » |
| **10.** Rapports hebdomadaires | Synthèse périodique poussée | — | ❓ non construit |

**Invariant de couche :** rien de tout ceci n'est stocké (P1). Le moteur reçoit
les compétences en paramètre — il ne connaît aucun référentiel.

---

## Couche 4 — Ce qu'elle fait faire

Navigation réelle : **trois pôles** (ADR-053), pas douze écrans.

| Brique | Geste demandé | Route | Statut |
|---|---|---|---|
| **1. Dashboard** — *Piloter* | Voir l'état global et déclencher la prochaine action | `/` | ✅ |
| **6. Session d'apprentissage** — *Travailler* | Composer, planifier, dérouler une séance | `/seances` | ✅ |
| **3. Profil & progression** — *Suivre* | Consulter l'état, gérer le référentiel | `/competences`, `/profil` | ✅ |
| **6.** Faire l'exercice puis son bilan | Le geste central de la boucle | `/seances`, `/exercices` (redirection) | ✅ |
| **8.** Demander au tuteur | Générer un lot d'exercices, étendre le référentiel, obtenir une correction | `/tuteur` | ✅ ADR-004 / ADR-037 |
| **2. Workspace focus** | Environnement sans distraction pour l'exercice en cours | — | ❓ non construit — arbitrage : mode dédié, ou le déroulé de séance suffit-il ? |
| **10. Reporting long terme** | Écran de recul, distinct du tableau de bord | `/progression` (redirection) | ❓ non construit comme écran propre |
| **4.** Graphe navigable / éditable | Explorer le savoir, éditer depuis le graphe | `/competences` (vue graphe) | 🔬 lecture seule |

**Gestes refusés par conception :** saisir une mesure sans source, s'auto-noter
en autonomie, se comparer à autrui.

---

## Couche 5 — Ce qu'elle fait des données

| Brique | Règle | Code | Statut |
|---|---|---|---|
| **12.** Source de vérité | Supabase/PostgreSQL ; `app/supabase/schema.sql` fait référence | `lib/supabase/` | ✅ |
| **12.** Autorisation | RLS est la seule barrière de confiance ; `service_role` jamais côté client | politiques SQL | ✅ |
| **12.** Isolation par compte | Toute clé de stockage navigateur est préfixée par le compte | `store/` | ✅ |
| **12.** Journal immuable | Archivage, jamais suppression, dès qu'il existe une preuve ou une tentative | `store/actions.ts` | ✅ ADR-027 / ADR-047 |
| **12.** Validation d'entrée | Les données venant de Supabase sont validées avant d'entrer dans le moteur | `store/supabase-backend.ts` | ✅ — leçon du 02/08 (`difficulte` en `TEXT`) |
| **12.** Contexte du tuteur | Fenêtre bornée (~12 K jetons/message) | `tutor/fenetre.ts`, `tutor/contexte.ts` | ✅ ADR-007 |
| **12.** Export du compte | Sortie complète des données | `store/export.ts` | ✅ P8 confidentialité |
| **12.** Analytics / modèles prédictifs | Promis par le schéma visuel | — | ❓ non construit — arbitrage : incompatible avec « aucun partage sans consentement explicite » tant que la finalité n'est pas écrite |
| **12.** Import/export Obsidian, PDF | — | — | ❓ non construit |

---

## Ce qui reste à remplir, par ordre de blocage

1. **Couche 2, aide extérieure** — refermer P8 en ✅ demande une décision
   humaine sur le barème `PLAFOND_AIDE`, pas une relecture de code.
2. **Couche 2, hésitations / triche** — instrumenter ou retirer de la vision.
   Tant que c'est dessiné mais absent, le schéma promet ce que le produit ne
   tient pas.
3. **Couche 3, motifs d'erreur** — les verdicts sont archivés depuis ADR-046 ;
   la détection reste à écrire. C'est la brique 9 la plus proche d'exister.
4. **Couche 1, granularité** — thème / sous-thème / notion : deux niveaux
   existent, le troisième est dessiné. Trancher avant d'écrire du code.
5. **Couche 4, Workspace focus** — décider si c'est un écran ou une propriété
   du déroulé de séance.

---

## Annexe — briques du schéma sans couche

Aucune promesse n'est faite ici. Chacune porte le test qui déciderait de la
construire.

| Brique | Test de décision |
|---|---|
| Notes markdown liées partout | Un usage réel bute-t-il sur l'impossibilité d'annoter ? |
| Widgets modulables | Deux utilisateurs veulent-ils réellement des accueils différents ? |
| Replanification automatique | Un plan proposé est-il ignoré assez souvent pour justifier qu'il se réécrive seul ? |
| Rapports hebdomadaires | La vue longitudinale existante manque-t-elle à l'usage ? |
| Benchmarks / comparaisons | 🗑️ Écarté — en tension directe avec le principe fondateur (`PRODUCT.md` §2). |
