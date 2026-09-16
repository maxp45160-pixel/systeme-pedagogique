# P01-0001 — Première tranche de classement délégué

Mandat humain du 16/09/2026, tâche 01a0ab48-a27f-7453-ac53-3b8d3407eae7.
Maxime demande de reprendre DIR-0001, confronter P-01 au code puis réaliser une tranche locale avec tests. Aucune dépense nouvelle, permission ni publication.
Réponses explicites suivantes : « Oui, commencer par cette frontière limitée » (nouvelle ressource vers domaine existant explicitement identifié ; compétences, nouveautés, ambiguïtés et choix antérieurs à contrôler) et « Oui, transférer le classement et sa documentation » depuis UX-0001.

## Confrontation et plan borné

Le parcours courant passe par ressources-conversation.tsx puis modale-ressources.tsx et classement-ressources-actions.ts. L'analyse ne classe pas ; la confirmation globale prévalide tout le lot. organisation-assistant.ts calcule seulement les alertes à la lecture. Les sources, analyses conservées, versions de document et origine du rangement existent déjà. Le graphe notionnel cible n'est pas construit.

1. Réutiliser ces contrats pour un rattachement de domaine seul après la première analyse d'une nouvelle ressource. Aucune création ni association automatique de compétence.
2. Refuser l'automatisme en présence de choix/brouillon/correction antérieurs, d'une analyse remplacée ou incertaine, d'un domaine absent ou non explicitement identifié. Présenter les points restant à contrôler.
3. Appliquer les choix humains par ressource, permettre correction et fermeture sans validation globale ; préserver les originaux.
4. Tests locaux avec données synthétiques : branchement, refus, version concurrente, reprise d'une réponse perdue et ressources indépendantes. Vérifier types/lint/tests et documenter les limites.

Ce découpage applique l'accord limité ; il ne valide ni les seuils de qualité réelle, ni une taxonomie nouvelle, ni la création déléguée de domaines/compétences, ni P-02. L'essai fournisseur demeure réservé UX-0001.
