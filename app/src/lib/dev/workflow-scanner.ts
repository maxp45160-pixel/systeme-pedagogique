/**
 * Scanner d'Architecture de Workflow — Introspection 100% dynamique (Couche 3).
 *
 * Construit un GrapheWorkflow architectural en analysant le code source reel
 * via le moteur AST TypeScript (workflow-ast-parser.ts) sans aucun registre code en dur :
 *   1. Routes Next.js (src/app/... + variantes canoniques searchParams)
 *   2. Modales et tiroirs (Modale et composants modale-*.tsx, tiroir-*.tsx)
 *   3. Actions serveur (src/lib/store/*actions*.ts)
 *   4. Navigations et transitions reelles (liens, formulaires, redirections)
 *
 * ## Frontiere (AGENTS.md)
 *
 * Couche 3 (Decide) : tout est derive du code, rien n'est stocke.
 * Les types du graphe restent dans workflow-graphe.ts (couche 1).
 */

import type { GrapheWorkflow } from "@/lib/domain/workflow-graphe";
import {
  analyserTousLesFichiersAst,
  baseRoute,
  CLES_VARIANTS,
  groupePourChemin,
  resoudreImportsComposants,
  resoudreModalesImbriquees,
  resoudreSurfacesPartagees,
  slugId,
} from "./workflow-ast-parser";
import {
  creerConstructionGraphe,
  relierNavigationPartagee,
} from "./workflow-scan-partage";

/**
 * Construit dynamiquement le graphe d'architecture du workflow.
 */
