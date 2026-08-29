# Point ADR — décisions du 22/08/2026

Ce document remplace la liste de propositions du 21/08. La session Q/R a
validé ou réfuté les sujets ouverts ; les décisions humaines sont inscrites
dans `ARCHITECTURE_DECISIONS.md`.

## Décisions validées

- ADR-011 : `Exercise` est nécessaire à une séance et reste une entité durable.
- ADR-034 : seul un échec sévère bloque un exercice ; un `partiel` reste
  candidat et appelle un ajustement de difficulté.
- ADR-035, 036, 040, 041, 042, 044, 045, 046, 047 : règles validées telles
  qu'elles sont décrites dans le registre.
- ADR-065 : gouvernance transactionnelle et journal spécialisé du référentiel.
- ADR-083, 084, 085 : contexte par familles, prédictions datées et calibration
  prudente.
- ADR-105 : carte des savoirs versionnée dans le dépôt ; rattachement humain.
- ADR-007 : aucun fournisseur gratuit canonique ; le moteur reste configurable
  et le choix se valide par mesure.

## Décisions réfutées ou remplacées

- ADR-005 : le moteur n'est pas une file comme modèle produit ; il agit vers les
  intentions déclarées. La file reste une vue dérivée (ADR-066 et ADR-096).
- ADR-064 : le workspace documentaire n'est plus une surface autonome ;
  l'Atelier est la surface canonique (ADR-080 et ADR-103).
- ADR-069 : le journal générique d'actions, les lots documentaires et le seuil
  d'aperçu sont reportés. Seule l'interdiction pour l'agent d'écrire une mesure
  est conservée.
- ADR-081 : le porteur unique est remplacé par des tags multiples dans
  ADR-107.
- ADR-087 : la scission générale est abandonnée ; l'atomicité d'ADR-086 ferme
  le besoin de cette machinerie.
- ADR-106 : les sous-domaines lexicaux sont remplacés par la proposition
  hiérarchique d'ADR-107. Le module et son câblage sont retirés du code le
  23/08 ; ADR-107 est construite le même jour, et **reste ❓** — construire
  n'est pas trancher.

## Ce qui reste hypothétique ou ouvert

- ADR-082 : les relations proposées restent 🔬 jusqu'à démonstration d'une
  précision suffisante, d'une justification claire et d'un geste fluide.
- ADR-086 : l'atomicité est validée ; la détection automatique du référentiel
  reste 🔬 et ne fait que proposer.
- ADR-107 : le modèle des domaines comme tags hiérarchiques est validé sur le
  fond ; le nouveau système de nommage des compétences reste à décider.
- `PLAFOND_AIDE` (P8) : conserver documentation → A2, assistant IA → A1,
  correction → A0 sans modifier les seuils avant environ 20 bilans renseignés.

## Proposition ADR-140 — calendrier externe limité au free/busy et aux séances acceptées ❓

**Statut : proposition non validée.** Aucun fournisseur, aucune portée OAuth,
aucune politique de confidentialité et aucune stratégie d'infrastructure n'a
encore été validé humainement. Le lot 10 est donc bloqué avant code et avant
toute migration.

### Alternatives à trancher

- **Google Calendar** : lecture candidate `calendar.freebusy`, écriture à
  confirmer avec la portée la plus étroite compatible avec le cycle de vie des
  événements (`calendar.app.created` ou `calendar.events`). Voir la
  [référence free/busy Google](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
  et la [référence d'insertion d'événement](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
- **Microsoft Graph** : lecture candidate `Calendars.Read` via `getSchedule`,
  écriture candidate `Calendars.ReadWrite`. Voir [getSchedule](https://learn.microsoft.com/en-us/graph/outlook-get-free-busy-schedule)
  et [création d'événement](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0).
- **CalDAV/iCalendar** : interopérabilité et gestion des identifiants propres à
  chaque serveur ; à retenir seulement avec une politique de secrets explicite.
- **Aucun connecteur initial** : conserver les disponibilités déclarées dans
  Twiny ; option de repli la plus sobre en données.

### Invariants proposés (non acceptés)

- Le connecteur reste dans l'infrastructure, derrière une frontière dédiée ;
  le domaine et `lib/engine/` ne connaissent ni fournisseur ni jeton.
- La lecture est bornée au free/busy utile : aucun titre, corps, lieu ou invité
  n'est importé lorsque les plages occupées suffisent.
- L'écriture porte uniquement sur les `LearningSession` explicitement acceptées,
  avec un titre neutre (par exemple « Séance Twiny »), sans compétence, preuve
  ni diagnostic.
- Supabase reste la vérité Twiny ; identifiants externes, curseurs, jetons,
  webhooks et erreurs persistantes relèvent de l'infrastructure.
- Les événements externes sont des faits d'orchestration dédupliqués et
  révocables ; ils déclenchent au plus une proposition de replanification et ne
  deviennent jamais des observations.
- La révocation arrête la synchronisation et révoque/supprime le jeton selon la
  politique approuvée, sans supprimer les faits Twiny.
- Les consentements lecture et écriture sont explicites, isolés par compte et
  soumis au moindre privilège ; chiffrement, rotation, rétention et suppression
  des jetons doivent être décidés avant implémentation.

### Validations humaines requises avant le lot 10

1. Fournisseur retenu, calendrier cible (principal ou choisi) et fuseau.
2. Portées OAuth exactes et séparation éventuelle lecture/écriture.
3. Politique de confidentialité : catégories, rétention, chiffrement,
   rotation, suppression, sous-traitants et libellés de consentement.
4. Sémantique des modifications/suppressions externes, durée de conservation
   des faits d'orchestration et comportement de replanification.
5. Architecture callback/webhook, vérification des secrets, reprise, limites,
   réessais et besoin éventuel d'une migration additive.
6. Matrice de tests acceptée : consentement, droits compte, free/busy,
   doublons, édition/suppression, déconnexion, reprise après erreur et absence
   de donnée pédagogique sensible.

Cette proposition ne vaut pas décision et n'autorise ni code, ni migration, ni
écriture dans Supabase.

Le fait qu'une hypothèse reste 🔬 ne constitue pas un chantier à construire par
anticipation. Elle porte son test de réfutation et attend les données prévues.
