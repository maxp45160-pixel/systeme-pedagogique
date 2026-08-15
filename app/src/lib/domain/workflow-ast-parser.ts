/**
 * Moteur d'Analyse Statique AST & JSX pour les Scanners de Workflow.
 *
 * Utilise l'API du compilateur TypeScript (ts.createSourceFile) pour introspecter
 * 100% dynamiquement la base de code sans AUCUN registre code en dur :
 *   1. Routes et variantes canoniques de requetes (searchParams)
 *   2. Arbre recursif d'imports et de dependances de composants
 *   3. Surfaces et sous-vues interactives (Canvas, explorateur, fiches, editeurs, bilans)
 *   4. Onglets et commutateurs d'etats (useState, tabs.map)
 *   5. Modales (Modale) et Tiroirs (Tiroir)
 *   6. Server Actions reelles (use server et lib/store/*.ts)
 *   7. Declencheurs atomiques (boutons, formulaires, liens) avec libelles reels
 *   8. Redirections et navigations (Link, router.push, redirect)
 *
 * ## Frontiere (AGENTS.md)
 *
 * Couche 3 (Decide) : tout est derive du code source, rien n'est stocke.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import ts from "typescript";
import type { GroupeWorkflow } from "./workflow-graphe";

export const RACINE_SRC = resolve(process.cwd(), "src");

/* ------------------------------------------------------------------ */
/* Types d'extraction AST                                              */
/* ------------------------------------------------------------------ */

export interface NavigationAst {
  cible: string;
  brute: string;
  type: "link" | "router-push" | "router-replace" | "redirect";
  declencheur?: string;
}

export interface ModaleAst {
  id: string;
  titre: string;
  fichier: string;
  estTiroir: boolean;
}

export interface ActionServeurAst {
  id: string;
  nom: string;
  fichier: string;
  libelle: string;
  redirection?: string;
}

export interface BoutonTriggerAst {
  texte: string;
  cibleNav?: string;
  actionInvoquee?: string;
  ouvreModale?: string;
  basculeOnglet?: string;
  fichier: string;
}

export interface OngletAst {
  id: string;
  libelle: string;
  groupe: string;
}

export interface SurfaceAst {
  id: string;
  nom: string;
  fichier: string;
  groupe: GroupeWorkflow;
  libelle: string;
  description?: string;
  badge?: string;
}

export interface FichierAstAnalyse {
  chemin: string;
  relatif: string; // ex: "components/atelier/espace-documentaire.tsx"
  contenu: string;
  imports: string[];
  navigations: NavigationAst[];
  modales: ModaleAst[];
  actionsDeclarees: ActionServeurAst[];
  actionsInvoquees: string[];
  boutons: BoutonTriggerAst[];
  onglets: OngletAst[];
  surfaces: SurfaceAst[];
  estPageRoute: boolean;
  route?: string;
  variantesSearchParams: string[];
  estRedirectionPure: boolean;
  titrePage?: string;
}

/* ------------------------------------------------------------------ */
/* Utilitaires & Normalisation                                         */
/* ------------------------------------------------------------------ */

export function norm(chemin: string): string {
  return chemin.replace(/\\/g, "/");
}

export function slugId(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normaliserUrl(url: string): string {
  return url.replace(/\$\{[^}]+\}/g, (match) => {
    if (match.includes("code")) return "{code}";
    if (match.includes("id") || match.includes("run") || match.includes("session"))
      return "{id}";
    return "{param}";
  });
}

export function baseRoute(url: string): string {
  const sansHash = url.split("#")[0];
  const [base, query] = sansHash.split("?");
  if (!query) return base;

  if (query.includes("session=")) return `${base}?session`;
  if (query.includes("run=")) return `${base}?run`;
  if (query.includes("generation=")) return `${base}?generation`;
  if (query.includes("document=")) return `${base}?document`;
  if (query.includes("note=")) return `${base}?note`;
  if (query.includes("correction=")) return `${base}?correction`;
  if (query.includes("evaluer=")) return `${base}?evaluer`;
  if (query.includes("bilan=")) return `${base}?bilan`;
  if (query.includes("abandon=")) return `${base}?abandon`;
  return base;
}

