/**
 * Formules LaTeX rendues lisibles — la partie qui décide, sans rendu.
 *
 * Le tuteur écrit spontanément du LaTeX quand on lui demande une formule
 * (`\[ SS = Z \times \sqrt{...} \]`). Le rendu markdown maison n'en savait
 * rien : la personne lisait la source, pas la formule. Le contenu était bon,
 * illisible.
 *
 * Le choix est la **conversion en Unicode**, pas un moteur de rendu. Une
 * librairie mathématique (KaTeX, MathJax) pèse plusieurs centaines de kilo-
 * octets et contredit « aucune librairie UI tierce ». Ce que les énoncés
 * utilisent réellement — opérateurs, lettres grecques, racines, fractions,
 * indices et exposants — tient dans une table de correspondance.
 *
 * Ce qui n'est pas couvert (matrices, intégrales, alignements) est rendu tel
 * quel, allégé de ses commandes : dégradé lisible, jamais une erreur.
 *
 * Comme `markdown-blocs.ts`, ce module vit dans `lib/` et non dans le JSX :
 * Vitest ne prend que `src/**\/*.test.ts` en environnement node. Toute boucle
 * qui avance un index y consomme au moins un caractère par tour (ADR-039).
 */

/** Commandes à un mot → caractère Unicode. Ordre sans importance. */
const SYMBOLES: Record<string, string> = {
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  mp: "∓",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  sim: "∼",
  equiv: "≡",
  propto: "∝",
  infty: "∞",
  sum: "∑",
  prod: "∏",
  int: "∫",
  partial: "∂",
  nabla: "∇",
  forall: "∀",
  exists: "∃",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  cup: "∪",
  cap: "∩",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  leftrightarrow: "↔",
  ldots: "…",
  dots: "…",
  cdots: "⋯",
  percent: "%",
  // Repli : `\sqrt` dont l'argument n'est pas encore arrivé par le flux SSE.
  sqrt: "√",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};

/** Exposants disponibles en Unicode. Une lettre absente reste en notation `^`. */
const EXPOSANTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};

/** Indices disponibles en Unicode. Même règle : ce qui manque garde le `_`. */
const INDICES: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "(": "₍",
  ")": "₎",
};

/** Traduit un groupe entier, ou rend `null` si un seul caractère manque. */
function traduire(groupe: string, table: Record<string, string>): string | null {
  let sortie = "";
  for (const c of groupe) {
    const t = Object.hasOwn(table, c) ? table[c] : undefined;
    if (t === undefined) return null;
    sortie += t;
  }
  return sortie;
}

/**
 * Lit le groupe qui suit la position `depart` : `{...}` accolé, sinon le seul
 * caractère qui suit. Rend le contenu et l'indice qui suit le groupe.
 */
function groupeApres(src: string, depart: number): { contenu: string; fin: number } | null {
  if (depart >= src.length) return null;
  if (src[depart] !== "{") return { contenu: src[depart], fin: depart + 1 };

  let profondeur = 0;
  for (let j = depart; j < src.length; j++) {
    if (src[j] === "{") profondeur++;
    else if (src[j] === "}") {
      profondeur--;
      if (profondeur === 0) return { contenu: src.slice(depart + 1, j), fin: j + 1 };
    }
  }
  return null; // accolade jamais fermée — flux SSE tronqué, on laisse tel quel
}

/**
 * `\frac{a}{b}` → `(a)/(b)`, `\sqrt{x}` → `√(x)`, `\sqrt[3]{x}` → `∛(x)`.
 * Résout d'abord l'intérieur : les formules réelles sont imbriquées.
 */
