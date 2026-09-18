# P01-0005 — Robustesse du classement documentaire

17/09/2026. [Mandat humain et périmètre](2026-09-17-p01-robustesse-mandat.md). Base `e9c6fc76c1866a4dee876e541bda8394abc0bd60` avec diff partagé préservé. Livraison locale uniquement ; aucune donnée du compte, aucun fournisseur, migration ou permission modifiés.

## Deux pertes de choix reproduites et corrigées

1. **Reprise écrasant un nouveau brouillon.** Une confirmation vers Mathématiques s'interrompt après réservation. La personne enregistre ensuite un brouillon Physique. Le rejeu de l'ancienne confirmation acceptait son reçu malgré la version périmée, appliquait Mathématiques et vidait le brouillon. L'identité précédente ne comparait que titre/type/domaine/compétences. La confirmation conserve désormais une empreinte des champs de choix préalables (brouillon et traces de rangement/référentiel). Une reprise interrompue refuse un changement de ces champs avant toute nouvelle écriture. Le brouillon initial inchangé reste reprenable.
2. **Lecture de versions différentes.** Le dépôt pouvait fournir v3 tandis que le Markdown lu séparément restait v2. Le contenu v2 était alors écrit avec un CAS v3, effaçant une correction de texte. `chargerChoix` exige désormais que les deux lectures portent exactement la même version avant de poursuivre. La garde équivalente existait déjà dans la délégation.

Les tests de régression ont été exécutés rouges avant modification de production : 18/20 passaient, les deux contre-exemples échouaient le 17/09 à 01:37. Après correction, ils passent. Le correctif est limité à `classement-ressources-actions.ts`, sans changement de domaine choisi, d'usage, de compétence ni de frontière de délégation.

Compatibilité : un reçu ancien sans empreinte peut reprendre si aucun champ de choix humain n'est présent. En présence d'un tel champ, il ne permet plus d'affirmer que le choix est inchangé : refus explicite, puis nouvelle confirmation avec la version relue. Le test de ce nouvel envoi utilise un domaine existant. Pour un domaine déjà créé par une ancienne confirmation partielle, le contrôle de collision existant reste applicable ; ce cas n'est pas présenté comme un nouveau domaine automatiquement recréable. Une confirmation déjà terminée ne consomme pas un nouveau brouillon et ne réécrit pas la ressource.

## Campagnes locales livrées

- `classement-resilience.test.ts` : le trajet nominal de rattachement à un domaine existant ou nouveau est relevé. Une panne ou un geste humain est ensuite injecté avant et après chaque accès au stockage de ce trajet. La reprise explicite doit converger, préserver le contenu et les choix humains, ne créer qu'un domaine au maximum et permettre un retrait durable. Les lectures sont des instantanés ; le double d'écriture applique un CAS et le double RPC un reçu idempotent. Le domaine du choix humain est vivant dans le catalogue synthétique.
- `corpus-groupe.proprietes.test.ts` : 12 combinaisons de catalogue/ordre, 32 entrées chacune, plus sept étapes de correction/retrait/disparition. Assertions d'identité (pas seulement titre), unicité, domaine explicite prioritaire, ordre stable des autres résultats, entrées gelées et absence de mutation. Domaines homonymes, inconnus et éléments hors corpus inclus.
- `retrouver-ressources.test.ts` : trois scénarios SSR supplémentaires couvrent titres homonymes dans Ressources/recherche et conservation des rôles hors corpus dans leur ordre.
- `classement-ressources-actions.test.ts` : sept régressions supplémentaires couvrent les deux défauts, le rejeu terminé, le brouillon initial inchangé, les reçus historiques et le retrait humain sans changement apparent de domaine/compétences.

Contrôle ciblé après intégration : **94 tests / 6 fichiers passent**, 17/09 à 01:41, 5,07 s. TypeScript a d'abord signalé une fixture Domaine incomplète et le frontmatter optionnel ; ces erreurs ont été corrigées, puis TypeScript est passé. La QA indépendante a relu le correctif et le banc de pannes et testé les cas de compatibilité. Aucun défaut de restitution supplémentaire démontré.

Les contrôles globaux finaux, leur date et leur empreinte sont consignés dans la fiche de mission P01-0005 ; ce rapport n'anticipe pas leur succès. Les autres modifications NUIT/P01 présentes dans le checkout ne sont pas attribuées à ce chantier.

## Frontières de preuve et suite

Les ports de stockage sont simulés ; les tests exécutent les véritables règles et actions, mais ne prouvent ni isolation transactionnelle PostgreSQL, ni qualité de classification d'un fournisseur, ni comportement complet du navigateur. La campagne de pannes parcourt les points du trajet nominal : ce n'est pas une exploration exhaustive de tous les entrelacements, comptes ou incidents multiples. La recette navigateur P01-0004 reste une preuve séparée.

PRODUCT (préservation des choix et brouillons) et ADR-145 (confirmation versionnée) ont été relus : le correctif restaure leurs garanties, sans nouveau contrat produit. Aucun statut humain promu, aucune dépendance installée, aucune publication. L'analyse réelle d'un nouveau support reste à réaliser sous autorisation distincte ; aucune donnée synthétique n'a été introduite dans le compte pour cette campagne.

Le sujet s'arrête après preuve locale et revue traitée ; pas de travail artificiel pour occuper la nuit ni de relance programmée.
