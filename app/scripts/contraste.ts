/**
 * Mesure du contraste des paires jeton/fond réellement consommées.
 *
 * Lit `src/app/tokens.css`, résout les chaînes de `var()` thème par thème
 * (cascade : `:root` sans thème, puis bloc de thème), calcule le ratio WCAG
 * 2.1 et le compare au seuil du rôle : 4,5:1 pour le texte, 3:1 pour un
 * contour de contrôle.
 *
 * Deux consommateurs :
 * - `npx vitest run src/lib/ui/contraste.test.ts` — la règle reste vraie ;
 * - `node --run scripts/contraste.ts` (ou `npx tsx`) — le tableau détaillé.
 *
 * Toute paire ajoutée à l'usage réel doit entrer dans `PAIRES` : une paire
 * non mesurée est une paire qui peut dériver sans que rien ne le signale.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const THEME_CLAIR = "clair";
const THEME_SOMBRE = "sombre";

interface Paire {
  premierPlan: string;
  arrierePlan: string;
  /** 4,5 pour du texte, 3 pour un contour de contrôle. */
  seuil: 4.5 | 3;
}

/** Paires jeton/fond effectivement consommées par les composants. */
export const PAIRES: readonly Paire[] = [
  // Textes sur surfaces
  { premierPlan: "--texte", arrierePlan: "--surface", seuil: 4.5 },
  { premierPlan: "--texte", arrierePlan: "--fond", seuil: 4.5 },
  { premierPlan: "--texte-attenue", arrierePlan: "--surface", seuil: 4.5 },
  { premierPlan: "--texte-attenue", arrierePlan: "--surface-2", seuil: 4.5 },
  { premierPlan: "--texte-attenue", arrierePlan: "--fond", seuil: 4.5 },
  { premierPlan: "--texte-discret", arrierePlan: "--surface", seuil: 4.5 },
  { premierPlan: "--texte-discret", arrierePlan: "--surface-2", seuil: 4.5 },
  { premierPlan: "--texte-discret", arrierePlan: "--fond", seuil: 4.5 },
  // Contour de contrôle (WCAG 1.4.11)
  { premierPlan: "--bordure-controle", arrierePlan: "--surface", seuil: 3 },
  // Marque : lien/texte primaire sur carte, libellé sur bouton principal
  { premierPlan: "--primaire", arrierePlan: "--surface", seuil: 4.5 },
  { premierPlan: "--primaire", arrierePlan: "--primaire-faible", seuil: 4.5 },
  { premierPlan: "--primaire-contraste", arrierePlan: "--primaire", seuil: 4.5 },
  // États d'action porteurs de texte
  { premierPlan: "--succes", arrierePlan: "--succes-faible", seuil: 4.5 },
  { premierPlan: "--alerte", arrierePlan: "--alerte-faible", seuil: 4.5 },
  { premierPlan: "--info", arrierePlan: "--info-faible", seuil: 4.5 },
  { premierPlan: "--danger", arrierePlan: "--danger-faible", seuil: 4.5 },
  { premierPlan: "--danger", arrierePlan: "--surface", seuil: 4.5 },
  // Rail « forêt », constant dans les deux thèmes
  { premierPlan: "--rail-texte", arrierePlan: "--rail", seuil: 4.5 },
  { premierPlan: "--rail-texte-attenue", arrierePlan: "--rail", seuil: 4.5 },
  { premierPlan: "--rail-texte-discret", arrierePlan: "--rail", seuil: 4.5 },
  { premierPlan: "--rail-texte-discret", arrierePlan: "--rail-2", seuil: 4.5 },
  { premierPlan: "--rail-actif-texte", arrierePlan: "--rail-actif", seuil: 4.5 },
] as const;

function retirerCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface Bloc {
  ordre: number;
  themes: ("base" | typeof THEME_CLAIR | typeof THEME_SOMBRE)[];
  declarations: Record<string, string>;
}

function extraireBlocs(css: string): Bloc[] {
  const blocs: Bloc[] = [];
  const sansCommentaires = retirerCommentaires(css);
  const regex = /([^{}]+)\{([^{}]*)\}/g;
  let correspondance: RegExpExecArray | null;
  let ordre = 0;
  while ((correspondance = regex.exec(sansCommentaires)) !== null) {
    const selecteur = correspondance[1].trim();
    if (selecteur.startsWith("@")) continue;
    const themes: Bloc["themes"] = [];
    // `:root` matche l'élément html quel que soit le thème : un bloc
    // `:root, [data-theme="clair"]` porte donc DEUX applicabilités.
    if (/(^|[\s,]):root/.test(selecteur)) themes.push("base");
    if (selecteur.includes('[data-theme="dark"]')) themes.push(THEME_SOMBRE);
    else if (selecteur.includes('[data-theme="clair"]')) themes.push(THEME_CLAIR);
    if (themes.length === 0) continue;

    const declarations: Record<string, string> = {};
    for (const ligne of correspondance[2].split(";")) {
      const [nom, ...reste] = ligne.split(":");
      if (reste.length === 0 || !nom.trim().startsWith("--")) continue;
      declarations[nom.trim()] = reste.join(":").trim();
    }
    blocs.push({ ordre: ordre++, themes, declarations });
  }
  return blocs;
}

