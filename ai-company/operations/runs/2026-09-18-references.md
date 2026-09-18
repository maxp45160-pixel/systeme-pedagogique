# P01-0006 — Références aux passages

## Mandat et constat

Accord local de Maxime le 18/09 : « vas-y », après l'essai ATS échoué (voir 2026-09-18-ats-essai.md). Correction technique du rattachement des citations ; aucune nouvelle décision produit ni promotion du pilote. Reprise ciblée des six fichiers fournisseurs/préparation de UX-0001, autres réservations maintenues. MENAGE-0002 possède les documents pendant sa réalisation ; écritures coordonnées.

## Réalisation

Le serveur construit un catalogue temporaire de sources distinctes pour la note et chaque page. Mistral et Qwen reçoivent sourceId, nature, texte et incertitude ; ils ne reconstruisent plus pieceId/page. Leurs sorties sourceId+citation sont traduites à chaque emplacement (éléments, organisation, domaine, compétences), puis soumises au validateur métier existant. Identifiant absent/inconnu, repères mélangés ou pages d'entrée dupliquées : refus. Aucun déplacement de citation vers une autre page. Les structures enregistrées et les historiques ne changent pas.

La version du contrat entre dans toute nouvelle empreinte de préparation. Un ancien devis est refusé avant réservation. Une analyse historique déjà terminée reste consultable et ne redevient pas à lancer ; les transcriptions conservées restent réutilisables sur reprise explicite. Aucun OCR ou réessai fournisseur n'est déclenché par cette correction.

## Vérification et limites

76 tests ciblés passent à18:24 le18/09 : adaptation réelle des retours simulés Mistral/Qwen, toutes sources V2, notes/fichiers distincts, citation répétée ATS, repère incorrect, ancien devis, historique terminé et reprise de13pages sans OCR. TypeScript avait passé avant le dernier ajout de test ; la vérification finale du checkout et son empreinte sont enregistrées dans la fiche P01-0006.

Revue indépendante par qa_classement_nuit : aucun défaut bloquant ; maintien de la tolérance historique à un domaine omis demandé et corrigé avec régression. Premiers échecs locaux dus à des appels de tests mal typés et au type du nouvel adaptateur : corrigés avant la vérification finale.

La citation ATS est reproduite comme cas de test, pas comme preuve d'une réponse réelle améliorée. Le modèle peut encore choisir le mauvais identifiant ou produire une citation inexacte ; ces réponses restent refusées. La fidélité OCR et la pertinence du classement ne sont pas prouvées par la présence d'une citation. Aucun appel fournisseur réel, aucune dépense ni modification des données ATS dans P01-0006. Prochain essai réel à autoriser séparément ; pas de publication.
