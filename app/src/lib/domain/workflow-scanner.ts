/**
 * Scanner de workflow — introspection dynamique du code source.
 *
 * Construit un `GrapheWorkflow` en analysant les fichiers source :
 *   1. Routes du filesystem (`app/(app)/...` → nœuds page)
 *   2. Patterns de navigation (`<Link>`, `router.push`, `redirect`)
 *   3. Modales (`<Modale titre=...>`)
 *   4. Résolution d'imports (quels composants appartiennent à quelle page)
 *
 * Conçu pour le rendu serveur de `/dev/workflow` — pas de cache, pas de
 * dépendance client. Reflète toujours l'état courant du code.
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
} from "./workflow-graphe";

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const RACINE_SRC = resolve(process.cwd(), "src");
const RACINE_APP = join(RACINE_SRC, "app");

/* ------------------------------------------------------------------ */
/* Cache de scan (dev)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cache des contenus analysés, indexé par chemin absolu.
 *
 * En mode dev, `/dev/workflow` est re-rendu à chaque navigation : sans cache,
 * chaque rendu relit et re-parse l'intégralité du code source. On ne relit un
 * fichier que si son `mtime` a changé depuis le dernier scan.
 *
 * Le cache est volontairement **non persistant** (module-level, pas de fichier
 * sur disque) : il vit le temps du process serveur, ce qui suffit à amortir
 * les re-rendus successifs sans jamais servir un contenu périmé après un
 * redémarrage.
 */
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

/* ------------------------------------------------------------------ */
/* Types internes                                                      */
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

interface FichierAnalyse {
  chemin: string;
  relatif: string; // relatif à src/, normalisé en /
  contenu: string;
  imports: string[]; // chemins d'import résolus (relatifs à src/)
  navigations: NavigationExtraite[];
  modales: ModaleExtraite[];
  estPageRoute: boolean;
  route?: string;
  estRedirectionPure: boolean;
  titrePage?: string;
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function norm(chemin: string): string {
  return chemin.replace(/\\/g, "/");
}

/* ------------------------------------------------------------------ */
/* Lecture récursive du filesystem                                      */
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
/* Conversion chemin → route                                           */
/* ------------------------------------------------------------------ */

/**
 * Convertit un chemin relatif à `src/app/` en route URL.
 *
 * - Route groups `(xxx)` → supprimés du chemin
 * - Dynamic segments `[param]` → `{param}`
 * - Retourne `null` si ce n'est pas un `page.tsx`.
 */
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
/* Normalisation d'URL                                                 */
/* ------------------------------------------------------------------ */

/**
 * Réduit un nom de variable de template à son concept, en retirant les
 * suffixes de rôle. `domaineNom` → `domaine`, `seanceId` → `seance`.
 * Évite que les identifiants de modale deviennent `reviser-domainenom`.
 */
function normaliserVariableTemplate(nom: string): string {
  return nom.replace(/(Nom|Id|ID|Code|Titre|Libelle|Label)$/, "");
}

function normaliserUrl(url: string): string {
  return url.replace(/\$\{[^}]+\}/g, (match) => {
    if (match.includes("code")) return "{code}";
    if (match.includes("id")) return "{id}";
    const simple = match.match(/\$\{(\w+)\}/);
    if (simple) {
      const concept = normaliserVariableTemplate(simple[1]);
      return concept ? `{${concept}}` : "{param}";
    }
    return "{param}";
  });
}

function baseRoute(url: string): string {
  const sansHash = url.split("#")[0];
  const [base, query] = sansHash.split("?");
  if (!query) return base;

  // Conserver les query parameters significatifs qui définissent un mode/écran
  // distinct — sans eux, des états réels seraient effondrés en un seul nœud
  // (ex. `?vue=graphe` bascule la vue compétences, `?document=` sélectionne
  // une fiche de l'atelier).
  if (query.includes("session=")) return `${base}?session`;
  if (query.includes("vue=graphe")) return `${base}?vue=graphe`;
  if (query.includes("document=")) return `${base}?document`;
  return base;
}

/* ------------------------------------------------------------------ */
/* Extraction des patterns de navigation                               */
/* ------------------------------------------------------------------ */

