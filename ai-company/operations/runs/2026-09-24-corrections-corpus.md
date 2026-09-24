# Corrections du corpus — 24/09/2026

## Mandat

Après le rapport de tests sur le corpus public, Maxime demande : « apporte les corrections nécessaires ». Ce mandat couvre la correction des refus EPUB, la préservation des notations et la précision des propositions. L'activation du MIME EPUB déjà prévu dans la pièce jointe existante corrige le refus constaté, sans modifier RLS, droits ni plafond. Aucun réessai fournisseur payant, nouvelle dépendance ou déploiement frontend n'est compris.

## Plan et critères

- Découper les longues sections EPUB sous les bornes existantes, garder provenance et couverture.
- Préserver les notations prises en charge, signaler celles qui ne le sont pas.
- Renforcer la formulation transférable et sourcée des compétences sans certifier la qualité sémantique par des tests de prompt.
- Activer le MIME EPUB après vérification de l'état distant.
- Rejouer les lecteurs sur le corpus, les tests ciblés, la vérification globale et le build ; revue indépendante.

Source des défauts : [rapport](../../../docs/pilotes/RESULTATS_CORPUS_2026-09-22.md). Le seuil de moins de 5 % reste à mesurer avec des références humaines.

## Activation distante EPUB

Le 24/09, Supabase confirmait l’absence de migration EPUB et son refus dans la contrainte et le bucket. Migration `autoriser_epub_documentaire` appliquée avec succès, version distante `20260924084536`. Relecture SQL : contrainte et bucket acceptent `application/epub+zip`, bucket privé, plafond 10 485 760 octets, RLS active. Aucun droit ni contenu modifié. Schéma de référence local déjà cohérent ; pas de modification nécessaire. Changelog public Supabase et documentation Storage consultés avant application. Ceci atteste la configuration distante ; le frontend corrigé reste local.

## Corrections locales

- Lecteur EPUB v2 : découpage déterministe en parties de 50 000 octets UTF-8 maximum, conservation du chemin original et titre Partie n/N. La concaténation restitue exactement le texte normalisé, y compris caractères multioctets. Les bornes ZIP/XML, la tranche de 20 unités et son budget texte restent actifs ; le budget décompressé est partagé entre les lectures internes.
- CSS locale déclarée et positions inline : sous/suscriptions prises en charge sans inférence à partir du nom des classes. Une position visuelle top/bottom reste explicitement visuelle pour les fragments inline ; l’alignement des cellules et des blocs ne crée aucun marqueur de notation ; cascade complexe ou style inconnu reste une réserve. Aucun accès réseau du lecteur.
- MathML : transcription structurelle conservatrice. Une expression non prise en charge est signalée au sein du texte. Un marqueur généré seul ne constitue pas du texte source : la section reste non analysée, sans réservation ni restitution. Les formules graphiques et figures ne sont toujours pas lues dans un EPUB.
- Les anciennes transcriptions incompatibles avec les nouvelles notations sont rejetées par comparaison au texte, aux réserves et au repère extraits. Pas de réanalyse automatique à la réouverture.
- Contrat de proposition v3 partagé Mistral/Qwen : compétence transférable, restriction technique démontrée, geste équivalent ou abstention sourcée ; reformulation complète sous les bornes. Le parcours inspecté ne tronque pas objet/précision. La génération est une cause probable de « répons » dans C01, pas une conclusion démontrée faute de réponse brute fournisseur.

## Rejeu local et revue

C05, C06 et C07 passent le lecteur public corrigé. Résultats du 24/09 : C05 = 54 unités, C06 = 38 unités issues de 26 sections, C07 = 18 unités issues de 7 sections ; leurs maxima respectifs sont 39 055, 49 993 et 49 924 octets par unité. C05 conserve 35 des 44 expressions MathML sous forme structurelle et signale les 9 autres comme non transcrites. Les deux rejets dus aux longues sections sont levés. Les sorties de contrôle restent dans scratch/corpus-classification-2026-09-22 avec empreintes, sans remplacer les extractions historiques. Le cas C05 montre une lecture MathML partielle, explicitement signalée ; cela ne démontre aucune compréhension de ses figures.

QA indépendante : contrôles de source/cache, provenance des parties, validité des limites, UTF-8, CSS locale et MathML. Elle a reproduit puis fait corriger une section composée uniquement du marqueur d’omission ; un test d’orchestration vérifie l’absence d’appel fournisseur et de réservation. La revue a également fait supprimer l’ajout de marqueurs de position à chaque simple classe CSS, qui amplifiait inutilement le texte.

Les commandes finales et leurs résultats, datés et liés au snapshot du checkout, sont enregistrés dans [la fiche P01-0012](../missions/P01-0012.json), champs checks et completion. Vérifications requises : TypeScript, ESLint, totalité Vitest, build Next.js et agents:check. Les tests des consignes et les réponses simulées prouvent la composition du contrat et sa validation, pas l’exactitude sémantique du modèle.

## Limites et suite

Aucun appel réel OCR/classification n’a été lancé dans cette correction. Le réessai Mistral de C04 (HTTP 500) et la mesure des progrès sur C01/C02/C08 nécessitent une recette fournisseur explicitement autorisée ; aucun coût supplémentaire de fournisseur IA documentaire engagé. Le coût Codex n’est pas déduit de ce constat. Aucun classement ni compétence du compte n’a été accepté ou modifié. La configuration distante EPUB est vérifiée ; aucun nouveau téléversement ni déploiement frontend n’est revendiqué. Le seuil de moins de 5 % n’est pas certifié.
