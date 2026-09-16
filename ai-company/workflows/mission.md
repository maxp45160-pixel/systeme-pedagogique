# Cycle de mission — démarrage, reprise et clôture

Appliquer le [mandat](../operations/autonomy.md) à toute réalisation non triviale.
Une réponse simple garde une trace proportionnée et n'exige pas de créer un dossier.

## Entrée et sélection

1. Lire la demande active puis le mandat, la fiche de mission et les seules
   sources utiles. Relever Git ; garder les changements préexistants.
   `npm run agents:resume -- ID` rassemble les références sans les approuver.
   Lire aussi `progress` et `closedMissions` : une livraison antérieure peut
   changer la prochaine action. Appliquer le [contrat de continuité](continuity.md).
2. Pour une nouvelle demande, créer une fiche selon le
   [contrat des missions](../operations/missions/README.md), avec la source exacte
   de l'accord et des critères observables. Une découverte hors mandat reste
   proposée dans le backlog, jamais `ready` par simple recommandation.
   Pour une nouvelle réalisation produit, enregistrer les `planLinks` vers les
   exigences existantes et la contribution bornée avant de commencer.
3. Pour reprendre une file, exécuter `npm run agents:next`. Lire l'accord
   référencé ; la sélection ne valide pas son sens et ne réserve pas le travail.
4. Le coordinateur unique du checkout se désigne `owner`, passe la fiche en
   `running`, actualise `updatedAt`, puis lance `npm run agents:check` avant d'écrire.
   Si une autre tâche possède le travail, la consulter ou attendre sa restitution.
   Ne jamais voler une mission en se fondant sur l'âge du fichier.

## Travail et concurrence

Attribuer aux sous-agents des fichiers distincts ; un propriétaire unique écrit
chaque fiche et un responsable intègre le résultat. Les réalisations indépendantes
concurrentes utilisent des worktrees quand nécessaire. Dans un checkout partagé,
les écritures de registres sont sérialisées et les modifications d'autrui préservées.
Le validateur repère les chevauchements déclarés ; ce n'est pas un verrou atomique.
Pour les fiches existantes, préférer la [mise à jour conditionnelle](../operations/missions/README.md#mise-à-jour-et-preuves-du-checkout--extension-dir-0001) ; son verrou
ne protège pas les fichiers produit ni les éditeurs qui le contournent.

Une anomalie du produit n'autorise pas à reprendre le chantier d'une autre tâche.
Rapprocher le diff, l'environnement testé et les preuves avant toute intégration.
Les tests passent sur la version livrée ; une modification pertinente ultérieure
invalide leurs conclusions et exige les vérifications concernées.

## Point de reprise obligatoire

Après un résultat significatif, avant transfert ou interruption prévisible,
actualiser la fiche : dernière preuve, prochaine action, blocage éventuel,
fichiers possédés et effets externes accomplis ou de résultat incertain.
Préparer la transmission `handoff` quand des résultats existent : livré, reste,
preuves et état de déploiement distinct. Le coordinateur écrit sa fiche, les
sous-agents lui transmettent les preuves ; pas d'écriture concurrente du suivi.
La fiche conserve les accords déjà donnés ; ne pas les redemander à la reprise.
Vérifier un effet externe incertain avant de tenter de nouveau l'opération.

Après un échec, identifier code/raisonnement, contexte, environnement, quota ou
cause inconnue. Une reprise exige une hypothèse ou un contrôle nouveau. En
l'absence de progrès, passer en `blocked` et expliquer la condition de reprise.
Ce statut n'autorise aucun changement de priorité ou dépense. Les travaux
indépendants autorisés peuvent continuer ; les chemins bloqués restent réservés
jusqu'à un transfert explicite ou une clôture.

## Vérification, clôture et suite

1. Exécuter les contrôles adaptés et la revue nécessaire. La fiche indique la
   commande, le résultat, la date et la révision testée (ou base + diff local
   décrit dans un fichier de preuve). Un test requis bloqué interdit `done`.
   Pour une nouvelle réalisation, fixer `verificationVersion: 1` et
   `requiredChecks`, capturer le snapshot avant vérification et comparer après.
   Clore avec `missions.mjs update`, qui refuse une empreinte périmée.
   Renseigner `handoff` avant ces contrôles pour les missions liées au plan.
   `agents:check` vérifie aussi les références d'exigences ; une transmission
   manquante interdit leur clôture, sans promouvoir de statut produit.
2. Mettre à jour documentation, preuve et index touchés. Les index renvoient
   aux sources ; ils ne maintiennent pas un deuxième état détaillé de mission.
3. Inscrire le résultat et ses preuves dans `completion`, mettre `done` pour
   le périmètre réellement terminé ou `blocked` pour le travail indispensable
   restant. `cancelled` conserve le motif et la source de l'annulation.
4. Lancer `npm run agents:check`. Distinguer réalisation technique, livraison
   distante et validation humaine du produit dans la synthèse.
5. Si le mandat demande de poursuivre, sélectionner le prochain travail
   admissible ; sinon restituer le résultat. File vide : arrêter, sans inventer
   de tâches. Le déclenchement reste à la demande pendant cette V2.