export function groupePourChemin(relatif: string): GroupeWorkflow {
  const r = relatif.toLowerCase();
  if (
    r.startsWith("app/(app)/seances") ||
    r.startsWith("components/seances") ||
    r.startsWith("components/adaptive")
  ) {
    return "seances";
  }
  if (
    r.startsWith("app/(app)/atelier") ||
    r.startsWith("components/atelier") ||
    r.startsWith("components/referentiel") ||
    r.startsWith("components/competences")
  ) {
    return "atelier";
  }
  if (
    r.startsWith("app/(app)/exercices") ||
    r.startsWith("components/exercices")
  ) {
    return "exercice";
  }
  if (r.startsWith("components/tuteur")) {
    return "tuteur";
  }
  if (
    r.startsWith("app/(app)/profil") ||
    r.startsWith("app/(app)/demarrer") ||
    r.startsWith("components/profil") ||
    r.startsWith("components/demarrer") ||
    r.startsWith("app/login")
  ) {
    return "profil";
  }
  return "dashboard";
}

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

/* ------------------------------------------------------------------ */
/* Lecture récursive des fichiers                                      */
/* ------------------------------------------------------------------ */

const cacheContenus = new Map<string, { mtimeMs: number; contenu: string }>();

export async function lireFichierAvecCache(chemin: string): Promise<string | null> {
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

export async function listerFichiersRec(
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

/* ------------------------------------------------------------------ */
/* Extraction du Texte JSX                                             */
/* ------------------------------------------------------------------ */

function extraireTexteNoeudJsx(noeud: ts.Node, sf: ts.SourceFile): string {
  if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) {
    return noeud.text.trim();
  }
  if (ts.isJsxText(noeud)) {
    return noeud.getText(sf).replace(/\s+/g, " ").trim();
  }
  if (ts.isJsxElement(noeud)) {
    return noeud.children
      .map((c) => extraireTexteNoeudJsx(c, sf))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (ts.isJsxExpression(noeud) && noeud.expression) {
    return extraireTexteNoeudJsx(noeud.expression, sf);
  }
  return "";
}

function valeurPropJsx(elem: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nomProp: string, sf: ts.SourceFile): string | undefined {
  for (const prop of elem.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText(sf) === nomProp) {
      if (!prop.initializer) return "true";
      if (ts.isStringLiteral(prop.initializer)) {
        return prop.initializer.text;
      }
      if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
        if (ts.isStringLiteral(prop.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(prop.initializer.expression)) {
          return prop.initializer.expression.text;
        }
        if (ts.isTemplateExpression(prop.initializer.expression)) {
          return normaliserUrl(prop.initializer.expression.getText(sf).slice(1, -1));
        }
        return prop.initializer.expression.getText(sf);
      }
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Analyse d'un fichier source avec TypeScript AST                     */
/* ------------------------------------------------------------------ */

export function analyserFichierSourceAst(chemin: string, relatif: string, contenu: string): FichierAstAnalyse {
  const sf = ts.createSourceFile(
    relatif,
    contenu,
    ts.ScriptTarget.Latest,
    true,
    relatif.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let route: string | undefined;
  let estPage = false;
  if (relatif.startsWith("app/")) {
    const r = cheminVersRoute(relatif.slice(4));
    if (r !== null) {
      route = r;
      estPage = true;
    }
  }

  const imports: string[] = [];
  const navigations: NavigationAst[] = [];
  const modales: ModaleAst[] = [];
  const actionsDeclarees: ActionServeurAst[] = [];
  const actionsInvoquees: string[] = [];
  const boutons: BoutonTriggerAst[] = [];
  const onglets: OngletAst[] = [];
  const surfaces: SurfaceAst[] = [];
  const variantesSearchParams: string[] = [];
  let titrePage: string | undefined;

  const estFichierActions =
    relatif.startsWith("lib/store/") &&
    (relatif.includes("action") || contenu.includes('"use server"') || contenu.includes("'use server'"));

  // 1. Détection des déclarations d'actions serveur
  if (estFichierActions) {
    for (const statement of sf.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const nom = statement.name?.getText(sf);
        if (nom && !nom.startsWith("_") && !nom.startsWith("load") && !nom.startsWith("charger") && !nom.startsWith("lire")) {
          const libelle = nom
            .replace(/Action$/, "")
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
            .trim();
          const libelleFormate = libelle.charAt(0).toUpperCase() + libelle.slice(1);

          let redirection: string | undefined;
          const corpsTexte = statement.body ? statement.body.getText(sf) : "";
          const mRedir = corpsTexte.match(/redirect\(["'`]([^"'`]+)["'`]\)/);
          if (mRedir) {
            redirection = normaliserUrl(mRedir[1]);
          }

          actionsDeclarees.push({
            id: `action:${slugId(nom)}`,
            nom,
            fichier: relatif,
            libelle: libelleFormate,
            redirection,
          });
        }
      }
    }
  }

  // 2. Détection de composants de modale autonomes (ex: modale-*.tsx)
  const nomFichier = relatif.split("/").pop() ?? "";
  if (nomFichier.startsWith("modale-") && nomFichier.endsWith(".tsx")) {
    const base = nomFichier.replace(/^modale-|\.tsx$/g, "").replace(/-/g, " ");
    const titre = base.charAt(0).toUpperCase() + base.slice(1);
    modales.push({
      id: `modal:${slugId(base)}`,
      titre,
      fichier: relatif,
      estTiroir: false,
    });
  } else if (nomFichier.startsWith("tiroir-") && nomFichier.endsWith(".tsx")) {
    const base = nomFichier.replace(/^tiroir-|\.tsx$/g, "").replace(/-/g, " ");
    const titre = base.charAt(0).toUpperCase() + base.slice(1);
    modales.push({
      id: `tiroir:${slugId(base)}`,
      titre,
      fichier: relatif,
      estTiroir: true,
    });
  }

  // 3. Détection de surfaces interactives de domaine
  const estDossierMetier =
    relatif.startsWith("components/atelier/") ||
    relatif.startsWith("components/dashboard/") ||
    relatif.startsWith("components/seances/") ||
    relatif.startsWith("components/exercices/") ||
    relatif.startsWith("components/adaptive/") ||
    relatif.startsWith("components/tuteur/") ||
    relatif.startsWith("components/profil/") ||
    relatif.startsWith("components/demarrer/") ||
    relatif.startsWith("components/layout/") ||
    relatif.startsWith("components/referentiel/") ||
    relatif.startsWith("components/competences/");

  if (estDossierMetier) {
    for (const statement of sf.statements) {
      if (
        (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement)) &&
        statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        let nomComp = "";
        if (ts.isFunctionDeclaration(statement) && statement.name) {
          nomComp = statement.name.getText(sf);
        } else if (ts.isVariableStatement(statement)) {
          const decl = statement.declarationList.declarations[0];
          if (decl && ts.isIdentifier(decl.name)) {
            nomComp = decl.name.getText(sf);
          }
        }

        if (
          nomComp &&
          nomComp.length > 2 &&
          /^[A-Z][a-z]/.test(nomComp) &&
          !/^[A-Z0-9_]+$/.test(nomComp) &&
          !nomComp.startsWith("Icone") &&
          !nomComp.startsWith("Squelette") &&
          !nomComp.startsWith("Bouton") &&
          !nomComp.startsWith("Champ") &&
          !nomComp.startsWith("Modale") &&
          !nomComp.startsWith("Tiroir") &&
          !nomComp.startsWith("Barre") &&
          !nomComp.startsWith("Radar")
        ) {
          const libelle = nomComp.replace(/([A-Z])/g, " $1").trim();
          surfaces.push({
            id: `surface:${slugId(nomComp)}`,
            nom: nomComp,
            fichier: relatif,
            groupe: groupePourChemin(relatif),
            libelle,
          });
        }
      }
    }
  }

  // 4. Parcours récursif de l'AST
  function visiter(node: ts.Node) {
    // Imports
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith("@/")) {
        imports.push(spec.slice(2));
      } else if (spec.startsWith(".")) {
        const dirCourant = relatif.split("/").slice(0, -1).join("/");
        const parts = (dirCourant ? dirCourant + "/" + spec : spec).split("/");
        const stack: string[] = [];
        for (const p of parts) {
          if (p === "." || p === "") continue;
          if (p === "..") stack.pop();
          else stack.push(p);
        }
        imports.push(stack.join("/"));
      }
    }

    // Navigations (router.push, router.replace, redirect)
    if (ts.isCallExpression(node)) {
      const texteAppel = node.expression.getText(sf);
      if (texteAppel === "router.push" || texteAppel === "router.replace" || texteAppel === "redirect") {
        const premierArg = node.arguments[0];
        if (premierArg) {
          if (ts.isStringLiteral(premierArg) || ts.isNoSubstitutionTemplateLiteral(premierArg)) {
            navigations.push({
              cible: premierArg.text,
              brute: premierArg.text,
              type: texteAppel === "redirect" ? "redirect" : "router-push",
            });
          } else if (ts.isTemplateExpression(premierArg)) {
            const brute = premierArg.getText(sf).slice(1, -1);
            navigations.push({
              cible: normaliserUrl(brute),
              brute,
              type: texteAppel === "redirect" ? "redirect" : "router-push",
            });
          }
        }
      }

      // Actions invoquées via await ou startTransition
      for (const m of node.getText(sf).matchAll(/([A-Za-z0-9_]+Action|[A-Za-z0-9_]+Seance|[A-Za-z0-9_]+Exercice|[A-Za-z0-9_]+Branche|[A-Za-z0-9_]+Note|[A-Za-z0-9_]+Document|[A-Za-z0-9_]+Theme|[A-Za-z0-9_]+Profil)\s*\(/g)) {
        actionsInvoquees.push(m[1]);
      }
    }

    // JSX Elements
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const elem = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = elem.tagName.getText(sf);

      // Titre de page
      if (tagName === "EntetePage") {
        const t = valeurPropJsx(elem, "titre", sf);
        if (t) titrePage = t;
      }

      // Modales JSX
      if (tagName === "Modale" || tagName === "Tiroir") {
        const titre = valeurPropJsx(elem, "titre", sf) ?? "Modale";
        const estTiroir = tagName === "Tiroir" || titre.toLowerCase().includes("tiroir");
        const id = `${estTiroir ? "tiroir" : "modal"}:${slugId(titre)}`;
        if (!modales.some((m) => m.id === id)) {
          modales.push({ id, titre, fichier: relatif, estTiroir });
        }
      }

      // Liens JSX (<Link href="...">, <LienBouton href="...">, <a href="...">)
      if (tagName === "Link" || tagName === "LienBouton" || tagName === "a") {
        const href = valeurPropJsx(elem, "href", sf);
        const texte = ts.isJsxElement(node) ? extraireTexteNoeudJsx(node, sf) : "";
        if (href && href.startsWith("/")) {
          navigations.push({
            cible: normaliserUrl(href),
            brute: href,
            type: "link",
            declencheur: texte ? `Clic '${texte}'` : undefined,
          });
          boutons.push({
            texte: texte || href,
            cibleNav: normaliserUrl(href),
            fichier: relatif,
          });
        }
      }

      // Formulaires & Actions JSX (<form action={...}>)
      if (tagName === "form") {
        const actionProp = valeurPropJsx(elem, "action", sf);
        if (actionProp) {
          const matchAct = actionProp.match(/([A-Za-z0-9_]+)(?:\.bind)?/);
          if (matchAct) actionsInvoquees.push(matchAct[1]);
        }
      }

      // Boutons JSX (<Bouton>, <button>, <BoutonSoumission>)
      if (
        tagName === "Bouton" ||
        tagName === "button" ||
        tagName === "BoutonSoumission" ||
        tagName === "BoutonAbandon" ||
        tagName === "BoutonGenerer" ||
        tagName === "BoutonReviser" ||
        tagName === "BoutonEditer"
      ) {
        const texte = ts.isJsxElement(node) ? extraireTexteNoeudJsx(node, sf) : tagName;
        const formAction = valeurPropJsx(elem, "formAction", sf);
        if (formAction) {
          const matchAct = formAction.match(/([A-Za-z0-9_]+)(?:\.bind)?/);
          if (matchAct) actionsInvoquees.push(matchAct[1]);
        }
        boutons.push({
          texte: texte || tagName,
          actionInvoquee: formAction,
          fichier: relatif,
        });
      }
    }

    // Détection d'onglets (const onglets = [...])
    if (ts.isVariableDeclaration(node) && node.name.getText(sf).toLowerCase().includes("onglet")) {
      if (node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        for (const elem of node.initializer.elements) {
          if (ts.isObjectLiteralExpression(elem)) {
            let idOnglet = "";
            let libelleOnglet = "";
            for (const p of elem.properties) {
              if (ts.isPropertyAssignment(p)) {
                const nomProp = p.name.getText(sf);
                if (nomProp === "id") idOnglet = p.initializer.getText(sf).replace(/['"]/g, "");
                if (nomProp === "libelle" || nomProp === "titre") libelleOnglet = p.initializer.getText(sf).replace(/['"]/g, "");
              }
            }
            if (idOnglet) {
              onglets.push({
                id: `tab:${slugId(idOnglet)}`,
                libelle: libelleOnglet || idOnglet,
                groupe: relatif,
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visiter);
  }

  visiter(sf);

  // Détection des variantes de searchParams pour les pages
  if (estPage) {
    if (contenu.includes("session")) variantesSearchParams.push(`${route}?session`);
    if (contenu.includes("run")) variantesSearchParams.push(`${route}?run`);
    if (contenu.includes("generation")) variantesSearchParams.push(`${route}?generation`);
    if (contenu.includes("document")) variantesSearchParams.push(`${route}?document`);
    if (contenu.includes("note")) variantesSearchParams.push(`${route}?note`);
    if (contenu.includes("correction")) variantesSearchParams.push(`${route}?correction`);
    if (contenu.includes("evaluer")) variantesSearchParams.push(`${route}?evaluer`);
    if (contenu.includes("bilan")) variantesSearchParams.push(`${route}?bilan`);
    if (contenu.includes("abandon")) variantesSearchParams.push(`${route}?abandon`);
  }

  // Redirection pure (ex: pages d'anciennes URLs)
  const sansBruit = contenu
    .replace(/^import\s+.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  const estRedirPure =
    estPage &&
    sansBruit.includes("redirect(") &&
    !/return\s*(\(?\s*<|<)/.test(sansBruit) &&
    !/<[A-Z]/.test(sansBruit);

  return {
    chemin,
    relatif,
    contenu,
    imports,
    navigations,
    modales,
    actionsDeclarees,
    actionsInvoquees: [...new Set(actionsInvoquees)],
    boutons,
    onglets,
    surfaces,
    estPageRoute: estPage,
    route,
    variantesSearchParams,
    estRedirectionPure: estRedirPure,
    titrePage,
  };
}

/* ------------------------------------------------------------------ */
/* Analyse globale du workspace                                        */
/* ------------------------------------------------------------------ */

export async function analyserTousLesFichiersAst(): Promise<Map<string, FichierAstAnalyse>> {
  const chemins = await listerFichiersRec(RACINE_SRC);
  const analyses = new Map<string, FichierAstAnalyse>();

  for (const ch of chemins) {
    const relatif = norm(ch.slice(RACINE_SRC.length + 1));
    const contenu = await lireFichierAvecCache(ch);
    if (contenu !== null) {
      analyses.set(relatif, analyserFichierSourceAst(ch, relatif, contenu));
    }
  }

  return analyses;
}

export function resoudreImportsComposants(analyses: Map<string, FichierAstAnalyse>): Map<string, Set<string>> {
  const importVers = new Map<string, string>();
  for (const relatif of analyses.keys()) {
    const sansExt = relatif.replace(/\.(tsx?|jsx?)$/, "");
    importVers.set(sansExt, relatif);
    if (relatif.endsWith("/index.tsx") || relatif.endsWith("/index.ts")) {
      importVers.set(sansExt.replace(/\/index$/, ""), relatif);
    }
  }

  function collecterComposantsRec(relatif: string, visites = new Set<string>()): Set<string> {
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

  const composantsParPage = new Map<string, Set<string>>();
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;
    composantsParPage.set(a.route, collecterComposantsRec(a.relatif));
  }

  return composantsParPage;
}