function developperCommandesAGroupes(src: string): string {
  let sortie = "";
  let i = 0;

  while (i < src.length) {
    const reste = src.slice(i);

    const frac = /^\\(?:d|t)?frac\s*/.exec(reste);
    if (frac) {
      const num = groupeApres(src, i + frac[0].length);
      const den = num ? groupeApres(src, num.fin) : null;
      if (num && den) {
        const a = developperCommandesAGroupes(num.contenu);
        const b = developperCommandesAGroupes(den.contenu);
        sortie += `(${a}) / (${b})`;
        i = den.fin;
        continue;
      }
    }

    const racine = /^\\sqrt\s*(?:\[([^\]]*)\])?\s*/.exec(reste);
    if (racine) {
      const arg = groupeApres(src, i + racine[0].length);
      if (arg) {
        const signe = racine[1] === "3" ? "∛" : racine[1] === "4" ? "∜" : "√";
        const indice = racine[1] && !"34".includes(racine[1]) ? `[${racine[1]}]` : "";
        sortie += `${signe}${indice}(${developperCommandesAGroupes(arg.contenu)})`;
        i = arg.fin;
        continue;
      }
    }

    // `\text{...}`, `\mathrm{...}` et consorts : la commande tombe, le contenu reste.
    const habillage = /^\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|operatorname)\s*/.exec(
      reste,
    );
    if (habillage) {
      const arg = groupeApres(src, i + habillage[0].length);
      if (arg) {
        sortie += developperCommandesAGroupes(arg.contenu);
        i = arg.fin;
        continue;
      }
    }

    // INVARIANT : au moins un caractère consommé par tour (ADR-039).
    sortie += src[i];
    i++;
  }

  return sortie;
}

/** `x^{2}` → `x²`, `\sigma_L` → `σ_L` faute d'indice Unicode pour « L ». */
function appliquerExposantsEtIndices(src: string): string {
  let sortie = "";
  let i = 0;

  while (i < src.length) {
    const c = src[i];
    if (c === "^" || c === "_") {
      const groupe = groupeApres(src, i + 1);
      if (groupe) {
        const table = c === "^" ? EXPOSANTS : INDICES;
        const traduit = traduire(groupe.contenu, table);
        sortie += traduit ?? `${c}${groupe.contenu}`;
        i = groupe.fin;
        continue;
      }
    }
    sortie += c;
    i++;
  }

  return sortie;
}

/**
 * Convertit une formule LaTeX en texte Unicode lisible.
 *
 * Ne rend jamais de chaîne vide sur une entrée non vide : une formule que la
 * table ne couvre pas ressort allégée de ses barres obliques, pas effacée.
 */
export function latexVersTexte(latex: string): string {
  let t = latex;

  // Délimiteurs extensibles et espacements : bruit pur.
  t = t.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*/g, "");
  t = t.replace(/\\(?:quad|qquad)/g, "  ");
  t = t.replace(/\\[,;:!]/g, " ");
  t = t.replace(/\\\\/g, "\n");

  t = developperCommandesAGroupes(t);

  // Commandes à un mot, les plus longues d'abord (`\Sigma` avant `\sigma`).
  // `Object.hasOwn` : sans lui, `\constructor` remonterait une fonction du prototype.
  t = t.replace(/\\([A-Za-z]+)/g, (brut, nom: string) =>
    Object.hasOwn(SYMBOLES, nom) ? SYMBOLES[nom] : nom,
  );

  t = appliquerExposantsEtIndices(t);

  // Les accolades restantes ne portent plus de sens une fois les groupes résolus.
  t = t.replace(/[{}]/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");

  return t.trim();
}

/** Un segment de texte : prose, ou formule à mettre en valeur. */
export type SegmentTexte = { formule: boolean; texte: string };

/**
 * Découpe une ligne de prose sur ses formules en ligne : `\(...\)` et `$...$`.
 *
 * Le `$` est délibérément sévère. « payer 30$ puis 40$ » entourerait un
 * intervalle de prose ; la paire n'est donc retenue que si son contenu porte
 * une marque de notation — commande, exposant ou indice — et aucun espace
 * autour des délimiteurs. Un montant en dollars n'y répond jamais.
 */
export function segmenterFormulesEnLigne(texte: string): SegmentTexte[] {
  const segments: SegmentTexte[] = [];
  const motif = /\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$/g;
  let curseur = 0;

  for (const trouve of texte.matchAll(motif)) {
    const brut = trouve[1] ?? trouve[2] ?? "";
    const parenthesee = trouve[1] !== undefined;
    if (!parenthesee && !/[\\^_]/.test(brut)) continue; // « 30$ … 40$ » reste de la prose
    if (!parenthesee && /^\s|\s$/.test(brut)) continue;

    const debut = trouve.index ?? 0;
    if (debut > curseur) segments.push({ formule: false, texte: texte.slice(curseur, debut) });
    segments.push({ formule: true, texte: latexVersTexte(brut) });
    curseur = debut + trouve[0].length;
  }

  if (curseur < texte.length) segments.push({ formule: false, texte: texte.slice(curseur) });
  return segments;
}
