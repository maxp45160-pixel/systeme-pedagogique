/**
 * Scanner de Parcours UX Atomique & Synthèse Macro — Introspection 100% dynamique (Couche 3).
 *
 * Construit dynamiquement deux perspectives de parcours utilisateur :
 *   1. 🎯 Mode "atomique" : exhaustivité totale (pages, sous-vues, onglets, micro-interactions,
 *      canvas D3, accordéons, pomodoro, tuteur IA, modales, tiroirs et Server Actions).
 *   2. 🧭 Mode "macro" : vue de synthèse exécutive épurée (8-12 macro-pôles maîtres articulant
 *      le funnel de valeur pédagogique : Intention → Séance → 3 Actes → Observation → Progression).
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé du code source, rien n'est stocké.
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
  resoudreNavigationPartagee,
  resoudreSurfacesPartagees,
  slugId,
  type FichierAstAnalyse,
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

  if (mode === "macro") {
    return construireMacroSynthese(analyses);
  }

  return construireUxAtomique(analyses, composantsParPage);
}

/* ------------------------------------------------------------------ */
/* 1. PERSPECTIVE SYNTHÈSE (MACRO) — Funnel de Valeur Épuré           */
/* ------------------------------------------------------------------ */

function construireMacroSynthese(
  analyses: Map<string, FichierAstAnalyse>,
): GrapheWorkflow {
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

  // Les 12 Macro-Pôles Maîtres du Funnel Pédagogique
  ajouterNoeud({
    id: "page:/",
    type: "page",
    libelle: "Tableau de bord & Priorité",
    url: "/",
    groupe: "dashboard",
    badge: "Hub Central",
    description: "Action prioritaire du jour, pomodoro et repères de navigation",
  });

  ajouterNoeud({
    id: "modal:de-quoi-as-tu-besoin",
    type: "modal",
    libelle: "Capture d'Intention libre (+)",
    groupe: "dashboard",
    badge: "Point d'Entrée Unique",
    description: "Traduction one-shot en langage naturel sans choisir l'objet d'avance — modale « De quoi as-tu besoin ? » du rail (ADR-073)",
  });

  ajouterNoeud({
    id: "page:/seances",
    type: "page",
    libelle: "Séances & Concepteur",
    url: "/seances",
    groupe: "seances",
    badge: "Entraînement",
    description: "Concepteur de séance, file d'exercices et cahier d'entraînement",
  });

  ajouterNoeud({
    id: "ux:exercice-bilan-final",
    type: "etape",
    libelle: "Observation forgée & Bilan",
    groupe: "exercice",
    badge: "Capitalisation",
    description: "Enregistrement factuel de l'observation d'apprentissage (Invariant 2)",
  });

  ajouterNoeud({
    id: "page:/atelier",
    type: "page",
    libelle: "Atelier & Référentiel",
    url: "/atelier",
    groupe: "atelier",
    badge: "Compétences & Notes",
    description: "Cartographie interactive, fiches pédagogiques et documents supports",
  });

  ajouterNoeud({
    id: "page:/progression",
    type: "page",
    libelle: "Profil, Croissance & Carrière",
    url: "/progression",
    groupe: "profil",
    badge: "Histoire & Série",
    description: "Cumul historique, jours actifs, série consécutive et dimensions (ADR-073)",
  });

  ajouterNoeud({
    id: "page:/compte",
    type: "page",
    libelle: "Compte & Préférences",
    url: "/compte",
    groupe: "profil",
    badge: "Paramètres",
    description: "Identité, réglages du compte et sécurité des accès",
  });

  ajouterNoeud({
    id: "tiroir:tuteur",
    type: "tiroir",
    libelle: "Assistance & Tuteur IA",
    groupe: "tuteur",
    badge: "Aide sur demande",
    description: "Béquille socratique confinée par paliers d'indices progressifs (Invariant 5)",
  });

  if (analyses.has("app/(app)/demarrer/page.tsx")) {
    ajouterNoeud({
      id: "page:/demarrer",
      type: "page",
      libelle: "Amorçage Référentiel",
      url: "/demarrer",
      groupe: "dashboard",
      badge: "Premier pas",
      condition: "Compte sans compétence",
    });
  }

  if (analyses.has("app/(app)/admin/page.tsx")) {
    ajouterNoeud({
      id: "page:/admin",
      type: "page",
      libelle: "Cockpit d'Administration",
      url: "/admin",
      groupe: "dashboard",
      badge: "Pilotage système",
      condition: "Administrateur seulement (ADR-074)",
    });
  }

  if (analyses.has("app/(app)/aide/page.tsx")) {
    ajouterNoeud({
      id: "page:/aide",
      type: "page",
      libelle: "Prise en main du système",
      url: "/aide",
      groupe: "dashboard",
      badge: "Documentation",
    });
  }

  // Connexions directrices du Funnel de Valeur
  // 1. Depuis le Hub
  connecter({
    source: "page:/",
    target: "modal:de-quoi-as-tu-besoin",
    type: "ouverture",
    libelle: "Déclarer une intention",
    declencheur: "Clic sur le bouton central '+'",
  });

  connecter({
    source: "page:/",
    target: "page:/seances",
    type: "navigation",
    libelle: "Lancer le travail du jour",
    declencheur: "Action prioritaire recommandée",
  });

  connecter({
    source: "page:/",
    target: "page:/atelier",
    type: "navigation",
    libelle: "Explorer l'Atelier",
    declencheur: "Rail de navigation",
  });

  connecter({
    source: "page:/",
    target: "page:/progression",
    type: "navigation",
    libelle: "Consulter la progression",
    declencheur: "Rail de navigation",
  });

  connecter({
    source: "page:/",
    target: "page:/compte",
    type: "navigation",
    libelle: "Gérer le compte",
    declencheur: "Rail de navigation",
  });

  if (parId.has("page:/demarrer")) {
    connecter({
      source: "page:/",
      target: "page:/demarrer",
      type: "navigation",
      libelle: "Amorçage initial",
      declencheur: "Absence de compétences actives",
    });
  }

  if (parId.has("page:/admin")) {
    connecter({
      source: "page:/",
      target: "page:/admin",
      type: "navigation",
      libelle: "Administration globale",
      declencheur: "Entrée réservée aux administrateurs",
    });
  }

  if (parId.has("page:/aide")) {
    connecter({
      source: "page:/",
      target: "page:/aide",
      type: "navigation",
      libelle: "Consulter l'aide",
      declencheur: "Rail de navigation (en bas)",
    });
  }

  // 2. Intention orientée vers l'action
  connecter({
    source: "modal:de-quoi-as-tu-besoin",
    target: "page:/seances",
    type: "transition",
    libelle: "Intention 'travail'",
    declencheur: "Génération de séance ciblée",
  });

  connecter({
    source: "modal:de-quoi-as-tu-besoin",
    target: "page:/atelier",
    type: "transition",
    libelle: "Intention 'projet' / 'note'",
    declencheur: "Ouverture du workspace documentaire",
  });

  // 3. Parcours d'exercice et forge d'observation
  // La boucle des 3 Actes se joue désormais dans la séance (ADR-079) : le
  // cahier du workspace `/seances` tient la résolution, la comparaison et la
  // mesure, il n'y a plus de fiche d'exercice autonome.
  connecter({
    source: "page:/seances",
    target: "ux:exercice-bilan-final",
    type: "transition",
    libelle: "Boucle des 3 Actes",
    declencheur: "Résolution → Comparaison → Mesure",
  });

  connecter({
    source: "ux:exercice-bilan-final",
    target: "page:/",
    type: "navigation",
    libelle: "Boucler la séance",
    declencheur: "Retour au tableau de bord",
  });

  connecter({
    source: "ux:exercice-bilan-final",
    target: "page:/atelier",
    type: "transition",
    libelle: "Impact sur les compétences",
    declencheur: "Recalcul dérivé des scores de maîtrise",
  });

  connecter({
    source: "ux:exercice-bilan-final",
    target: "page:/progression",
    type: "transition",
    libelle: "Inscrire dans l'historique",
    declencheur: "Incrémentation des observations et série",
  });

  // 4. Boucle inverse Atelier -> Séances
  connecter({
    source: "page:/atelier",
    target: "page:/seances",
    type: "navigation",
    libelle: "S'entraîner sur cette fiche",
    declencheur: "Bouton d'entraînement contextuel",
  });

  // 5. Tuteur IA transversal
  connecter({
    source: "page:/seances",
    target: "tiroir:tuteur",
    type: "ouverture",
    libelle: "Indice sur blocage",
    declencheur: "Demande d'aide par paliers (1/3, 2/3, 3/3)",
  });

  connecter({
    source: "page:/",
    target: "tiroir:tuteur",
    type: "ouverture",
    libelle: "Conseil méthodologique",
    declencheur: "Ouverture du compagnon tuteur",
  });

  return { noeuds, liens };
}

