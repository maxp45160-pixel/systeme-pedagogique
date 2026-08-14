/**
 * Scanner de Parcours UX (User Journey) — Couche 3 (Décide).
 *
 * Contrairement au scanner AST qui analyse les routes du code source et les
 * imports, ce module dérive la **topologie réelle de l'expérience utilisateur** :
 *   1. Les sous-états visuels interactifs (Canvas 2D, Radars, Éditeur Markdown...)
 *   2. La boucle d'exercice en 3 actes (Chercher → Indices → Comparer → Mesurer → Bilan)
 *   3. Le studio et le workspace de séance (Concentration live, minuteur Pomodoro)
 *   4. Les déclencheurs d'interaction explicites (triggers, clics canvas, boutons)
 *   5. Le compagnon tuteur IA proactif et ses propositions structurées
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé de la logique métier, rien n'est stocké.
 * Les types du graphe restent dans `workflow-graphe.ts` (couche 1).
 */

import type {
  GrapheWorkflow,
  LienWorkflow,
  NoeudWorkflow,
} from "./workflow-graphe";

/**
 * Construit le graphe complet de parcours utilisateur et d'interaction (Perspective UX).
 */
export async function scannerUxJourney(): Promise<GrapheWorkflow> {
  const noeuds: NoeudWorkflow[] = [
    /* ══════════════════════════════════════════════════════════════════ */
    /* 1. CLUSTER DASHBOARD & PILOTAGE                                     */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "page:/",
      type: "page",
      groupe: "dashboard",
      libelle: "Dashboard & Pilotage",
      url: "/",
      badge: "Accueil",
      description: "Vue d'ensemble de la progression, indicateurs de maîtrise et carrefour d'actions rapides.",
    },
    {
      id: "ux:recommandation-active",
      type: "sous-vue",
      groupe: "dashboard",
      libelle: "Carte Prochaine Action",
      badge: "Moteur IA",
      description: "Proposition d'activité personnalisée issue du moteur de calibration.",
    },
    {
      id: "ux:refus-recommandation",
      type: "sous-vue",
      groupe: "dashboard",
      libelle: "Refus avec motif",
      badge: "Feedback",
      description: "Dialogue d'explication du refus (trop dur, trop facile, manque de temps).",
    },
    {
      id: "ux:pomodoro",
      type: "sous-vue",
      groupe: "dashboard",
      libelle: "Minuteur Pomodoro",
      badge: "Focus",
      description: "Cadencement en blocs de concentration de 25 min et pauses.",
    },
    {
      id: "ux:capture-rapide",
      type: "sous-vue",
      groupe: "dashboard",
      libelle: "Capture rapide de notes",
      badge: "Brouillon",
      description: "Saisie instantanée d'idées ou d'observations projetées dans l'Atelier.",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 2. CLUSTER ATELIER & MÉMOIRE DOCUMENTAIRE                           */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "page:/atelier",
      type: "page",
      groupe: "atelier",
      libelle: "Atelier Documentaire",
      url: "/atelier",
      badge: "Mémoire",
      description: "Espace central de visualisation, documentation et exploration des compétences.",
    },
    {
      id: "ux:atelier-graphe",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Vue Graphe Canvas 2D",
      badge: "Constellation",
      description: "Graphe interactif d3-force des compétences, domaines et dépendances.",
    },
    {
      id: "ux:fiche-competence",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Compétence (Radar)",
      badge: "Maîtrise",
      description: "Radar de maîtrise, niveau estimé, historique des preuves et actions rapides.",
    },
    {
      id: "ux:fiche-domaine",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Synthèse Domaine",
      badge: "Couverture",
      description: "Taux de complétion du domaine et liste des compétences associées.",
    },
    {
      id: "ux:dossier-transversal",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Explorateur Documentaire",
      badge: "Arborescence",
      description: "Arbre de dossiers des notes, thèmes et fiches supports.",
    },
    {
      id: "ux:editeur-note",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Éditeur Markdown de Note",
      badge: "Markdown",
      description: "Mode lecture / édition Markdown, sauvegarde et versions figées (snapshots).",
    },
    {
      id: "ux:panneau-contexte",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Volet Contexte & Liaisons",
      badge: "Relations",
      description: "Liaisons bidirectionnelles entre fiches et pièces jointes PDF.",
    },
    {
      id: "modal:ajouter-des-competences",
      type: "modal",
      groupe: "atelier",
      libelle: "Ajouter des compétences",
      description: "Formulaire d'ajout de compétences au référentiel du compte.",
    },
    {
      id: "modal:reviser-domaine",
      type: "modal",
      groupe: "atelier",
      libelle: "Réviser le domaine",
      description: "Sélection d'exercices ciblés pour consolider un domaine fragile.",
    },
    {
      id: "modal:editer-competence",
      type: "modal",
      groupe: "atelier",
      libelle: "Éditer la compétence",
      description: "Modification du libellé, description et statut d'une compétence.",
    },
    {
      id: "modal:validation-branche",
      type: "modal",
      groupe: "atelier",
      libelle: "Validation de branche",
      description: "Validation et intégration d'une branche de compétences proposée par l'IA.",
    },
    {
      id: "modal:nouveau-document",
      type: "modal",
      groupe: "atelier",
      libelle: "Nouveau document",
      description: "Création d'une nouvelle note ou fiche d'apprentissage.",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 3. CLUSTER SÉANCES & CONCEPTEUR                                     */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "page:/seances",
      type: "page",
      groupe: "seances",
      libelle: "Cahier de séances",
      url: "/seances",
      badge: "Cahier",
      description: "Historique des séances réalisées, file d'attente et point d'entrée studio.",
    },
    {
      id: "ux:concepteur-seance",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Concepteur de Séance",
      badge: "Studio",
      description: "Composition sur mesure : choix des thèmes, ordre des exercices et temps estimé.",
    },
    {
      id: "ux:workspace-seance",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Workspace Séance en direct",
      url: "/seances?session={id}",
      badge: "Live",
      description: "Mode concentration plein écran, jauge d'avancement et carrefour d'exercices.",
    },
    {
      id: "ux:seance-bilan",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Bilan de Séance",
      badge: "Clôture",
      description: "Calcul de l'écart besoin/réalisé et synthèse du temps passé.",
    },
    {
      id: "modal:composer-une-seance",
      type: "modal",
      groupe: "seances",
      libelle: "Composer une séance",
      description: "Assistant guidé de création d'une nouvelle séance d'entraînement.",
    },
    {
      id: "modal:ajouter-un-theme",
      type: "modal",
      groupe: "seances",
      libelle: "Ajouter un thème",
      description: "Création ou ajout d'un thème à la séance en cours de composition.",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 4. CLUSTER BOUCLE D'EXERCICE (3 ACTES)                              */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "page:/exercices/{id}",
      type: "page",
      groupe: "exercice",
      libelle: "Vue Exercice",
      url: "/exercices/{id}",
      badge: "Parcours",
      description: "Conteneur du parcours pédagogique en 3 actes et affichage des tentatives antérieures.",
    },
    {
      id: "ux:exercice-chercher",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 1 : Chercher",
      badge: "Résolution",
      description: "Résolution autonome, énoncé, chronomètre actif et zone de brouillon.",
    },
    {
      id: "ux:exercice-indices",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Déblocage d'indices",
      badge: "Échafaudage",
      description: "Révélation échelonnée des indices 1..N avec ajustement de la calibration.",
    },
    {
      id: "ux:exercice-abandon",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Abandon de tentative",
      badge: "Régulation",
      description: "Arrêt explicite ou dérivé (< 25% durée) sans fabriquer de fausse mesure.",
    },
    {
      id: "ux:exercice-comparer",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 2 : Comparer",
      badge: "Correction",
      description: "Révélation de la solution officielle et confrontation avec la production.",
    },
    {
      id: "ux:exercice-mesurer",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 3 : Mesurer",
      badge: "Auto-évaluation",
      description: "Bilan assisté, critères de réussite, charge mentale et ressenti.",
    },
    {
      id: "ux:exercice-bilan-final",
      type: "etape",
      groupe: "exercice",
      libelle: "Bilan & Preuve forgée",
      badge: "Preuve",
      description: "Preuve immuable enregistrée, niveau de maîtrise actualisé et choix de la suite.",
    },
    {
      id: "modal:editer-exercice",
      type: "modal",
      groupe: "exercice",
      libelle: "Éditer l'exercice",
      description: "Modification du contenu pédagogique (si aucune preuve enregistrée).",
    },
    {
      id: "modal:generer-exercice",
      type: "modal",
      groupe: "exercice",
      libelle: "Générer un exercice",
      description: "Génération automatique d'un nouvel exercice par le moteur d'IA.",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 5. CLUSTER COMPAGNON TUTEUR IA                                      */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "ux:tiroir-tuteur",
      type: "tiroir",
      groupe: "tuteur",
      libelle: "Tiroir Tuteur IA",
      badge: "Omniprésent",
      description: "Compagnon conversationnel guidé, accessible en surimpression sur tout écran.",
    },
    {
      id: "ux:tuteur-modes",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "6 Modes Rapides",
      badge: "Amorces",
      description: "Explique-moi, Évalue-moi, Indice, Corrige mon raisonnement, Lacunes, Projet.",
    },
    {
      id: "ux:tuteur-suggestion-exercice",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion d'exercice",
      badge: "Génération IA",
      description: "Proposition d'exercice complet généré par l'IA dans le flux du chat.",
    },
    {
      id: "ux:tuteur-suggestion-branche",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion de branche",
      badge: "Structure IA",
      description: "Proposition d'une arborescence de compétences à intégrer au référentiel.",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 6. CLUSTER PROFIL, SYNC & ACTIONS                                  */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      id: "page:/profil",
      type: "page",
      groupe: "profil",
      libelle: "Profil d'apprentissage",
      url: "/profil",
      badge: "Paramètres",
      description: "Définition du sujet d'étude, objectifs à long terme et calibrage.",
    },
    {
      id: "ux:profil-objectifs",
      type: "sous-vue",
      groupe: "profil",
      libelle: "Édition Sujet & Objectifs",
      badge: "Objectifs",
      description: "Formulaire de mise à jour des ambitions et du domaine principal.",
    },
    {
      id: "ux:tiroir-compte",
      type: "tiroir",
      groupe: "profil",
      libelle: "Tiroir Compte & Sync",
      badge: "Synchronisation",
      description: "Gestion de l'export JSON du journal, import et session utilisateur.",
    },
    {
      id: "page:/login",
      type: "page",
      groupe: "profil",
      libelle: "Authentification / Connexion",
      url: "/login",
      badge: "Accès",
      description: "Portail d'accès et authentification Supabase Auth.",
    },

    /* ── Actions / Mutations (Couche 1 / Effets) ── */
    { id: "action:demarrer-tentative", type: "action", groupe: "exercice", libelle: "Démarrer chrono" },
    { id: "action:debloquer-indice", type: "action", groupe: "exercice", libelle: "Débloquer un indice" },
    { id: "action:abandonner-tentative", type: "action", groupe: "exercice", libelle: "Abandonner tentative" },
    { id: "action:terminer-exercice", type: "action", groupe: "exercice", libelle: "Enregistrer la preuve" },
    { id: "action:creer-seance", type: "action", groupe: "seances", libelle: "Créer la séance" },
    { id: "action:demarrer-seance", type: "action", groupe: "seances", libelle: "Démarrer la séance" },
    { id: "action:terminer-seance", type: "action", groupe: "seances", libelle: "Clôturer la séance" },
    { id: "action:annuler-seance", type: "action", groupe: "seances", libelle: "Annuler la séance" },
    { id: "action:ajouter-note", type: "action", groupe: "seances", libelle: "Consigner note séance" },
    { id: "action:creer-note", type: "action", groupe: "atelier", libelle: "Enregistrer note Markdown" },
    { id: "action:creer-exercice", type: "action", groupe: "exercice", libelle: "Créer l'exercice IA" },
    { id: "action:creer-branche", type: "action", groupe: "atelier", libelle: "Valider branche compétences" },
    { id: "action:refuser-recommandation", type: "action", groupe: "dashboard", libelle: "Enregistrer refus" },
    { id: "action:modifier-profil", type: "action", groupe: "profil", libelle: "Enregistrer profil" },
    { id: "action:exporter-journal", type: "action", groupe: "profil", libelle: "Exporter journal JSON" },
    { id: "action:se-deconnecter", type: "action", groupe: "profil", libelle: "Déconnexion" },
  ];

  const liens: LienWorkflow[] = [
    /* ══════════════════════════════════════════════════════════════════ */
    /* 1. TRANSITIONS & TRIGGERS DASHBOARD                                */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/",
      target: "ux:recommandation-active",
      type: "interaction",
      libelle: "Afficher recommandation",
      declencheur: "Calcul automatique du moteur au chargement",
    },
    {
      source: "ux:recommandation-active",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Démarrer l'exercice",
      declencheur: "Clic 'Démarrer immédiatement'",
    },
    {
      source: "ux:recommandation-active",
      target: "modal:composer-une-seance",
      type: "ouverture",
      libelle: "Personnaliser en séance",
      declencheur: "Clic 'Personnaliser'",
    },
    {
      source: "ux:recommandation-active",
      target: "ux:refus-recommandation",
      type: "interaction",
      libelle: "Refuser la proposition",
      declencheur: "Clic 'Refuser avec motif'",
    },
    {
      source: "ux:refus-recommandation",
      target: "action:refuser-recommandation",
      type: "soumission",
      libelle: "Confirmer le refus",
      declencheur: "Sélection du motif (trop dur, trop facile...)",
    },
    {
      source: "action:refuser-recommandation",
      target: "page:/",
      type: "transition",
      libelle: "Recalcul du moteur",
    },
    {
      source: "page:/",
      target: "ux:pomodoro",
      type: "interaction",
      libelle: "Lancer le Pomodoro",
      declencheur: "Clic 'Démarrer 25 min'",
    },
    {
      source: "ux:pomodoro",
      target: "page:/",
      type: "transition",
      libelle: "Fin de concentration",
      declencheur: "Sonnerie / Fin du cycle 25 min",
    },
    {
      source: "page:/",
      target: "ux:capture-rapide",
      type: "interaction",
      libelle: "Saisir une observation",
      declencheur: "Focus champ capture rapide",
    },
    {
      source: "ux:capture-rapide",
      target: "action:creer-note",
      type: "soumission",
      libelle: "Sauvegarder la note",
      declencheur: "Clic 'Consigner dans l'Atelier'",
    },
    {
      source: "page:/",
      target: "page:/atelier",
      type: "navigation",
      libelle: "Ouvrir l'Atelier",
      declencheur: "Menu navigation / Carte pilotage",
    },
    {
      source: "page:/",
      target: "page:/seances",
      type: "navigation",
      libelle: "Ouvrir les Séances",
      declencheur: "Menu navigation / Carte séances",
    },
    {
      source: "page:/",
      target: "page:/profil",
      type: "navigation",
      libelle: "Ouvrir le Profil",
      declencheur: "Menu navigation / Carte profil",
    },
    {
      source: "page:/",
      target: "modal:reviser-domaine",
      type: "ouverture",
      libelle: "Réviser un domaine fragile",
      declencheur: "Clic sur alerte domaine fragile",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 2. TRANSITIONS & TRIGGERS ATELIER                                  */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/atelier",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Explorer la constellation",
      declencheur: "Vue par défaut de l'Atelier",
    },
    {
      source: "ux:atelier-graphe",
      target: "ux:fiche-competence",
      type: "interaction",
      libelle: "Inspecter compétence",
      declencheur: "Clic sur un nœud compétence du Canvas 2D",
    },
    {
      source: "ux:fiche-competence",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Fermer la fiche",
      declencheur: "Clic sur l'arrière-plan du Canvas / Fil d'Ariane",
    },
    {
      source: "ux:atelier-graphe",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Inspecter domaine",
      declencheur: "Clic sur un nœud domaine du Canvas 2D",
    },
    {
      source: "ux:fiche-domaine",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Fermer le domaine",
      declencheur: "Clic sur l'arrière-plan du Canvas / Fil d'Ariane",
    },
    {
      source: "ux:atelier-graphe",
      target: "ux:dossier-transversal",
      type: "interaction",
      libelle: "Ouvrir l'explorateur",
      declencheur: "Clic sur le bouton 'Explorateur de dossiers'",
    },
    {
      source: "ux:dossier-transversal",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Revenir au graphe",
      declencheur: "Clic 'Graphe global'",
    },
    {
      source: "ux:dossier-transversal",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Consulter la note",
      declencheur: "Clic sur une note dans l'arborescence",
    },
    {
      source: "ux:editeur-note",
      target: "ux:panneau-contexte",
      type: "interaction",
      libelle: "Relations & Pièces jointes",
      declencheur: "Clic sur le volet 'Contexte'",
    },
    {
      source: "ux:panneau-contexte",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Masquer le volet",
      declencheur: "Fermeture du volet",
    },
    {
      source: "ux:editeur-note",
      target: "action:creer-note",
      type: "soumission",
      libelle: "Sauvegarder Markdown",
      declencheur: "Clic 'Enregistrer' ou 'Figer révision'",
    },
    {
      source: "action:creer-note",
      target: "ux:editeur-note",
      type: "transition",
      libelle: "Document actualisé",
    },
    {
      source: "ux:fiche-domaine",
      target: "modal:reviser-domaine",
      type: "ouverture",
      libelle: "Réviser le domaine",
      declencheur: "Clic 'Réviser ce domaine'",
    },
    {
      source: "modal:reviser-domaine",
      target: "ux:fiche-domaine",
      type: "retour",
      libelle: "Fermer",
    },
    {
      source: "modal:reviser-domaine",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Démarrer séance de révision",
      declencheur: "Validation de la sélection d'exercices",
    },
    {
      source: "ux:fiche-domaine",
      target: "modal:ajouter-des-competences",
      type: "ouverture",
      libelle: "Ajouter des compétences",
      declencheur: "Clic 'Ajouter des compétences'",
    },
    {
      source: "modal:ajouter-des-competences",
      target: "ux:fiche-domaine",
      type: "retour",
      libelle: "Fermer",
    },
    {
      source: "modal:ajouter-des-competences",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Valider les ajouts",
      declencheur: "Clic 'Ajouter au référentiel'",
    },
    {
      source: "action:creer-branche",
      target: "ux:atelier-graphe",
      type: "transition",
      libelle: "Actualisation constellation",
    },
    {
      source: "ux:fiche-competence",
      target: "modal:editer-competence",
      type: "ouverture",
      libelle: "Éditer compétence",
      declencheur: "Clic 'Éditer la compétence'",
    },
    {
      source: "modal:editer-competence",
      target: "ux:fiche-competence",
      type: "retour",
      libelle: "Fermer",
    },
    {
      source: "ux:fiche-competence",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer un exercice ciblé",
      declencheur: "Clic 'Créer un exercice sur cette compétence'",
    },
    {
      source: "ux:dossier-transversal",
      target: "modal:nouveau-document",
      type: "ouverture",
      libelle: "Créer un document",
      declencheur: "Clic '+ Nouveau document'",
    },
    {
      source: "modal:nouveau-document",
      target: "ux:dossier-transversal",
      type: "retour",
      libelle: "Fermer",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 3. TRANSITIONS & TRIGGERS SÉANCES & CONCEPTEUR                     */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/seances",
      target: "ux:concepteur-seance",
      type: "interaction",
      libelle: "Studio de séance",
      declencheur: "Clic 'Composer une séance'",
    },
    {
      source: "page:/seances",
      target: "modal:composer-une-seance",
      type: "ouverture",
      libelle: "Assistant rapide",
      declencheur: "Clic '+ Nouvelle séance'",
    },
    {
      source: "modal:composer-une-seance",
      target: "modal:ajouter-un-theme",
      type: "ouverture",
      libelle: "Créer un thème",
      declencheur: "Clic '+ Nouveau thème'",
    },
    {
      source: "modal:ajouter-un-theme",
      target: "modal:composer-une-seance",
      type: "retour",
      libelle: "Thème créé",
    },
    {
      source: "modal:composer-une-seance",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Valider la composition",
      declencheur: "Clic 'Créer la séance'",
    },
    {
      source: "ux:concepteur-seance",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Planifier la séance",
      declencheur: "Clic 'Enregistrer la séance'",
    },
    {
      source: "action:creer-seance",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Ouvrir le workspace",
    },
    {
      source: "page:/seances",
      target: "ux:workspace-seance",
      type: "interaction",
      libelle: "Reprendre la séance",
      declencheur: "Clic sur une séance 'En cours' ou 'Planifiée'",
    },
    {
      source: "ux:workspace-seance",
      target: "action:demarrer-seance",
      type: "soumission",
      libelle: "Démarrer le chrono",
      declencheur: "Clic 'Démarrer la séance'",
    },
    {
      source: "action:demarrer-seance",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Statut 'en-cours'",
    },
    {
      source: "ux:workspace-seance",
      target: "action:ajouter-note",
      type: "soumission",
      libelle: "Consigner observation",
      declencheur: "Saisie bloc-notes live séance",
    },
    {
      source: "action:ajouter-note",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Note ajoutée",
    },
    {
      source: "ux:workspace-seance",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Exécuter l'exercice actif",
      declencheur: "Sélection d'une activité dans le workspace",
    },
    {
      source: "ux:workspace-seance",
      target: "action:terminer-seance",
      type: "soumission",
      libelle: "Clôturer la séance",
      declencheur: "Clic 'Terminer la séance' (toutes activités faites)",
    },
    {
      source: "action:terminer-seance",
      target: "ux:seance-bilan",
      type: "transition",
      libelle: "Afficher le bilan",
    },
    {
      source: "ux:seance-bilan",
      target: "page:/seances",
      type: "navigation",
      libelle: "Sortir vers le cahier",
      declencheur: "Clic 'Retour au cahier'",
    },
    {
      source: "ux:seance-bilan",
      target: "page:/",
      type: "navigation",
      libelle: "Retourner au dashboard",
      declencheur: "Clic 'Accueil'",
    },
    {
      source: "ux:workspace-seance",
      target: "action:annuler-seance",
      type: "soumission",
      libelle: "Annuler la séance",
      declencheur: "Clic 'Abandonner la séance'",
    },
    {
      source: "action:annuler-seance",
      target: "page:/seances",
      type: "transition",
      libelle: "Séance annulée",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 4. TRANSITIONS & TRIGGERS BOUCLE 3 ACTES D'EXERCICE                */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/exercices/{id}",
      target: "ux:exercice-chercher",
      type: "interaction",
      libelle: "Entrer dans la tentative",
      declencheur: "Clic 'Commencer' / 'Refaire'",
    },
    {
      source: "ux:exercice-chercher",
      target: "action:demarrer-tentative",
      type: "soumission",
      libelle: "Déclencher le chronomètre",
      declencheur: "Top départ de la tentative",
    },
    {
      source: "action:demarrer-tentative",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Tentative active",
    },
    {
      source: "ux:exercice-chercher",
      target: "ux:exercice-indices",
      type: "interaction",
      libelle: "Demander un indice",
      declencheur: "Clic 'Débloquer indice (1..N)'",
    },
    {
      source: "ux:exercice-indices",
      target: "action:debloquer-indice",
      type: "soumission",
      libelle: "Débloquer l'indice N",
      declencheur: "Confirmation de déblocage",
    },
    {
      source: "action:debloquer-indice",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Indice visible dans l'énoncé",
    },
    {
      source: "ux:exercice-chercher",
      target: "ux:exercice-abandon",
      type: "interaction",
      libelle: "Déclarer un blocage / abandon",
      declencheur: "Clic 'Abandonner cette tentative'",
    },
    {
      source: "ux:exercice-abandon",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Enregistrer l'abandon",
      declencheur: "Saisie ou validation du motif d'abandon",
    },
    {
      source: "action:abandonner-tentative",
      target: "page:/exercices/{id}",
      type: "transition",
      libelle: "Retour écran exercice",
    },
    {
      source: "ux:exercice-chercher",
      target: "ux:exercice-comparer",
      type: "transition",
      libelle: "Passer à l'Acte 2 (Comparer)",
      declencheur: "Clic 'Afficher la correction'",
    },
    {
      source: "ux:exercice-comparer",
      target: "ux:exercice-mesurer",
      type: "transition",
      libelle: "Passer à l'Acte 3 (Mesurer)",
      declencheur: "Clic 'Passer à l'évaluation'",
    },
    {
      source: "ux:exercice-mesurer",
      target: "action:terminer-exercice",
      type: "soumission",
      libelle: "Enregistrer la preuve",
      declencheur: "Validation du formulaire d'auto-évaluation",
    },
    {
      source: "action:terminer-exercice",
      target: "ux:exercice-bilan-final",
      type: "transition",
      libelle: "Preuve forgée dans la base",
    },
    {
      source: "ux:exercice-bilan-final",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Refaire cet exercice",
      declencheur: "Clic 'Refaire cet exercice'",
    },
    {
      source: "ux:exercice-bilan-final",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Reprendre la séance",
      declencheur: "Clic 'Retour au workspace séance'",
      condition: "séance en cours",
    },
    {
      source: "ux:exercice-bilan-final",
      target: "page:/atelier",
      type: "navigation",
      libelle: "Voir l'effet sur la compétence",
      declencheur: "Clic 'Voir dans l'Atelier'",
    },
    {
      source: "ux:exercice-bilan-final",
      target: "page:/",
      type: "navigation",
      libelle: "Prochaine recommandation",
      declencheur: "Clic 'Continuer vers le dashboard'",
    },
    {
      source: "page:/exercices/{id}",
      target: "modal:editer-exercice",
      type: "ouverture",
      libelle: "Éditer l'énoncé",
      declencheur: "Clic 'Éditer'",
    },
    {
      source: "modal:editer-exercice",
      target: "page:/exercices/{id}",
      type: "retour",
      libelle: "Fermer",
    },
    {
      source: "page:/exercices/{id}",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer une variante",
      declencheur: "Clic 'Générer un exercice similaire'",
    },
    {
      source: "modal:generer-exercice",
      target: "action:creer-exercice",
      type: "soumission",
      libelle: "Créer l'exercice",
      declencheur: "Clic 'Valider l'exercice généré'",
    },
    {
      source: "action:creer-exercice",
      target: "page:/exercices/{id}",
      type: "transition",
      libelle: "Nouvel exercice disponible",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 5. TRANSITIONS & TRIGGERS COMPAGNON TUTEUR IA                      */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur",
      declencheur: "Clic bouton Tuteur / Raccourci",
    },
    {
      source: "page:/atelier",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Assistance documentaire",
      declencheur: "Clic bouton Tuteur dans l'Atelier",
    },
    {
      source: "ux:workspace-seance",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Aide live séance",
      declencheur: "Clic Tuteur dans le workspace",
    },
    {
      source: "ux:exercice-chercher",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Débloquer de l'aide",
      declencheur: "Clic 'Demander au tuteur'",
    },
    {
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-modes",
      type: "interaction",
      libelle: "Choisir un mode rapide",
      declencheur: "Clic pilule (Explique-moi, Évalue-moi, Lacunes...)",
    },
    {
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-exercice",
      type: "interaction",
      libelle: "Proposition d'exercice",
      declencheur: "Appel outil 'exercice' par le LLM",
    },
    {
      source: "ux:tuteur-suggestion-exercice",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Examiner l'exercice",
      declencheur: "Clic 'Examiner la proposition'",
    },
    {
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-branche",
      type: "interaction",
      libelle: "Proposition de branche",
      declencheur: "Appel outil 'referentiel' par le LLM",
    },
    {
      source: "ux:tuteur-suggestion-branche",
      target: "modal:validation-branche",
      type: "ouverture",
      libelle: "Valider l'arborescence",
      declencheur: "Clic 'Intégrer les compétences'",
    },
    {
      source: "modal:validation-branche",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Intégrer les nœuds",
      declencheur: "Validation du formulaire",
    },
    {
      source: "modal:validation-branche",
      target: "ux:tiroir-tuteur",
      type: "retour",
      libelle: "Fermer la modale",
    },

    /* ══════════════════════════════════════════════════════════════════ */
    /* 6. TRANSITIONS & TRIGGERS PROFIL & COMPTE                          */
    /* ══════════════════════════════════════════════════════════════════ */
    {
      source: "page:/profil",
      target: "ux:profil-objectifs",
      type: "interaction",
      libelle: "Éditer le profil",
      declencheur: "Saisie dans les champs sujet & objectifs",
    },
    {
      source: "ux:profil-objectifs",
      target: "action:modifier-profil",
      type: "soumission",
      libelle: "Enregistrer le profil",
      declencheur: "Clic 'Enregistrer les modifications'",
    },
    {
      source: "action:modifier-profil",
      target: "page:/profil",
      type: "transition",
      libelle: "Profil sauvegardé",
    },
    {
      source: "page:/",
      target: "ux:tiroir-compte",
      type: "ouverture",
      libelle: "Ouvrir gestion de compte",
      declencheur: "Clic sur l'avatar / pastille de statut sync",
    },
    {
      source: "ux:tiroir-compte",
      target: "action:exporter-journal",
      type: "soumission",
      libelle: "Exporter le journal",
      declencheur: "Clic 'Télécharger l'archive JSON'",
    },
    {
      source: "action:exporter-journal",
      target: "ux:tiroir-compte",
      type: "transition",
      libelle: "Archive générée et téléchargée",
    },
    {
      source: "ux:tiroir-compte",
      target: "action:se-deconnecter",
      type: "soumission",
      libelle: "Se déconnecter",
      declencheur: "Clic 'Déconnexion'",
    },
    {
      source: "action:se-deconnecter",
      target: "page:/login",
      type: "transition",
      libelle: "Redirection vers login",
    },
    {
      source: "page:/login",
      target: "page:/",
      type: "navigation",
      libelle: "Connexion réussie",
      declencheur: "Authentification réussie",
    },
  ];

  return { noeuds, liens };
}
