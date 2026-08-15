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
 * Construit dynamiquement le graphe d'architecture du workflow.
 */
export async function scannerWorkflow(): Promise<GrapheWorkflow> {
  const analyses = await analyserTousLesFichiersAst();
  const composantsPage = resoudreImportsComposants(analyses);

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
      // Arête bidirectionnelle page principale ↔ sous-mode
      connecter({
        source: pageId,
        target: varId,
        type: "transition",
        libelle: `Mode ${nomVar}`,
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
      const slug = slugId(modale.titre);
      const estTiroir = modale.estTiroir || modale.titre.toLowerCase().includes("tiroir") || modale.fichier.includes("tiroir");
      const id = `${estTiroir ? "tiroir" : "modal"}:${slug}`;

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

  return { noeuds, liens };
}
