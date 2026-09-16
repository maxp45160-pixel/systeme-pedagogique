# P01-0001 — Livraison locale et preuves

16/09/2026. Base Git : `7b877169cd6154c15d91a37d4a844b018500dc3f`, plus diff local P01-0001. Checkout propre au démarrage ; aucun commit, push ou déploiement effectué.

## Résultat borné

[Mandat et accords humains](2026-09-16-p01-classification.md).
La réalisation applique uniquement la frontière confirmée : après la première analyse déclenchée d'une nouvelle ressource, rattacher le domaine vivant explicitement identifié et sourcé. La règle refuse les incertitudes détectées, les choix/brouillons/corrections antérieurs et les analyses remplacées. Elle ne crée ni domaine, ni compétence, ni lien de compétence, ni mesure.

L'assistant affiche la provenance et les points à contrôler. Chaque document s'applique indépendamment ; fermer ne valide rien. Les compétences ne sont pas précochées après délégation. Corriger le domaine seul n'ajoute donc pas ces compétences. Le retrait laisse l'original sans domaine et conserve un refus humain durable, même après réanalyse. Une création humaine recharge le référentiel pour la suite du contrôle sans effacer les saisies indépendantes.

L'écriture de délégation ne change que les cinq métadonnées de rangement ; titre, type, corps et liens sont conservés. Version attendue et relecture avant effet protègent le document. Une réponse perdue est relue, sans réécriture automatique ni appel IA. Aucun changement de schéma, permissions, configuration fournisseur ou budget.

## Revue indépendante

Explorateur natif : confrontation P-01/code, consommation des fonctions et protection des rangements existants. Worker natif : règle/action et tests sous propriété exclusive. QA native : deux défauts relevés puis corrigés (retrait impossible, référentiel périmé après création humaine) ; retour d'erreur du retrait rendu explicite. Contrôle du coordinateur : aucune présélection de compétences après délégation, retrait encore possible après réanalyse si le lien reste inchangé. Modèle et effort hérités ; aucune extension de l'essai compute.

## Vérification

Le résultat final des commandes et l'empreinte du checkout figurent dans [la fiche P01-0001](../missions/P01-0001.json). Les tests utilisent des données synthétiques et des lecteurs/écritures simulés. Les suites UI vérifient le rendu statique, les choix initiaux et l'appel après première lecture ; les suites d'action couvrent CAS, droits refusés, réponse perdue, retrait et refus durable.

## Limites et suite

- Pas d'essai fournisseur, de validation sur corpus réel, de navigateur authentifié ni de vérification distante Supabase. La pertinence sémantique n'est pas établie par la présence d'une citation ni par les tests.
- Incertitudes signalées traitées conservativement ; leur fréquence réelle et l'effort de correction restent à éprouver. Aucun seuil de qualité nouveau validé.
- Le CAS protège le document ; référentiel, analyse et corrections sont relus avant effet mais n'ont pas de transaction globale commune. Aucune garantie d'atomicité globale ajoutée.
- L'infrastructure actuelle de test est Node/SSR ; aucune bibliothèque DOM installée. Le trajet interactif complet dans le navigateur reste une recette d'usage à effectuer.
- Deux écarts P01-07 identifiés en lecture, hors tranche : le domaine de la première compétence prend parfois priorité à l'affichage sur le domaine déclaré (`vues-ressources-atelier.tsx`, `espace-documentaire.tsx`) ; les groupes sans nom peuvent faire disparaître une ressource des résultats de recherche. À traiter dans une tranche de restitution, sans rouvrir le cadrage général.
- Graphe notionnel, rapprochements transversaux et mémoire de compréhension non livrés. P-02 et plan restent ultérieurs. P01-0001 terminé localement ne signifie pas P-01 ni produit terminés.

UX-0001 conserve le fournisseur, les analyses et l'essai payant historique. Zéro appel fournisseur distinct initié pendant cette mission. Usage/coût Codex attribuable non disponible ; aucune économie chiffrée revendiquée.

Résultats finaux : `npm run verify --workspace=app -- --maxWorkers=2` passe : TypeScript, ESLint sans erreur (10 avertissements hors fichiers modifiés), 2 385 tests / 233 fichiers. `npm run agents:check` et `git diff --check` passent. Les avertissements de preuves historiques DIR-0001 sont conservés ; ils ne sont pas les preuves de P01-0001.
