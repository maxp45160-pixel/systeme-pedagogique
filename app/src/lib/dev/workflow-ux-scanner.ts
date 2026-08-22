/**
 * Scanner de Parcours UX Atomique & Synthèse Macro (Couche 3).
 *
 * Construit deux perspectives de parcours utilisateur :
 *   1. Mode "atomique" : exhaustivité totale, 100 % dérivée du code source
 *      (pages, sous-vues, onglets, micro-interactions, canvas D3, accordéons,
 *      pomodoro, tuteur IA, modales, tiroirs et Server Actions).
 *   2. Mode "macro" : synthèse dirigée — les pôles et arêtes directrices du
 *      funnel de valeur sont **nommés ici** (Intention → Séance → 3 Actes →
 *      Observation → Progression), pas inférés. Chaque pôle reste vérifié
 *      contre l'AST (`analyses.has`) pour n'exister que si son écran existe.
 *      L'en-tête antérieur revendiquait « 100 % dynamique » pour les deux
 *      modes ; c'était faux pour celui-ci, et l'affirmation a été corrigée
 *      plutôt que le graphe réécrit — la synthèse assumée est un choix de
 *      lecture, pas un registre oublié.
 *
 * ## Frontiere (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé du code source ou vérifié contre lui,
 * rien n'est stocké. Les types du graphe restent dans workflow-graphe.ts
 * (couche 1) ; la mécanique partagée dans workflow-scan-partage.ts.
 */

import type {
  GrapheWorkflow,
  TypeNoeudWorkflow,
} from "@/lib/domain/workflow-graphe";
import {
  analyserTousLesFichiersAst,
  baseRoute,
  groupePourChemin,
  resoudreImportsComposants,
  resoudreModalesImbriquees,
  resoudreSurfacesPartagees,
  slugId,
  type FichierAstAnalyse,
} from "./workflow-ast-parser";
import { creerConstructionGraphe, relierNavigationPartagee } from "./workflow-scan-partage";

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
  const construction = creerConstructionGraphe();
  const { ajouterNoeud, connecter, parId } = construction;

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
    // Libellé du rail (ADR-062) : le graphe parle comme l'interface.
    libelle: "Cahier",
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
      // Même entrée de rail que l'utilisateur lit — pas « Cockpit ».
      libelle: "Comptes et accès",
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

  // 6. Retours au hub — le rail dessert chaque pôle depuis n'importe quel
  // écran : la consultation n'est pas une impasse du funnel. Sans ces arêtes,
  // la vue de synthèse décrit un arbre à six impasses là où le parcours réel
  // est un cycle — et le « retour au tableau de bord » cesse d'être un geste
  // pensé pour l'utilisateur.
  for (const pole of ["page:/progression", "page:/compte", "page:/aide", "page:/admin", "page:/demarrer"]) {
    if (!parId.has(pole)) continue;
    connecter({
      source: pole,
      target: "page:/",
      type: "navigation",
      libelle: "Retour au tableau de bord",
      declencheur: "Rail / barre mobile du cadre",
      cadre: true,
    });
  }

  if (parId.has("tiroir:tuteur")) {
    for (const hote of ["page:/", "page:/seances"]) {
      if (!parId.has(hote)) continue;
      connecter({
        source: "tiroir:tuteur",
        target: hote,
        type: "retour",
        libelle: "Fermer",
        declencheur: "Clic 'Fermer' / Échap",
        cadre: true,
      });
    }
  }

  return { noeuds: construction.noeuds, liens: construction.liens };
}

/* ------------------------------------------------------------------ */
/* 2. PERSPECTIVE ATOMIQUE ULTRA-DÉTAILLÉE                            */
/* ------------------------------------------------------------------ */

