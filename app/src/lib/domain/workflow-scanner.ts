/**
 * Scanner d'Architecture de Workflow — Introspection 100% dynamique.
 *
 * Construit un `GrapheWorkflow` en analysant le code source réel sans aucun
 * registre codé en dur :
 *   1. Routes Next.js (`src/app/.../page.tsx` + variantes canoniques détectées dans `searchParams`)
 *   2. Modales et tiroirs (`<Modale ...>` et composants de modales)
 *   3. Actions serveur (`src/lib/store/*actions*.ts` et `actions.ts`)
 *   4. Arbre des imports et invocations réelles (liens, formulaires, transitions)
 *
 * ## Frontière (AGENTS.md)
 *
 * Couche 3 (Décide) : tout est dérivé du code, rien n'est stocké.
 * Les types du graphe restent dans `workflow-graphe.ts` (couche 1).
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import type {
  GrapheWorkflow,
  NoeudWorkflow,
  LienWorkflow,
  TypeNoeudWorkflow,
  TypeLienWorkflow,
  GroupeWorkflow,
} from "./workflow-graphe";

/* ------------------------------------------------------------------ */
/* Constantes & Cache                                                  */
/* ------------------------------------------------------------------ */

const RACINE_SRC = resolve(process.cwd(), "src");

const cacheContenus = new Map<string, { mtimeMs: number; contenu: string }>();

async function lireFichierAvecCache(chemin: string): Promise<string | null> {
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

function norm(chemin: string): string {
  return chemin.replace(/\\/g, "/");
}

/* ------------------------------------------------------------------ */
/* Lecture récursive des fichiers                                      */
/* ------------------------------------------------------------------ */

async function listerFichiers(
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
      resultats.push(...(await listerFichiers(chemin, extensions)));
    } else if (extensions.some((ext) => entree.name.endsWith(ext))) {
      if (entree.name.endsWith(".test.ts") || entree.name.endsWith(".test.tsx"))
        continue;
      if (entree.name.endsWith(".d.ts")) continue;
      resultats.push(chemin);
    }
  }
  return resultats;
}

/* ------------------------------------------------------------------ */
/* Types d'analyse interne                                             */
/* ------------------------------------------------------------------ */

interface NavigationExtraite {
  cible: string;
  brute: string;
  type: "link" | "router-push" | "router-replace" | "redirect";
}

interface ModaleExtraite {
  titre: string;
  fichier: string;
}

interface ActionServeurExtraite {
  nom: string;
  fichier: string;
  libelle: string;
  redirection?: string;
  revalidation?: string;
}

interface FichierAnalyse {
  chemin: string;
  relatif: string; // relatif à src/
  contenu: string;
  imports: string[];
  navigations: NavigationExtraite[];
  modales: ModaleExtraite[];
  actionsDeclarees: ActionServeurExtraite[];
  actionsInvoquees: string[];
  estPageRoute: boolean;
  route?: string;
  variantesSearchParams?: string[];
  estRedirectionPure: boolean;
  titrePage?: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Dérivation d'URL & Routes                                           */
/* ------------------------------------------------------------------ */

function cheminVersRoute(relatifApp: string): string | null {
  if (!relatifApp.endsWith("page.tsx") && !relatifApp.endsWith("page.ts"))
    return null;

  let route = relatifApp.replace(/\/?page\.tsx?$/, "");
  route = route.replace(/\([^)]+\)\/?/g, "");
  route = route.replace(/\[([^\]]+)\]/g, "{$1}");
  route = "/" + route;
  route = route.replace(/\/+/g, "/");
  if (route !== "/" && route.endsWith("/")) route = route.slice(0, -1);
  return route;
}

function normaliserUrl(url: string): string {
  return url.replace(/\$\{[^}]+\}/g, (match) => {
    if (match.includes("code")) return "{code}";
    if (match.includes("id") || match.includes("run") || match.includes("session"))
      return "{id}";
    return "{param}";
  });
}

function baseRoute(url: string): string {
  const sansHash = url.split("#")[0];
  const [base, query] = sansHash.split("?");
  if (!query) return base;

  if (query.includes("session=")) return `${base}?session`;
  if (query.includes("run=")) return `${base}?run`;
  if (query.includes("generation=")) return `${base}?generation`;
  if (query.includes("document=")) return `${base}?document`;
  if (query.includes("note=")) return `${base}?note`;
  if (query.includes("vue=graphe")) return `${base}?vue=graphe`;
  return base;
}

function groupePourChemin(relatif: string): GroupeWorkflow {
  const r = relatif.toLowerCase();
  if (r.startsWith("app/(app)/seances") || r.startsWith("components/seances")) {
    return "seances";
  }
  if (r.startsWith("app/(app)/atelier") || r.startsWith("components/atelier") || r.startsWith("components/referentiel")) {
    return "atelier";
  }
  if (r.startsWith("app/(app)/exercices") || r.startsWith("components/exercices")) {
    return "exercice";
  }
  if (r.startsWith("components/tuteur")) {
    return "tuteur";
  }
  if (r.startsWith("app/(app)/profil") || r.startsWith("app/(app)/demarrer") || r.startsWith("components/profil") || r.startsWith("app/login")) {
    return "profil";
  }
  return "dashboard";
}

