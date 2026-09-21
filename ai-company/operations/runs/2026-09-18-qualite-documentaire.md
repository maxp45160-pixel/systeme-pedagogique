# Qualité documentaire générique — 18/09/2026

## Mandat et plan

Maxime recadre : « le livret ATS c un test [...] Faut traiter le générique ».
Il approuve par « parfait, fais ça » la recette multi-matières/types de documents,
la correction des causes communes et la correction ciblée sans réanalyse ni perte
des choix antérieurs. ATS reste un cas de régression, aucun classement à appliquer.
Aucun appel payant, nouvelle dépendance, migration, publication ou déploiement.

Base : master 536340d. Les deux fichiers P01-0009 sont préexistants et préservés.
P01-0010 possède les changements. Répartition : CTO corrections métier et store ;
QA recette, validation des répétitions et consignes fournisseurs ; coordinateur
interface, intégration et documentation. Aucun statut humain promu.

Plan : partager les consignes déjà prévues entre fournisseurs, refuser les
répétitions identiques sans les effacer silencieusement, conserver les corrections
humaines dans le brouillon existant lié à l'analyse et l'indice, puis vérifier
création/reprise/pérennité via tests et interface. Les citations originales ne
sont pas éditées. La qualité sémantique reste distincte des contrôles de forme.

## Résultat local

Les règles de pertinence sont désormais communes aux deux fournisseurs. Les
répétitions par code/intitulé normalisé sont refusées dans les nouvelles réponses,
sans suppression silencieuse ; la lecture historique préserve leurs indices.
Les devis V2 portent la version du contrat, les réussites antérieures restent
réutilisables sans relance. La recette vérifie explicitement ces frontières.

Une proposition nouvelle peut être corrigée isolément dans sa fenêtre : geste,
objet et précision, avec la citation et l'intitulé d'origine à portée de lecture.
« Conserver la correction » enregistre le brouillon et ses autres choix, sans
création ni appel IA. La confirmation réutilise l'intitulé corrigé, conserve sa
trace et reste protégée contre versions périmées, collisions et reprises doubles.
La correction reste affichable après confirmation, et n'est jamais transposée
par indice sur une nouvelle analyse. Sources, palier, importance et codes ne sont
pas éditables via cette commande. Les anciennes commandes sans correction restent
compatibles. Le brouillon accepte l'usage indéterminé déjà prévu par P01-0002.

## Recette représentative et limites

Le corpus `app/src/lib/documents/fixtures/qualite-documentaire.ts` contient
12 scénarios synthétiques : mathématiques (ATS comme simple régression),
philosophie, histoire, informatique, biologie, logistique et sujet indéterminé.
Il représente des notes, pages PDF et transcriptions d'image après OCR ; il ne
teste pas un OCR réel. Chaque cas distingue verdict technique et jugement de sens.

Les cas sans compétence et les ambiguïtés sont conservables. Doublons de codes,
titres canoniquement identiques et citation inventée sont refusés. Trois erreurs
de sens restent techniquement acceptables : domaine choisi par utilité abusive,
geste non démontré et recouvrement général/spécifique. Elles sont consignées comme
limites connues, pas corrigées par un prétendu filtre sémantique universel.

Pour éprouver le gain fournisseur : reprendre les mêmes supports de plusieurs
matières avant/après, identifier version/modèle/consignes, relever domaine justifié,
gestes couverts/manqués, propositions non étayées, recouvrements, effort de correction,
coût et durée. Les jugements des fixtures restent proposés, pas une vérité humaine
validée. Aucun essai réel payant réalisé ou planifié dans cette mission.

## Vérifications réalisées avant contrôle global

- CTO : 58 tests ciblés métier initialement ; extension du reçu et NFC vérifiée
  par 47 tests ciblés supplémentaires/rejoués. Ces nombres se recouvrent.
- QA qualité : 68 tests sur validation, corpus et requêtes fournisseurs simulées.
- Coordinateur : 29 tests orchestration (devis/historiques), puis 21 tests
  modale/lecteur historique. Les totaux ne sont pas additionnés.
- Revue indépendante : falsification, reprises, indices, versions et historique
  examinés ; 67 tests exécutés. Deux défauts reproduits puis corrigés : correction
  invisible après confirmation et doublons Unicode après correction humaine.
- Navigateur via CUA sur un banc local temporaire à deux matières : champ vide
  refusé ; source/original affichés ; saisie conservée après échec simulé ;
  correction d'une proposition sans modifier l'autre ; réouverture du composant ;
  retour à l'intitulé initial. Vérification visuelle du formulaire effectuée.
  La sauvegarde était simulée en mémoire ; la persistance serveur est couverte
  par les tests avec doubles, pas par une écriture sur le compte de Maxime.
  Banc supprimé et onglet fermé après recette.

Les résultats globaux effectifs et leur snapshot sont enregistrés dans P01-0010,
sans déduire leur réussite de ce rapport. Aucun effet externe ni déploiement.

## Coordination

Le mandat actuel reprend les quatre fichiers de brouillon encore réservés par
UX-0001. Sa tâche propriétaire a été relue : dernier tour terminé, aucune exécution
concurrente. Transfert limité consigné dans sa fiche, ancien blocage fournisseur
préservé. Les fichiers/tests de lecture du reçu ont été ajoutés au périmètre pour
la correction de traçabilité signalée par la revue.