export async function scannerWorkflow(): Promise<GrapheWorkflow> {
  const analyses = await analyserTousLesFichiersAst();
  const composantsPage = resoudreImportsComposants(analyses);

  const construction = creerConstructionGraphe();
  const { ajouterNoeud, connecter, parId } = construction;

  // 0. Clés de variantes réellement ciblées par des navigations ou
  // redirections, toutes sources confondues. Elles complètent les clés lues
  // par chaque page (`searchParams`) : une route ciblée par `?session=` ou
  // `?note=` est un vrai mode, même si la page le laisse transiter.
  const clesCibleesParRoute = new Map<string, Set<string>>();
  function noterCible(url: string) {
    const [base, query] = url.split("?");
    if (!query) return;
    for (const cle of CLES_VARIANTS) {
      if (query === cle || query.startsWith(`${cle}=`)) {
        const set = clesCibleesParRoute.get(base) ?? new Set<string>();
        set.add(cle);
        clesCibleesParRoute.set(base, set);
      }
    }
  }
  for (const a of analyses.values()) {
    for (const nav of a.navigations) noterCible(nav.cible);
    for (const act of a.actionsDeclarees) {
      if (act.redirection) noterCible(act.redirection);
    }
  }

  // 1. Déclarer les pages et sous-routes canoniques
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

    const cles = new Set<string>();
    for (const varRoute of a.variantesSearchParams ?? []) {
      const cle = varRoute.split("?")[1];
      if (cle) cles.add(cle);
    }
    for (const cle of clesCibleesParRoute.get(a.route) ?? []) {
      cles.add(cle);
    }

    for (const cle of cles) {
      const varRoute = `${a.route}?${cle}`;
      const varId = `page:${varRoute}`;
      ajouterNoeud({
        id: varId,
        type: "page",
        libelle: `${a.titrePage ?? a.route} (${cle})`,
        url: varRoute,
        groupe: groupePourChemin(a.relatif),
      });
      // Arête bidirectionnelle page principale ↔ sous-mode
      connecter({
        source: pageId,
        target: varId,
        type: "transition",
        libelle: `Mode ${cle}`,
      });
      connecter({
        source: varId,
        target: pageId,
        type: "navigation",
        libelle: "Retour",
      });
    }
  }

  // 2. Déclarer les modales et tiroirs
  const modaleVersPage = new Map<string, string>();
  for (const a of analyses.values()) {
    for (const modale of a.modales) {
      const id = modale.id;
      const estTiroir = modale.estTiroir;

      ajouterNoeud({
        id,
        type: estTiroir ? "tiroir" : "modal",
        libelle: modale.titre,
        groupe: groupePourChemin(modale.fichier),
      });

      // Retrouver la page qui importe ce fichier de modale
      for (const [route, comps] of composantsPage.entries()) {
        if (comps.has(modale.fichier) || route === a.route) {
          const sourcePage = `page:${route}`;
          if (parId.has(sourcePage)) {
            modaleVersPage.set(id, sourcePage);
            connecter({
              source: sourcePage,
              target: id,
              type: "ouverture",
              libelle: modale.titre,
            });
            connecter({
              source: id,
              target: sourcePage,
              type: "retour",
              libelle: "Fermer",
            });
          }
        }
      }
    }
  }

  // 2bis. Modales imbriquées — une modale peut monter une autre modale (la
  // capture d'intention passe la main au parcours de projet ou à la
  // proposition de référentiel). La passe ci-dessus ne relie que depuis les
  // pages : la modale-enfant est alors déclarée mais jamais atteinte, et le
  // graphe la montre inatteignable alors que le chemin existe.
  for (const [parent, enfants] of resoudreModalesImbriquees(analyses)) {
    if (!parId.has(parent)) continue;
    for (const enfant of enfants) {
      if (!parId.has(enfant)) continue;
      connecter({
        source: parent,
        target: enfant,
        type: "ouverture",
        libelle: "Modale imbriquée",
      });
      connecter({
        source: enfant,
        target: parent,
        type: "retour",
        libelle: "Fermer",
      });
    }
  }

  // Surfaces du cadre partagé (layout) : modales et tiroirs montés par le
  // layout, donc disponibles sur toutes les pages du groupe de routes — le
  // tuteur flottant, le point d'entrée `+`. Même cause que la navigation
  // persistante : sans cette passe, seules les pages qui importent leur
  // fichier sembleraient pouvoir les ouvrir.
  const surfacesPartagees = resoudreSurfacesPartagees(analyses);
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const sourceId = `page:${a.route}`;
    for (const [dossier, ids] of surfacesPartagees.entries()) {
      if (!a.relatif.startsWith(`${dossier}/`)) continue;
      for (const id of ids) {
        if (!parId.has(id)) continue;
        connecter({
          source: sourceId,
          target: id,
          type: "ouverture",
          libelle: "Sur le cadre",
        });
        connecter({
          source: id,
          target: sourceId,
          type: "retour",
          libelle: "Fermer",
        });
      }
    }
  }

  // 3. Déclarer les Server Actions réelles
  const toutesActions = new Map<string, import("./workflow-ast-parser").ActionServeurAst>();
  for (const a of analyses.values()) {
    for (const act of a.actionsDeclarees) {
      toutesActions.set(act.nom, act);
    }
  }

  // Relier les actions invoquées dans chaque page
  for (const [route, comps] of composantsPage.entries()) {
    const pageId = `page:${route}`;
    const actionsUtilisees = new Set<string>();

    const pageAnalyse = [...analyses.values()].find((a) => a.route === route);
    if (pageAnalyse) {
      pageAnalyse.actionsInvoquees.forEach((act) => actionsUtilisees.add(act));
    }

    for (const comp of comps) {
      const aComp = analyses.get(comp);
      if (aComp) {
        aComp.actionsInvoquees.forEach((act) => actionsUtilisees.add(act));
      }
    }

    for (const nomAct of actionsUtilisees) {
      const act = toutesActions.get(nomAct);
      if (!act) continue;

      const actId = `action:${slugId(nomAct)}`;
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
      });

      // Redirection après action
      if (act.redirection) {
        const destId = `page:${baseRoute(act.redirection)}`;
        if (parId.has(destId)) {
          connecter({
            source: actId,
            target: destId,
            type: "transition",
            libelle: "Redirection après action",
          });
        }
      } else {
        // Retour à la page source après mise à jour
        connecter({
          source: actId,
          target: pageId,
          type: "transition",
          libelle: "Actualisation",
        });
      }
    }
  }

  // 4. Déclarer les navigations entre pages
  for (const [route, comps] of composantsPage.entries()) {
    const sourceId = `page:${route}`;
    const toutesNav = new Set<string>();

    const pageAnalyse = [...analyses.values()].find((a) => a.route === route);
    if (pageAnalyse) {
      pageAnalyse.navigations.forEach((n) => toutesNav.add(baseRoute(n.cible)));
    }

    for (const comp of comps) {
      const aComp = analyses.get(comp);
      if (aComp) {
        aComp.navigations.forEach((n) => toutesNav.add(baseRoute(n.cible)));
      }
    }

    for (const cible of toutesNav) {
      const targetId = `page:${cible}`;
      if (parId.has(targetId) && targetId !== sourceId) {
        connecter({
          source: sourceId,
          target: targetId,
          type: "navigation",
          libelle: cible,
        });
      }
    }
  }

  // 5. Navigation persistante du cadre — passe partagée avec la perspective
  // UX (workflow-scan-partage.ts). Sources : les pages seules, ici ; l'UX y
  // ajoute ses variantes searchParams.
  relierNavigationPartagee(
    construction,
    analyses,
    [...analyses.values()]
      .filter(
        (a) =>
          a.estPageRoute &&
          a.route &&
          !a.estRedirectionPure &&
          !a.route.startsWith("/dev"),
      )
      .map((a) => ({ id: `page:${a.route}`, relatif: a.relatif })),
  );

  return { noeuds: construction.noeuds, liens: construction.liens };
}