/* ------------------------------------------------------------------ */
/* Extraction des patterns de code                                     */
/* ------------------------------------------------------------------ */

function extraireNavigations(contenu: string): NavigationExtraite[] {
  const r: NavigationExtraite[] = [];

  // href="/path"
  for (const m of contenu.matchAll(/href=["'](\/[^"']*?)["']/g)) {
    r.push({ cible: m[1], brute: m[1], type: "link" });
  }
  // href={`/path...`}
  for (const m of contenu.matchAll(/href=\{`(\/[^`]*?)`\}/g)) {
    r.push({ cible: normaliserUrl(m[1]), brute: m[1], type: "link" });
  }
  // router.push/replace
  for (const m of contenu.matchAll(/router\.(push|replace)\(["'](\/[^"']*?)["']\)/g)) {
    r.push({
      cible: m[2],
      brute: m[2],
      type: m[1] === "push" ? "router-push" : "router-replace",
    });
  }
  for (const m of contenu.matchAll(/router\.(push|replace)\(`(\/[^`]*?)`\)/g)) {
    r.push({
      cible: normaliserUrl(m[2]),
      brute: m[2],
      type: m[1] === "push" ? "router-push" : "router-replace",
    });
  }
  // redirect
  for (const m of contenu.matchAll(/redirect\(["'](\/[^"']*?)["']/g)) {
    r.push({ cible: m[1], brute: m[1], type: "redirect" });
  }
  for (const m of contenu.matchAll(/redirect\(`(\/[^`]*?)`\)/g)) {
    r.push({ cible: normaliserUrl(m[1]), brute: m[1], type: "redirect" });
  }

  return r;
}

function estRedirectionPure(contenu: string): boolean {
  const sansBruit = contenu
    .replace(/^import\s+.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  if (!sansBruit.includes("redirect(")) return false;
  return !/return\s*(\(?\s*<|<)/.test(sansBruit) && !/<[A-Z]/.test(sansBruit);
}

function extraireModales(contenu: string, fichier: string): ModaleExtraite[] {
  const resultats: ModaleExtraite[] = [];
  if (fichier.startsWith("lib/") || (!contenu.includes("<Modale") && !contenu.includes("<Tiroir"))) {
    return resultats;
  }

  // <Modale ...>
  const matchesModale = [...contenu.matchAll(/<Modale\b([\s\S]*?)(?=\/?>|\n\s*<)/g)];
  for (const m of matchesModale) {
    const props = m[1];
    const simple = props.match(/titre=["']([^"']+)["']/);
    if (simple) {
      resultats.push({ titre: simple[1], fichier });
      continue;
    }
    const tpl = props.match(/titre=\{`([^`]+)`\}/);
    if (tpl) {
      resultats.push({ titre: normaliserUrl(tpl[1]), fichier });
      continue;
    }
  }

  // Composants de modale autonomes (ex: ModaleRevision, ModaleCompetence, ModaleTheme)
  const nomFichier = fichier.split("/").pop() ?? "";
  if (nomFichier.startsWith("modale-") && nomFichier.endsWith(".tsx")) {
    const base = nomFichier.replace(/^modale-|\.tsx$/g, "").replace(/-/g, " ");
    const titre = base.charAt(0).toUpperCase() + base.slice(1);
    if (!resultats.some((r) => r.titre.toLowerCase() === titre.toLowerCase())) {
      resultats.push({ titre, fichier });
    }
  }

  return resultats;
}

function extraireImports(contenu: string, meRelatif: string): string[] {
  const r: string[] = [];
  for (const m of contenu.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
    r.push(m[1]);
  }
  const dirCourant = meRelatif.split("/").slice(0, -1).join("/");
  for (const m of contenu.matchAll(/from\s+["'](\.\.?[^"']+)["']/g)) {
    const relImport = m[1];
    const parts = (dirCourant ? dirCourant + "/" + relImport : relImport).split("/");
    const stack: string[] = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      if (p === "..") {
        stack.pop();
      } else {
        stack.push(p);
      }
    }
    r.push(stack.join("/"));
  }
  return r;
}