function extraireNavigations(contenu: string): NavigationExtraite[] {
  const r: NavigationExtraite[] = [];

  // href="/path" ou href='/path'
  for (const m of contenu.matchAll(/href=["'](\/[^"']*?)["']/g)) {
    r.push({ cible: m[1], brute: m[1], type: "link" });
  }
  // href={`/path...`}
  for (const m of contenu.matchAll(/href=\{`(\/[^`]*?)`\}/g)) {
    r.push({ cible: normaliserUrl(m[1]), brute: m[1], type: "link" });
  }
  // router.push/replace("/path") ou ('...')
  for (const m of contenu.matchAll(
    /router\.(push|replace)\(["'](\/[^"']*?)["']\)/g,
  )) {
    r.push({
      cible: m[2],
      brute: m[2],
      type: m[1] === "push" ? "router-push" : "router-replace",
    });
  }
  // router.push/replace(`/path...`)
  for (const m of contenu.matchAll(
    /router\.(push|replace)\(`(\/[^`]*?)`\)/g,
  )) {
    r.push({
      cible: normaliserUrl(m[2]),
      brute: m[2],
      type: m[1] === "push" ? "router-push" : "router-replace",
    });
  }
  // redirect("/path") ou redirect('/path')
  for (const m of contenu.matchAll(/redirect\(["'](\/[^"']*?)["']/g)) {
    r.push({ cible: m[1], brute: m[1], type: "redirect" });
  }
  // redirect(`/path...`)
  for (const m of contenu.matchAll(/redirect\(`(\/[^`]*?)`\)/g)) {
    r.push({ cible: normaliserUrl(m[1]), brute: m[1], type: "redirect" });
  }

  return r;
}

/* ------------------------------------------------------------------ */
/* Détection des modales                                               */
/* ------------------------------------------------------------------ */

function extraireModales(
  contenu: string,
  fichier: string,
): ModaleExtraite[] {
  const resultats: ModaleExtraite[] = [];
  if (fichier.startsWith("lib/") || !contenu.includes("<Modale")) return resultats;

  // Match actual JSX tag <Modale ...> or <Modale>
  const matches = [...contenu.matchAll(/<Modale\b([\s\S]*?)(?=\/?>|\n\s*<)/g)];
  for (const m of matches) {
    const props = m[1];
    let titre: string | null = null;

    // titre="..." ou titre='...'
    const simple = props.match(/titre=["']([^"']+)["']/);
    if (simple) titre = simple[1];

    // titre={`...`}
    if (!titre) {
      const tpl = props.match(/titre=\{`([^`]+)`\}/);
      if (tpl) titre = normaliserUrl(tpl[1]);
    }

    // titre={IDENTIFIANT} -> rechercher const IDENTIFIANT = "..." dans contenu
    if (!titre) {
      const ident = props.match(/titre=\{([A-Za-z0-9_]+)\}/);
      if (ident) {
        const nomConstante = ident[1];
        const reConst = new RegExp(`const\\s+${nomConstante}\\s*=\\s*["']([^"']+)["']`);
        const mConst = contenu.match(reConst);
        if (mConst) titre = mConst[1];
      }
    }

    // titre={cond ? "Titre1" : "Titre2"} — ternaire explicite
    if (!titre) {
      const ternaire = props.match(/\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
      if (ternaire) {
        resultats.push({ titre: ternaire[1], fichier });
        resultats.push({ titre: ternaire[2], fichier });
        continue;
      }
    }

    // titre={expr} — fallback en filtrant les égalités (ex: role === "support")
    if (!titre) {
      const expr = props.match(/titre=\{([\s\S]+?)\}/);
      if (expr) {
        const sansComparaisons = expr[1].replace(/===?\s*["'][^"']+["']/g, "");
        const litteraux = [...sansComparaisons.matchAll(/["']([^"']{4,})["']/g)];
        for (const lit of litteraux) {
          resultats.push({ titre: lit[1], fichier });
        }
        if (litteraux.length > 0) continue;
      }
    }

    if (titre) {
      resultats.push({ titre, fichier });
    }
  }
  return resultats;
}

/* ------------------------------------------------------------------ */
/* Extraction des imports                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Titre de page (EntetePage)                                          */
/* ------------------------------------------------------------------ */

function extraireTitrePage(contenu: string): string | undefined {
  const m = contenu.match(/<EntetePage[^>]*?titre=["']([^"']+)["']/);
  return m?.[1];
}

/* ------------------------------------------------------------------ */
/* Détection de redirection pure                                       */
/* ------------------------------------------------------------------ */

function estRedirectionPure(contenu: string): boolean {
  const sansBruit = contenu
    .replace(/^import\s+.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  if (!sansBruit.includes("redirect(")) return false;
  // Chercher un retour JSX — les types TS (`Promise<{...}>`) ne comptent pas
  return !/return\s*(\(?\s*<|<)/.test(sansBruit) && !/<[A-Z]/.test(sansBruit);
}

/* ------------------------------------------------------------------ */
/* Libellé depuis une route                                            */
/* ------------------------------------------------------------------ */

const LIBELLES_ROUTES: Record<string, string> = {
  "/": "Tableau de bord",
  "/atelier": "Atelier",
  "/seances": "Cahier",
  "/demarrer": "Amorçage",
  "/profil": "Profil",
  "/login": "Connexion",
  "/exercices/{id}": "Exercice autonome",
  "/competences/{code}": "Fiche compétence",
  "/competences/domaine/{id}": "Domaine",
  "/competences?vue=graphe": "Compétences (graphe)",
  "/seances?session": "Workspace séance",
};

function libelleRoute(route: string): string {
  if (LIBELLES_ROUTES[route]) return LIBELLES_ROUTES[route];
  const segments = route.split("/").filter(Boolean);
  const dernier = segments[segments.length - 1] ?? route;
  return dernier.charAt(0).toUpperCase() + dernier.slice(1);
}

/* ------------------------------------------------------------------ */
/* Identifiant de modale depuis un titre                               */
/* ------------------------------------------------------------------ */

function idModale(titre: string): string {
  return titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/* Type de nœud pour une modale/tiroir                                 */
/* ------------------------------------------------------------------ */

function typeModale(titre: string, fichier: string): TypeNoeudWorkflow {
  const f = fichier.toLowerCase();
  if (f.includes("tiroir") || f.includes("compte")) return "tiroir";
  const t = titre.toLowerCase();
  if (t.includes("tiroir") || t.includes("compte") || t.includes("synchronisation"))
    return "tiroir";
  return "modal";
}

/* ------------------------------------------------------------------ */
/* Collecte récursive des composants importés                         */
/* ------------------------------------------------------------------ */

function collecterComposantsRec(
  relatif: string,
  analyses: Map<string, FichierAnalyse>,
  importVers: Map<string, string>,
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
      const subs = collecterComposantsRec(fichier, analyses, importVers, visites);
      for (const s of subs) resultats.add(s);
    }
  }
  return resultats;
}

/* ------------------------------------------------------------------ */
/* Résolution d'URL cible vers un nœud de page                          */
/* ------------------------------------------------------------------ */

function resoudreRouteCible(
  cibleRoute: string,
  parId: Map<string, NoeudWorkflow>,
): string | null {
  const directId = `page:${cibleRoute}`;
  if (parId.has(directId)) return directId;

  const segmentsCible = cibleRoute.split("/").filter(Boolean);
  for (const [id, noeud] of parId.entries()) {
    if (noeud.type !== "page" || !noeud.url) continue;
    const segmentsPage = noeud.url.split("/").filter(Boolean);
    if (segmentsPage.length !== segmentsCible.length) continue;

    let correspond = true;
    for (let i = 0; i < segmentsPage.length; i++) {
      const segP = segmentsPage[i];
      const segC = segmentsCible[i];
      const estParamPage = segP.startsWith("{") && segP.endsWith("}");
      const estParamCible = segC.startsWith("{") && segC.endsWith("}");
      if (!estParamPage && segP !== segC) {
        correspond = false;
        break;
      }
      if (estParamPage && !estParamCible && segC === "") {
        correspond = false;
        break;
      }
    }

    if (correspond) return id;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Ajout d'un lien avec déduplication                                  */
/* ------------------------------------------------------------------ */

function ajouterLien(
  liens: LienWorkflow[],
  vus: Set<string>,
  lien: LienWorkflow,
): void {
  const cle = `${lien.source}→${lien.target}→${lien.type}`;
  if (vus.has(cle)) return;
  vus.add(cle);
  liens.push(lien);
}

/* ------------------------------------------------------------------ */
/* Scanner principal                                                   */
/* ------------------------------------------------------------------ */

/**
 * Introspection complète du code source — produit un `GrapheWorkflow`
 * reflétant les routes, navigations et modales du code actuel.
 */
export async function scannerWorkflow(): Promise<GrapheWorkflow> {
  /* ── Phase 1 : lister et lire tous les fichiers ── */

  const cheminsFichiers = await listerFichiers(RACINE_SRC);
  const analyses = new Map<string, FichierAnalyse>();

  for (const chemin of cheminsFichiers) {
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

    analyses.set(relatif, {
      chemin,
      relatif,
      contenu,
      imports: extraireImports(contenu, relatif),
      navigations: extraireNavigations(contenu),
      modales: extraireModales(contenu, relatif),
      estPageRoute: estPage,
      route,
      estRedirectionPure: estPage && estRedirectionPure(contenu),
      titrePage: estPage ? extraireTitrePage(contenu) : undefined,
    });
  }

  /* ── Phase 2 : table de résolution des imports ── */

  // Clé = chemin d'import sans @/ ni extension → valeur = chemin relatif du fichier
  const importVers = new Map<string, string>();
  for (const relatif of analyses.keys()) {
    const sansExt = relatif.replace(/\.(tsx?|jsx?)$/, "");
    importVers.set(sansExt, relatif);
    if (relatif.endsWith("/index.tsx") || relatif.endsWith("/index.ts")) {
      importVers.set(sansExt.replace(/\/index$/, ""), relatif);
    }
  }

  /* ── Phase 3 : arbre de composants par page (récursif) ── */

  const composantsPage = new Map<string, Set<string>>();

  // Collecter aussi les layouts pour attribuer leurs composants aux pages enfants
  const layoutsGlobaux: FichierAnalyse[] = [];
  for (const a of analyses.values()) {
    if (a.relatif.endsWith("layout.tsx") || a.relatif.endsWith("layout.ts")) {
      if (a.relatif.startsWith("app/")) layoutsGlobaux.push(a);
    }
  }

  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const composants = collecterComposantsRec(a.relatif, analyses, importVers);

    // Imports des layouts couvrant cette page
    for (const layout of layoutsGlobaux) {
      const dirLayout = layout.relatif.replace(/\/layout\.tsx?$/, "");
      const dirPage = a.relatif.replace(/\/page\.tsx?$/, "");
      if (dirPage.startsWith(dirLayout)) {
        const compsLayout = collecterComposantsRec(layout.relatif, analyses, importVers);
        for (const c of compsLayout) composants.add(c);
      }
    }

    composantsPage.set(a.route, composants);
  }

  /* ── Phase 4 : construire nœuds et arêtes ── */

  const noeuds: NoeudWorkflow[] = [];
  const liens: LienWorkflow[] = [];
  const parId = new Map<string, NoeudWorkflow>();
  const vus = new Set<string>();

  // Table des redirections pures : route source → route cible
  const redirections = new Map<string, string>();
  for (const a of analyses.values()) {
    if (a.estPageRoute && a.estRedirectionPure && a.navigations.length > 0) {
      const cible = a.navigations.find((n) => n.type === "redirect");
      if (cible && a.route) redirections.set(a.route, baseRoute(cible.cible));
    }
  }

  // Suivre une chaîne de redirections (max 5 sauts)
  function resoudreRedirection(route: string): string {
    let courant = route;
    for (let i = 0; i < 5; i++) {
      const suivant = redirections.get(courant);
      if (!suivant || suivant === courant) return courant;
      courant = suivant;
    }
    return courant;
  }

  // Nœuds page
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const id = `page:${a.route}`;
    const noeud: NoeudWorkflow = {
      id,
      type: "page",
      libelle: a.titrePage ?? libelleRoute(a.route),
      url: a.route,
    };
    noeuds.push(noeud);
    parId.set(id, noeud);
  }

  // Nœud synthétique — Workspace séance (`/seances?session={id}`)
  //
  // Ce n'est pas une route du filesystem : c'est `/seances` avec un query
  // parameter qui bascule dans le workspace plein écran (`VueSeanceDetail`).
  // Le graphe déclaratif le déclare comme page à part entière ; le scanner
  // doit le synthétiser quand `/seances` existe, sinon les arêtes qui le
  // visent (ex. retour depuis `etape:exercice-bilan`) échouent au BFS.
  if (parId.has("page:/seances")) {
    const id = "page:/seances?session";
    const noeud: NoeudWorkflow = {
      id,
      type: "page",
      libelle: "Workspace séance",
      url: "/seances?session={id}",
    };
    noeuds.push(noeud);
    parId.set(id, noeud);
  }

  // Nœuds modale / tiroir — depuis tous les fichiers analysés
  const modaleVue = new Set<string>(); // pour déduplication
  const modaleParFichier = new Map<string, string[]>(); // fichier → [ids]

  for (const a of analyses.values()) {
    for (const modale of a.modales) {
      const slug = idModale(modale.titre);
      const typ = typeModale(modale.titre, modale.fichier);
      const id = `${typ === "tiroir" ? "tiroir" : "modal"}:${slug}`;

      if (!modaleVue.has(id)) {
        modaleVue.add(id);
        const noeud: NoeudWorkflow = {
          id,
          type: typ,
          libelle: modale.titre,
        };
        noeuds.push(noeud);
        parId.set(id, noeud);
      }

      const ids = modaleParFichier.get(modale.fichier) ?? [];
      ids.push(id);
      modaleParFichier.set(modale.fichier, ids);
    }
  }

  // Arêtes
  for (const a of analyses.values()) {
    if (!a.estPageRoute || !a.route || a.estRedirectionPure) continue;
    if (a.route.startsWith("/dev")) continue;

    const sourceId = `page:${a.route}`;

    // Rassembler les navigations : page + composants importés
    const toutesNav = [...a.navigations];
    const composants = composantsPage.get(a.route);

    if (composants) {
      for (const comp of composants) {
        const ac = analyses.get(comp);
        if (!ac) continue;
        toutesNav.push(...ac.navigations);

        // Modales déclarées dans ce composant → arête ouverture
        const idsModales = modaleParFichier.get(comp);
        if (idsModales) {
          for (const mid of idsModales) {
            if (parId.has(mid)) {
              const noeudModal = parId.get(mid)!;
              ajouterLien(liens, vus, {
                source: sourceId,
                target: mid,
                type: "ouverture",
                libelle: noeudModal.libelle,
              });
              // Retour modale → page
              ajouterLien(liens, vus, {
                source: mid,
                target: sourceId,
                type: "retour",
                libelle: "Fermer",
              });
            }
          }
        }
      }
    }

    // Modales déclarées directement dans la page
    const idsModalesPage = modaleParFichier.get(a.relatif);
    if (idsModalesPage) {
      for (const mid of idsModalesPage) {
        if (parId.has(mid)) {
          const noeudModal = parId.get(mid)!;
          ajouterLien(liens, vus, {
            source: sourceId,
            target: mid,
            type: "ouverture",
            libelle: noeudModal.libelle,
          });
          ajouterLien(liens, vus, {
            source: mid,
            target: sourceId,
            type: "retour",
            libelle: "Fermer",
          });
        }
      }
    }

    // Arêtes de navigation
    for (const nav of toutesNav) {
      let cibleRoute = baseRoute(nav.cible);

      // Suivre les redirections
      cibleRoute = resoudreRedirection(cibleRoute);

      const cibleId = resoudreRouteCible(cibleRoute, parId) ?? `page:${cibleRoute}`;
      if (!parId.has(cibleId)) continue; // Cible inconnue

      // On conserve les self-links : ils représentent des états réels (recherche
      // sur `/seances`, erreur sur `/login`, rafraîchissement) et non des
      // artefacts. Les supprimer effaçait des transitions que le produit a.
      ajouterLien(liens, vus, {
        source: sourceId,
        target: cibleId,
        type: "navigation",
        libelle: cibleRoute,
      });
    }
  }

  /* ── Phase 6 : Actions et Étapes du parcours ── */

  // Registre des Server Actions (effets de bord)
  const REGISTRE_ACTIONS: Array<{
    id: string;
    libelle: string;
    fonction: string;
    destination: string;
    typeDestination?: TypeLienWorkflow;
    condition?: string;
  }> = [
    { id: "action:demarrer-tentative", libelle: "Commencer / Refaire", fonction: "demarrerTentative", destination: "etape:exercice-chercher", typeDestination: "transition" },
    { id: "action:debloquer-indice", libelle: "Débloquer un indice", fonction: "debloquerIndice", destination: "etape:exercice-chercher", typeDestination: "transition", condition: "indices restants" },
    { id: "action:abandonner-tentative", libelle: "Abandonner la tentative", fonction: "abandonnerExercice", destination: "page:/exercices/{id}", typeDestination: "transition" },
    { id: "action:terminer-exercice", libelle: "Enregistrer la preuve", fonction: "terminerExercice", destination: "etape:exercice-bilan", typeDestination: "transition" },
    { id: "action:creer-seance", libelle: "Créer la séance", fonction: "creerSeanceAction", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:demarrer-seance", libelle: "Démarrer la séance", fonction: "demarrerSeanceAction", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:terminer-seance", libelle: "Terminer la séance", fonction: "terminerSeanceAction", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:annuler-seance", libelle: "Annuler la séance", fonction: "annulerSeanceAction", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:ajouter-note", libelle: "Annoter la séance", fonction: "ajouterNoteSession", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:creer-note", libelle: "Enregistrer la note", fonction: "creerNoteAction", destination: "page:/atelier", typeDestination: "transition" },
    { id: "action:refuser-recommandation", libelle: "Refuser la recommandation", fonction: "refuserRecommandation", destination: "page:/", typeDestination: "transition" },
    { id: "action:creer-exercice", libelle: "Accepter l'exercice généré", fonction: "creerExercice", destination: "page:/seances", typeDestination: "transition" },
    { id: "action:creer-branche", libelle: "Valider la branche de compétences", fonction: "creerBranche", destination: "page:/atelier", typeDestination: "transition" },
    { id: "action:modifier-profil", libelle: "Enregistrer le profil", fonction: "enregistrerSujetEtObjectifs", destination: "page:/profil", typeDestination: "transition" },
    { id: "action:exporter-journal", libelle: "Exporter le journal", fonction: "exporterJournal", destination: "tiroir:compte-et-synchronisation", typeDestination: "transition" },
    { id: "action:se-deconnecter", libelle: "Se déconnecter", fonction: "seDeconnecter", destination: "page:/login", typeDestination: "transition" },
    { id: "action:retirer-theme", libelle: "Retirer un thème", fonction: "retirerThemeAction", destination: "modal:composer-une-seance", typeDestination: "transition" },
    { id: "action:renommer-theme", libelle: "Renommer un thème", fonction: "renommerThemeAction", destination: "modal:composer-une-seance", typeDestination: "transition" },
  ];

  // Registre des étapes du parcours d'exercice
  const REGISTRE_ETAPES: Array<{
    id: string;
    libelle: string;
    liens: Array<{ target: string; type: TypeLienWorkflow; libelle: string; condition?: string }>;
  }> = [
    {
      id: "etape:exercice-chercher",
      libelle: "Acte Chercher — résolution",
      liens: [
        { target: "action:demarrer-tentative", type: "soumission", libelle: "Commencer" },
        { target: "action:debloquer-indice", type: "soumission", libelle: "Débloquer l'indice N", condition: "indices restants" },
        { target: "etape:exercice-comparer", type: "transition", libelle: "Afficher la correction" },
        { target: "action:abandonner-tentative", type: "soumission", libelle: "Abandonner cette tentative" },
      ],
    },
    {
      id: "etape:exercice-comparer",
      libelle: "Acte Comparer — correction visible",
      liens: [
        { target: "etape:exercice-mesurer", type: "transition", libelle: "Passer à l'évaluation" },
        { target: "action:abandonner-tentative", type: "soumission", libelle: "Abandonner cette tentative" },
      ],
    },
    {
      id: "etape:exercice-mesurer",
      libelle: "Acte Mesurer — bilan",
      liens: [
        { target: "action:terminer-exercice", type: "soumission", libelle: "Enregistrer la preuve" },
        { target: "action:abandonner-tentative", type: "soumission", libelle: "Abandonner cette tentative" },
      ],
    },
    {
      id: "etape:exercice-bilan",
      libelle: "Bilan enregistré — preuve écrite",
      liens: [
        { target: "page:/atelier", type: "navigation", libelle: "Voir l'effet sur la compétence" },
        { target: "page:/", type: "navigation", libelle: "Prochaine action recommandée" },
        { target: "page:/seances?session", type: "navigation", libelle: "Retour au workspace séance", condition: "séance en cours" },
        { target: "etape:exercice-chercher", type: "transition", libelle: "Refaire cet exercice" },
      ],
    },
  ];

  // Insérer les étapes si le parcours d'exercice est présent
  const aParcoursExercice = [...parId.keys()].some(
    (id) => id === "page:/exercices/{id}" || id === "page:/seances",
  );

  if (aParcoursExercice) {
    for (const etape of REGISTRE_ETAPES) {
      if (!parId.has(etape.id)) {
        const noeud: NoeudWorkflow = {
          id: etape.id,
          type: "etape",
          libelle: etape.libelle,
        };
        noeuds.push(noeud);
        parId.set(etape.id, noeud);
      }
    }

    if (parId.has("page:/exercices/{id}")) {
      ajouterLien(liens, vus, {
        source: "page:/exercices/{id}",
        target: "etape:exercice-chercher",
        type: "transition",
        libelle: "Commencer la tentative",
      });
    }

    if (parId.has("page:/seances")) {
      ajouterLien(liens, vus, {
        source: "page:/seances",
        target: "etape:exercice-chercher",
        type: "transition",
        libelle: "Exercice actif — acte Chercher",
      });
    }

    for (const etape of REGISTRE_ETAPES) {
      for (const l of etape.liens) {
        ajouterLien(liens, vus, {
          source: etape.id,
          target: l.target,
          type: l.type,
          libelle: l.libelle,
          condition: l.condition,
        });
      }
    }
  }

  // Détection des Server Actions invoquées dans le code
  for (const act of REGISTRE_ACTIONS) {
    let detectee = false;

    for (const a of analyses.values()) {
      if (!a.contenu.includes(act.fonction)) continue;

      // Retrouver la source (page ou modale) qui appelle cette fonction
      let sourceId: string | undefined;

      if (a.estPageRoute && a.route && !a.estRedirectionPure && !a.route.startsWith("/dev")) {
        sourceId = `page:${a.route}`;
      } else {
        // Est-ce une modale ?
        const idsModales = modaleParFichier.get(a.relatif);
        if (idsModales && idsModales.length > 0) {
          sourceId = idsModales[0];
        } else {
          // Quel composant/page importe ce fichier ?
          for (const [route, comps] of composantsPage.entries()) {
            if (comps.has(a.relatif)) {
              sourceId = `page:${route}`;
              break;
            }
          }
        }
      }

      if (sourceId && parId.has(sourceId)) {
        detectee = true;

        if (!parId.has(act.id)) {
          const noeud: NoeudWorkflow = {
            id: act.id,
            type: "action",
            libelle: act.libelle,
          };
          noeuds.push(noeud);
          parId.set(act.id, noeud);
        }

        ajouterLien(liens, vus, {
          source: sourceId,
          target: act.id,
          type: "soumission",
          libelle: act.libelle,
          condition: act.condition,
        });

        // Lien de sortie de l'action vers sa destination
        let dest = act.destination;
        if (dest.startsWith("page:")) {
          const rCible = resoudreRedirection(dest.slice(5));
          dest = resoudreRouteCible(rCible, parId) ?? `page:${rCible}`;
        }

        if (parId.has(dest)) {
          ajouterLien(liens, vus, {
            source: act.id,
            target: dest,
            type: act.typeDestination ?? "transition",
            libelle: "Redirection après action",
          });
        }
      }
    }
  }

  return { noeuds, liens };
}
