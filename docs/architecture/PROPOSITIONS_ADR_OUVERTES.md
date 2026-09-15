# Propositions d’architecture ouvertes

Les décisions et leurs statuts vivent dans [le registre ADR](../../ARCHITECTURE_DECISIONS.md).
Ce fichier conserve les arbitrages non rendus, sans leur attribuer de numéro ADR.

## Proposition — calendrier externe limité au free/busy et aux séances acceptées ❓

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