function extraireActionsDeclarees(contenu: string, relatif: string): ActionServeurExtraite[] {
  const actions: ActionServeurExtraite[] = [];
  const estFichierActions =
    relatif.startsWith("lib/store/") &&
    (relatif.includes("action") || contenu.includes('"use server"') || contenu.includes("'use server'"));

  if (!estFichierActions) return actions;

  // export async function nom(...)
  for (const m of contenu.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*(?::\s*[\w<>[\]\s|]+)?\s*\{/g)) {
    const nom = m[1];
    if (nom.startsWith("_") || nom.startsWith("load") || nom.startsWith("charger") || nom.startsWith("lire")) {
      continue;
    }

    // Libellé dérivé du camelCase
    const libelle = nom
      .replace(/Action$/, "")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .trim();
    const libelleFormate = libelle.charAt(0).toUpperCase() + libelle.slice(1);

    // Corps de fonction pour extraire redirections ou revalidations
    const debutIndex = m.index! + m[0].length;
    const extraitCorps = contenu.slice(debutIndex, debutIndex + 1200);

    let redirection: string | undefined;
    const mRedir = extraitCorps.match(/redirect\(["'`]([^"'`]+)["'`]\)/);
    if (mRedir) {
      redirection = normaliserUrl(mRedir[1]);
    }

    actions.push({
      nom,
      fichier: relatif,
      libelle: libelleFormate,
      redirection,
    });
  }

  return actions;
}

function extraireActionsInvoquees(contenu: string): string[] {
  const invoquees: string[] = [];
  // form action={nomAction} ou bind(null, ...)
  for (const m of contenu.matchAll(/action=\{([A-Za-z0-9_]+)(?:\.bind\([^)]+\))?\}/g)) {
    invoquees.push(m[1]);
  }
  // formAction={nomAction}
  for (const m of contenu.matchAll(/formAction=\{([A-Za-z0-9_]+)(?:\.bind\([^)]+\))?\}/g)) {
    invoquees.push(m[1]);
  }
  // await nomAction(...) dans useTransition ou onClick
  for (const m of contenu.matchAll(/await\s+([A-Za-z0-9_]+Action|[A-Za-z0-9_]+Seance|[A-Za-z0-9_]+Exercice|[A-Za-z0-9_]+Branche|[A-Za-z0-9_]+Note|[A-Za-z0-9_]+Document|[A-Za-z0-9_]+Theme|[A-Za-z0-9_]+Profil)\s*\(/g)) {
    invoquees.push(m[1]);
  }
  return [...new Set(invoquees)];
}

function extraireVariantesSearchParams(contenu: string, route?: string): string[] {
  if (!route) return [];
  const variantes: string[] = [];
  if (route === "/seances") {
    if (contenu.includes("session")) variantes.push("/seances?session");
    if (contenu.includes("run")) variantes.push("/seances?run");
    if (contenu.includes("generation")) variantes.push("/seances?generation");
  } else if (route === "/atelier") {
    if (contenu.includes("document")) variantes.push("/atelier?document");
    if (contenu.includes("note")) variantes.push("/atelier?note");
  }
  return variantes;
}

function slugId(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/* Scanner Principal                                                   */
/* ------------------------------------------------------------------ */

export async function scannerWorkflow(): Promise<GrapheWorkflow> {
  const chemins = await listerFichiers(RACINE_SRC);
  const analyses = new Map<string, FichierAnalyse>();

  for (const chemin of chemins) {
    const relatif = norm(chemin.slice(RACINE_SRC.length + 1));
    const contenu = await lireFichierAvecCache(chemin);
    if (contenu === null) continue;

    let route: string | undefined;
    let estPage = false;
    if (relatif.startsWith("app/")) {
      const r = cheminVersRoute(relatif.slice(4));
      if (r !== null) {
        route = r;
        estPage = true;
      }
    }

    const navigations = extraireNavigations(contenu);
    const modales = extraireModales(contenu, relatif);
    const actionsDeclarees = extraireActionsDeclarees(contenu, relatif);
    const actionsInvoquees = extraireActionsInvoquees(contenu);
    const variantesSearchParams = estPage ? extraireVariantesSearchParams(contenu, route) : [];

    // Titre de page
    let titrePage: string | undefined;
    const mTitre = contenu.match(/<EntetePage[^>]*?titre=["']([^"']+)["']/);
    if (mTitre) titrePage = mTitre[1];

    analyses.set(relatif, {
      chemin,
      relatif,
      contenu,
      imports: extraireImports(contenu, relatif),
      navigations,
      modales,
      actionsDeclarees,
      actionsInvoquees,
      estPageRoute: estPage,
      route,
      variantesSearchParams,
      estRedirectionPure: estPage && estRedirectionPure(contenu),
      titrePage,
    });
  }

  // Résolution des imports
  const importVers = new Map<string, string>();
  for (const relatif of analyses.keys()) {
    const sansExt = relatif.replace(/\.(tsx?|jsx?)$/, "");
    importVers.set(sansExt, relatif);
    if (relatif.endsWith("/index.tsx") || relatif.endsWith("/index.ts")) {
      importVers.set(sansExt.replace(/\/index$/, ""), relatif);
    }
  }

  function collecterComposantsRec(
    relatif: string,
    visites = new Set<string>(),
  ): Set<string> {
    const resultats = new Set<string>();
    const a = analyses.get(relatif);
    if (!a) return resultats;

    for (const imp of a.imports) {
      const fichier = importVers.get(imp);
      if (fichier && !visites.has(fichier)) {
        visites.add(fichier);
        resultats.add(fichier);
        const sous = collecterComposantsRec(fichier, visites);
        for (const s of sous) resultats.add(s);
      }
    }
    return resultats;
  }

  const composantsPage = new Map<string, Set<string>>();
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;
    composantsPage.set(a.route, collecterComposantsRec(a.relatif));
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
      const estTiroir = modale.titre.toLowerCase().includes("tiroir") || modale.fichier.includes("tiroir");
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
  const toutesActions = new Map<string, ActionServeurExtraite>();
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
