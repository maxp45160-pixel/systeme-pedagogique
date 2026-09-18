# ATS — essai du contrat de passages P01-0007

Le 18/09/2026, après livraison de P01-0007 et proposition du prochain essai réel, Maxime répond « vasy ». Accord renouvelé pour une seule synthèse Mistral des 13 transcriptions ATS, aux conditions déjà présentées : plafond 0,423 €, sans OCR nouveau, classement ni compétence appliqués, aucun réessai automatique. Devis vérifié après actualisation du navigateur avec passages-extraits-v1.

Ressource depot-7119baf3ddf77ecb24bcf980e6bbd319 ; base cafc3136-d39e-49ef-9861-8565c9f32072. Un seul clic Réessayer prévu, puis vérification du résultat et du coût. Aucun changement de code dans cet essai.

Lancement constaté à 16:51:48 UTC : analyse cfea2b62-9f20-40ea-88aa-711b02848fd4, tentative 3e894732-23ab-4b12-8757-f5be26592809. État en-cours, 13 pages conservées. Ne pas répéter le clic si cette tâche est interrompue.

## Résultat vérifié

Échec enregistré le 18/09 à 16:52:13 UTC. Une seule requête POST /api/depot/analyser, 26,9 secondes. Erreur : « La précision dépasse 24 caractères : ce n'est plus une précision, c'est une seconde compétence. »

Le code relu situe ce refus dans motifsRefusStructure, appelé pour une nouvelle compétence par validerOrganisationDepot. La traduction de tous les passageId et la validation des éléments de synthèse précèdent cette étape ; elles ont donc été franchies. La limite de 24 caractères est déjà transmise dans la consigne. Le fournisseur ne l'a pas respectée. La sortie brute rejetée n'est pas enregistrée : texte exact du champ fautif, nombre et validité des autres compétences inconnus. Cette longueur seule ne démontre pas réellement la présence de deux compétences, malgré la formulation du message.

Une opération restitution seulement, aucun OCR : réservation 367239 micro-EUR et coût rapproché 134904 micro-EUR, soit 0,134904 €, sous le plafond 0,423 €. Relevé Twiny, pas facture fournisseur indépendante.

Les 13 pages sont conservées, aucune restitution nouvelle persistée. Le navigateur conserve l'ancienne synthèse, le brouillon Mathématiques et les deux anciennes compétences sélectionnées. Aucun classement appliqué, aucune compétence créée, aucune relance. Autorisation consommée.

Conclusion bornée : cette tentative dépasse l'ancien blocage de recopie des citations, mais échoue sur une contrainte de proposition de compétence. Le succès bout en bout et la pertinence sémantique restent non validés. Une évolution vers des résultats partiels conservés ou une correction d'une seule proposition serait une modification du contrat de restitution à décider explicitement ; aucune troncature ni hausse de seuil effectuée ici.
