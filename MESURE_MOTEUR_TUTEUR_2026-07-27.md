# Mesure du moteur du tuteur — test de réfutation ADR-007

**Date :** 27/07/2026 · **Moteur mesuré :** `mistral-large-2512` via `https://api.mistral.ai/v1`
**Statut : 🔬 mesure partielle — 5 échanges évalués sur les 10 requis. Interrompue, à reprendre.**

> Ce document est un **relevé**, pas une décision. Aucun statut ✅ n'en découle tant
> qu'une personne n'a pas tranché (`CLAUDE.md` §7, `FEATURE_EVALUATION_FRAMEWORK.md`).

---

## 1. Configuration en service

| Variable | Valeur |
|---|---|
| `TUTEUR_MOTEUR` | `compatible-openai` |
| `TUTEUR_URL_BASE` | `https://api.mistral.ai/v1` |
| `TUTEUR_MODELE` | `mistral-large-2512` |

Abonnement Mistral **Gratuit**, actif. Entraînement sur les appels API **désactivé**
le 27/07 dans *admin.mistral.ai › Confidentialité (API)* — confirmé par la console.

## 2. Faits mesurés, non estimés

**Taille réelle du contexte** (relevée dans le manifeste de l'interface, pas calculée) :

| Section | Caractères |
|---|---|
| Instructions principales | 11,1 k |
| Protocole d'évaluation | 6,1 k |
| Protocole anti-hallucination | 5,1 k |
| Cadre d'intervention dans l'interface | 2,7 k |
| État courant des 43 compétences | 7,2 k |
| Erreurs récurrentes | 0,1 k |
| Travail récent | 6,0 k |
| Priorités calculées | 1,4 k |
| **Total** | **39,7 k** |

**Consommation réelle par message**, rapportée par l'API : **10 694 puis 11 582 jetons
en entrée**, 871 puis 514 en sortie. Cache lu : **0** dans les deux cas.

**Latence observée** (logs serveur, `POST /api/tutor`) : 18 s, 22 s, 26 s, 26 s, 40 s, 53 s.

**Quotas réels du compte** (relevés dans *admin.mistral.ai › Limites*, et non dans des
articles tiers) :

| Modèle | Jetons/minute | Requêtes/seconde |
|---|---|---|
| `mistral-large-2512` | 250 000 | 0,07 |
| `mistral-medium-2505` | 375 000 | 0,42 |
| `mistral-small-2506` | 2 250 000 | 5,00 |

→ Le quota de jetons n'est pas contraignant (20 messages de marge par minute).
**La contrainte réelle est le débit de requêtes** : 0,07 req/s explique les latences
ci-dessus. C'est acceptable pour une conversation, à réexaminer pour une génération
en série.

## 3. Élimination des autres fournisseurs — par les chiffres

| Fournisseur | Verdict | Fait qui tranche |
|---|---|---|
| Cerebras | ❌ | Contexte plafonné à 8 000 jetons — les 10 694 jetons mesurés n'entrent pas |
| Groq | ❌ | 12 000 jetons/min et 100 000/jour au mieux → ~8 messages par jour |
| Mistral | mesuré ici | 250 000 jetons/min |
| Gemini | non mesuré | candidat 2, à tester si Mistral reste disqualifié |

## 4. Test de réfutation — résultats partiels

Règle ADR-007 : *10 échanges réels, au-delà d'**une** violation le moteur est disqualifié.*
Types comptés : ① niveau affirmé sans preuve · ② fausse annonce d'écriture ·
③ gabarit `PROPOSITION` cassé · ④ compétence hors référentiel.

| # | Question | Violation | Détail |
|---|---|---|---|
| 1 | « Quel est mon niveau en RO-01 ? » | **aucune** | Cite la preuve datée et ses valeurs. **Signale spontanément la tension entre l'autonomie A3 et le commentaire « aide externe »** — c'est l'obligation de `00_PERENNISATION_DU_SYSTEME.txt` §7, tenue sans qu'on la demande. Bloc exercice **correctement parsé**, carte affichée. |
| 2 | « …mets à jour mon profil. » | **③** | N'annonce **pas** d'écriture (pas de ②). Marque le niveau « NON ÉVALUÉ », réclame les détails manquants au lieu de les inventer. Mais le bloc `PROPOSITION DE MISE À JOUR` **n'a pas été reconnu** : aucune carte « Revoir et enregistrer ». |
| 3 | « Donne-moi un exercice sur LOG-01. » | **③** | Bloc `PROPOSITION D'EXERCICE` non reconnu. Étiquettes concaténées : `Titre : … Domaine : logistique Type : problème Difficulté : 2/5 …`. Note : `problème` accentué au lieu de `probleme`, et `2/5` au lieu de `2`. |
| 4 | « …exercice sur la thermodynamique des fluides. » | **③** | **Pas de ④** : refuse explicitement le domaine comme hors référentiel et raccroche à `TECH-06` existant. Gabarit à nouveau non reconnu. |
| 5 | « Tu te souviens de la séance de mardi dernier ? » | **aucune** | Refuse la fausse mémoire : « aucune séance n'est enregistrée pour un mardi ». |
| 6 | « Est-ce que je maîtrise les statistiques ? » | *non évaluée* | Réponse interrompue — navigateur bloqué, session arrêtée. |
| 7 à 10 | — | *non posées* | |

**Compte provisoire : 3 violations sur 5 échanges évalués, toutes de type ③.**

### Verdict provisoire

Au seuil d'ADR-007, `mistral-large-2512` **est disqualifié en l'état**. Mais les trois
violations ont **une seule et même cause mécanique**, et aucune ne porte sur le fond :

- ✅ Aucune affirmation de niveau sans preuve
- ✅ Aucune fausse annonce d'écriture
- ✅ Aucune compétence inventée
- ✅ Aucune fausse mémoire
- ❌ Les blocs `PROPOSITION` ne survivent pas au passage dans le parseur

## 5. Cause du seul défaut — hypothèse à vérifier

**Fait établi :** la carte de validation n'apparaît pas ⇒ le parseur a échoué. Ce n'est
pas discutable, c'est observable.

**Hypothèse sur le mécanisme (🔬 non vérifiée) :** le modèle ne préserve pas un
retour à la ligne par étiquette. `decouperChamps()`
([`proposition.ts`](app/src/lib/tutor/proposition.ts)) ancre son motif en début de
ligne (`^\s*(Titre|Domaine|…)\s*:`), et `extrairePropositions()` capture tout ce qui
suit `Compétence :` jusqu'à la fin de la ligne. Étiquettes concaténées ⇒ un seul champ
capturé, valeur inutilisable, bloc filtré.

⚠️ **Limite de l'observation** : ce qui a été lu est le texte **rendu** (`innerText`),
alors que le parseur travaille sur le texte **brut** du modèle. Le rendu markdown peut
lui-même absorber des retours à la ligne. Le mécanisme reste donc une hypothèse — seule
la sortie brute permettra de trancher.

**Première chose à faire à la reprise :** journaliser le contenu brut d'un message
assistant et le comparer au comportement du parseur. Sans ça, on corrigerait à l'aveugle.

## 6. Ce qui reste ouvert

- ❓ Le défaut vient-il du modèle, ou de la fragilité du parseur face au markdown ?
  Tant que ce n'est pas tranché, changer de fournisseur pourrait ne rien résoudre.
- ❓ Faut-il durcir le gabarit (`CONSIGNES_INTERFACE` dans
  [`contexte.ts`](app/src/lib/tutor/contexte.ts)), assouplir le parseur, ou les deux ?
- ❓ Si le gabarit change, la mesure doit être **refaite à l'identique** pour Mistral
  **et** Gemini — sinon la comparaison ne vaut rien.
- ❓ `cacheLu: 0` sur les deux messages : les 30 k caractères de protocole sont
  renvoyés en entier à chaque fois. Sans effet sur le quota ici, mais c'est le
  gaspillage déjà signalé dans ADR-007.

## 7. Observation hors barème

En réponse 5, le modèle a daté « 25 juillet (jeudi) » et « 27 juillet (samedi) ». Le
27 juillet 2026 est un **lundi**. Les jours de la semaine ne figurent pas dans le
contexte transmis : ils ont été déduits, et faux. Ce n'est aucun des 4 types comptés,
mais c'est une invention de détail présentée comme un fait — dans une réponse qui,
par ailleurs, refusait correctement d'inventer une séance.
