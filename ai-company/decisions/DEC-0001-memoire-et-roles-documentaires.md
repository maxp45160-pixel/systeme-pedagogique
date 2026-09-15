# DEC-0001 — Mémoire sourcée et rôles documentaires

> Périmètre d'exécution amendé après la demande complémentaire du 15/09 :
> des sous-agents natifs exécutent désormais les rôles. Le choix documentaire
> initial est conservé ci-dessous comme historique de proposition, sans promotion
> de statut. Contrat courant : [exécution native](../operations/native-agents.md)
> et [mandat complémentaire](../operations/mandate.md).

- Identifiant : DEC-0001
- Date : 2026-09-15
- Statut : proposed
- Auteur de la proposition : Codex
- Décideur : Maxime
- Validation humaine : aucune validation durable de cette adaptation
- Source de la validation : UNKNOWN / À VALIDER AVEC LE FONDATEUR
- Décisions liées : registre [ADR](../../ARCHITECTURE_DECISIONS.md) conservé

## Contexte

Maxime a demandé cette V1 dans le [mandat conservé](../operations/mandate.md).
L'[audit](../CURRENT_SYSTEM_AUDIT.md) trouve une vision et des ADR existants,
mais aucun rôle institutionnel partagé. La réalisation documentaire réversible
est autorisée ; cela ne constitue pas une validation de son utilité future.

## Problème

Permettre la reprise et des analyses fiables sans multiplier les sources
normatives ni créer d'infrastructure multi-agent prématurée.

## Options étudiées

1. Conserver seulement les conversations : aucune création, reprise fragile.
2. Index Markdown sourcés, rôles et workflows exécutés par la session existante :
   entretien explicite, faible surface technique.
3. Rôles natifs persistants et orchestration : potentielle isolation des contextes,
   valeur supplémentaire et coût non mesurés ; condition de phase 8 non satisfaite.
4. Nouveau framework/cloud : disproportionné au besoin établi.

## Décision

**Proposition réalisée localement sous mandat, statut proposed conservé :**
option 2. Autorités produit/ADR inchangées ; DEC limité aux sujets d'organisation.
Routage naturel via AGENTS. Contrôles Node locaux à la demande, sans dépendance,
appel fournisseur ou écriture de synthèse automatique.

## Justification

Réutilise les mécanismes existants et permet les six usages minimaux du brief.
Le fondateur relit des analyses sourcées. Aucun besoin établi d'un framework.

## Conséquences

Les rôles restent des définitions, pas des processus indépendants. Les analyses
ne sont ni indépendantes statistiquement ni automatiquement contradictoires.
La mémoire doit être entretenue. Les contrôles mécaniques ne valident pas le sens.
Suppression/réduction du dossier et du routage possible sans migration produit.

## Éléments de remise en cause

Oublis de contexte mesurés malgré les fiches ; plusieurs tâches indépendantes
répétées pour lesquelles un spécialiste isolé détecte davantage d'erreurs à
coût acceptable ; entretien plus coûteux que son bénéfice. Étudier alors les
capacités natives actuelles, sans créer de framework par défaut.

## Historique

15/09/2026 : proposition Codex et implémentation réversible autorisée par le
mandat initial. Aucun statut humain accepté ajouté.