function resolver(
  nom: string,
  variables: Record<string, string>,
  profondeur = 0,
): string {
  const valeur = variables[nom];
  if (valeur === undefined) return "";
  if (profondeur > 10) return "";
  const remplacee = valeur.replace(/var\((--[\w-]+)\)/g, (_, interne: string) =>
    resolver(interne, variables, profondeur + 1),
  );
  return remplacee.includes("var(") ? "" : remplacee;
}

type Rgb = readonly [number, number, number];

function parserCouleur(valeur: string): Rgb | null {
  const v = valeur.trim();
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(v);
  if (hex) {
    const corps = hex[1];
    const plein =
      corps.length === 3
        ? corps
            .split("")
            .map((c) => c + c)
            .join("")
        : corps;
    return [
      parseInt(plein.slice(0, 2), 16),
      parseInt(plein.slice(2, 4), 16),
      parseInt(plein.slice(4, 6), 16),
    ];
  }
  // rgb(38 33 23 / 0.035) ou rgba(38, 33, 23, 1) — l'alpha est ignoré :
  // les paires mesurées sont opaques par construction.
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (!rgb) return null;
  const parties = rgb[1].split(/[\s,/]+/).filter(Boolean);
  if (parties.length < 3) return null;
  const canal = (crue: string): number => {
    if (crue.endsWith("%")) return Math.round((parseFloat(crue) / 100) * 255);
    return Math.round(parseFloat(crue));
  };
  return [canal(parties[0]), canal(parties[1]), canal(parties[2])];
}

function luminance([r, g, b]: Rgb): number {
  const lineaire = (canal: number): number => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
}

export function ratioContraste(avant: Rgb, apres: Rgb): number {
  const l1 = luminance(avant);
  const l2 = luminance(apres);
  const [claire, sombre] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return Math.round(((claire + 0.05) / (sombre + 0.05)) * 100) / 100;
}

export interface ResultatPaire {
  readonly paire: string;
  readonly theme: string;
  readonly ratio: number;
  readonly seuil: number;
  readonly conforme: boolean;
  /** Défini quand un jeton est absent ou non résoluble — un défaut en soi. */
  readonly erreur?: string;
}

function variablesPourTheme(blocs: Bloc[], theme: string): Record<string, string> {
  /*
    Modèle de cascade réel : un bloc s'applique au thème courant si son
    sélecteur matche (`:root` matche toujours ; le bloc de l'autre thème ne
    matche pas). L'ordre du fichier est l'ordre de priorité.
  */
  const variables: Record<string, string> = {};
  for (const bloc of [...blocs].sort((a, b) => a.ordre - b.ordre)) {
    if (!bloc.themes.includes("base") && !bloc.themes.includes(theme as never)) continue;
    Object.assign(variables, bloc.declarations);
  }
  return variables;
}

export function mesurerPaires(css: string): ResultatPaire[] {
  const blocs = extraireBlocs(css);
  const resultats: ResultatPaire[] = [];
  for (const theme of [THEME_CLAIR, THEME_SOMBRE]) {
    const variables = variablesPourTheme(blocs, theme);
    for (const paire of PAIRES) {
      const nom = `${paire.premierPlan} × ${paire.arrierePlan}`;
      const avant = resolver(paire.premierPlan, variables);
      const arriere = resolver(paire.arrierePlan, variables);
      const couleurAvant = parserCouleur(avant);
      const couleurArriere = parserCouleur(arriere);
      if (!couleurAvant || !couleurArriere) {
        resultats.push({
          paire: nom,
          theme,
          ratio: Number.NaN,
          seuil: paire.seuil,
          conforme: false,
          erreur: `jeton non résoluble (${!couleurAvant ? paire.premierPlan : paire.arrierePlan})`,
        });
        continue;
      }
      const ratio = ratioContraste(couleurAvant, couleurArriere);
      resultats.push({
        paire: nom,
        theme,
        ratio,
        seuil: paire.seuil,
        conforme: ratio >= paire.seuil,
      });
    }
  }
  return resultats;
}

const cheminTokens = join(dirname(fileURLToPath(import.meta.url)), "../src/app/tokens.css");

/** Point d'entrée CLI : `node scripts/contraste.ts` affiche le tableau. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const resultats = mesurerPaires(readFileSync(cheminTokens, "utf8"));
  console.table(
    resultats.map((r) => ({
      paire: r.paire,
      thème: r.theme,
      ratio: r.erreur ? "—" : r.ratio.toFixed(2),
      seuil: r.seuil,
      verdict: r.erreur ?? (r.conforme ? "OK" : "SOUS LE SEUIL"),
    })),
  );
  const echecs = resultats.filter((r) => !r.conforme);
  if (echecs.length > 0) {
    console.error(`${echecs.length} paire(s) sous le seuil.`);
    process.exitCode = 1;
  }
}
