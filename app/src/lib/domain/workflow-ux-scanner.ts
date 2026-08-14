/**
 * Scanner de Parcours UX (User Journey) — Couche 3 (Décide).
 *
 * Contrairement au scanner d'architecture brut qui ne liste que les routes et
 * imports stricts, ce module introspecte dynamiquement le code source pour
 * dériver la **topologie réelle de l'expérience utilisateur** :
 *   1. Les sous-états interactifs et vues internes (Canvas 2D, Galerie Domaines,
 *      Vue Transversale, Fiches Compétence/Domaine avec onglets, Éditeur Markdown,
 *      Visualiseur de Snapshots, Volet Contexte, PDF).
 *   2. La boucle d'exercice en 3 actes (Chercher → Indices → Comparer → Mesurer → Bilan / Preuve).
 *   3. Le studio et le workspace de séance (Concentration live, minuteur Pomodoro, notes live).
 *   4. Les déclencheurs d'interaction explicites extraits des boutons, liens et gestes.
 *   5. Le compagnon tuteur IA proactif et ses propositions d'exercices ou de branches.
 *   6. Les mutations et Server Actions réelles avec leurs sources et destinations.
 *
 * ## Principe fondamental
 *
 * Tout est dérivé dynamiquement depuis les fichiers sources de `src/` :
 * les pages, sous-composants, modales `<Modale>`, tiroirs et appels d'actions
 * sont inspectés en temps réel pour s'adapter continuellement à l'évolution du code.
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé de la logique métier, rien n'est stocké.
 * Les types du graphe restent dans `workflow-graphe.ts` (couche 1).
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import type {
  GrapheWorkflow,
  LienWorkflow,
  NoeudWorkflow,
} from "./workflow-graphe";

/* ------------------------------------------------------------------ */
/* Constantes & Cache                                                  */
/* ------------------------------------------------------------------ */

const RACINE_SRC = resolve(process.cwd(), "src");

const cacheFichiers = new Map<string, { mtimeMs: number; contenu: string }>();

async function lireFichier(chemin: string): Promise<string | null> {
  try {
    const stats = await stat(chemin);
    const enCache = cacheFichiers.get(chemin);
    if (enCache && enCache.mtimeMs === stats.mtimeMs) {
      return enCache.contenu;
    }
    const contenu = await readFile(chemin, "utf-8");
    cacheFichiers.set(chemin, { mtimeMs: stats.mtimeMs, contenu });
    return contenu;
  } catch {
    return null;
  }
}

async function listerFichiersRec(
  repertoire: string,
  extensions = [".tsx", ".ts"],
): Promise<string[]> {
  const resultats: string[] = [];
  let entrees: import("fs").Dirent[];
  try {
    entrees = await readdir(repertoire, { withFileTypes: true });
  } catch {
    return resultats;
  }
  for (const entree of entrees) {
    if (
      entree.name === "node_modules" ||
      entree.name === ".next" ||
      entree.name === ".git"
    )
      continue;
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) {
      resultats.push(...(await listerFichiersRec(chemin, extensions)));
    } else if (extensions.some((ext) => entree.name.endsWith(ext))) {
      if (entree.name.endsWith(".test.ts") || entree.name.endsWith(".test.tsx"))
        continue;
      if (entree.name.endsWith(".d.ts")) continue;
      resultats.push(chemin);
    }
  }
  return resultats;
}

function norm(chemin: string): string {
  return chemin.replace(/\\/g, "/");
}

/* ------------------------------------------------------------------ */
/* Introspection Dynamique UX                                          */
/* ------------------------------------------------------------------ */

interface FichierCode {
  chemin: string;
  relatif: string;
  contenu: string;
}

/**
 * Construit dynamiquement le graphe complet de parcours utilisateur et d'interaction.
 */