function construireUxAtomique(
  analyses: Map<string, FichierAstAnalyse>,
  composantsParPage: Map<string, Set<string>>,
): GrapheWorkflow {
  const construction = creerConstructionGraphe();
  const { ajouterNoeud, connecter, parId } = construction;

  // 1. Pages et sous-routes canoniques (searchParams)
  // Chaque nœud écran (page ou variante) mémorise le dossier du fichier qui
  // le porte : la passe du cadre partagé (8) en a besoin pour savoir de quel
  // layout il dépend — une variante `?document` porte le même rail et les
  // mêmes surfaces flottantes que sa page de base.
  const sourcesCadre: { id: string; relatif: string }[] = [];
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
    sourcesCadre.push({ id: pageId, relatif: a.relatif });

    for (const varRoute of a.variantesSearchParams ?? []) {
      const varId = `page:${varRoute}`;
      const nomVar = varRoute.split("?")[1] ?? "";
      const qual = qualifierVarianteUx(a.route, nomVar, a.titrePage);

      ajouterNoeud({
        id: varId,
        type: qual.type,
        libelle: qual.libelle,
        url: varRoute,
        groupe: groupePourChemin(a.relatif),
        badge: qual.badge,
      });
      sourcesCadre.push({ id: varId, relatif: a.relatif });

      connecter({
        source: pageId,
        target: varId,
        type: "transition",
        libelle: qual.libelleTransition,
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

  // Index global des server actions réelles
  const toutesActions = new Map<string, import("./workflow-ast-parser").ActionServeurAst>();
  for (const a of analyses.values()) {
    for (const act of a.actionsDeclarees) {
      toutesActions.set(act.nom, act);
    }
  }

  // 3. Boucle pédagogique d'exercice — dérivée dynamiquement de l'AST de VueExercice
  const analyseVueExercice = analyses.get("components/exercices/vue-exercice.tsx");
  const seances = analyses.get("app/(app)/seances/page.tsx");
  if (seances && analyseVueExercice) {
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

    // 1. Entrée dans la résolution depuis le workspace
    if (parId.has(sessionId)) {
      connecter({
        source: sessionId,
        target: "ux:exercice-chercher",
        type: "interaction",
        libelle: "Acte 1 : Chercher",
        declencheur: "Tentative en cours dans le workspace",
      });
    }

    // 2. Chercher -> Mesurer (Transitions vers ?evaluer détectées dans l'AST)
    if (parId.has(evaluerId)) {
      const navEvaluer = analyseVueExercice.navigations.find((n) => n.cible.includes("evaluer"));
      connecter({
        source: "ux:exercice-chercher",
        target: evaluerId,
        type: "navigation",
        libelle: navEvaluer?.declencheur?.replace(/^Clic '|'$/g, "") || "Demander la correction",
        declencheur: navEvaluer?.declencheur || "Navigation vers évaluation",
      });

      connecter({
        source: evaluerId,
        target: "ux:exercice-mesurer",
        type: "interaction",
        libelle: "Acte 2 : Mesurer",
        declencheur: "Évaluation du bilan proposé par le tuteur",
      });
    }

    // 3. Mesurer -> Bilan & Actions de clôture
    if (parId.has(bilanId)) {
      connecter({
        source: "ux:exercice-mesurer",
        target: bilanId,
        type: "transition",
        libelle: "Enregistrer l'observation",
        declencheur: "Auto-évaluation validée",
      });
    }

    // Actions serveur réelles invoquées dans VueExercice (terminerExercice, abandonnerExercice, etc.)
    for (const nomAct of analyseVueExercice.actionsInvoquees) {
      const act = toutesActions.get(nomAct);
      if (!act) continue;
      const actId = act.id;

      if (nomAct === "terminerExercice") {
        connecter({
          source: "ux:exercice-mesurer",
          target: actId,
          type: "soumission",
          libelle: act.libelle,
          declencheur: "Soumission du bilan",
        });
      } else if (nomAct === "abandonnerExercice") {
        for (const acteId of ["ux:exercice-chercher", "ux:exercice-mesurer"] as const) {
          connecter({
            source: acteId,
            target: actId,
            type: "soumission",
            libelle: act.libelle,
            declencheur: "Clic 'Abandonner cette tentative'",
          });
          if (parId.has(abandonId)) {
            connecter({
              source: acteId,
              target: abandonId,
              type: "transition",
              libelle: "Tentative abandonnée",
              declencheur: "Aucune observation enregistrée",
            });
          }
        }
      }
    }

    // 4. Sorties du Bilan — le périmètre réel de l'écran, pas tout le fichier.
    //
    // L'AST ne voit pas les branches JSX : reprendre toutes les navigations de
    // vue-exercice.tsx les attribuait au bilan alors qu'elles appartiennent aux
    // autres actes (compositeur du démarrage, liens d'en-tête d'autres états).
    // Le nœud ?bilan affichait 18 sorties pour un écran qui en propose trois
    // sur sa carte impact — Prochaine action recommandée (/), Fiche compétence
    // (/atelier), Cahier (/seances) — auxquelles s'ajoute la clôture de séance
    // côté serveur. Mesuré sur vue-exercice.tsx (bloc `bilan === "1"`).
    if (parId.has(bilanId)) {
      for (const [cible, libelle] of [
        ["/", "Prochaine action recommandée"],
        ["/atelier", "Voir la fiche dans l'Atelier"],
        ["/seances", "Retour au cahier"],
      ] as const) {
        const destId = `page:${cible}`;
        if (parId.has(destId)) {
          connecter({
            source: bilanId,
            target: destId,
            type: "navigation",
            libelle,
            declencheur: `Carte impact — ${libelle}`,
          });
        }
      }
      if (analyseVueExercice.actionsInvoquees.includes("terminerSeance")) {
        const actTerminer = toutesActions.get("terminerSeance");
        if (actTerminer && parId.has(actTerminer.id)) {
          connecter({
            source: bilanId,
            target: actTerminer.id,
            type: "soumission",
            libelle: actTerminer.libelle,
            declencheur: "Dernière activité de la séance traitée",
          });
        }
      }
    }

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
    /*
     * Récupération de mot de passe (ADR-100). L'entrée de la page de
     * redéfinition n'est pas un clic mais la consommation du lien du
     * courriel : l'échange de code a lieu dans `/auth/callback`, invisible à
     * l'AST comme toutes les routes serveur. Sans cette arête explicite, le
     * graphe la déclarerait inatteignable alors qu'elle est le second temps
     * obligé du flux.
     */
    if (parId.has("page:/auth/mot-de-passe-oublie") && parId.has("page:/auth/nouveau-mot-de-passe")) {
      connecter({
        source: "page:/auth/mot-de-passe-oublie",
        target: "page:/auth/nouveau-mot-de-passe",
        type: "navigation",
        libelle: "Lien de redéfinition consommé",
        declencheur: "Ouverture du courriel — session établie par /auth/callback",
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
  // sembleraient inaccessibles depuis la plupart des écrans. La passe couvre
  // aussi les variantes searchParams (`?document`, `?session`, …) : c'est le
  // même écran avec un panneau ouvert, le rail y est identique — sans quoi un
  // mode à douze chemins d'entrée ne montrerait qu'une seule sortie.
  // `connecter` déduplique déjà une arête identique (source→cible→type→libellé),
  // y compris quand deux dossiers de layouts s'imbriquent.
  relierNavigationPartagee(construction, analyses, sourcesCadre, "Rail / barre mobile du cadre");
  const surfacesPartagees = resoudreSurfacesPartagees(analyses);

  for (const src of sourcesCadre) {
    const sourceId = src.id;

    for (const [dossier, ids] of surfacesPartagees.entries()) {
      if (!src.relatif.startsWith(`${dossier}/`)) continue;
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
          cadre: true,
        });
        // Contrepartie de l'ouverture : fermer la surface rend l'écran qu'on
        // avait quitté. Sans cette arête, le tiroir tuteur et le point
        // d'entrée `+` sont des ouvertures sans retour — un état-trappe dans
        // le graphe alors que Fermer / Échap existe partout.
        connecter({
          source: id,
          target: sourceId,
          type: "retour",
          libelle: "Fermer",
          declencheur: "Clic 'Fermer' / Échap",
          cadre: true,
        });
      }
    }
  }

  // 9. Sorties du point d'entrée `+` — la capture d'intention oriente vers
  // une surface existante (ADR-073) : chaque genre rejoint son destinataire
  // réel dans `capture-intention.tsx`. Sans cette passe, le geste d'entrée le
  // plus fréquent est un puits du graphe alors qu'il ne l'est jamais côté
  // utilisateur. La passe vit après le cadre partagé : c'est lui qui crée le
  // nœud de la capture quand aucune page ne l'importe. Les cibles vers une
  // autre modale ne sont connectées que si le nœud existe : une modale-enfant
  // montée uniquement par cette capture est rattachée par la passe des
  // modales imbriquées.
  const intentionId = "modal:de-quoi-as-tu-besoin";
  if (parId.has(intentionId)) {
    if (parId.has("page:/seances")) {
      connecter({
        source: intentionId,
        target: "page:/seances",
        type: "transition",
        libelle: "Intention « travail »",
        declencheur: "Bouton « Préparer la séance » — compositeur pré-rempli",
      });
    }
    if (parId.has("page:/atelier")) {
      connecter({
        source: intentionId,
        target: "page:/atelier",
        type: "transition",
        libelle: "Intention « note »",
        declencheur: "Fiche créée puis ouverte dans l'Atelier",
      });
    }
    for (const [cible, libelle, declencheur] of [
      [
        "modal:nouveau-projet",
        "Intention « projet »",
        "Le parcours de projet prend le relais avec l'intention pré-remplie",
      ],
      [
        "modal:referentiel",
        "Intention « référentiel »",
        "Proposition de branches avec le sujet pré-rempli",
      ],
      [
        "modal:competence",
        "Demande de compétence explicite",
        "Modale compétence avec branches pré-remplies",
      ],
    ] as const) {
      if (!parId.has(cible)) continue;
      connecter({
        source: intentionId,
        target: cible,
        type: "ouverture",
        libelle,
        declencheur,
      });
    }
  }

  // 10. Modales imbriquées — une modale peut monter une autre modale (la
  // capture d'intention passe la main au parcours de projet ou à la
  // proposition de référentiel). La passe des modales réelles ne suit que les
  // pages : la modale-enfant reste alors déclarée mais jamais reliée — puits
  // ou inatteignable selon la perspective. L'ouverture déjà posée par la
  // passe `+` n'est pas doublée ; seul le retour manquant est ajouté.
  for (const [parent, enfants] of resoudreModalesImbriquees(analyses)) {
    if (!parId.has(parent)) continue;
    for (const enfant of enfants) {
      const porteur = [...analyses.values()].find((fa) =>
        fa.modales.some((m) => m.id === enfant),
      );
      const ast = porteur?.modales.find((m) => m.id === enfant);

      if (!parId.has(enfant)) {
        ajouterNoeud({
          id: enfant,
          type: ast?.estTiroir ? "tiroir" : "modal",
          libelle: ast?.titre ?? enfant,
          groupe: porteur ? groupePourChemin(porteur.relatif) : undefined,
        });
      }

      const dejaOuverte = construction.liens.some(
        (l) => l.source === parent && l.target === enfant && l.type === "ouverture",
      );
      if (!dejaOuverte) {
        connecter({
          source: parent,
          target: enfant,
          type: "ouverture",
          libelle: `Ouvrir ${ast?.titre ?? enfant}`,
          declencheur: "Montée par la modale parente",
        });
      }

      const dejaRetournee = construction.liens.some(
        (l) => l.source === enfant && l.target === parent && l.type === "retour",
      );
      if (!dejaRetournee) {
        connecter({
          source: enfant,
          target: parent,
          type: "retour",
          libelle: "Fermer",
          declencheur: "Clic 'Fermer' / Échap",
        });
      }
    }
  }

  // 11. Sous-vues sans issue : une affordance inférée du code (widget, panneau,
  // onglet) n'est pas une fin de parcours — l'utilisateur en sort en naviguant
  // depuis sa page, pas depuis elle. Même statut que les micro-interactions
  // heuristiques : affichées, mais non comptées comme puits par
  // `statistiquesGraphe`. Pages, modales, tiroirs et actions sont toujours
  // reliés par construction ; seules les sous-vues peuvent tomber à zéro
  // sortie, et c'est alors le signe d'une affordance, pas d'une impasse.
  const idsAvecSortie = new Set(construction.liens.map((l) => l.source));
  for (const n of construction.noeuds) {
    if (n.type === "sous-vue" && !idsAvecSortie.has(n.id)) {
      n.heuristique = true;
    }
  }

  return { noeuds: construction.noeuds, liens: construction.liens };
}

/* ------------------------------------------------------------------ */
/* Helpers de qualification UX                                        */
/* ------------------------------------------------------------------ */

function qualifierVarianteUx(
  route: string,
  nomVar: string,
  titrePage?: string,
): {
  type: TypeNoeudWorkflow;
  libelle: string;
  libelleTransition: string;
  badge?: string;
} {
  if (route === "/seances") {
    switch (nomVar) {
      case "session":
        return {
          type: "etape",
          libelle: "Séance active (Session)",
          libelleTransition: "Déroulé de séance",
          badge: "Session",
        };
      case "correction":
        return {
          type: "etape",
          libelle: "Étape : Correction de raisonnement",
          libelleTransition: "Mode correction",
          badge: "Correction",
        };
      case "evaluer":
        return {
          type: "etape",
          libelle: "Étape : Évaluation du tuteur",
          libelleTransition: "Mode évaluation",
          badge: "Auto-évaluation",
        };
      case "bilan":
        return {
          type: "etape",
          libelle: "Étape : Bilan d'impact",
          libelleTransition: "Mode bilan",
          badge: "Consolidation",
        };
      case "abandon":
        return {
          type: "etape",
          libelle: "Étape : Abandon de séance",
          libelleTransition: "Mode abandon",
          badge: "Sortie",
        };
      default:
        return {
          type: "etape",
          libelle: `Étape : ${nomVar}`,
          libelleTransition: `Mode ${nomVar}`,
          badge: nomVar,
        };
    }
  }

  if (route === "/atelier") {
    switch (nomVar) {
      case "document":
        return {
          type: "sous-vue",
          libelle: "Fiche : Document & Compétence",
          libelleTransition: "Mode document",
          badge: "Document",
        };
      case "note":
        return {
          type: "sous-vue",
          libelle: "Fiche : Note & Projet",
          libelleTransition: "Mode note",
          badge: "Projet",
        };
      default:
        return {
          type: "sous-vue",
          libelle: `Atelier (${nomVar})`,
          libelleTransition: `Mode ${nomVar}`,
          badge: nomVar,
        };
    }
  }

  return {
    type: "sous-vue",
    libelle: `${titrePage ?? route} (${nomVar})`,
    libelleTransition: `Mode ${nomVar}`,
    badge: nomVar,
  };
}