/* ------------------------------------------------------------------ */
/* 2. PERSPECTIVE ATOMIQUE ULTRA-DÉTAILLÉE                            */
/* ------------------------------------------------------------------ */

function construireUxAtomique(
  analyses: Map<string, FichierAstAnalyse>,
  composantsParPage: Map<string, Set<string>>,
): GrapheWorkflow {
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

  // 2. Surfaces, Sous-Vues, Onglets & Micro-Interactions montées par page
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
          badge: surf.badge,
        });

        connecter({
          source: pageId,
          target: surfId,
          type: "interaction",
          libelle: surf.libelle,
          declencheur: `Composant monté dans ${route}`,
        });

        // Détection d'onglets déclarés dans ce composant
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

      // Micro-interactions riches (Canvas, Pomodoro, Tuteur, Accordéons, Médias)
      const sourceMicro = surfacesParFichier.get(rel) ?? pageId;
      for (const micro of a.microInteractions) {
        ajouterNoeud({
          id: micro.id,
          type: "sous-vue",
          libelle: micro.libelle,
          groupe: groupePourChemin(rel),
          badge: micro.badge,
          heuristique: micro.heuristique,
        });

        connecter({
          source: sourceMicro,
          target: micro.id,
          type: "interaction",
          libelle: micro.libelle,
          declencheur: micro.declencheur,
        });
      }
    }
  }

  // 3. Boucle pédagogique d'exercice — fidèle au code (ADR-079)
  // Le vrai parcours tient dans le workspace de séance : deux actes
  // (Chercher → Mesurer) dont les transitions sont portées par les variantes
  // de `searchParams` que `vue-exercice.tsx` lit réellement (`evaluer`,
  // `bilan`, `abandon`). On ne modélise donc aucune étape inventée : les
  // nœuds de variantes sont dérivés (section 1) et les actions réelles
  // (terminer/abandonner) se résolvent vers `/seances`.
  const seances = analyses.get("app/(app)/seances/page.tsx");
  if (seances) {
    const sessionId = "page:/seances?session";
    const evaluerId = "page:/seances?evaluer";
    const bilanId = "page:/seances?bilan";
    const abandonId = "page:/seances?abandon";

    ajouterNoeud({
      id: "ux:exercice-chercher",
      type: "etape",
      libelle: "Acte 1 : Chercher",
      groupe: "exercice",
      badge: "Résolution",
    });
    ajouterNoeud({
      id: "ux:exercice-mesurer",
      type: "etape",
      libelle: "Acte 2 : Mesurer",
      groupe: "exercice",
      badge: "Auto-évaluation",
    });

    // Le workspace de séance ouvre l'acte de résolution.
    if (parId.has(sessionId)) {
      connecter({
        source: sessionId,
        target: "ux:exercice-chercher",
        type: "interaction",
        libelle: "Acte 1 : Chercher",
        declencheur: "Tentative en cours dans le workspace",
      });
    }

    // Chercher → Mesurer : le lien « Demander la correction » navigue vers
    // `urlExercice(exercice.id, navigation, 'evaluer')` (vue-exercice.tsx).
    if (parId.has(evaluerId)) {
      connecter({
        source: "ux:exercice-chercher",
        target: evaluerId,
        type: "navigation",
        libelle: "Demander la correction au tuteur",
        declencheur: "urlExercice(…, 'evaluer')",
      });
    }

    if (parId.has(evaluerId)) {
      connecter({
        source: evaluerId,
        target: "ux:exercice-mesurer",
        type: "interaction",
        libelle: "Acte 2 : Mesurer",
        declencheur: "Évaluation du bilan proposé par le tuteur",
      });
    }

    // Mesurer → Bilan : l'auto-évaluation validée clôt la tentative
    // (`terminerExercice` → destinationApresExercice(…, "bilan")).
    connecter({
      source: "ux:exercice-mesurer",
      target: bilanId,
      type: "transition",
      libelle: "Enregistrer l'observation",
      declencheur: "Auto-évaluation validée → terminerExercice",
    });
    connecter({
      source: "ux:exercice-mesurer",
      target: "action:terminerexercice",
      type: "soumission",
      libelle: "terminerExercice",
      declencheur: "Soumission du bilan",
    });

    // Abandon disponible dans les deux actes (`BoutonAbandon` →
    // `abandonnerExercice` → destinationApresExercice(…, "abandon")).
    for (const acteId of ["ux:exercice-chercher", "ux:exercice-mesurer"] as const) {
      connecter({
        source: acteId,
        target: "action:abandonnerexercice",
        type: "soumission",
        libelle: "abandonnerExercice",
        declencheur: "Clic 'Abandonner cette tentative'",
      });
      connecter({
        source: acteId,
        target: abandonId,
        type: "transition",
        libelle: "Tentative abandonnée",
        declencheur: "Aucune observation enregistrée",
      });
    }

    // Sorties réelles du bilan (CarteImpact → LienApresImpact).
    if (parId.has(bilanId)) {
      connecter({
        source: bilanId,
        target: sessionId,
        type: "navigation",
        libelle: "Reprendre la séance (Exercice suivant)",
        declencheur: "LienApresImpact avec séance",
      });
      connecter({
        source: bilanId,
        target: "page:/",
        type: "navigation",
        libelle: "Prochaine action recommandée",
        declencheur: "LienApresImpact sans séance",
      });
      connecter({
        source: bilanId,
        target: "page:/atelier?document",
        type: "navigation",
        libelle: "Voir la fiche compétence",
        declencheur: "Chip compétence du bilan",
      });
    }

    // Sorties réelles de l'abandon (bandeau → « Reprendre dans une séance »).
    if (parId.has(abandonId)) {
      connecter({
        source: abandonId,
        target: "page:/seances",
        type: "navigation",
        libelle: "Reprendre dans une séance",
        declencheur: "Composer une séance ciblée",
      });
    }
  }

  // 4. Modales & Tiroirs réels
  for (const a of analyses.values()) {
    for (const modale of a.modales) {
      const id = modale.id;

      // Trouver toutes les pages qui montent cette modale
      const pagesSources: string[] = [];
      for (const [route, comps] of composantsParPage.entries()) {
        if (comps.has(modale.fichier) || route === a.route) {
          const sourcePage = `page:${route}`;
          if (parId.has(sourcePage)) {
            pagesSources.push(sourcePage);
          }
        }
      }

      if (pagesSources.length > 0) {
        ajouterNoeud({
          id,
          type: modale.estTiroir ? "tiroir" : "modal",
          libelle: modale.titre,
          groupe: groupePourChemin(modale.fichier),
        });

        for (const sourcePage of pagesSources) {
          connecter({
            source: sourcePage,
            target: id,
            type: "ouverture",
            libelle: `Ouvrir ${modale.titre}`,
            declencheur: `Déclencheur d'ouverture`,
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
      const surfaceCompId = surfacesParFichier.get(f.relatif);
      const sourceEffective = surfaceCompId && parId.has(surfaceCompId) ? surfaceCompId : pageId;

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
              source: sourceEffective,
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
          source: sourceEffective,
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
    const pageId = `page:${route}`;
    const fichiersAInspecter = [
      ...[...analyses.values()].filter((a) => a.route === route),
      ...[...comps].map((c) => analyses.get(c)).filter(Boolean) as import("./workflow-ast-parser").FichierAstAnalyse[],
    ];

    for (const f of fichiersAInspecter) {
      const surfaceCompId = surfacesParFichier.get(f.relatif);
      const sourceEffective = surfaceCompId && parId.has(surfaceCompId) ? surfaceCompId : pageId;

      for (const nav of f.navigations) {
        const cibleBase = baseRoute(nav.cible);
        const targetId = `page:${cibleBase}`;
        if (parId.has(targetId) && targetId !== pageId) {
          connecter({
            source: sourceEffective,
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
    if (parId.has("page:/demarrer")) {
      connecter({
        source: "page:/",
        target: "page:/demarrer",
        type: "navigation",
        libelle: "Amorçage",
        declencheur: "Absence de compétences initiales",
      });
    }
    if (parId.has("page:/admin")) {
      connecter({
        source: "page:/",
        target: "page:/admin",
        type: "navigation",
        libelle: "Comptes et accès",
        declencheur: "Entrée de rail, comptes administrateurs seulement",
      });
    }
    if (parId.has("page:/suspendu")) {
      connecter({
        source: "page:/",
        target: "page:/suspendu",
        type: "navigation",
        libelle: "Accès suspendu",
        declencheur: "Redirection du cadre applicatif quand l'accès est fermé",
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

  // 8. Cadre partagé — navigation persistante et surfaces du layout (rail,
  // barre mobile, tiroir tuteur, point d'entrée `+`). Elles ne vivent pas
  // dans les pages : sans cette passe, `/compte`, `/aide` ou le tiroir
  // sembleraient inaccessibles depuis la plupart des écrans. `connecter`
  // déduplique déjà une arête identique (source→cible→libellé→déclencheur),
  // y compris quand deux dossiers de layouts s'imbriquent.
  const navPartagee = resoudreNavigationPartagee(analyses);
  const surfacesPartagees = resoudreSurfacesPartagees(analyses);

  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const sourceId = `page:${a.route}`;
    if (!parId.has(sourceId)) continue;

    for (const [dossier, cibles] of navPartagee.entries()) {
      if (!a.relatif.startsWith(`${dossier}/`)) continue;
      for (const cible of cibles) {
        const targetId = `page:${cible}`;
        if (!parId.has(targetId) || targetId === sourceId) continue;
        connecter({
          source: sourceId,
          target: targetId,
          type: "navigation",
          libelle: "Navigation persistante",
          declencheur: "Rail / barre mobile du cadre",
        });
      }
    }

    for (const [dossier, ids] of surfacesPartagees.entries()) {
      if (!a.relatif.startsWith(`${dossier}/`)) continue;
      for (const id of ids) {
        if (!parId.has(id)) {
          // Surface déclarée par le layout mais montée par aucune page
          // inspectée : on la crée pour refléter le cadre réel.
          const porteur = [...analyses.values()].find((fa) =>
            fa.modales.some((m) => m.id === id),
          );
          const modale = porteur?.modales.find((m) => m.id === id);
          ajouterNoeud({
            id,
            type: modale?.estTiroir ? "tiroir" : "modal",
            libelle: modale?.titre ?? id,
            groupe: porteur ? groupePourChemin(porteur.relatif) : undefined,
          });
        }
        connecter({
          source: sourceId,
          target: id,
          type: "ouverture",
          libelle: "Ouvrir depuis le cadre",
          declencheur: "Bouton du cadre partagé",
        });
      }
    }
  }

  return { noeuds, liens };
}
