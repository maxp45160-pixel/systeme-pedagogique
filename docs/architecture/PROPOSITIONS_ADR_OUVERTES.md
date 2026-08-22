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

Le fait qu'une hypothèse reste 🔬 ne constitue pas un chantier à construire par
anticipation. Elle porte son test de réfutation et attend les données prévues.