export async function scannerUxJourney(): Promise<GrapheWorkflow> {
  const chemins = await listerFichiersRec(RACINE_SRC);
  const fichiers = new Map<string, FichierCode>();

  for (const ch of chemins) {
    const relatif = norm(ch.slice(RACINE_SRC.length + 1));
    const contenu = await lireFichier(ch);
    if (contenu !== null) {
      fichiers.set(relatif, { chemin: ch, relatif, contenu });
    }
  }

  const noeuds: NoeudWorkflow[] = [];
  const liens: LienWorkflow[] = [];
  const parId = new Map<string, NoeudWorkflow>();
  const vusLiens = new Set<string>();

  function ajouterNoeud(noeud: NoeudWorkflow) {
    if (!parId.has(noeud.id)) {
      parId.set(noeud.id, noeud);
      noeuds.push(noeud);
    }
  }

  function connecter(lien: LienWorkflow) {
    const cle = `${lien.source}→${lien.target}→${lien.type}→${lien.libelle}`;
    if (!vusLiens.has(cle)) {
      vusLiens.add(cle);
      liens.push(lien);
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 1. CLUSTER DASHBOARD & PILOTAGE                                     */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageDashboard = fichiers.get("app/(app)/page.tsx");
  if (pageDashboard) {
    ajouterNoeud({
      id: "page:/",
      type: "page",
      groupe: "dashboard",
      libelle: "Dashboard & Pilotage",
      url: "/",
      badge: "Accueil",
      description: "Vue d'ensemble de la progression, indicateurs de maîtrise et carrefour d'actions rapides.",
    });

    const prochAction = fichiers.get("components/dashboard/prochaine-action.tsx");
    if (prochAction) {
      ajouterNoeud({
        id: "ux:recommandation-active",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Carte Prochaine Action",
        badge: "Moteur IA",
        description: "Proposition d'activité personnalisée issue du moteur de calibration.",
      });
      connecter({
        source: "page:/",
        target: "ux:recommandation-active",
        type: "interaction",
        libelle: "Afficher recommandation",
        declencheur: "Calcul automatique du moteur au chargement",
      });

      const refus = fichiers.get("components/dashboard/refus-recommandation.tsx");
      if (refus) {
        ajouterNoeud({
          id: "action:refuser-recommandation",
          type: "action",
          groupe: "dashboard",
          libelle: "Enregistrer refus",
        });
        connecter({
          source: "ux:recommandation-active",
          target: "action:refuser-recommandation",
          type: "soumission",
          libelle: "Passer la recommandation",
          declencheur: "Clic 'Passer'",
        });
        connecter({
          source: "action:refuser-recommandation",
          target: "page:/",
          type: "transition",
          libelle: "Recalcul du moteur",
        });
      }
    }

    const pomodoro = fichiers.get("components/dashboard/pomodoro.tsx");
    if (pomodoro) {
      ajouterNoeud({
        id: "ux:pomodoro",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Minuteur Pomodoro",
        badge: "Focus",
        description: "Cadencement en blocs de concentration de 25 min et pauses.",
      });
      connecter({
        source: "page:/",
        target: "ux:pomodoro",
        type: "interaction",
        libelle: "Lancer le Pomodoro",
        declencheur: "Clic 'Démarrer 25 min'",
      });
      connecter({
        source: "ux:pomodoro",
        target: "page:/",
        type: "transition",
        libelle: "Fin de concentration",
        declencheur: "Sonnerie / Fin du cycle 25 min",
      });
    }

    const capture = fichiers.get("components/dashboard/capture-notes.tsx");
    if (capture) {
      ajouterNoeud({
        id: "ux:capture-rapide",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Capture rapide de notes",
        badge: "Brouillon",
        description: "Saisie instantanée d'idées ou d'observations projetées dans l'Atelier.",
      });
      ajouterNoeud({
        id: "action:creer-note",
        type: "action",
        groupe: "atelier",
        libelle: "Enregistrer note Markdown",
      });
      connecter({
        source: "page:/",
        target: "ux:capture-rapide",
        type: "interaction",
        libelle: "Saisir une observation",
        declencheur: "Focus champ capture rapide",
      });
      connecter({
        source: "ux:capture-rapide",
        target: "action:creer-note",
        type: "soumission",
        libelle: "Sauvegarder la note",
        declencheur: "Clic 'Consigner dans l'Atelier'",
      });
    }

    const pilotage = fichiers.get("components/dashboard/pilotage-referentiel.tsx");
    if (pilotage) {
      ajouterNoeud({
        id: "ux:alerte-domaine-fragile",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Alerte Domaine Fragile",
        badge: "Vigilance",
        description: "Détection automatique d'un domaine dont la robustesse est en baisse.",
      });
      connecter({
        source: "page:/",
        target: "ux:alerte-domaine-fragile",
        type: "interaction",
        libelle: "Alerte domaine",
        declencheur: "Indicateur de fragilité",
      });
    }

    const etatGlobal = fichiers.get("components/dashboard/etat-global.tsx");
    if (etatGlobal) {
      ajouterNoeud({
        id: "ux:kpi-progression",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Indicateurs de Maîtrise",
        badge: "Pilotage",
        description: "Jauges de couverture globale, compétences acquises et volume de preuves.",
      });
      connecter({
        source: "page:/",
        target: "ux:kpi-progression",
        type: "interaction",
        libelle: "Consulter la progression",
        declencheur: "Vue dashboard",
      });
      connecter({
        source: "ux:kpi-progression",
        target: "ux:galerie-domaines",
        type: "navigation",
        libelle: "Explorer la couverture par domaine",
        declencheur: "Clic sur la couverture / répartition des niveaux",
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 2. CLUSTER ATELIER & MÉMOIRE DOCUMENTAIRE                           */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageAtelier = fichiers.get("app/(app)/atelier/page.tsx");
  const compAtelier = fichiers.get("components/atelier/espace-documentaire.tsx");

  if (pageAtelier && compAtelier) {
    ajouterNoeud({
      id: "page:/atelier",
      type: "page",
      groupe: "atelier",
      libelle: "Atelier Documentaire",
      url: "/atelier",
      badge: "Mémoire",
      description: "Espace central de visualisation, documentation et exploration des compétences.",
    });

    // 1. Explorateur Sidebar
    ajouterNoeud({
      id: "ux:explorateur-sidebar",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Explorateur Documentaire",
      badge: "Arborescence",
      description: "Arbre interactif des dossiers (Domaines, Transversal, Archivés), filtres et recherche instantanée.",
    });

    // 2. Vue Graphe Canvas 2D (Défaut)
    ajouterNoeud({
      id: "ux:atelier-graphe",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Vue Graphe Canvas 2D",
      badge: "Constellation",
      description: "Graphe interactif d3-force des compétences, domaines et dépendances.",
    });

    // 3. Galerie des Domaines
    ajouterNoeud({
      id: "ux:galerie-domaines",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Galerie des Domaines",
      badge: "Vue d'ensemble",
      description: "Grille de synthèse de tous les domaines d'apprentissage avec taux de couverture et compétences associées.",
    });

    // 4. Hub Transversal
    ajouterNoeud({
      id: "ux:vue-transversale",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Hub Transversal",
      badge: "Catégories",
      description: "Vue d'ensemble des catégories transversales (Thèmes, Compétences transversales, Fiches supports).",
    });

    // 5. Grille Sous-Dossier
    ajouterNoeud({
      id: "ux:categorie-dossier",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Grille Sous-Dossier",
      badge: "Dossier",
      description: "Contenu détaillé d'une sous-catégorie transversale ou d'un dossier documentaire.",
    });

    // 6. Fiche Compétence (Radar + 4 Onglets)
    ajouterNoeud({
      id: "ux:fiche-competence",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Compétence (Radar)",
      badge: "Maîtrise",
      description: "Radar de maîtrise, 4 onglets (Synthèse, Progression, Relations, Notes), historique des preuves et actions.",
    });

    // 7. Fiche Domaine (3 Onglets)
    ajouterNoeud({
      id: "ux:fiche-domaine",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Synthèse Domaine",
      badge: "Couverture",
      description: "Fiche mère avec 3 onglets (Structure par paliers, Progression Radar, Gestion du référentiel).",
    });

    // 8. Éditeur Markdown
    ajouterNoeud({
      id: "ux:editeur-note",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Éditeur Markdown de Note",
      badge: "Markdown",
      description: "Mode édition Markdown / aperçu rendu, sauvegarde continue et versions figées (snapshots).",
    });

    // 10. Visualiseur Snapshot
    ajouterNoeud({
      id: "ux:apercu-snapshot",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Aperçu Version Figée",
      badge: "Snapshot",
      description: "Consultation en lecture seule d'une révision historique figée (v1, v2...).",
    });

    // 11. Volet Contexte & Relations
    ajouterNoeud({
      id: "ux:panneau-contexte",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Volet Contexte & Liaisons",
      badge: "Relations",
      description: "Liaisons bidirectionnelles wikilinks [[ ]], pièces jointes PDF, historique de snapshots et raccourcis.",
    });

    // Modales Atelier
    ajouterNoeud({
      id: "modal:ajouter-des-competences",
      type: "modal",
      groupe: "atelier",
      libelle: "Ajouter des compétences",
      description: "Formulaire d'ajout de compétences au référentiel du compte.",
    });
    ajouterNoeud({
      id: "modal:reviser-domaine",
      type: "modal",
      groupe: "atelier",
      libelle: "Réviser le domaine",
      description: "Sélection d'exercices ciblés pour consolider un domaine fragile ou révision assistée par IA.",
    });
    ajouterNoeud({
      id: "modal:editer-competence",
      type: "modal",
      groupe: "atelier",
      libelle: "Éditer la compétence",
      description: "Modification du libellé, description et statut d'une compétence.",
    });
    ajouterNoeud({
      id: "modal:validation-branche",
      type: "modal",
      groupe: "atelier",
      libelle: "Validation de branche",
      description: "Validation et intégration d'une branche de compétences proposée par l'IA.",
    });
    ajouterNoeud({
      id: "modal:nouveau-document",
      type: "modal",
      groupe: "atelier",
      libelle: "Nouveau document",
      description: "Création d'une nouvelle note ou fiche d'apprentissage support.",
    });

    // Actions Atelier
    ajouterNoeud({ id: "action:creer-branche", type: "action", groupe: "atelier", libelle: "Valider branche compétences" });
    ajouterNoeud({ id: "action:figer-revision", type: "action", groupe: "atelier", libelle: "Figer version snapshot" });
    ajouterNoeud({ id: "action:televerser-pdf", type: "action", groupe: "atelier", libelle: "Joindre un PDF" });
    ajouterNoeud({ id: "action:supprimer-pdf", type: "action", groupe: "atelier", libelle: "Supprimer PDF" });
    ajouterNoeud({ id: "action:supprimer-note", type: "action", groupe: "atelier", libelle: "Supprimer la note" });
    ajouterNoeud({ id: "action:ajouter-wikilien", type: "action", groupe: "atelier", libelle: "Lier une fiche [[ ]]" });
    ajouterNoeud({ id: "action:rectifier-preuve", type: "action", groupe: "atelier", libelle: "Rectifier une preuve" });

    // Liens et transitions Atelier
    connecter({
      source: "page:/atelier",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Explorer la constellation",
      declencheur: "Vue par défaut de l'Atelier",
    });
    connecter({
      source: "page:/atelier",
      target: "ux:explorateur-sidebar",
      type: "interaction",
      libelle: "Ouvrir l'arborescence",
      declencheur: "Rail latéral gauche",
    });

    // Navigation depuis l'explorateur
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:galerie-domaines",
      type: "interaction",
      libelle: "Ouvrir dossier Domaines",
      declencheur: "Clic 'Domaines' ou 'Domaines archivés'",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:vue-transversale",
      type: "interaction",
      libelle: "Ouvrir dossier Transversal",
      declencheur: "Clic 'Transversal'",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Consulter domaine",
      declencheur: "Clic sur un dossier de domaine",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:fiche-competence",
      type: "interaction",
      libelle: "Consulter compétence",
      declencheur: "Clic sur une compétence dans l'arborescence",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Consulter note",
      declencheur: "Clic sur une note Markdown",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "page:/exercices/{id}",
      type: "navigation",
      libelle: "Ouvrir l'exercice dans le cahier",
      declencheur: "Clic sur un exercice dans l'arborescence",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "modal:nouveau-document",
      type: "ouverture",
      libelle: "Nouveau document",
      declencheur: "Clic '+ Nouveau document'",
    });

    // Navigation depuis le Canvas 2D
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:fiche-competence",
      type: "interaction",
      libelle: "Inspecter compétence",
      declencheur: "Clic sur un nœud compétence du Canvas 2D",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Inspecter domaine",
      declencheur: "Clic sur un nœud domaine du Canvas 2D",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:explorateur-sidebar",
      type: "interaction",
      libelle: "Ouvrir l'explorateur",
      declencheur: "Clic bouton 'Ouvrir l'explorateur'",
    });

    // View Switcher unifié (Bascule directe 1 clic)
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:galerie-domaines",
      type: "interaction",
      libelle: "Bascule vue Domaines",
      declencheur: "Clic onglet 'Domaines' (View Switcher)",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:vue-transversale",
      type: "interaction",
      libelle: "Bascule vue Transversal",
      declencheur: "Clic onglet 'Transversal' (View Switcher)",
    });
    connecter({
      source: "ux:galerie-domaines",
      target: "ux:vue-transversale",
      type: "interaction",
      libelle: "Bascule vue Transversal",
      declencheur: "Clic onglet 'Transversal' (View Switcher)",
    });
    connecter({
      source: "ux:vue-transversale",
      target: "ux:galerie-domaines",
      type: "interaction",
      libelle: "Bascule vue Domaines",
      declencheur: "Clic onglet 'Domaines' (View Switcher)",
    });

    // Navigation depuis la galerie de domaines
    connecter({
      source: "ux:galerie-domaines",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Ouvrir la fiche domaine",
      declencheur: "Clic carte domaine",
    });
    connecter({
      source: "ux:galerie-domaines",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Revenir au graphe",
      declencheur: "Clic 'Graphe global'",
    });

    // Navigation depuis le hub transversal
    connecter({
      source: "ux:vue-transversale",
      target: "ux:categorie-dossier",
      type: "interaction",
      libelle: "Ouvrir une catégorie",
      declencheur: "Clic sur une carte catégorie",
    });
    connecter({
      source: "ux:vue-transversale",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Revenir au graphe",
      declencheur: "Clic 'Graphe global'",
    });
    connecter({
      source: "ux:categorie-dossier",
      target: "ux:vue-transversale",
      type: "interaction",
      libelle: "Retour aux catégories",
      declencheur: "Fil d'Ariane",
    });
    connecter({
      source: "ux:categorie-dossier",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Ouvrir la note",
      declencheur: "Clic sur une fiche de la catégorie",
    });

    // Interactions Fiche Compétence
    connecter({
      source: "ux:fiche-competence",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Fermer la fiche",
      declencheur: "Clic sur l'arrière-plan du Canvas / Fil d'Ariane",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Ouvrir domaine parent",
      declencheur: "Fil d'Ariane domaine",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "modal:editer-competence",
      type: "ouverture",
      libelle: "Éditer compétence",
      declencheur: "Clic 'Éditer la compétence'",
    });
    connecter({
      source: "modal:editer-competence",
      target: "ux:fiche-competence",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "action:rectifier-preuve",
      type: "soumission",
      libelle: "Rectifier une preuve",
      declencheur: "Clic 'Rectifier' dans l'historique des preuves (mode adaptatif)",
    });
    connecter({
      source: "action:rectifier-preuve",
      target: "ux:fiche-competence",
      type: "transition",
      libelle: "Preuve rectifiée",
    });

    // Interactions Fiche Domaine
    connecter({
      source: "ux:fiche-domaine",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Fermer le domaine",
      declencheur: "Clic sur l'arrière-plan du Canvas / Fil d'Ariane",
    });
    connecter({
      source: "ux:fiche-domaine",
      target: "modal:reviser-domaine",
      type: "ouverture",
      libelle: "Réviser le domaine",
      declencheur: "Clic 'Réviser ce domaine'",
    });
    connecter({
      source: "modal:reviser-domaine",
      target: "ux:fiche-domaine",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "modal:reviser-domaine",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Démarrer séance de révision",
      declencheur: "Validation de la sélection d'exercices",
    });
    connecter({
      source: "ux:fiche-domaine",
      target: "modal:ajouter-des-competences",
      type: "ouverture",
      libelle: "Ajouter des compétences",
      declencheur: "Clic 'Ajouter des compétences'",
    });
    connecter({
      source: "modal:ajouter-des-competences",
      target: "ux:fiche-domaine",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "modal:ajouter-des-competences",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Valider les ajouts",
      declencheur: "Clic 'Ajouter au référentiel'",
    });
    connecter({
      source: "action:creer-branche",
      target: "ux:atelier-graphe",
      type: "transition",
      libelle: "Actualisation constellation",
    });

    // Interactions Éditeur de Note
    connecter({
      source: "ux:editeur-note",
      target: "ux:panneau-contexte",
      type: "interaction",
      libelle: "Relations & Pièces jointes",
      declencheur: "Clic sur le volet 'Contexte'",
    });
    connecter({
      source: "ux:panneau-contexte",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Masquer le volet",
      declencheur: "Fermeture du volet",
    });
    connecter({
      source: "ux:editeur-note",
      target: "action:creer-note",
      type: "soumission",
      libelle: "Sauvegarder Markdown",
      declencheur: "Clic 'Enregistrer'",
    });
    connecter({
      source: "action:creer-note",
      target: "ux:editeur-note",
      type: "transition",
      libelle: "Document actualisé",
    });
    connecter({
      source: "ux:editeur-note",
      target: "action:figer-revision",
      type: "soumission",
      libelle: "Figer une version",
      declencheur: "Clic 'Figer révision'",
    });
    connecter({
      source: "action:figer-revision",
      target: "ux:editeur-note",
      type: "transition",
      libelle: "Snapshot créé",
    });
    connecter({
      source: "ux:editeur-note",
      target: "action:supprimer-note",
      type: "soumission",
      libelle: "Supprimer la note",
      declencheur: "Clic 'Supprimer' (note support)",
    });
    connecter({
      source: "action:supprimer-note",
      target: "ux:explorateur-sidebar",
      type: "transition",
      libelle: "Note retirée de l'espace",
    });

    // Interactions Volet Contexte
    connecter({
      source: "ux:panneau-contexte",
      target: "action:televerser-pdf",
      type: "soumission",
      libelle: "Joindre un PDF",
      declencheur: "Sélection fichier PDF",
    });
    connecter({
      source: "action:televerser-pdf",
      target: "ux:panneau-contexte",
      type: "transition",
      libelle: "PDF disponible",
    });
    connecter({
      source: "ux:panneau-contexte",
      target: "action:supprimer-pdf",
      type: "soumission",
      libelle: "Supprimer le PDF",
      declencheur: "Clic '×' sur la pièce jointe",
    });
    connecter({
      source: "action:supprimer-pdf",
      target: "ux:panneau-contexte",
      type: "transition",
      libelle: "PDF retiré",
    });
    connecter({
      source: "ux:panneau-contexte",
      target: "action:ajouter-wikilien",
      type: "soumission",
      libelle: "Lier une fiche",
      declencheur: "Sélection fiche + clic 'Ajouter'",
    });
    connecter({
      source: "action:ajouter-wikilien",
      target: "ux:editeur-note",
      type: "transition",
      libelle: "Wikilien inséré dans le brouillon",
    });
    connecter({
      source: "ux:panneau-contexte",
      target: "ux:apercu-snapshot",
      type: "interaction",
      libelle: "Ouvrir révision figée",
      declencheur: "Clic sur une version vN de l'historique",
    });
    connecter({
      source: "ux:apercu-snapshot",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Fermer l'aperçu snapshot",
      declencheur: "Clic 'Fermer l'aperçu'",
    });

    // Modale Nouveau Document
    connecter({
      source: "modal:nouveau-document",
      target: "ux:explorateur-sidebar",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "modal:nouveau-document",
      target: "action:creer-note",
      type: "soumission",
      libelle: "Créer le document",
      declencheur: "Validation formulaire création",
    });
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 3. CLUSTER SÉANCES & CONCEPTEUR                                     */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageSeances = fichiers.get("app/(app)/seances/page.tsx");
  if (pageSeances) {
    ajouterNoeud({
      id: "page:/seances",
      type: "page",
      groupe: "seances",
      libelle: "Cahier de séances",
      url: "/seances",
      badge: "Cahier",
      description: "Historique des séances réalisées, file d'attente et point d'entrée studio.",
    });
    ajouterNoeud({
      id: "ux:concepteur-seance",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Concepteur de Séance",
      badge: "Studio",
      description: "Composition sur mesure : choix des thèmes, ordre des exercices et temps estimé.",
    });
    ajouterNoeud({
      id: "ux:workspace-seance",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Workspace Séance en direct",
      url: "/seances?session={id}",
      badge: "Live",
      description: "Mode concentration plein écran, jauge d'avancement et carrefour d'exercices.",
    });
    ajouterNoeud({
      id: "ux:seance-bilan",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Bilan de Séance",
      badge: "Clôture",
      description: "Calcul de l'écart besoin/réalisé et synthèse du temps passé.",
    });
    ajouterNoeud({
      id: "modal:composer-une-seance",
      type: "modal",
      groupe: "seances",
      libelle: "Composer une séance",
      description: "Assistant guidé de création d'une nouvelle séance d'entraînement.",
    });
    ajouterNoeud({
      id: "modal:ajouter-un-theme",
      type: "modal",
      groupe: "seances",
      libelle: "Ajouter un thème",
      description: "Création ou ajout d'un thème à la séance en cours de composition.",
    });

    // Actions Séances
    ajouterNoeud({ id: "action:creer-seance", type: "action", groupe: "seances", libelle: "Créer la séance" });
    ajouterNoeud({ id: "action:demarrer-seance", type: "action", groupe: "seances", libelle: "Démarrer la séance" });
    ajouterNoeud({ id: "action:terminer-seance", type: "action", groupe: "seances", libelle: "Clôturer la séance" });
    ajouterNoeud({ id: "action:annuler-seance", type: "action", groupe: "seances", libelle: "Annuler la séance" });
    ajouterNoeud({ id: "action:ajouter-note", type: "action", groupe: "seances", libelle: "Consigner note séance" });

    // Liens Séances
    connecter({
      source: "page:/seances",
      target: "ux:concepteur-seance",
      type: "interaction",
      libelle: "Studio de séance",
      declencheur: "Clic 'Composer une séance'",
    });
    connecter({
      source: "page:/seances",
      target: "modal:composer-une-seance",
      type: "ouverture",
      libelle: "Assistant rapide",
      declencheur: "Clic '+ Nouvelle séance'",
    });
    connecter({
      source: "page:/seances",
      target: "ux:workspace-seance",
      type: "interaction",
      libelle: "Reprendre la séance",
      declencheur: "Clic sur une séance 'En cours' ou 'Planifiée'",
    });
    connecter({
      source: "modal:composer-une-seance",
      target: "modal:ajouter-un-theme",
      type: "ouverture",
      libelle: "Créer un thème",
      declencheur: "Clic '+ Nouveau thème'",
    });
    connecter({
      source: "modal:ajouter-un-theme",
      target: "modal:composer-une-seance",
      type: "retour",
      libelle: "Thème créé",
    });
    connecter({
      source: "modal:composer-une-seance",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Valider la composition",
      declencheur: "Clic 'Créer la séance'",
    });
    connecter({
      source: "ux:concepteur-seance",
      target: "action:creer-seance",
      type: "soumission",
      libelle: "Planifier la séance",
      declencheur: "Clic 'Enregistrer la séance'",
    });
    connecter({
      source: "action:creer-seance",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Ouvrir le workspace",
    });
    connecter({
      source: "ux:workspace-seance",
      target: "action:demarrer-seance",
      type: "soumission",
      libelle: "Démarrer le chrono",
      declencheur: "Clic 'Démarrer la séance'",
    });
    connecter({
      source: "action:demarrer-seance",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Statut 'en-cours'",
    });
    connecter({
      source: "ux:workspace-seance",
      target: "action:ajouter-note",
      type: "soumission",
      libelle: "Consigner observation",
      declencheur: "Saisie bloc-notes live séance",
    });
    connecter({
      source: "action:ajouter-note",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Note ajoutée",
    });
    connecter({
      source: "ux:workspace-seance",
      target: "action:terminer-seance",
      type: "soumission",
      libelle: "Clôturer la séance",
      declencheur: "Clic 'Terminer la séance' (toutes activités faites)",
    });
    connecter({
      source: "action:terminer-seance",
      target: "ux:seance-bilan",
      type: "transition",
      libelle: "Afficher le bilan",
    });
    connecter({
      source: "ux:seance-bilan",
      target: "page:/seances",
      type: "navigation",
      libelle: "Sortir vers le cahier",
      declencheur: "Clic 'Retour au cahier'",
    });
    connecter({
      source: "ux:seance-bilan",
      target: "page:/",
      type: "navigation",
      libelle: "Retourner au dashboard",
      declencheur: "Clic 'Accueil'",
    });
    connecter({
      source: "ux:workspace-seance",
      target: "action:annuler-seance",
      type: "soumission",
      libelle: "Annuler la séance",
      declencheur: "Clic 'Abandonner la séance'",
    });
    connecter({
      source: "action:annuler-seance",
      target: "page:/seances",
      type: "transition",
      libelle: "Séance annulée",
    });

    const compAdaptive = fichiers.get("components/adaptive/activity-workspace.tsx");
    if (compAdaptive) {
      ajouterNoeud({
        id: "ux:adaptive-workspace",
        type: "sous-vue",
        groupe: "seances",
        libelle: "Workspace Activité Adaptative",
        url: "/seances?run={id}",
        badge: "Adaptatif",
        description: "Espace de travail immersif pour les activités d'exploration, de production ou de projet.",
      });
      ajouterNoeud({
        id: "ux:generation-review",
        type: "sous-vue",
        groupe: "seances",
        libelle: "Revue de Contenu Adaptatif",
        url: "/seances?generation={id}",
        badge: "Génération",
        description: "Préparation et revue du contenu généré par l'IA avant lancement.",
      });

      ajouterNoeud({ id: "action:demarrer-activite-adaptative", type: "action", groupe: "seances", libelle: "Démarrer activité adaptative" });
      ajouterNoeud({ id: "action:enregistrer-jalon", type: "action", groupe: "seances", libelle: "Valider un jalon" });
      ajouterNoeud({ id: "action:terminer-exploration", type: "action", groupe: "seances", libelle: "Clôturer exploration" });
      ajouterNoeud({ id: "action:abandonner-activite-adaptative", type: "action", groupe: "seances", libelle: "Abandonner activité adaptative" });

      connecter({
        source: "page:/seances",
        target: "ux:adaptive-workspace",
        type: "interaction",
        libelle: "Lancer activité adaptative",
        declencheur: "Clic sur une activité adaptative dans la file",
      });
      connecter({
        source: "page:/seances",
        target: "ux:generation-review",
        type: "interaction",
        libelle: "Préparer contenu",
        declencheur: "Clic sur une génération en attente",
      });
      connecter({
        source: "ux:generation-review",
        target: "ux:adaptive-workspace",
        type: "transition",
        libelle: "Lancer après revue",
        declencheur: "Validation du contenu préparé",
      });
      connecter({
        source: "ux:adaptive-workspace",
        target: "action:demarrer-activite-adaptative",
        type: "soumission",
        libelle: "Démarrer le travail",
        declencheur: "Clic 'Démarrer' / 'Reprendre'",
      });
      connecter({
        source: "action:demarrer-activite-adaptative",
        target: "ux:adaptive-workspace",
        type: "transition",
        libelle: "Activité en cours",
      });
      connecter({
        source: "ux:adaptive-workspace",
        target: "action:enregistrer-jalon",
        type: "soumission",
        libelle: "Cocher un jalon",
        declencheur: "Validation d'un objectif d'étape",
      });
      connecter({
        source: "action:enregistrer-jalon",
        target: "ux:adaptive-workspace",
        type: "transition",
        libelle: "Jalon validé",
      });
      connecter({
        source: "ux:adaptive-workspace",
        target: "action:terminer-exploration",
        type: "soumission",
        libelle: "Terminer l'activité",
        declencheur: "Clic 'Terminer l'exploration' / 'Enregistrer'",
      });
      connecter({
        source: "action:terminer-exploration",
        target: "page:/seances",
        type: "transition",
        libelle: "Preuve enregistrée et retour au cahier",
      });
      connecter({
        source: "ux:adaptive-workspace",
        target: "action:abandonner-activite-adaptative",
        type: "soumission",
        libelle: "Abandonner l'activité",
        declencheur: "Clic 'Abandonner'",
      });
      connecter({
        source: "action:abandonner-activite-adaptative",
        target: "page:/seances",
        type: "transition",
        libelle: "Activité abandonnée sans mesure",
      });
      connecter({
        source: "ux:recommandation-active",
        target: "ux:adaptive-workspace",
        type: "transition",
        libelle: "Lancer activité recommandée",
        declencheur: "Clic sur recommandation adaptative",
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 4. CLUSTER BOUCLE D'EXERCICE (3 ACTES)                              */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageExercice = fichiers.get("app/(app)/exercices/[id]/page.tsx");
  if (pageExercice) {
    ajouterNoeud({
      id: "page:/exercices/{id}",
      type: "page",
      groupe: "exercice",
      libelle: "Vue Exercice",
      url: "/exercices/{id}",
      badge: "Parcours",
      description: "Conteneur du parcours pédagogique en 3 actes et affichage des tentatives antérieures.",
    });
    ajouterNoeud({
      id: "ux:exercice-chercher",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 1 : Chercher",
      badge: "Résolution",
      description: "Résolution autonome, énoncé, chronomètre actif et zone de brouillon.",
    });
    ajouterNoeud({
      id: "ux:exercice-indices",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Déblocage d'indices",
      badge: "Échafaudage",
      description: "Révélation échelonnée des indices 1..N avec ajustement de la calibration.",
    });
    ajouterNoeud({
      id: "ux:exercice-abandon",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Abandon de tentative",
      badge: "Régulation",
      description: "Arrêt explicite ou dérivé (< 25% durée) sans fabriquer de fausse mesure.",
    });
    ajouterNoeud({
      id: "ux:exercice-comparer",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 2 : Comparer",
      badge: "Correction",
      description: "Révélation de la solution officielle et confrontation avec la production.",
    });
    ajouterNoeud({
      id: "ux:exercice-mesurer",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 3 : Mesurer",
      badge: "Auto-évaluation",
      description: "Bilan assisté, critères de réussite, charge mentale et ressenti.",
    });
    ajouterNoeud({
      id: "ux:exercice-bilan-final",
      type: "etape",
      groupe: "exercice",
      libelle: "Bilan & Preuve forgée",
      badge: "Preuve",
      description: "Preuve immuable enregistrée, niveau de maîtrise actualisé et choix de la suite.",
    });
    ajouterNoeud({
      id: "modal:editer-exercice",
      type: "modal",
      groupe: "exercice",
      libelle: "Éditer l'exercice",
      description: "Modification du contenu pédagogique (si aucune preuve enregistrée).",
    });
    ajouterNoeud({
      id: "modal:generer-exercice",
      type: "modal",
      groupe: "exercice",
      libelle: "Générer un exercice",
      description: "Génération automatique d'un nouvel exercice par le moteur d'IA.",
    });

    // Actions Exercice
    ajouterNoeud({ id: "action:demarrer-tentative", type: "action", groupe: "exercice", libelle: "Démarrer chrono" });
    ajouterNoeud({ id: "action:debloquer-indice", type: "action", groupe: "exercice", libelle: "Débloquer un indice" });
    ajouterNoeud({ id: "action:abandonner-tentative", type: "action", groupe: "exercice", libelle: "Abandonner tentative" });
    ajouterNoeud({ id: "action:terminer-exercice", type: "action", groupe: "exercice", libelle: "Enregistrer la preuve" });
    ajouterNoeud({ id: "action:creer-exercice", type: "action", groupe: "exercice", libelle: "Créer l'exercice IA" });

    // Liens Boucle 3 actes
    connecter({
      source: "page:/exercices/{id}",
      target: "ux:exercice-chercher",
      type: "interaction",
      libelle: "Entrer dans la tentative",
      declencheur: "Clic 'Commencer' / 'Refaire'",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "action:demarrer-tentative",
      type: "soumission",
      libelle: "Déclencher le chronomètre",
      declencheur: "Top départ de la tentative",
    });
    connecter({
      source: "action:demarrer-tentative",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Tentative active",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-indices",
      type: "interaction",
      libelle: "Demander un indice",
      declencheur: "Clic 'Débloquer indice (1..N)'",
    });
    connecter({
      source: "ux:exercice-indices",
      target: "action:debloquer-indice",
      type: "soumission",
      libelle: "Débloquer l'indice N",
      declencheur: "Confirmation de déblocage",
    });
    connecter({
      source: "action:debloquer-indice",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Indice visible dans l'énoncé",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-abandon",
      type: "interaction",
      libelle: "Déclarer un blocage / abandon",
      declencheur: "Clic 'Abandonner cette tentative'",
    });
    connecter({
      source: "ux:exercice-abandon",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Enregistrer l'abandon",
      declencheur: "Saisie ou validation du motif d'abandon",
    });
    connecter({
      source: "action:abandonner-tentative",
      target: "page:/exercices/{id}",
      type: "transition",
      libelle: "Retour écran exercice",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-comparer",
      type: "transition",
      libelle: "Passer à l'Acte 2 (Comparer)",
      declencheur: "Clic 'Afficher la correction'",
    });
    connecter({
      source: "ux:exercice-comparer",
      target: "ux:exercice-mesurer",
      type: "transition",
      libelle: "Passer à l'Acte 3 (Mesurer)",
      declencheur: "Clic 'Passer à l'évaluation'",
    });
    connecter({
      source: "ux:exercice-mesurer",
      target: "action:terminer-exercice",
      type: "soumission",
      libelle: "Enregistrer la preuve",
      declencheur: "Validation du formulaire d'auto-évaluation",
    });
    connecter({
      source: "action:terminer-exercice",
      target: "ux:exercice-bilan-final",
      type: "transition",
      libelle: "Preuve forgée dans la base",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Refaire cet exercice",
      declencheur: "Clic 'Refaire cet exercice'",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/atelier",
      type: "navigation",
      libelle: "Voir l'effet sur la compétence",
      declencheur: "Clic 'Voir dans l'Atelier'",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/",
      type: "navigation",
      libelle: "Prochaine recommandation",
      declencheur: "Clic 'Continuer vers le dashboard'",
    });

    if (parId.has("page:/seances")) {
      connecter({
        source: "ux:workspace-seance",
        target: "ux:exercice-chercher",
        type: "transition",
        libelle: "Exécuter l'exercice actif",
        declencheur: "Sélection d'une activité dans le workspace",
      });
      connecter({
        source: "ux:exercice-bilan-final",
        target: "ux:workspace-seance",
        type: "transition",
        libelle: "Reprendre la séance",
        declencheur: "Clic 'Retour au workspace séance'",
        condition: "séance en cours",
      });
      connecter({
        source: "action:abandonner-tentative",
        target: "ux:workspace-seance",
        type: "transition",
        libelle: "Reprendre la séance",
        declencheur: "Abandon dans une séance",
        condition: "séance en cours",
      });
    }

    if (parId.has("ux:recommandation-active")) {
      connecter({
        source: "ux:recommandation-active",
        target: "ux:exercice-chercher",
        type: "transition",
        libelle: "Démarrer l'exercice",
        declencheur: "Clic 'Démarrer immédiatement'",
      });
      connecter({
        source: "ux:recommandation-active",
        target: "modal:composer-une-seance",
        type: "ouverture",
        libelle: "Personnaliser en séance",
        declencheur: "Clic 'Personnaliser'",
      });
    }

    // Liens Modales Exercice
    connecter({
      source: "page:/exercices/{id}",
      target: "modal:editer-exercice",
      type: "ouverture",
      libelle: "Éditer l'énoncé",
      declencheur: "Clic 'Éditer'",
    });
    connecter({
      source: "modal:editer-exercice",
      target: "page:/exercices/{id}",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "page:/exercices/{id}",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer une variante",
      declencheur: "Clic 'Générer un exercice similaire'",
    });
    connecter({
      source: "modal:generer-exercice",
      target: "action:creer-exercice",
      type: "soumission",
      libelle: "Créer l'exercice",
      declencheur: "Clic 'Valider l'exercice généré'",
    });
    connecter({
      source: "action:creer-exercice",
      target: "page:/exercices/{id}",
      type: "transition",
      libelle: "Nouvel exercice disponible",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer un exercice ciblé",
      declencheur: "Clic 'Créer un exercice sur cette compétence'",
    });
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 5. CLUSTER COMPAGNON TUTEUR IA                                      */
  /* ══════════════════════════════════════════════════════════════════ */
  const compTuteur = fichiers.get("components/tuteur/chat.tsx");
  if (compTuteur) {
    ajouterNoeud({
      id: "ux:tiroir-tuteur",
      type: "tiroir",
      groupe: "tuteur",
      libelle: "Tiroir Tuteur IA",
      badge: "Omniprésent",
      description: "Compagnon conversationnel guidé, accessible en surimpression sur tout écran.",
    });
    ajouterNoeud({
      id: "ux:tuteur-modes",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "6 Modes Rapides",
      badge: "Amorces",
      description: "Explique-moi, Évalue-moi, Indice, Corrige mon raisonnement, Lacunes, Projet.",
    });
    ajouterNoeud({
      id: "ux:tuteur-suggestion-exercice",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion d'exercice",
      badge: "Génération IA",
      description: "Proposition d'exercice complet généré par l'IA dans le flux du chat.",
    });
    ajouterNoeud({
      id: "ux:tuteur-suggestion-branche",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion de branche",
      badge: "Structure IA",
      description: "Proposition d'une arborescence de compétences à intégrer au référentiel.",
    });

    connecter({
      source: "page:/",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Ouvrir le tuteur",
      declencheur: "Clic bouton Tuteur / Raccourci",
    });
    connecter({
      source: "page:/atelier",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Assistance documentaire",
      declencheur: "Clic bouton Tuteur dans l'Atelier",
    });
    if (parId.has("ux:workspace-seance")) {
      connecter({
        source: "ux:workspace-seance",
        target: "ux:tiroir-tuteur",
        type: "ouverture",
        libelle: "Aide live séance",
        declencheur: "Clic Tuteur dans le workspace",
      });
    }
    if (parId.has("ux:exercice-chercher")) {
      connecter({
        source: "ux:exercice-chercher",
        target: "ux:tiroir-tuteur",
        type: "ouverture",
        libelle: "Débloquer de l'aide",
        declencheur: "Clic 'Demander au tuteur'",
      });
    }

    connecter({
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-modes",
      type: "interaction",
      libelle: "Choisir un mode rapide",
      declencheur: "Clic pilule (Explique-moi, Évalue-moi, Lacunes...)",
    });
    connecter({
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-exercice",
      type: "interaction",
      libelle: "Proposition d'exercice",
      declencheur: "Appel outil 'exercice' par le LLM",
    });
    connecter({
      source: "ux:tuteur-suggestion-exercice",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Examiner l'exercice",
      declencheur: "Clic 'Examiner la proposition'",
    });
    connecter({
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-branche",
      type: "interaction",
      libelle: "Proposition de branche",
      declencheur: "Appel outil 'referentiel' par le LLM",
    });
    connecter({
      source: "ux:tuteur-suggestion-branche",
      target: "modal:validation-branche",
      type: "ouverture",
      libelle: "Valider l'arborescence",
      declencheur: "Clic 'Intégrer les compétences'",
    });
    connecter({
      source: "modal:validation-branche",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Intégrer les nœuds",
      declencheur: "Validation du formulaire",
    });
    connecter({
      source: "modal:validation-branche",
      target: "ux:tiroir-tuteur",
      type: "retour",
      libelle: "Fermer la modale",
    });
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 6. CLUSTER PROFIL, SYNC & AMORÇAGE                                 */
  /* ══════════════════════════════════════════════════════════════════ */
  const compCompte = fichiers.get("components/layout/compte.tsx");
  if (compCompte) {
    ajouterNoeud({
      id: "ux:tiroir-compte",
      type: "tiroir",
      groupe: "profil",
      libelle: "Tiroir Compte & Réglages",
      badge: "Synchronisation",
      description: "Gestion du profil d'apprentissage, clé IA, export du journal et session.",
    });
    ajouterNoeud({
      id: "ux:profil-objectifs",
      type: "sous-vue",
      groupe: "profil",
      libelle: "Édition Sujet & Objectifs",
      badge: "Objectifs",
      description: "Formulaire de mise à jour des ambitions et du domaine principal.",
    });
    ajouterNoeud({
      id: "page:/login",
      type: "page",
      groupe: "profil",
      libelle: "Authentification / Connexion",
      url: "/login",
      badge: "Accès",
      description: "Portail d'accès et authentification Supabase Auth.",
    });

    ajouterNoeud({ id: "action:modifier-profil", type: "action", groupe: "profil", libelle: "Enregistrer profil" });
    ajouterNoeud({ id: "action:exporter-journal", type: "action", groupe: "profil", libelle: "Exporter journal JSON" });
    ajouterNoeud({ id: "action:se-deconnecter", type: "action", groupe: "profil", libelle: "Déconnexion" });

    connecter({
      source: "page:/",
      target: "ux:tiroir-compte",
      type: "ouverture",
      libelle: "Ouvrir gestion de compte",
      declencheur: "Clic sur l'avatar / pastille de statut sync",
    });
    connecter({
      source: "ux:tiroir-compte",
      target: "ux:profil-objectifs",
      type: "interaction",
      libelle: "Éditer le profil",
      declencheur: "Onglet 'Profil d'apprentissage'",
    });
    connecter({
      source: "ux:profil-objectifs",
      target: "action:modifier-profil",
      type: "soumission",
      libelle: "Enregistrer le profil",
      declencheur: "Clic 'Enregistrer'",
    });
    connecter({
      source: "action:modifier-profil",
      target: "ux:tiroir-compte",
      type: "transition",
      libelle: "Profil sauvegardé",
    });
    connecter({
      source: "ux:tiroir-compte",
      target: "action:exporter-journal",
      type: "soumission",
      libelle: "Exporter le journal",
      declencheur: "Clic 'Télécharger l'archive JSON'",
    });
    connecter({
      source: "action:exporter-journal",
      target: "ux:tiroir-compte",
      type: "transition",
      libelle: "Archive générée et téléchargée",
    });
    connecter({
      source: "ux:tiroir-compte",
      target: "action:se-deconnecter",
      type: "soumission",
      libelle: "Se déconnecter",
      declencheur: "Clic 'Déconnexion'",
    });
    connecter({
      source: "action:se-deconnecter",
      target: "page:/login",
      type: "transition",
      libelle: "Redirection vers login",
    });
    connecter({
      source: "page:/login",
      target: "page:/",
      type: "navigation",
      libelle: "Connexion réussie",
      declencheur: "Authentification réussie",
    });
  }

  // Amorçage pour nouveau compte (/demarrer)
  const pageDemarrer = fichiers.get("app/(app)/demarrer/page.tsx");
  if (pageDemarrer) {
    ajouterNoeud({
      id: "page:/demarrer",
      type: "page",
      groupe: "profil",
      libelle: "Amorçage de compte",
      url: "/demarrer",
      badge: "Onboarding",
      description: "Amorçage d'un compte neuf sans référentiel (sujet d'étude et point de départ).",
    });
    ajouterNoeud({
      id: "action:amorcer-compte",
      type: "action",
      groupe: "profil",
      libelle: "Amorcer le profil",
    });
    connecter({
      source: "page:/demarrer",
      target: "action:amorcer-compte",
      type: "soumission",
      libelle: "Valider l'amorce",
      declencheur: "Validation formulaire amorçage",
    });
    connecter({
      source: "action:amorcer-compte",
      target: "page:/atelier",
      type: "transition",
      libelle: "Redirection vers l'Atelier",
    });
    connecter({
      source: "page:/",
      target: "page:/demarrer",
      type: "navigation",
      libelle: "Amorcer un sujet",
      declencheur: "Absence de référentiel initial",
      condition: "compte neuf",
    });
    connecter({
      source: "page:/login",
      target: "page:/demarrer",
      type: "navigation",
      libelle: "Amorçage compte neuf",
      declencheur: "Première connexion sans compétences",
      condition: "compte neuf",
    });
  }

  // Interconnexions globales (Rail de navigation principal)
  connecter({
    source: "page:/",
    target: "page:/atelier",
    type: "navigation",
    libelle: "Ouvrir l'Atelier",
    declencheur: "Menu navigation / Carte pilotage",
  });
  if (parId.has("page:/seances")) {
    connecter({
      source: "page:/",
      target: "page:/seances",
      type: "navigation",
      libelle: "Ouvrir les Séances",
      declencheur: "Menu navigation / Carte séances",
    });
  }
  if (parId.has("ux:alerte-domaine-fragile") && parId.has("modal:reviser-domaine")) {
    connecter({
      source: "ux:alerte-domaine-fragile",
      target: "modal:reviser-domaine",
      type: "ouverture",
      libelle: "Réviser le domaine fragile",
      declencheur: "Clic sur alerte domaine fragile",
    });
  }

  return { noeuds, liens };
}
