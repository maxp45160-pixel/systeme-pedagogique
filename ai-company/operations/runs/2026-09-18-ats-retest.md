# ATS — nouvel essai après P01-0006

Le 18/09/2026, après livraison de la correction locale et indication qu'un prochain essai réel doit être autorisé, Maxime demande « reteste ». Cet accord renouvelle une tentative unique de synthèse Mistral sur les 13 transcriptions ATS existantes, aux mêmes conditions : maximum 0,423 €, aucun OCR nouveau, aucun classement appliqué et aucun réessai automatique. Devis relu après actualisation de la page pour prendre le nouveau contrat sourceId.

Ressource : depot-7119baf3ddf77ecb24bcf980e6bbd319. Base de synthèse : cafc3136-d39e-49ef-9861-8565c9f32072. Lancement unique via Réessayer ; résultat à vérifier avant toute autre action.

Lancement constaté à 16:33:24 UTC : analyse 59b47ca5-5879-490a-91be-a2c1c823246f, tentative 28ecfa81-caec-4c9a-8987-b85e26d368b2. État en-cours et 13 pages conservées vérifiés en lecture seule dans Supabase. Ne pas répéter le clic en cas d'interruption de la tâche.

## Résultat vérifié

Échec à 16:33:49 UTC, après un seul POST /api/depot/analyser de27,1secondes. Erreur : citation absente du passage désigné page2, citation proposée « Simplifier: pour b et c non nuls, (a×c)/(b×c) = a/b ». Lecture seule de la transcription page2 : la règle de simplification y figure, mais avec les délimiteurs mathématiques et commandes LaTeX frac/times. La réponse a réécrit la notation au lieu de recopier un extrait exact. Ce refus reste fondé au contrat de citation exacte ; il ne démontre ni une erreur mathématique ni un mauvais numéro pour ce passage précis. L'absence de sortie brute conservée ne permet pas de conclure sur les autres propositions.

Une seule opération de coût pour la tentative, suffixe restitution ; aucun OCR. Réservation296493micro-EUR, coût rapproché116694micro-EUR, soit0,116694€, sous le plafond0,423€. Ce coût applicatif n'est pas une facture fournisseur indépendante.

13pages conservées ; restitution de cette tentative absente ; l'interface garde les résultats antérieurs, le brouillon Mathématiques et les deux anciennes compétences sélectionnées. Aucun clic sur Appliquer ce choix, aucun classement ni compétence créés par cet essai. Aucun deuxième essai lancé ; autorisation consommée.

Constat : la correction des références ne suffit pas à obtenir une restitution acceptée sur cet essai réel. Piste encore proposée : faire sélectionner des passages identifiés dont la citation serait extraite côté serveur, pour éviter la recopie des formules. Ni assouplissement de validation ni nouvelle réalisation dans cette tentative.
