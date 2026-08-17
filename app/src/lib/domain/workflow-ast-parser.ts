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

export interface MicroInteractionAst {
  id: string;
  type: "canvas" | "accordéon" | "pomodoro" | "tuteur" | "media";
  libelle: string;
  declencheur: string;
  fichier: string;
  badge?: string;
  cible?: string;
  /**
   * Vrai quand la micro-interaction est INFÉRÉE d'un motif de code (canvas,
   * chronomètre, accordéon…) et non d'une déclaration explicite. Ces nœuds
   * restent affichés mais ne comptent pas comme « fins de parcours » : ce sont
   * des affordances, pas des états terminaux.
   */
  heuristique?: boolean;
}

export interface FichierAstAnalyse {
  chemin: string;
  relatif: string; // ex: "components/atelier/espace-documentaire.tsx"
  contenu: string;
  imports: string[];
  navigations: NavigationAst[];
  /** Destinations de navigation déclarées en données (tableaux d'objets à `href`). */
  destinationsPartagees: string[];
  modales: ModaleAst[];
  actionsDeclarees: ActionServeurAst[];
  actionsInvoquees: string[];
  boutons: BoutonTriggerAst[];
  onglets: OngletAst[];
  surfaces: SurfaceAst[];
  microInteractions: MicroInteractionAst[];
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
  let u = url.trim();
  if ((u.startsWith("`") && u.endsWith("`")) || (u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
    u = u.slice(1, -1);
  }
  let resultat = "";
  let i = 0;
  while (i < u.length) {
    if (u.startsWith("${", i)) {
      let profondeur = 1;
      let j = i + 2;
      while (j < u.length && profondeur > 0) {
        if (u[j] === "{") profondeur++;
        else if (u[j] === "}") profondeur--;
        j++;
      }
      const expr = u.slice(i, j).toLowerCase();
      if (expr.includes("code") || expr.includes("domaine") || expr.includes("doc")) {
        resultat += "{code}";
      } else if (expr.includes("id") || expr.includes("run") || expr.includes("session")) {
        resultat += "{id}";
      } else {
        resultat += "{param}";
      }
      i = j;
    } else {
      resultat += u[i];
      i++;
    }
  }
  return resultat.replace(/['"`]/g, "").trim();
}

export function normaliserTexteDynamique(texte: string): string {
  return texte
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[\s(]+$/, "")
    .replace(/\s+/g, " ")
    .replace(/['"`]/g, "")
    .trim();
}

export function baseRoute(url: string): string {
  const sansHash = url.split("#")[0];
  const [base, query] = sansHash.split("?");
  if (!query) return base;

  if (query.includes("session=")) return `${base}?session`;
  if (query.includes("document=")) return `${base}?document`;
  if (query.includes("note=")) return `${base}?note`;
  if (query.includes("correction=")) return `${base}?correction`;
  if (query.includes("evaluer=")) return `${base}?evaluer`;
  if (query.includes("bilan=")) return `${base}?bilan`;
  if (query.includes("abandon=")) return `${base}?abandon`;
  return base;
}

/**
 * Les clés de variantes de requête que le graphe sait représenter.
 *
 * Une variante `route?clé` n'est déclarée que si elle est lue par la page
 * (`searchParams`) ou réellement ciblée par une navigation/redirection —
 * jamais sur la seule présence du mot dans le texte source, qui fabriquait
 * des modes inexistants (`/suspendu?document`, `/progression?bilan`, …).
 */
export const CLES_VARIANTS = [
  "session",
  "document",
  "note",
  "correction",
  "evaluer",
  "bilan",
  "abandon",
] as const;

/**
 * Extrait les clés de `searchParams` réellement lues par une page.
 *
 * Lit la déclaration de propriété `searchParams` du type des props (inline ou
 * interface nommée), dépaquette `Promise<T>` le cas échéant, et collecte les
 * noms des membres de l'objet. C'est la source de vérité des variantes :
 * `searchParams: { session?, correction?, … }` déclare les modes que la page
 * sait afficher.
 */
export function extraireClesSearchParams(sf: ts.SourceFile): string[] {
  const cles = new Set<string>();

  function collecterDepuis(typeNode: ts.TypeNode | undefined) {
    if (!typeNode) return;
    let t = typeNode;
    if (ts.isTypeReferenceNode(t)) {
      if (t.typeName.getText(sf) !== "Promise" || !t.typeArguments || t.typeArguments.length !== 1) {
        return;
      }
      t = t.typeArguments[0];
    }
    if (!ts.isTypeLiteralNode(t)) return;
    for (const membre of t.members) {
      if (ts.isPropertySignature(membre) && membre.name) {
        const cle = membre.name.getText(sf).replace(/^['"]|['"]$/g, "");
        if (cle) cles.add(cle);
      }
    }
  }

  function visiter(node: ts.Node) {
    if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
      for (const membre of node.members) {
        if (
          ts.isPropertySignature(membre) &&
          membre.name &&
          membre.name.getText(sf) === "searchParams"
        ) {
          collecterDepuis(membre.type);
        }
      }
    }
    ts.forEachChild(node, visiter);
  }
  visiter(sf);

  return [...cles];
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
    r.startsWith("components/exercices") ||
    r.startsWith("components/bilan")
  ) {
    return "exercice";
  }
  if (
    r.startsWith("app/(app)/atelier") ||
    r.startsWith("components/atelier") ||
    r.startsWith("components/projets") ||
    r.startsWith("components/referentiel") ||
    r.startsWith("components/competences")
  ) {
    return "atelier";
  }
  if (r.startsWith("components/tuteur")) {
    return "tuteur";
  }
  if (
    r.startsWith("app/(app)/profil") ||
    r.startsWith("app/(app)/progression") ||
    r.startsWith("app/(app)/admin") ||
    r.startsWith("app/(app)/compte") ||
    r.startsWith("components/profil") ||
    r.startsWith("components/progression") ||
    r.startsWith("components/admin") ||
    r.startsWith("components/compte") ||
    r.startsWith("components/layout")
  ) {
    return "profil";
  }
  return "dashboard";
}

export function cheminVersRoute(relatifApp: string): string | null {
  const norm = relatifApp.replace(/\\/g, "/");
  const match = norm.match(/(?:^|\/)(page)\.(tsx|ts|js|jsx)$/);
  if (!match) return null;

  let rep = norm.replace(/\/page\.(tsx|ts|js|jsx)$/, "");
  if (rep === norm || rep === "page") rep = "";

  const segments = rep
    .split("/")
    .filter((s) => s.length > 0 && !s.startsWith("(") && !s.endsWith(")"));

  const route = "/" + segments.map((s) => {
    if (s.startsWith("[...") && s.endsWith("]")) return `{...${s.slice(4, -1)}}`;
    if (s.startsWith("[[...") && s.endsWith("]]")) return `{[...${s.slice(5, -2)}]}`;
    if (s.startsWith("[") && s.endsWith("]")) return `{${s.slice(1, -1)}}`;
    return s;
  }).join("/");

  return route === "" ? "/" : route;
}

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
  extensions: string[] = [".tsx", ".ts"],
): Promise<string[]> {
  let entrees: import("fs").Dirent[];
  try {
    entrees = await readdir(repertoire, { withFileTypes: true });
  } catch {
    return [];
  }
  const resultats: string[] = [];

  for (const entree of entrees) {
    if (
      entree.name === "node_modules" ||
      entree.name === ".next" ||
      entree.name === ".git"
    ) {
      continue;
    }
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
  if (ts.isTemplateExpression(noeud)) {
    return normaliserTexteDynamique(noeud.getText(sf).slice(1, -1));
  }
  return "";
}

function resoudreValeurConstante(sf: ts.SourceFile, identifiant: string): string | undefined {
  for (const statement of sf.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === identifiant && decl.initializer) {
          if (ts.isStringLiteral(decl.initializer) || ts.isNoSubstitutionTemplateLiteral(decl.initializer)) {
            return decl.initializer.text;
          }
          if (ts.isTemplateExpression(decl.initializer)) {
            return normaliserUrl(decl.initializer.getText(sf).slice(1, -1));
          }
          if (ts.isConditionalExpression(decl.initializer)) {
            if (ts.isStringLiteral(decl.initializer.whenTrue)) return decl.initializer.whenTrue.text;
            if (ts.isStringLiteral(decl.initializer.whenFalse)) return decl.initializer.whenFalse.text;
          }
        }
      }
    }
  }
  return undefined;
}

function valeurPropJsx(
  elem: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  nomProp: string,
  sf: ts.SourceFile,
  fichierRelatif?: string,
): string | undefined {
  for (const prop of elem.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText(sf) === nomProp) {
      if (!prop.initializer) return "true";
      if (ts.isStringLiteral(prop.initializer)) {
        return prop.initializer.text;
      }
      if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
        const expr = prop.initializer.expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
          return expr.text;
        }
        if (ts.isTemplateExpression(expr)) {
          return normaliserUrl(expr.getText(sf).slice(1, -1));
        }
        if (ts.isIdentifier(expr)) {
          const nom = expr.text;
          const resolu = resoudreValeurConstante(sf, nom);
          if (resolu) return resolu;
          if (nomProp === "titre" && fichierRelatif) {
            const nomFichier = fichierRelatif.split("/").pop() ?? "";
            const base = nomFichier.replace(/^modale-|^tiroir-|\.tsx?$/g, "").replace(/-/g, " ");
            if (base && base !== "modale" && base !== "tiroir") {
              return base.charAt(0).toUpperCase() + base.slice(1);
            }
          }
          return nom;
        }
        return expr.getText(sf);
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
  const destinationsPartagees: string[] = [];
  let titrePage: string | undefined;

  const estFichierActions =
    relatif.startsWith("lib/store/") &&
    (relatif.includes("action") || contenu.includes('"use server"') || contenu.includes("'use server'"));

  const estFichierUi =
    (relatif.startsWith("components/") || (relatif.startsWith("app/") && !relatif.startsWith("app/api/"))) &&
    (relatif.endsWith(".tsx") || relatif.endsWith(".jsx"));

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
          const mRedir = corpsTexte.match(/redirect\(([^)]+)\)/);
          if (mRedir) {
            const argumentRedirection = mRedir[1].trim().replace(/^["'`]|["'`]$/g, "");
            // Redirections dynamiques connues : `destinationApresExercice` et
            // `urlExercice` ne mènent qu'au cahier `/seances` (ADR-079,
            // navigation-exercice.ts). L'étape éventuelle (bilan/abandon/…) est
            // le littéral passé en argument ; elle s'ignore ici car le graphe
            // résout les cibles de redirection sur la route de base.
            if (argumentRedirection.includes("destinationApresExercice") || argumentRedirection.includes("urlExercice")) {
              redirection = "/seances";
            } else {
              redirection = normaliserUrl(argumentRedirection);
            }
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
  if (estFichierUi && nomFichier.startsWith("modale-") && nomFichier.endsWith(".tsx")) {
    const base = nomFichier.replace(/^modale-|\.tsx$/g, "").replace(/-/g, " ");
    const titre = base.charAt(0).toUpperCase() + base.slice(1);
    modales.push({
      id: `modal:${slugId(base)}`,
      titre,
      fichier: relatif,
      estTiroir: false,
    });
  } else if (estFichierUi && nomFichier.startsWith("tiroir-") && nomFichier.endsWith(".tsx")) {
    const base = nomFichier.replace(/^tiroir-|\.tsx$/g, "").replace(/-/g, " ");
    const titre = base.charAt(0).toUpperCase() + base.slice(1);
    modales.push({
      id: `tiroir:${slugId(base)}`,
      titre,
      fichier: relatif,
      estTiroir: true,
    });
  }

  // 3. Détection de surfaces interactives de domaine (Couche 4 UI uniquement)
  const estDossierMetier =
    estFichierUi &&
    (relatif.startsWith("components/atelier/") ||
      relatif.startsWith("components/dashboard/") ||
      relatif.startsWith("components/seances/") ||
      relatif.startsWith("components/exercices/") ||
      relatif.startsWith("components/adaptive/") ||
      relatif.startsWith("components/tuteur/") ||
      relatif.startsWith("components/profil/") ||
      relatif.startsWith("components/demarrer/") ||
      relatif.startsWith("components/layout/") ||
      relatif.startsWith("components/referentiel/") ||
      relatif.startsWith("components/competences/"));

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

    // JSX Elements (Couche 4 UI)
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const elem = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = elem.tagName.getText(sf);

      // Titre de page
      if (tagName === "EntetePage") {
        const t = valeurPropJsx(elem, "titre", sf, relatif);
        if (t) titrePage = t;
      }

      // Modales JSX
      if (tagName === "Modale" || tagName === "Tiroir") {
        const titre = valeurPropJsx(elem, "titre", sf, relatif);
        const estTiroir = tagName === "Tiroir" || (titre ? titre.toLowerCase().includes("tiroir") : false);

        const modaleDediee = modales.find((m) => m.fichier === relatif);
        if (modaleDediee) {
          if (titre && titre !== "Modale") {
            modaleDediee.titre = titre;
          }
        } else {
          const titreEffectif = titre ?? "Modale";
          const id = `${estTiroir ? "tiroir" : "modal"}:${slugId(titreEffectif)}`;
          if (!modales.some((m) => m.id === id)) {
            modales.push({ id, titre: titreEffectif, fichier: relatif, estTiroir });
          }
        }
      }

      // Liens JSX (<Link href="...">, <LienBouton href="...">, <a href="...">)
      if (tagName === "Link" || tagName === "LienBouton" || tagName === "a") {
        const href = valeurPropJsx(elem, "href", sf, relatif);
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
        const actionProp = valeurPropJsx(elem, "action", sf, relatif);
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
        const formAction = valeurPropJsx(elem, "formAction", sf, relatif);
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

    // Détection d'onglets (const onglets = [...], tabs = [...]) dans les composants UI
    if (
      estFichierUi &&
      ts.isVariableDeclaration(node) &&
      (node.name.getText(sf).toLowerCase().includes("onglet") ||
        node.name.getText(sf).toLowerCase().includes("tabs"))
    ) {
      if (node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        for (const elem of node.initializer.elements) {
          if (ts.isObjectLiteralExpression(elem)) {
            let idOnglet = "";
            let libelleOnglet = "";
            for (const p of elem.properties) {
              if (ts.isPropertyAssignment(p)) {
                let init = p.initializer;
                if (ts.isAsExpression(init)) {
                  init = init.expression;
                }
                const nomProp = p.name.getText(sf);
                if (nomProp === "id") {
                  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
                    idOnglet = init.text;
                  } else {
                    idOnglet = init.getText(sf).replace(/['"]/g, "").trim();
                  }
                }
                if (nomProp === "libelle" || nomProp === "titre" || nomProp === "label") {
                  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
                    libelleOnglet = init.text;
                  } else if (ts.isTemplateExpression(init)) {
                    const head = init.head.text.replace(/[\s(]+$/, "").trim();
                    libelleOnglet = head ? normaliserTexteDynamique(head) : "Onglet";
                  } else {
                    libelleOnglet = normaliserTexteDynamique(init.getText(sf));
                  }
                }
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

  // Destinations de navigation déclarées en données, hors JSX : structures
  // portant une propriété `href` littérale (ex: `NAVIGATION` dans
  // components/layout/navigation.ts, dont les routes sont nichées dans des
  // groupes `entrees`). Le rail et la barre mobile rendent ces routes sur
  // CHAQUE page du groupe `(app)` — un scanner de pages seules ne peut pas
  // les voir, elles ne vivent pas dans les pages.
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const collecterHrefs = (node: ts.Node) => {
        if (ts.isObjectLiteralExpression(node)) {
          for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop) || prop.name.getText(sf) !== "href") continue;
            const init = prop.initializer;
            let valeur: string | undefined;
            if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
              valeur = init.text;
            } else if (ts.isTemplateExpression(init)) {
              valeur = normaliserUrl(init.getText(sf).slice(1, -1));
            }
            if (valeur && valeur.startsWith("/")) {
              destinationsPartagees.push(valeur);
            }
          }
        }
        ts.forEachChild(node, collecterHrefs);
      };
      collecterHrefs(decl.initializer);
    }
  }

  visiter(sf);

  // Détection des variantes de searchParams pour les pages : uniquement les
  // clés que la page lit réellement dans son type de props. Un mot présent
  // dans le texte source ne crée pas un mode (voir `CLES_VARIANTS`).
  if (estPage && route) {
    for (const cle of extraireClesSearchParams(sf)) {
      if ((CLES_VARIANTS as readonly string[]).includes(cle)) {
        variantesSearchParams.push(`${route}?${cle}`);
      }
    }
  }

  // 5. Détection des micro-interactions riches (Couche 4 UI uniquement)
  const microInteractions: MicroInteractionAst[] = [];
  const slugFichier = slugId(relatif);

  if (estFichierUi) {
    // 5.1. Canvas 2D / Graphe D3
    if (
      relatif.includes("graphe") &&
      (contenu.includes("<canvas") || contenu.includes("forceSimulation") || contenu.includes("d3-force"))
    ) {
      microInteractions.push(
        {
          id: `micro:${slugFichier}-canvas-clic`,
          type: "canvas",
          libelle: "Sélection & Centrage de fiche",
          declencheur: "Clic sur un nœud compétence ou domaine",
          fichier: relatif,
          badge: "Canvas 2D",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-canvas-drag`,
          type: "canvas",
          libelle: "Repositionnement dynamique",
          declencheur: "Glisser-déposer de nœud (forces D3)",
          fichier: relatif,
          badge: "D3 Force",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-canvas-zoom`,
          type: "canvas",
          libelle: "Zoom & Navigation spatiale",
          declencheur: "Molette / Pincement sur le canvas",
          fichier: relatif,
          badge: "Zoom 2D",
          heuristique: true,
        },
      );
    }

    // 5.2. Pomodoro & Timers de concentration (Composant dédié unique)
    if (relatif.endsWith("pomodoro.tsx")) {
      microInteractions.push(
        {
          id: `micro:${slugFichier}-pomodoro-focus`,
          type: "pomodoro",
          libelle: "Cycle de concentration (25 min)",
          declencheur: "Lancement du cycle de travail",
          fichier: relatif,
          badge: "Focus",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-pomodoro-pause`,
          type: "pomodoro",
          libelle: "Pause de récupération (5 min)",
          declencheur: "Bascule automatique ou clic pause",
          fichier: relatif,
          badge: "Pause",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-pomodoro-reset`,
          type: "pomodoro",
          libelle: "Réinitialisation du cycle",
          declencheur: "Remise à zéro du chronomètre",
          fichier: relatif,
          badge: "Chrono",
          heuristique: true,
        },
      );
    }

    // 5.3. Modes rapides & Déclencheurs contextuels du Tuteur IA (Hub central chat.tsx / vue-exercice.tsx)
    if (relatif.endsWith("chat.tsx")) {
      microInteractions.push(
        {
          id: `micro:${slugFichier}-mode-indice`,
          type: "tuteur",
          libelle: "Demande d'indice de démarche",
          declencheur: "Clic mode 'Donne-moi un indice'",
          fichier: relatif,
          badge: "Indice",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-mode-corrige`,
          type: "tuteur",
          libelle: "Correction de raisonnement",
          declencheur: "Clic mode 'Corrige mon raisonnement'",
          fichier: relatif,
          badge: "Correction",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-mode-explique`,
          type: "tuteur",
          libelle: "Explication de concept",
          declencheur: "Clic mode 'Explique-moi'",
          fichier: relatif,
          badge: "Concept",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-mode-lacunes`,
          type: "tuteur",
          libelle: "Bilan des lacunes ciblées",
          declencheur: "Clic mode 'Fais le point sur mes lacunes'",
          fichier: relatif,
          badge: "Diagnostic",
          heuristique: true,
        },
      );
    } else if (relatif.endsWith("vue-exercice.tsx")) {
      microInteractions.push(
        {
          id: `micro:${slugFichier}-aide-contextuelle-indice`,
          type: "tuteur",
          libelle: "Demander un indice de résolution",
          declencheur: "Clic 'Besoin d'un indice ?'",
          fichier: relatif,
          badge: "Indice",
          heuristique: true,
        },
        {
          id: `micro:${slugFichier}-aide-contextuelle-consigne`,
          type: "tuteur",
          libelle: "Clarification de consigne",
          declencheur: "Clic 'Comprendre la consigne'",
          fichier: relatif,
          badge: "Consigne",
          heuristique: true,
        },
      );
    }

    // 5.4. Accordéons & contenus repliables
    const aAccordeonJsx =
      relatif.includes("panneau-pliable") ||
      relatif.includes("glossaire") ||
      contenu.includes("<PanneauPliable") ||
      contenu.includes("<Glossaire") ||
      contenu.includes("<details");

    if (aAccordeonJsx) {
      microInteractions.push({
        id: `micro:${slugFichier}-accordion`,
        type: "accordéon",
        libelle: "Déplier un contenu repliable",
        declencheur: "Clic sur un contenu replié",
        fichier: relatif,
        badge: "Accordéon",
        heuristique: true,
      });
    }

    // 5.5. Médias & Pièces jointes
    const aUploadMedia =
      contenu.includes('type="file"') ||
      contenu.includes("type='file'") ||
      (relatif.includes("espace-documentaire") && contenu.includes("televerser")) ||
      relatif.includes("workspace-note-support") ||
      relatif.includes("capture-notes");

    if (aUploadMedia) {
      microInteractions.push({
        id: `micro:${slugFichier}-media-upload`,
        type: "media",
        libelle: "Téléversement de support / pièce jointe",
        declencheur: "Sélection de document PDF ou image",
        fichier: relatif,
        badge: "Storage",
        heuristique: true,
      });
    }
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
    destinationsPartagees: [...new Set(destinationsPartagees)],
    modales,
    actionsDeclarees,
    actionsInvoquees: [...new Set(actionsInvoquees)],
    boutons,
    onglets,
    surfaces,
    microInteractions,
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
        const estUi =
          (fichier.startsWith("components/") || (fichier.startsWith("app/") && !fichier.startsWith("app/api/"))) &&
          (fichier.endsWith(".tsx") || fichier.endsWith(".jsx"));
        if (estUi) {
          resultats.add(fichier);
        }
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

/**
 * Navigation persistante du cadre partagé — rail desktop et barre mobile.
 *
 * Les pages ne déclarent pas elles-mêmes le rail : il vit dans les layouts
 * (`app/(app)/layout.tsx` rend `Sidebar` + `NavMobile` + le pied de compte).
 * Un scanner qui ne regarde que les pages et leurs composants le rend donc
 * invisible — d'où des graphes où `/aide`, `/compte` ou `/progression`
 * semblent inaccessibles alors qu'ils sont atteignables depuis toutes les
 * pages du groupe.
 *
 * Retourne, pour chaque dossier de layout (`app/(app)`, …), les destinations
 * de navigation persistante joignables depuis toute page qu'il enveloppe :
 * les liens `<Link>` du layout et de ses composants, plus les tableaux de
 * navigation déclarés en données (`destinationsPartagees`). Les `redirect`
 * du layout (`/login`, `/suspendu`) n'y entrent pas — ce sont des gardes,
 * pas des destinations.
 */
export function resoudreNavigationPartagee(
  analyses: Map<string, FichierAstAnalyse>,
): Map<string, Set<string>> {
  const importVers = new Map<string, string>();
  for (const relatif of analyses.keys()) {
    const sansExt = relatif.replace(/\.(tsx?|jsx?)$/, "");
    importVers.set(sansExt, relatif);
    if (relatif.endsWith("/index.tsx") || relatif.endsWith("/index.ts")) {
      importVers.set(sansExt.replace(/\/index$/, ""), relatif);
    }
  }

  function collecterImportsRec(relatif: string, visites = new Set<string>()): Set<string> {
    const resultats = new Set<string>();
    const a = analyses.get(relatif);
    if (!a) return resultats;
    for (const imp of a.imports) {
      const fichier = importVers.get(imp);
      if (fichier && !visites.has(fichier)) {
        visites.add(fichier);
        resultats.add(fichier);
        for (const sous of collecterImportsRec(fichier, visites)) {
          resultats.add(sous);
        }
      }
    }
    return resultats;
  }

  function collecterCibles(f: FichierAstAnalyse, cibles: Set<string>) {
    for (const nav of f.navigations) {
      if (nav.type !== "link") continue;
      cibles.add(baseRoute(nav.cible));
    }
    for (const dest of f.destinationsPartagees) {
      cibles.add(baseRoute(dest));
    }
  }

  const parDossier = new Map<string, Set<string>>();
  for (const a of analyses.values()) {
    if (!a.relatif.startsWith("app/") || a.relatif.startsWith("app/api/")) continue;
    const nomFichier = a.relatif.split("/").pop() ?? "";
    if (nomFichier !== "layout.tsx" && nomFichier !== "layout.ts") continue;

    const dossier = a.relatif.replace(/\/layout\.tsx?$/, "");
    const cibles = new Set<string>();
    collecterCibles(a, cibles);
    for (const fichier of collecterImportsRec(a.relatif)) {
      const fa = analyses.get(fichier);
      if (fa) collecterCibles(fa, cibles);
    }

    if (cibles.size === 0) continue;
    const existantes = parDossier.get(dossier) ?? new Set<string>();
    for (const c of cibles) existantes.add(c);
    parDossier.set(dossier, existantes);
  }

  return parDossier;
}

/**
 * Surfaces (modales et tiroirs) du cadre partagé — la contrepartie de
 * `resoudreNavigationPartagee` pour les fenêtres.
 *
 * Le layout monte des surfaces que toute page du groupe porte : le bouton
 * flottant du tuteur (`tiroir:tuteur`, « accessible de partout ») et le point
 * d'entrée `+` du rail (`modal:de-quoi-as-tu-besoin`). Un scanner de pages
 * seules les rattache seulement aux pages qui importent leur fichier — le
 * reste du graphe les croit absentes.
 *
 * Retourne, pour chaque dossier de layout, les identifiants des modales et
 * tiroirs déclarés par le layout ou par ses composants (imports transitifs).
 *
 * Seules les surfaces du cadre lui-même sont retenues : un tiroir (panneau
 * flottant) ou une modale déclarée en JSX par un composant courant. Une modale
 * dédiée (`modale-*.tsx`) importée par le sous-arbre du layout n'est pas pour
 * autant du cadre — elle peut être imbriquée dans un tiroir ou un parcours
 * (ex. la compétence et l'exercice ouverts depuis le chat du tuteur) et n'est
 * pas accessible depuis toutes les pages.
 */
export function resoudreSurfacesPartagees(
  analyses: Map<string, FichierAstAnalyse>,
): Map<string, Set<string>> {
  const importVers = new Map<string, string>();
  for (const relatif of analyses.keys()) {
    const sansExt = relatif.replace(/\.(tsx?|jsx?)$/, "");
    importVers.set(sansExt, relatif);
    if (relatif.endsWith("/index.tsx") || relatif.endsWith("/index.ts")) {
      importVers.set(sansExt.replace(/\/index$/, ""), relatif);
    }
  }

  function collecterImportsRec(relatif: string, visites = new Set<string>()): Set<string> {
    const resultats = new Set<string>();
    const a = analyses.get(relatif);
    if (!a) return resultats;
    for (const imp of a.imports) {
      const fichier = importVers.get(imp);
      if (fichier && !visites.has(fichier)) {
        visites.add(fichier);
        resultats.add(fichier);
        for (const sous of collecterImportsRec(fichier, visites)) {
          resultats.add(sous);
        }
      }
    }
    return resultats;
  }

  function estSurfaceDeCadre(f: FichierAstAnalyse, m: ModaleAst): boolean {
    if (m.estTiroir) return true;
    const nomFichier = f.relatif.split("/").pop() ?? "";
    return !nomFichier.startsWith("modale-");
  }

  function collecterSurfaces(f: FichierAstAnalyse, ids: Set<string>) {
    for (const modale of f.modales) {
      if (estSurfaceDeCadre(f, modale)) ids.add(modale.id);
    }
  }

  const parDossier = new Map<string, Set<string>>();
  for (const a of analyses.values()) {
    if (!a.relatif.startsWith("app/") || a.relatif.startsWith("app/api/")) continue;
    const nomFichier = a.relatif.split("/").pop() ?? "";
    if (nomFichier !== "layout.tsx" && nomFichier !== "layout.ts") continue;

    const dossier = a.relatif.replace(/\/layout\.tsx?$/, "");
    const ids = new Set<string>();
    collecterSurfaces(a, ids);
    for (const fichier of collecterImportsRec(a.relatif)) {
      const fa = analyses.get(fichier);
      if (fa) collecterSurfaces(fa, ids);
    }

    if (ids.size === 0) continue;
    const existantes = parDossier.get(dossier) ?? new Set<string>();
    for (const id of ids) existantes.add(id);
    parDossier.set(dossier, existantes);
  }

  return parDossier;
}
