/**
 * Scanner de Parcours UX Atomique — Introspection 100% dynamique (Couche 3).
 *
 * Construit le GrapheWorkflow complet du parcours utilisateur et des interactions
 * reelles au niveau atomique (pages, surfaces, sous-vues, onglets, modales, tiroirs,
 * formulaires, boutons, declencheurs et Server Actions) en analysant l'AST TypeScript
 * via workflow-ast-parser.ts sans AUCUNE donnee codee en dur.
 *
 * ## Frontiere (AGENTS.md)
 *
 * Couche 3 (Decide) : tout est derive du code source, rien n'est stocke.
 * Les types du graphe restent dans workflow-graphe.ts (couche 1).
 */

import type {
  GrapheWorkflow,
  LienWorkflow,
  NoeudWorkflow,
} from "./workflow-graphe";
import {
  analyserTousLesFichiersAst,
  baseRoute,
  groupePourChemin,
  resoudreImportsComposants,
  slugId,
} from "./workflow-ast-parser";

/**
 * Construit dynamiquement le graphe complet du parcours UX (macro ou atomique).
 */
export async function scannerUxJourney(options?: {
  mode?: "macro" | "atomique";
}): Promise<GrapheWorkflow> {
  const mode = options?.mode ?? "atomique";
  const analyses = await analyserTousLesFichiersAst();
  const composantsParPage = resoudreImportsComposants(analyses);

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
    const cle = `${lien.source}→${lien.target}→${lien.type}→${lien.libelle}→${lien.declencheur ?? ""}`;
    if (!vusLiens.has(cle)) {
      vusLiens.add(cle);
      liens.push(lien);
    }
  }

  // 1. Pages et sous-routes canoniques (searchParams)
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const pageId = `page:${a.route}`;
    ajouterNoeud({
      id: pageId,
      type: "page",
      libelle: a.titrePage ?? a.route,
      url: a.route,
      groupe: groupePourChemin(a.relatif),
    });

    for (const varRoute of a.variantesSearchParams ?? []) {
      const varId = `page:${varRoute}`;
      const nomVar = varRoute.split("?")[1] ?? "";
      ajouterNoeud({
        id: varId,
        type: "page",
        libelle: `${a.titrePage ?? a.route} (${nomVar})`,
        url: varRoute,
        groupe: groupePourChemin(a.relatif),
      });

      connecter({
        source: pageId,
        target: varId,
        type: "transition",
        libelle: `Mode ${nomVar}`,
        declencheur: `Paramètre URL ?${nomVar}`,
      });
      connecter({
        source: varId,
        target: pageId,
        type: "navigation",
        libelle: "Sortie / Retour",
        declencheur: "Fermeture du mode plein écran",
      });
    }
  }

  // 2. Surfaces et Sous-Vues interactives montées par page
  const surfacesParFichier = new Map<string, string>();
  for (const [route, comps] of composantsParPage.entries()) {
    const pageId = `page:${route}`;
    if (!parId.has(pageId)) continue;

    // Inspecter la page et ses composants importés
    const fichiersAInspecter = [
      ...[...analyses.values()].filter((a) => a.route === route).map((a) => a.relatif),
      ...comps,
    ];

    for (const rel of fichiersAInspecter) {
      const a = analyses.get(rel);
      if (!a) continue;

      for (const surf of a.surfaces) {
        const surfId = `ux:${slugId(surf.nom)}`;
        surfacesParFichier.set(rel, surfId);

        ajouterNoeud({
          id: surfId,
          type: "sous-vue",
          libelle: surf.libelle,
          groupe: surf.groupe,
        });

        connecter({
          source: pageId,
          target: surfId,
          type: "interaction",
          libelle: surf.libelle,
          declencheur: `Composant monté dans ${route}`,
        });

        // Détection d'onglets déclarés dans ce composant (mode atomique)
        if (mode === "atomique") {
          for (const onglet of a.onglets) {
            const tabId = `tab:${slugId(onglet.id)}`;
            ajouterNoeud({
              id: tabId,
              type: "sous-vue",
              libelle: `Onglet : ${onglet.libelle}`,
              groupe: surf.groupe,
            });

            connecter({
              source: surfId,
              target: tabId,
              type: "interaction",
              libelle: onglet.libelle,
              declencheur: `Clic onglet '${onglet.libelle}'`,
            });
          }
        }
      }
    }
  }

  // 3. Boucle pédagogique d'exercice en 3 actes (détectée dynamiquement si /exercices/[id] existe)
  const pageExercice = analyses.get("app/(app)/exercices/[id]/page.tsx");
  if (pageExercice) {
    const actes = [
      { id: "ux:exercice-chercher", libelle: "Acte 1 : Chercher", badge: "Résolution" },
      { id: "ux:exercice-comparer", libelle: "Acte 2 : Comparer", badge: "Correction" },
      { id: "ux:exercice-mesurer", libelle: "Acte 3 : Mesurer", badge: "Auto-évaluation" },
      { id: "ux:exercice-bilan-final", libelle: "Bilan & Preuve forgée", badge: "Preuve" },
    ];

    for (const acte of actes) {
      ajouterNoeud({
        id: acte.id,
        type: "etape",
        libelle: acte.libelle,
        groupe: "exercice",
        badge: acte.badge,
      });
    }

    connecter({
      source: "page:/exercices/{id}",
      target: "ux:exercice-chercher",
      type: "interaction",
      libelle: "Démarrer tentative",
      declencheur: "Top départ de la tentative",
    });
    connecter({
      source: "ux:exercice-chercher",
      target: "ux:exercice-comparer",
      type: "transition",
      libelle: "Passer à la comparaison",
      declencheur: "Clic 'Afficher la correction'",
    });
    connecter({
      source: "ux:exercice-comparer",
      target: "ux:exercice-mesurer",
      type: "transition",
      libelle: "Passer à l'évaluation",
      declencheur: "Clic 'Passer à l'évaluation'",
    });
    connecter({
      source: "ux:exercice-mesurer",
      target: "ux:exercice-bilan-final",
      type: "transition",
      libelle: "Enregistrer la preuve",
      declencheur: "Validation auto-évaluation",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/",
      type: "navigation",
      libelle: "Retour dashboard",
      declencheur: "Clic 'Continuer vers le dashboard'",
    });
    connecter({
      source: "ux:exercice-bilan-final",
      target: "page:/atelier",
      type: "navigation",
      libelle: "Voir dans l'Atelier",
      declencheur: "Clic 'Voir dans l'Atelier'",
    });
  }

  // 4. Modales & Tiroirs réels
  for (const a of analyses.values()) {
    for (const modale of a.modales) {
      const slug = slugId(modale.titre);
      const id = `${modale.estTiroir ? "tiroir" : "modal"}:${slug}`;

      ajouterNoeud({
        id,
        type: modale.estTiroir ? "tiroir" : "modal",
        libelle: modale.titre,
        groupe: groupePourChemin(modale.fichier),
      });

      // Relier depuis chaque page qui monte cette modale
      for (const [route, comps] of composantsParPage.entries()) {
        if (comps.has(modale.fichier) || route === a.route) {
          const sourcePage = `page:${route}`;
          if (parId.has(sourcePage)) {
            connecter({
              source: sourcePage,
              target: id,
              type: "ouverture",
              libelle: `Ouvrir ${modale.titre}`,
              declencheur: `Déclencheur d'ouverture dans ${route}`,
            });
            connecter({
              source: id,
              target: sourcePage,
              type: "retour",
              libelle: "Fermer",
              declencheur: "Clic 'Fermer' / Échap",
            });
          }
        }
      }
    }
  }

  // 5. Server Actions réelles et Déclencheurs atomiques
  const toutesActions = new Map<string, import("./workflow-ast-parser").ActionServeurAst>();
  for (const a of analyses.values()) {
    for (const act of a.actionsDeclarees) {
      toutesActions.set(act.nom, act);
    }
  }

  for (const [route, comps] of composantsParPage.entries()) {
    const pageId = `page:${route}`;
    const fichiersAInspecter = [
      ...[...analyses.values()].filter((a) => a.route === route),
      ...[...comps].map((c) => analyses.get(c)).filter(Boolean) as import("./workflow-ast-parser").FichierAstAnalyse[],
    ];

    for (const f of fichiersAInspecter) {
      // Boutons avec action
      for (const b of f.boutons) {
        if (b.actionInvoquee) {
          const act = toutesActions.get(b.actionInvoquee);
          if (act) {
            const actId = act.id;
            ajouterNoeud({
              id: actId,
              type: "action",
              libelle: act.libelle,
              groupe: groupePourChemin(act.fichier),
            });

            connecter({
              source: pageId,
              target: actId,
              type: "soumission",
              libelle: act.libelle,
              declencheur: b.texte ? `Clic '${b.texte}'` : undefined,
            });

            if (act.redirection) {
              const destId = `page:${baseRoute(act.redirection)}`;
              if (parId.has(destId)) {
                connecter({
                  source: actId,
                  target: destId,
                  type: "transition",
                  libelle: "Redirection",
                  declencheur: `Redirigé vers ${act.redirection}`,
                });
              }
            } else {
              connecter({
                source: actId,
                target: pageId,
                type: "transition",
                libelle: "Actualisation",
                declencheur: "Mise à jour réussie",
              });
            }
          }
        }
      }

      // Actions invoquées directement dans le composant
      for (const nomAct of f.actionsInvoquees) {
        const act = toutesActions.get(nomAct);
        if (!act) continue;

        const actId = act.id;
        ajouterNoeud({
          id: actId,
          type: "action",
          libelle: act.libelle,
          groupe: groupePourChemin(act.fichier),
        });

        connecter({
          source: pageId,
          target: actId,
          type: "soumission",
          libelle: act.libelle,
          declencheur: `Appel ${nomAct}`,
        });

        if (act.redirection) {
          const destId = `page:${baseRoute(act.redirection)}`;
          if (parId.has(destId)) {
            connecter({
              source: actId,
              target: destId,
              type: "transition",
              libelle: "Redirection",
              declencheur: `Redirigé vers ${act.redirection}`,
            });
          }
        } else {
          connecter({
            source: actId,
            target: pageId,
            type: "transition",
            libelle: "Actualisation",
            declencheur: "Mise à jour réussie",
          });
        }
      }
    }
  }

  // 6. Navigations inter-pages et boutons de navigation
  for (const [route, comps] of composantsParPage.entries()) {
    const sourceId = `page:${route}`;
    const fichiersAInspecter = [
      ...[...analyses.values()].filter((a) => a.route === route),
      ...[...comps].map((c) => analyses.get(c)).filter(Boolean) as import("./workflow-ast-parser").FichierAstAnalyse[],
    ];

    for (const f of fichiersAInspecter) {
      for (const nav of f.navigations) {
        const cibleBase = baseRoute(nav.cible);
        const targetId = `page:${cibleBase}`;
        if (parId.has(targetId) && targetId !== sourceId) {
          connecter({
            source: sourceId,
            target: targetId,
            type: "navigation",
            libelle: `Vers ${nav.cible}`,
            declencheur: nav.declencheur ?? `Lien vers ${nav.cible}`,
          });
        }
      }
    }
  }

  // 7. Connexions racine globales d'accès (Navbar / Rails principaux)
  if (parId.has("page:/")) {
    if (parId.has("page:/atelier")) {
      connecter({
        source: "page:/",
        target: "page:/atelier",
        type: "navigation",
        libelle: "Ouvrir l'Atelier",
        declencheur: "Menu navigation / Carte pilotage",
      });
    }
    if (parId.has("page:/seances")) {
      connecter({
        source: "page:/",
        target: "page:/seances",
        type: "navigation",
        libelle: "Ouvrir les Séances",
        declencheur: "Menu navigation / Carte séances",
      });
    }
    if (parId.has("page:/projets")) {
      connecter({
        source: "page:/",
        target: "page:/projets",
        type: "navigation",
        libelle: "Ouvrir les Projets",
        declencheur: "Menu navigation / Carte projets",
      });
    }
    if (parId.has("page:/demarrer")) {
      connecter({
        source: "page:/",
        target: "page:/demarrer",
        type: "navigation",
        libelle: "Amorçage",
        declencheur: "Absence de compétences initiales",
      });
    }
  }

  if (parId.has("page:/login") && parId.has("page:/")) {
    connecter({
      source: "page:/login",
      target: "page:/",
      type: "navigation",
      libelle: "Connexion réussie",
      declencheur: "Authentification validée",
    });
  }

  return { noeuds, liens };
}
