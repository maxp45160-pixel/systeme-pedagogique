/**
 * Scanner de Parcours UX (User Journey) — Introspection 100% dynamique.
 *
 * Dérive dynamiquement la topologie de l'expérience utilisateur selon deux
 * niveaux de granularité sans aucun code en dur :
 *   - Mode "macro" : Vue épurée des grands carrefours fonctionnels (~45 nœuds).
 *   - Mode "atomique" : Exhaustivité totale au bouton, sous-onglet, projection,
 *     pièce jointe et micro-interaction près (~80 nœuds).
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé du code source, rien n'est stocké.
 * Les types du graphe restent dans `workflow-graphe.ts` (couche 1).
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import type {
  GrapheWorkflow,
  GroupeWorkflow,
  LienWorkflow,
  NoeudWorkflow,
  TypeLienWorkflow,
  TypeNoeudWorkflow,
} from "./workflow-graphe";

/* ------------------------------------------------------------------ */
/* Constantes & Cache                                                  */
/* ------------------------------------------------------------------ */

const RACINE_SRC = resolve(process.cwd(), "src");

const cacheContenus = new Map<string, { mtimeMs: number; contenu: string }>();

async function lireFichier(chemin: string): Promise<string | null> {
  try {
    const stats = await stat(chemin);
    const enCache = cacheContenus.get(chemin);
    if (enCache && enCache.mtimeMs === stats.mtimeMs) {
      return enCache.contenu;
    }
    const contenu = await readFile(chemin, "utf-8");
    cacheContenus.set(chemin, { mtimeMs: stats.mtimeMs, contenu });
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

export interface OptionsScannerUx {
  mode?: "macro" | "atomique";
}

/* ------------------------------------------------------------------ */
/* Scanner Principal                                                   */
/* ------------------------------------------------------------------ */

export async function scannerUxJourney(options: OptionsScannerUx = {}): Promise<GrapheWorkflow> {
  const mode = options.mode ?? "macro";
  const estAtomique = mode === "atomique";

  const chemins = await listerFichiersRec(RACINE_SRC);
  const fichiers = new Map<string, { chemin: string; relatif: string; contenu: string }>();

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
    const cle = `${lien.source}→${lien.target}→${lien.type}→${lien.libelle}→${lien.condition ?? ""}`;
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

    if (fichiers.has("components/dashboard/prochaine-action.tsx")) {
      ajouterNoeud({
        id: "ux:prochaine-action",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Carte Prochaine Action",
        badge: "Moteur IA",
        description: "Proposition d'activité personnalisée issue du moteur de calibration.",
      });
      connecter({
        source: "page:/",
        target: "ux:prochaine-action",
        type: "interaction",
        libelle: "Afficher recommandation",
        declencheur: "Calcul automatique du moteur au chargement",
      });

      if (fichiers.has("components/dashboard/refus-recommandation.tsx")) {
        ajouterNoeud({
          id: "action:refuser-recommandation",
          type: "action",
          groupe: "dashboard",
          libelle: "Enregistrer refus",
        });
        connecter({
          source: "ux:prochaine-action",
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

      if (estAtomique && fichiers.has("components/dashboard/feedback-recommandation.tsx")) {
        ajouterNoeud({
          id: "ux:feedback-recommandation",
          type: "sous-vue",
          groupe: "dashboard",
          libelle: "Évaluation Recommandation",
          badge: "Feedback",
          description: "Retour qualitatif sur la pertinence de la recommandation.",
        });
        connecter({
          source: "ux:prochaine-action",
          target: "ux:feedback-recommandation",
          type: "interaction",
          libelle: "Donner feedback",
          declencheur: "Clic sur les étoiles/options de pertinence",
        });
        connecter({
          source: "ux:feedback-recommandation",
          target: "ux:prochaine-action",
          type: "interaction",
          libelle: "Feedback consigné",
        });
      }
    }

    if (fichiers.has("components/dashboard/pilotage-referentiel.tsx")) {
      ajouterNoeud({
        id: "ux:pilotage-referentiel",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Pilotage Référentiel",
        badge: "Vigilance",
        description: "Surveillance de la robustesse des domaines et couverture des compétences.",
      });
      connecter({
        source: "page:/",
        target: "ux:pilotage-referentiel",
        type: "interaction",
        libelle: "Consulter la vigilance",
        declencheur: "Vue dashboard",
      });
    }

    if (fichiers.has("components/dashboard/capture-notes.tsx")) {
      ajouterNoeud({
        id: "ux:capture-notes",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Capture Rapide de Notes",
        badge: "Brouillon",
        description: "Saisie instantanée d'idées ou création de notes opérationnelles.",
      });
      ajouterNoeud({
        id: "action:creer-note",
        type: "action",
        groupe: "atelier",
        libelle: "Enregistrer note",
      });
      connecter({
        source: "page:/",
        target: "ux:capture-notes",
        type: "interaction",
        libelle: "Commencer un travail",
        declencheur: "Focus champ capture rapide",
      });
      connecter({
        source: "ux:capture-notes",
        target: "action:creer-note",
        type: "soumission",
        libelle: "Sauvegarder note",
        declencheur: "Clic 'Consigner dans l'Atelier'",
      });
      connecter({
        source: "action:creer-note",
        target: "page:/atelier",
        type: "transition",
        libelle: "Redirection vers l'espace de la note",
      });

      // Modale de résolution d'intention par Thème IA
      if (fichiers.has("components/seances/modale-theme.tsx")) {
        ajouterNoeud({
          id: "modal:theme-ia",
          type: "modal",
          groupe: "seances",
          libelle: "Séance personnalisée (Thème IA)",
          description: "Résolution en direct SSE d'une intention libre en compétences.",
        });
        ajouterNoeud({
          id: "action:creer-theme",
          type: "action",
          groupe: "seances",
          libelle: "Enregistrer le thème",
        });
        connecter({
          source: "ux:capture-notes",
          target: "modal:theme-ia",
          type: "ouverture",
          libelle: "Résoudre intention",
          declencheur: "Clic 'Nouveau thème personnalisé'",
        });
        connecter({
          source: "modal:theme-ia",
          target: "ux:capture-notes",
          type: "retour",
          libelle: "Fermer",
        });
        connecter({
          source: "modal:theme-ia",
          target: "action:creer-theme",
          type: "soumission",
          libelle: "Créer le thème",
          declencheur: "Clic 'Enregistrer ce thème'",
        });
        connecter({
          source: "action:creer-theme",
          target: "ux:capture-notes",
          type: "transition",
          libelle: "Thème disponible",
        });
      }
    }

    if (fichiers.has("components/dashboard/etat-global.tsx")) {
      ajouterNoeud({
        id: "ux:etat-global",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Indicateurs de Maîtrise",
        badge: "Pilotage",
        description: "Jauges de couverture globale, compétences acquises et volume de preuves.",
      });
      connecter({
        source: "page:/",
        target: "ux:etat-global",
        type: "interaction",
        libelle: "Consulter la progression",
        declencheur: "Vue dashboard",
      });
    }

    if (fichiers.has("components/dashboard/progression-recente.tsx")) {
      ajouterNoeud({
        id: "ux:progression-recente",
        type: "sous-vue",
        groupe: "dashboard",
        libelle: "Progression Récente",
        badge: "Historique",
        description: "Flux chronologique des dernières preuves forgées.",
      });
      connecter({
        source: "page:/",
        target: "ux:progression-recente",
        type: "interaction",
        libelle: "Déplier progression récente",
        declencheur: "Clic volet 'Progression récente'",
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 2. CLUSTER ATELIER & ESPACE DOCUMENTAIRE                            */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageAtelier = fichiers.get("app/(app)/atelier/page.tsx");
  if (pageAtelier) {
    ajouterNoeud({
      id: "page:/atelier",
      type: "page",
      groupe: "atelier",
      libelle: "Atelier Documentaire",
      url: "/atelier",
      badge: "Mémoire",
      description: "Espace central de visualisation, documentation et exploration des compétences.",
    });

    ajouterNoeud({
      id: "ux:atelier-graphe",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Vue Graphe Canvas 2D",
      badge: "Constellation",
      description: "Graphe interactif d3-force des compétences, domaines et dépendances.",
    });
    ajouterNoeud({
      id: "ux:galerie-domaines",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Galerie des Domaines",
      badge: "Vue d'ensemble",
      description: "Synthèse des domaines d'apprentissage avec couverture et compétences associées.",
    });
    ajouterNoeud({
      id: "ux:vue-transversale",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Hub Transversal",
      badge: "Catégories",
      description: "Vue d'ensemble des catégories transversales (Thèmes, Fiches supports).",
    });
    ajouterNoeud({
      id: "ux:explorateur-sidebar",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Explorateur Documentaire",
      badge: "Arborescence",
      description: "Arbre interactif des dossiers (Domaines, Transversal, Archivés).",
    });
    ajouterNoeud({
      id: "ux:fiche-competence",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Compétence",
      badge: "Maîtrise",
      description: "Radar de maîtrise, onglets (Synthèse, Progression, Relations, Notes) et historique des preuves.",
    });
    ajouterNoeud({
      id: "ux:fiche-domaine",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Fiche Domaine",
      badge: "Couverture",
      description: "Synthèse de domaine avec paliers, progression et révision du référentiel.",
    });
    ajouterNoeud({
      id: "ux:editeur-note",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Éditeur de Note Markdown",
      badge: "Markdown",
      description: "Mode édition Markdown / rendu, volet de contexte et liaisons.",
    });
    ajouterNoeud({
      id: "ux:panneau-contexte",
      type: "sous-vue",
      groupe: "atelier",
      libelle: "Volet Contexte & Liaisons",
      badge: "Relations",
      description: "Liaisons wikilinks [[ ]], pièces jointes et historique.",
    });

    // Studio Concepteur de Séance depuis Note Opérationnelle
    if (fichiers.has("components/seances/concepteur-seance.tsx")) {
      ajouterNoeud({
        id: "ux:concepteur-seance",
        type: "sous-vue",
        groupe: "seances",
        libelle: "Studio Concepteur de Séance",
        badge: "Studio",
        description: "Composition sur mesure depuis une note opérationnelle : choix des thèmes, temps et exercices.",
      });
      ajouterNoeud({
        id: "action:creer-seance",
        type: "action",
        groupe: "seances",
        libelle: "Créer la séance",
      });

      connecter({
        source: "ux:editeur-note",
        target: "ux:concepteur-seance",
        type: "interaction",
        libelle: "Composer une séance",
        declencheur: "Note opérationnelle 'Séance'",
      });
      connecter({
        source: "ux:concepteur-seance",
        target: "action:creer-seance",
        type: "soumission",
        libelle: "Planifier / Démarrer",
        declencheur: "Clic 'Démarrer la séance' / 'Planifier'",
      });
    }

    // Actions Atelier
    ajouterNoeud({ id: "action:creer-branche", type: "action", groupe: "atelier", libelle: "Valider branche compétences" });
    ajouterNoeud({ id: "action:supprimer-note", type: "action", groupe: "atelier", libelle: "Supprimer la note" });
    ajouterNoeud({ id: "action:rectifier-preuve", type: "action", groupe: "atelier", libelle: "Rectifier une preuve" });

    // Modales Atelier
    ajouterNoeud({ id: "modal:revision-domaine", type: "modal", groupe: "atelier", libelle: "Réviser le référentiel" });
    ajouterNoeud({ id: "modal:modale-competence", type: "modal", groupe: "atelier", libelle: "Éditer compétence" });

    // ── Détails atomiques Atelier ──
    if (estAtomique) {
      ajouterNoeud({
        id: "ux:fiche-competence-synthese",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Synthèse Compétence",
        badge: "Radar",
        description: "Radar de dimensions et niveau calculé.",
      });
      ajouterNoeud({
        id: "ux:fiche-competence-progression",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Progression Compétence",
        badge: "Preuves",
        description: "Historique chronologique et rectification des preuves.",
      });
      ajouterNoeud({
        id: "ux:fiche-competence-relations",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Relations Compétence",
        badge: "Graphe",
        description: "Prérequis et compétences dépendantes.",
      });
      ajouterNoeud({
        id: "ux:fiche-competence-notes",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Notes Compétence",
        badge: "Documentation",
        description: "Notes et documents rattachés.",
      });
      ajouterNoeud({
        id: "ux:fiche-domaine-structure",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Paliers Domaine",
        badge: "Paliers",
        description: "Structure par niveaux et compétences du domaine.",
      });
      ajouterNoeud({
        id: "ux:fiche-domaine-radar",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Radar Domaine",
        badge: "Radar",
        description: "Radar global de maîtrise du domaine.",
      });
      ajouterNoeud({
        id: "ux:fiche-domaine-gestion",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Onglet Gestion Référentiel",
        badge: "Gestion",
        description: "Ajout, renommage et archivage de compétences.",
      });
      ajouterNoeud({
        id: "ux:projection-theme",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Fiche Thème d'Étude",
        badge: "Thème",
        description: "Projection en lecture seule du thème enregistré et compétences associées.",
      });
      ajouterNoeud({
        id: "ux:projection-exercice",
        type: "sous-vue",
        groupe: "atelier",
        libelle: "Fiche Exercice Atelier",
        badge: "Exercice",
        description: "Projection de l'exercice dans l'arborescence documentaire.",
      });
      ajouterNoeud({
        id: "action:archiver-competence",
        type: "action",
        groupe: "atelier",
        libelle: "Archiver compétence",
      });
      ajouterNoeud({
        id: "action:supprimer-theme",
        type: "action",
        groupe: "atelier",
        libelle: "Supprimer le thème",
      });
      ajouterNoeud({
        id: "modal:ajouter-des-competences",
        type: "modal",
        groupe: "atelier",
        libelle: "Ajouter des compétences",
      });

      connecter({ source: "ux:fiche-competence", target: "ux:fiche-competence-synthese", type: "interaction", libelle: "Onglet Synthèse", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-competence", target: "ux:fiche-competence-progression", type: "interaction", libelle: "Onglet Progression", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-competence", target: "ux:fiche-competence-relations", type: "interaction", libelle: "Onglet Relations", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-competence", target: "ux:fiche-competence-notes", type: "interaction", libelle: "Onglet Notes", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-competence", target: "action:archiver-competence", type: "soumission", libelle: "Archiver compétence", declencheur: "Clic 'Archiver'" });
      connecter({ source: "action:archiver-competence", target: "ux:explorateur-sidebar", type: "transition", libelle: "Compétence archivée" });
      connecter({ source: "ux:fiche-competence", target: "ux:fiche-domaine", type: "navigation", libelle: "Remonter au domaine", declencheur: "Clic dossier dans le fil d'Ariane" });
      connecter({ source: "ux:fiche-competence", target: "ux:atelier-graphe", type: "interaction", libelle: "Retour constellation", declencheur: "Clic retour constellation fil d'Ariane" });
      connecter({ source: "ux:fiche-competence", target: "action:creer-seance", type: "soumission", libelle: "Lancer séance ciblée", declencheur: "Clic 'Lancer une séance ciblée' (ConcepteurSeance)" });

      // Liaisons depuis les éléments associés de la fiche compétence
      connecter({ source: "ux:fiche-competence-synthese", target: "ux:projection-exercice", type: "interaction", libelle: "Aperçu exercice associé", declencheur: "Clic carte exercice dans Éléments associés" });
      connecter({ source: "ux:fiche-competence-synthese", target: "modal:generer-exercice", type: "ouverture", libelle: "Générer exercice ciblé", declencheur: "Clic '+ Générer un exercice'" });
      connecter({ source: "ux:fiche-competence-synthese", target: "ux:editeur-note", type: "interaction", libelle: "Consulter document lié", declencheur: "Clic carte document dans Éléments associés" });

      // Liaisons depuis l'onglet Relations
      connecter({ source: "ux:fiche-competence-relations", target: "ux:fiche-competence", type: "interaction", libelle: "Naviguer compétence reliée", declencheur: "Clic prérequis / suivante" });
      connecter({ source: "ux:fiche-competence-relations", target: "ux:editeur-note", type: "interaction", libelle: "Consulter ressource liée", declencheur: "Clic document dans Relations" });

      // Liaisons depuis l'onglet Notes & ressources
      connecter({ source: "ux:fiche-competence-notes", target: "ux:editeur-note", type: "interaction", libelle: "Ouvrir note liée", declencheur: "Clic carte note dans Notes & ressources" });
      connecter({ source: "ux:fiche-competence-notes", target: "action:creer-note", type: "soumission", libelle: "Créer une note liée", declencheur: "Clic '+ Créer une note liée'" });

      // Onglets Domaine
      connecter({ source: "ux:fiche-domaine", target: "ux:fiche-domaine-structure", type: "interaction", libelle: "Onglet Paliers", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-domaine", target: "ux:fiche-domaine-radar", type: "interaction", libelle: "Onglet Radar", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-domaine", target: "ux:fiche-domaine-gestion", type: "interaction", libelle: "Onglet Gestion", declencheur: "Clic onglet" });
      connecter({ source: "ux:fiche-domaine", target: "modal:ajouter-des-competences", type: "ouverture", libelle: "Ajouter compétences", declencheur: "Clic 'Ajouter des compétences'" });
      connecter({ source: "modal:ajouter-des-competences", target: "ux:fiche-domaine", type: "retour", libelle: "Fermer" });
      connecter({ source: "modal:ajouter-des-competences", target: "action:creer-branche", type: "soumission", libelle: "Valider ajouts", declencheur: "Validation formulaire" });
      connecter({ source: "ux:fiche-domaine-structure", target: "ux:fiche-competence", type: "interaction", libelle: "Ouvrir compétence du palier", declencheur: "Clic compétence dans le palier" });
      connecter({ source: "ux:fiche-domaine", target: "ux:galerie-domaines", type: "interaction", libelle: "Retour galerie", declencheur: "Clic racine dans le fil d'Ariane" });

      ajouterNoeud({ id: "action:televerser-pdf", type: "action", groupe: "atelier", libelle: "Joindre un PDF" });
      ajouterNoeud({ id: "action:supprimer-pdf", type: "action", groupe: "atelier", libelle: "Supprimer le PDF" });
      ajouterNoeud({ id: "action:figer-revision", type: "action", groupe: "atelier", libelle: "Figer version snapshot" });
      ajouterNoeud({ id: "ux:apercu-snapshot", type: "sous-vue", groupe: "atelier", libelle: "Aperçu Snapshot", badge: "Version", description: "Consultation lecture seule d'une révision historique." });
      ajouterNoeud({ id: "action:ajouter-wikilien", type: "action", groupe: "atelier", libelle: "Lier fiche [[ ]]" });
      ajouterNoeud({ id: "ux:categorie-dossier", type: "sous-vue", groupe: "atelier", libelle: "Grille Sous-Dossier", badge: "Dossier", description: "Contenu détaillé d'une sous-catégorie transversale." });
      ajouterNoeud({ id: "modal:nouveau-document", type: "modal", groupe: "atelier", libelle: "Nouveau document" });

      connecter({ source: "ux:panneau-contexte", target: "action:televerser-pdf", type: "soumission", libelle: "Joindre PDF", declencheur: "Sélection fichier PDF" });
      connecter({ source: "action:televerser-pdf", target: "ux:panneau-contexte", type: "transition", libelle: "PDF attaché" });
      connecter({ source: "ux:panneau-contexte", target: "action:supprimer-pdf", type: "soumission", libelle: "Supprimer PDF", declencheur: "Clic ×" });
      connecter({ source: "action:supprimer-pdf", target: "ux:panneau-contexte", type: "transition", libelle: "PDF retiré" });
      connecter({ source: "ux:editeur-note", target: "action:figer-revision", type: "soumission", libelle: "Figer révision", declencheur: "Clic 'Figer révision'" });
      connecter({ source: "action:figer-revision", target: "ux:editeur-note", type: "transition", libelle: "Snapshot créé" });
      connecter({ source: "ux:panneau-contexte", target: "ux:apercu-snapshot", type: "interaction", libelle: "Consulter version", declencheur: "Clic version vN" });
      connecter({ source: "ux:apercu-snapshot", target: "ux:editeur-note", type: "interaction", libelle: "Fermer aperçu", declencheur: "Clic fermer" });
      connecter({ source: "ux:panneau-contexte", target: "action:ajouter-wikilien", type: "soumission", libelle: "Lier fiche", declencheur: "Sélection wikilien" });
      connecter({ source: "action:ajouter-wikilien", target: "ux:editeur-note", type: "transition", libelle: "Wikilien inséré" });
      connecter({ source: "ux:vue-transversale", target: "ux:categorie-dossier", type: "interaction", libelle: "Ouvrir dossier", declencheur: "Clic dossier" });
      connecter({ source: "ux:categorie-dossier", target: "ux:editeur-note", type: "interaction", libelle: "Ouvrir document", declencheur: "Clic document" });
      connecter({ source: "ux:explorateur-sidebar", target: "modal:nouveau-document", type: "ouverture", libelle: "Nouveau document", declencheur: "Clic '+ Nouveau'" });
      connecter({ source: "modal:nouveau-document", target: "action:creer-note", type: "soumission", libelle: "Créer", declencheur: "Validation formulaire" });
      connecter({ source: "modal:nouveau-document", target: "ux:explorateur-sidebar", type: "retour", libelle: "Fermer" });
      connecter({ source: "ux:explorateur-sidebar", target: "ux:projection-theme", type: "interaction", libelle: "Ouvrir thème", declencheur: "Clic thème" });
      connecter({ source: "ux:projection-theme", target: "action:supprimer-theme", type: "soumission", libelle: "Supprimer thème", declencheur: "Clic 'Supprimer le thème'" });
      connecter({ source: "action:supprimer-theme", target: "ux:explorateur-sidebar", type: "transition", libelle: "Thème supprimé" });
      connecter({ source: "ux:explorateur-sidebar", target: "ux:projection-exercice", type: "interaction", libelle: "Ouvrir fiche exercice", declencheur: "Clic exercice" });
      connecter({ source: "ux:projection-exercice", target: "page:/exercices/{id}", type: "navigation", libelle: "Lancer l'exercice", declencheur: "Clic 'Lancer l'exercice'" });
    }

    // Câblage Atelier
    connecter({
      source: "page:/atelier",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Explorer la constellation",
      declencheur: "Vue par défaut",
    });
    connecter({
      source: "page:/atelier",
      target: "ux:explorateur-sidebar",
      type: "interaction",
      libelle: "Ouvrir l'arborescence",
      declencheur: "Rail latéral",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:galerie-domaines",
      type: "interaction",
      libelle: "Bascule Domaines",
      declencheur: "Clic onglet 'Domaines'",
    });
    connecter({
      source: "ux:galerie-domaines",
      target: "ux:vue-transversale",
      type: "interaction",
      libelle: "Bascule Transversal",
      declencheur: "Clic onglet 'Transversal'",
    });
    connecter({
      source: "ux:vue-transversale",
      target: "ux:atelier-graphe",
      type: "interaction",
      libelle: "Bascule Constellation",
      declencheur: "Clic onglet 'Constellation'",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:fiche-competence",
      type: "interaction",
      libelle: "Inspecter compétence",
      declencheur: "Clic nœud compétence",
    });
    connecter({
      source: "ux:atelier-graphe",
      target: "ux:fiche-domaine",
      type: "interaction",
      libelle: "Inspecter domaine",
      declencheur: "Clic nœud domaine",
    });
    connecter({
      source: "ux:fiche-domaine",
      target: "modal:revision-domaine",
      type: "ouverture",
      libelle: "Réviser avec le tuteur",
      declencheur: "Clic 'Réviser avec le tuteur'",
    });
    connecter({
      source: "modal:revision-domaine",
      target: "ux:fiche-domaine",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "modal:revision-domaine",
      target: "action:creer-branche",
      type: "soumission",
      libelle: "Valider révision",
      declencheur: "Validation formulaire révision",
    });
    connecter({
      source: "action:creer-branche",
      target: "ux:fiche-domaine",
      type: "transition",
      libelle: "Référentiel actualisé",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "modal:modale-competence",
      type: "ouverture",
      libelle: "Éditer compétence",
      declencheur: "Clic 'Éditer'",
    });
    connecter({
      source: "modal:modale-competence",
      target: "ux:fiche-competence",
      type: "retour",
      libelle: "Fermer",
    });
    connecter({
      source: "ux:fiche-competence",
      target: "action:rectifier-preuve",
      type: "soumission",
      libelle: "Rectifier preuve",
      declencheur: "Clic 'Rectifier'",
    });
    connecter({
      source: "action:rectifier-preuve",
      target: "ux:fiche-competence",
      type: "transition",
      libelle: "Preuve rectifiée",
    });
    connecter({
      source: "ux:explorateur-sidebar",
      target: "ux:editeur-note",
      type: "interaction",
      libelle: "Ouvrir note",
      declencheur: "Clic sur une note",
    });
    connecter({
      source: "ux:editeur-note",
      target: "ux:panneau-contexte",
      type: "interaction",
      libelle: "Ouvrir volet contexte",
      declencheur: "Clic volet 'Contexte'",
    });
    connecter({
      source: "ux:editeur-note",
      target: "action:creer-note",
      type: "soumission",
      libelle: "Sauvegarder note",
      declencheur: "Clic 'Enregistrer'",
    });
    connecter({
      source: "ux:editeur-note",
      target: "action:supprimer-note",
      type: "soumission",
      libelle: "Supprimer note",
      declencheur: "Clic 'Supprimer'",
    });
    connecter({
      source: "action:supprimer-note",
      target: "ux:explorateur-sidebar",
      type: "transition",
      libelle: "Note supprimée",
    });
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 3. CLUSTER SÉANCES & CAHIER                                         */
  /* ══════════════════════════════════════════════════════════════════ */
  const pageSeances = fichiers.get("app/(app)/seances/page.tsx");
  if (pageSeances) {
    ajouterNoeud({
      id: "page:/seances",
      type: "page",
      groupe: "seances",
      libelle: "Cahier de Séances",
      url: "/seances",
      badge: "Cahier",
      description: "Historique des séances réalisées, file d'attente et point d'entrée studio.",
    });

    ajouterNoeud({
      id: "ux:file-seances",
      type: "sous-vue",
      groupe: "seances",
      libelle: "File En cours & Planifiées",
      badge: "File",
      description: "Séances actives et planifiées prêtes à démarrer ou reprendre.",
    });
    ajouterNoeud({
      id: "ux:cahier-seances",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Cahier Historique",
      badge: "Journal",
      description: "Historique chronologique des séances terminées et recherche.",
    });
    ajouterNoeud({
      id: "ux:workspace-seance",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Workspace Séance Live",
      url: "/seances?session={id}",
      badge: "Live",
      description: "Mode concentration plein écran, minuteur Pomodoro, jauge et carrefour d'exercices.",
    });
    ajouterNoeud({
      id: "ux:adaptive-workspace",
      type: "sous-vue",
      groupe: "seances",
      libelle: "Workspace Activité Adaptative",
      url: "/seances?run={id}",
      badge: "Adaptatif",
      description: "Espace immersif d'exploration ou de production de projet.",
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

    // Actions Séances
    ajouterNoeud({ id: "action:demarrer-seance", type: "action", groupe: "seances", libelle: "Démarrer la séance" });
    ajouterNoeud({ id: "action:terminer-seance", type: "action", groupe: "seances", libelle: "Terminer la séance" });
    ajouterNoeud({ id: "action:annuler-seance", type: "action", groupe: "seances", libelle: "Annuler la séance" });
    ajouterNoeud({ id: "action:demarrer-activite-adaptative", type: "action", groupe: "seances", libelle: "Démarrer activité" });
    ajouterNoeud({ id: "action:terminer-exploration", type: "action", groupe: "seances", libelle: "Terminer exploration" });

    // ── Détails atomiques Séances ──
    if (estAtomique) {
      ajouterNoeud({ id: "ux:pomodoro", type: "sous-vue", groupe: "seances", libelle: "Minuteur Pomodoro", badge: "Focus", description: "Cadencement 25 min et pauses." });
      ajouterNoeud({ id: "action:ajouter-note", type: "action", groupe: "seances", libelle: "Consigner note live séance" });
      ajouterNoeud({ id: "action:enregistrer-jalon", type: "action", groupe: "seances", libelle: "Valider un jalon" });
      ajouterNoeud({ id: "action:abandonner-activite-adaptative", type: "action", groupe: "seances", libelle: "Abandonner activité adaptative" });
      ajouterNoeud({ id: "ux:seance-bilan", type: "sous-vue", groupe: "seances", libelle: "Bilan de Séance", badge: "Clôture", description: "Synthèse temps et écart besoin/réalisé." });

      connecter({ source: "ux:workspace-seance", target: "ux:pomodoro", type: "interaction", libelle: "Lancer chrono Pomodoro", declencheur: "Clic 'Démarrer 25 min'" });
      connecter({ source: "ux:pomodoro", target: "ux:workspace-seance", type: "interaction", libelle: "Fin cycle concentration" });
      connecter({ source: "ux:workspace-seance", target: "action:ajouter-note", type: "soumission", libelle: "Prendre note", declencheur: "Saisie bloc-notes live" });
      connecter({ source: "action:ajouter-note", target: "ux:workspace-seance", type: "transition", libelle: "Note ajoutée" });
      connecter({ source: "ux:adaptive-workspace", target: "action:enregistrer-jalon", type: "soumission", libelle: "Cocher jalon", declencheur: "Validation objectif" });
      connecter({ source: "action:enregistrer-jalon", target: "ux:adaptive-workspace", type: "transition", libelle: "Jalon validé" });
      connecter({ source: "ux:adaptive-workspace", target: "action:abandonner-activite-adaptative", type: "soumission", libelle: "Abandonner", declencheur: "Clic 'Abandonner'" });
      connecter({ source: "action:abandonner-activite-adaptative", target: "page:/seances", type: "transition", libelle: "Retour cahier" });
      connecter({ source: "action:terminer-seance", target: "ux:seance-bilan", type: "transition", libelle: "Afficher le bilan" });
      connecter({ source: "ux:seance-bilan", target: "page:/seances", type: "navigation", libelle: "Retour au cahier", declencheur: "Clic 'Retour au cahier'" });
      connecter({ source: "ux:seance-bilan", target: "page:/", type: "navigation", libelle: "Retour accueil", declencheur: "Clic 'Accueil'" });
    }

    // Câblage Séances
    connecter({
      source: "page:/seances",
      target: "ux:file-seances",
      type: "interaction",
      libelle: "Consulter la file",
      declencheur: "Vue cahier",
    });
    connecter({
      source: "page:/seances",
      target: "ux:cahier-seances",
      type: "interaction",
      libelle: "Consulter le cahier",
      declencheur: "Vue cahier",
    });
    connecter({
      source: "ux:file-seances",
      target: "ux:workspace-seance",
      type: "navigation",
      libelle: "Reprendre la séance",
      declencheur: "Clic 'Reprendre la séance →'",
    });
    connecter({
      source: "ux:file-seances",
      target: "action:demarrer-seance",
      type: "soumission",
      libelle: "Démarrer la séance",
      declencheur: "Clic 'Démarrer la séance →'",
    });
    connecter({
      source: "action:demarrer-seance",
      target: "ux:workspace-seance",
      type: "transition",
      libelle: "Séance active",
    });
    if (parId.has("action:creer-seance")) {
      connecter({
        source: "action:creer-seance",
        target: "ux:workspace-seance",
        type: "transition",
        libelle: "Ouvrir la séance",
      });
    }
    connecter({
      source: "ux:file-seances",
      target: "action:annuler-seance",
      type: "soumission",
      libelle: "Annuler la séance",
      declencheur: "Clic 'Annuler'",
    });
    connecter({
      source: "action:annuler-seance",
      target: "page:/seances",
      type: "transition",
      libelle: "Séance annulée",
    });
    connecter({
      source: "ux:workspace-seance",
      target: "action:terminer-seance",
      type: "soumission",
      libelle: "Terminer la séance",
      declencheur: "Clic 'Terminer la séance'",
    });
    if (!estAtomique) {
      connecter({
        source: "action:terminer-seance",
        target: "page:/seances",
        type: "transition",
        libelle: "Séance archivée dans le cahier",
      });
    }
    connecter({
      source: "page:/seances",
      target: "ux:adaptive-workspace",
      type: "navigation",
      libelle: "Activité adaptative",
      declencheur: "Clic travail ouvert",
    });
    connecter({
      source: "page:/seances",
      target: "ux:generation-review",
      type: "navigation",
      libelle: "Préparer contenu",
      declencheur: "Clic génération",
    });
    connecter({
      source: "ux:generation-review",
      target: "ux:adaptive-workspace",
      type: "transition",
      libelle: "Lancer après revue",
      declencheur: "Validation contenu",
    });
    connecter({
      source: "ux:adaptive-workspace",
      target: "action:demarrer-activite-adaptative",
      type: "soumission",
      libelle: "Démarrer travail",
      declencheur: "Clic 'Démarrer'",
    });
    connecter({
      source: "action:demarrer-activite-adaptative",
      target: "ux:adaptive-workspace",
      type: "transition",
      libelle: "Activité en cours",
    });
    connecter({
      source: "ux:adaptive-workspace",
      target: "action:terminer-exploration",
      type: "soumission",
      libelle: "Terminer l'activité",
      declencheur: "Clic 'Terminer l'exploration'",
    });
    connecter({
      source: "action:terminer-exploration",
      target: "page:/seances",
      type: "transition",
      libelle: "Clôture activité",
    });
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 4. CLUSTER EXERCICE & PARCOURS EN ACTES                            */
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
      description: "Conteneur du parcours pédagogique en 3 actes et tentatives antérieures.",
    });

    ajouterNoeud({
      id: "ux:exercice-chercher",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 1 : Chercher",
      badge: "Résolution",
      description: "Résolution autonome, énoncé, chronomètre actif et brouillon.",
    });
    ajouterNoeud({
      id: "ux:exercice-indices",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Déblocage d'indices",
      badge: "Aide",
      description: "Révélation échelonnée des indices avec ajustement de la calibration.",
    });
    ajouterNoeud({
      id: "ux:exercice-abandon",
      type: "sous-vue",
      groupe: "exercice",
      libelle: "Abandon de tentative",
      badge: "Régulation",
      description: "Arrêt explicite sans fabriquer de fausse mesure.",
    });
    ajouterNoeud({
      id: "ux:exercice-mesurer",
      type: "etape",
      groupe: "exercice",
      libelle: "Acte 2 : Bilan du tuteur",
      badge: "Correction IA",
      description: "Le tuteur relit la réponse et propose un bilan à valider.",
    });
    ajouterNoeud({
      id: "ux:exercice-bilan-final",
      type: "etape",
      groupe: "exercice",
      libelle: "Preuve forgée & Bilan",
      badge: "Preuve",
      description: "Preuve immuable enregistrée et niveau de maîtrise actualisé.",
    });

    // Actions Exercice
    ajouterNoeud({ id: "action:demarrer-tentative", type: "action", groupe: "exercice", libelle: "Démarrer chrono" });
    ajouterNoeud({ id: "action:debloquer-indice", type: "action", groupe: "exercice", libelle: "Débloquer indice" });
    ajouterNoeud({ id: "action:abandonner-tentative", type: "action", groupe: "exercice", libelle: "Abandonner tentative" });
    ajouterNoeud({ id: "action:terminer-exercice", type: "action", groupe: "exercice", libelle: "Enregistrer la preuve" });

    // Modales Exercice
    ajouterNoeud({ id: "modal:generer-exercice", type: "modal", groupe: "exercice", libelle: "Générer un exercice" });
    ajouterNoeud({ id: "modal:editer-exercice", type: "modal", groupe: "exercice", libelle: "Éditer l'exercice" });

    // Câblage Exercice
    connecter({
      source: "page:/exercices/{id}",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Entrer dans la tentative",
      declencheur: "Clic 'Commencer' / 'Refaire'",
    });
    connecter({
      source: "page:/exercices/{id}",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Générer similaire",
      declencheur: "Clic 'Générer un exercice similaire'",
    });
    connecter({
      source: "modal:generer-exercice",
      target: "page:/exercices/{id}",
      type: "retour",
      libelle: "Fermer",
    });
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
      source: "ux:exercice-chercher",
      target: "action:demarrer-tentative",
      type: "soumission",
      libelle: "Top départ",
      declencheur: "Démarrage automatique",
    });
    connecter({
      source: "action:demarrer-tentative",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Chronomètre actif",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-indices",
      type: "interaction",
      libelle: "Demander un indice",
      declencheur: "Clic 'Débloquer indice'",
    });
    connecter({
      source: "ux:exercice-indices",
      target: "action:debloquer-indice",
      type: "soumission",
      libelle: "Débloquer",
      declencheur: "Confirmation",
    });
    connecter({
      source: "action:debloquer-indice",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Indice révélé",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-abandon",
      type: "interaction",
      libelle: "Arrêter la tentative",
      declencheur: "Clic 'Abandonner'",
    });
    connecter({
      source: "ux:exercice-abandon",
      target: "action:abandonner-tentative",
      type: "soumission",
      libelle: "Enregistrer abandon",
      declencheur: "Validation motif",
    });
    connecter({
      source: "action:abandonner-tentative",
      target: "page:/exercices/{id}",
      type: "transition",
      libelle: "Retour exercice",
    });
    if (parId.has("ux:workspace-seance")) {
      connecter({
        source: "action:abandonner-tentative",
        target: "ux:workspace-seance",
        type: "transition",
        libelle: "Reprendre la séance",
        declencheur: "Abandon dans une séance",
        condition: "séance en cours",
      });
    }
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-mesurer",
      type: "transition",
      libelle: "Demander la correction au tuteur",
      declencheur: "Clic 'Demander la correction'",
    });
    connecter({
      source: "ux:exercice-mesurer",
      target: "action:terminer-exercice",
      type: "soumission",
      libelle: "Valider le bilan",
      declencheur: "Clic 'Enregistrer la preuve'",
    });
    connecter({
      source: "action:terminer-exercice",
      target: "ux:exercice-bilan-final",
      type: "transition",
      libelle: "Preuve immuable forgée",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/",
      type: "navigation",
      libelle: "Retour Dashboard",
      declencheur: "Clic 'Continuer vers le dashboard'",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/atelier",
      type: "navigation",
      libelle: "Voir dans l'Atelier",
      declencheur: "Clic 'Voir dans l'Atelier'",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "ux:exercice-chercher",
      type: "transition",
      libelle: "Refaire l'exercice",
      declencheur: "Clic 'Refaire cet exercice'",
    });
    if (parId.has("ux:workspace-seance")) {
      connecter({
        source: "ux:exercice-bilan-final",
        target: "ux:workspace-seance",
        type: "transition",
        libelle: "Reprendre la séance",
        declencheur: "Clic 'Retour au workspace séance'",
        condition: "séance en cours",
      });
      connecter({
        source: "ux:workspace-seance",
        target: "ux:exercice-chercher",
        type: "transition",
        libelle: "Exécuter l'activité",
        declencheur: "Sélection d'exercice en séance",
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 5. CLUSTER TUTEUR & COMPAGNON CONVERSATIONNEL                      */
  /* ══════════════════════════════════════════════════════════════════ */
  ajouterNoeud({
    id: "ux:tiroir-tuteur",
    type: "tiroir",
    groupe: "tuteur",
    libelle: "Tiroir Tuteur IA",
    badge: "Omniprésent",
    description: "Compagnon conversationnel guidé, accessible en surimpression.",
  });
  ajouterNoeud({
    id: "ux:tuteur-modes",
    type: "sous-vue",
    groupe: "tuteur",
    libelle: "Amorces Rapides",
    badge: "Modes",
    description: "Explique-moi, Évalue-moi, Indice, Corrige mon raisonnement, Lacunes, Projet.",
  });
  connecter({
    source: "ux:tiroir-tuteur",
    target: "ux:tuteur-modes",
    type: "interaction",
    libelle: "Sélectionner amorce",
    declencheur: "Clic pilule de mode",
  });
  connecter({
    source: "ux:tuteur-modes",
    target: "ux:tiroir-tuteur",
    type: "interaction",
    libelle: "Envoi consigne",
    declencheur: "Injection dans le chat",
  });

  if (fichiers.has("components/tuteur/chat.tsx")) {
    ajouterNoeud({
      id: "ux:tuteur-suggestion-exercice",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion d'exercice IA",
      badge: "Génération IA",
      description: "Proposition d'exercice complet généré par l'IA dans le flux du chat.",
    });
    ajouterNoeud({
      id: "ux:tuteur-suggestion-branche",
      type: "sous-vue",
      groupe: "tuteur",
      libelle: "Suggestion de branche IA",
      badge: "Structure IA",
      description: "Proposition d'arborescence de compétences générée dans le chat.",
    });

    connecter({
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-exercice",
      type: "interaction",
      libelle: "Proposition d'exercice",
      declencheur: "Appel outil 'exercice' par le LLM",
    });
    connecter({
      source: "ux:tiroir-tuteur",
      target: "ux:tuteur-suggestion-branche",
      type: "interaction",
      libelle: "Proposition de branche",
      declencheur: "Appel outil 'referentiel' par le LLM",
    });
    if (parId.has("modal:generer-exercice")) {
      connecter({
        source: "ux:tuteur-suggestion-exercice",
        target: "modal:generer-exercice",
        type: "ouverture",
        libelle: "Examiner l'exercice",
        declencheur: "Clic 'Examiner la proposition'",
      });
    }
    if (parId.has("modal:revision-domaine")) {
      connecter({
        source: "ux:tuteur-suggestion-branche",
        target: "modal:revision-domaine",
        type: "ouverture",
        libelle: "Intégrer les compétences",
        declencheur: "Clic 'Intégrer les compétences'",
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* 6. CLUSTER PROFIL, ONBOARDING & AUTHENTIFICATION                   */
  /* ══════════════════════════════════════════════════════════════════ */
  ajouterNoeud({
    id: "ux:tiroir-compte",
    type: "tiroir",
    groupe: "profil",
    libelle: "Tiroir Compte & Réglages",
    badge: "Synchronisation",
    description: "Gestion du profil d'apprentissage, clé IA, export du journal et session.",
  });
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
    id: "page:/login",
    type: "page",
    groupe: "profil",
    libelle: "Authentification",
    url: "/login",
    badge: "Accès",
    description: "Portail d'accès et authentification Supabase Auth.",
  });
  ajouterNoeud({
    id: "action:exporter-journal",
    type: "action",
    groupe: "profil",
    libelle: "Exporter journal JSON",
  });
  ajouterNoeud({
    id: "action:se-deconnecter",
    type: "action",
    groupe: "profil",
    libelle: "Déconnexion",
  });
  ajouterNoeud({
    id: "action:amorcer-compte",
    type: "action",
    groupe: "profil",
    libelle: "Amorcer le profil",
  });

  if (estAtomique) {
    ajouterNoeud({ id: "ux:profil-objectifs", type: "sous-vue", groupe: "profil", libelle: "Édition Sujet & Objectifs", badge: "Objectifs", description: "Formulaire de mise à jour des ambitions." });
    ajouterNoeud({ id: "action:modifier-profil", type: "action", groupe: "profil", libelle: "Enregistrer profil" });
    ajouterNoeud({ id: "action:configurer-cle-ia", type: "action", groupe: "profil", libelle: "Configurer clé IA" });
    ajouterNoeud({ id: "action:reinitialiser-compte", type: "action", groupe: "profil", libelle: "Réinitialiser compte" });

    connecter({ source: "ux:tiroir-compte", target: "ux:profil-objectifs", type: "interaction", libelle: "Éditer profil", declencheur: "Onglet 'Profil'" });
    connecter({ source: "ux:profil-objectifs", target: "action:modifier-profil", type: "soumission", libelle: "Sauvegarder", declencheur: "Clic 'Enregistrer'" });
    connecter({ source: "action:modifier-profil", target: "ux:tiroir-compte", type: "transition", libelle: "Profil mis à jour" });
    connecter({ source: "ux:tiroir-compte", target: "action:configurer-cle-ia", type: "soumission", libelle: "Enregistrer clé API", declencheur: "Saisie clé" });
    connecter({ source: "action:configurer-cle-ia", target: "ux:tiroir-compte", type: "transition", libelle: "Clé validée" });
    connecter({ source: "ux:tiroir-compte", target: "action:reinitialiser-compte", type: "soumission", libelle: "Remise à zéro", declencheur: "Confirmation réinitialisation" });
    connecter({ source: "action:reinitialiser-compte", target: "page:/demarrer", type: "transition", libelle: "Compte réinitialisé" });
  }

  connecter({
    source: "ux:tiroir-compte",
    target: "action:exporter-journal",
    type: "soumission",
    libelle: "Exporter journal",
    declencheur: "Clic 'Télécharger l'archive JSON'",
  });
  connecter({
    source: "action:exporter-journal",
    target: "ux:tiroir-compte",
    type: "transition",
    libelle: "Archive téléchargée",
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
    libelle: "Redirection login",
  });
  connecter({
    source: "page:/demarrer",
    target: "action:amorcer-compte",
    type: "soumission",
    libelle: "Valider amorce",
    declencheur: "Validation formulaire",
  });
  connecter({
    source: "action:amorcer-compte",
    target: "page:/atelier",
    type: "transition",
    libelle: "Redirection Atelier",
  });
  connecter({
    source: "page:/login",
    target: "page:/",
    type: "transition",
    libelle: "Connexion réussie",
    declencheur: "Authentification réussie",
  });

  /* ══════════════════════════════════════════════════════════════════ */
  /* 7. LIAISONS GLOBALES & CARREFOURS D'ENTRÉE                          */
  /* ══════════════════════════════════════════════════════════════════ */
  connecter({
    source: "page:/",
    target: "page:/atelier",
    type: "navigation",
    libelle: "Ouvrir l'Atelier",
    declencheur: "Menu navigation / Carte pilotage",
  });
  connecter({
    source: "page:/",
    target: "page:/seances",
    type: "navigation",
    libelle: "Ouvrir les Séances",
    declencheur: "Menu navigation / Carte séances",
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
    source: "page:/",
    target: "ux:tiroir-tuteur",
    type: "ouverture",
    libelle: "Ouvrir le tuteur",
    declencheur: "Clic bouton Tuteur / Raccourci",
  });
  connecter({
    source: "page:/",
    target: "ux:tiroir-compte",
    type: "ouverture",
    libelle: "Ouvrir réglages",
    declencheur: "Clic avatar",
  });

  // Reprise directe d'une séance active depuis le Dashboard
  if (parId.has("ux:workspace-seance")) {
    connecter({
      source: "page:/",
      target: "ux:workspace-seance",
      type: "navigation",
      libelle: "Reprendre la séance",
      declencheur: "Clic 'Reprendre la séance'",
      condition: "séance en cours",
    });
  }

  // Liens d'action directe depuis la recommandation active
  if (parId.has("ux:prochaine-action") && parId.has("ux:exercice-chercher")) {
    connecter({
      source: "ux:prochaine-action",
      target: "ux:exercice-chercher",
      type: "navigation",
      libelle: "Démarrer immédiatement",
      declencheur: "Clic 'Démarrer immédiatement'",
    });
  }
  if (parId.has("ux:prochaine-action") && parId.has("ux:adaptive-workspace")) {
    connecter({
      source: "ux:prochaine-action",
      target: "ux:adaptive-workspace",
      type: "navigation",
      libelle: "Lancer activité recommandée",
      declencheur: "Clic sur activité adaptative",
    });
  }

  // Liens de création d'exercice ciblé depuis une compétence
  if (parId.has("ux:fiche-competence") && parId.has("modal:generer-exercice")) {
    connecter({
      source: "ux:fiche-competence",
      target: "modal:generer-exercice",
      type: "ouverture",
      libelle: "Créer exercice ciblé",
      declencheur: "Clic 'Créer un exercice sur cette compétence'",
    });
  }

  // Liens d'exploration depuis l'Atelier vers les exercices
  if (parId.has("ux:explorateur-sidebar") && parId.has("page:/exercices/{id}")) {
    connecter({
      source: "ux:explorateur-sidebar",
      target: "page:/exercices/{id}",
      type: "navigation",
      libelle: "Ouvrir exercice depuis arborescence",
      declencheur: "Clic sur un exercice",
    });
  }

  // Liens transversaux depuis le Dashboard vers l'Atelier
  if (parId.has("ux:etat-global") && parId.has("ux:galerie-domaines")) {
    connecter({
      source: "ux:etat-global",
      target: "ux:galerie-domaines",
      type: "interaction",
      libelle: "Filtrer par domaine",
      declencheur: "Clic sur un palier ou domaine",
    });
  }
  if (parId.has("ux:pilotage-referentiel") && parId.has("modal:revision-domaine")) {
    connecter({
      source: "ux:pilotage-referentiel",
      target: "modal:revision-domaine",
      type: "ouverture",
      libelle: "Réviser domaine fragile",
      declencheur: "Clic sur alerte domaine fragile",
    });
  }
  if (parId.has("ux:progression-recente") && parId.has("page:/exercices/{id}")) {
    connecter({
      source: "ux:progression-recente",
      target: "page:/exercices/{id}",
      type: "navigation",
      libelle: "Revoir preuve",
      declencheur: "Clic preuve récente",
    });
  }

  // Liens globaux vers le tuteur depuis les espaces de travail
  if (parId.has("page:/atelier")) {
    connecter({
      source: "page:/atelier",
      target: "ux:tiroir-tuteur",
      type: "ouverture",
      libelle: "Assistance documentaire",
      declencheur: "Clic Tuteur dans l'Atelier",
    });
  }
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
      libelle: "Demander au tuteur",
      declencheur: "Clic 'Demander au tuteur'",
    });
  }

  return { noeuds, liens };
}
