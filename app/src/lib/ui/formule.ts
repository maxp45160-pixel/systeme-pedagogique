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
 * Au-delà de la table, le module couvre les constructions qui rendaient la
 * formule illisible : environnements (`\begin{cases}`, `\begin{pmatrix}`…)
 * convertis en texte délimité, accents (`\bar`, `\vec`, `\hat`) portés par le
 * symbole, coefficients binomiaux, ensembles usuels (`\mathbb{R}` → ℝ),
 * accolades d'ensemble préservées. Le nom d'une commande inconnue ne se
 * réécrit jamais comme du texte — il tombe, et le groupe reste.
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
  // Relations, délimiteurs et opérateurs fréquents — sans eux, le tuteur écrit
  // « P(A mid B) » et la lecture voit un mot anglais au milieu d'une formule.
  mid: "|",
  vert: "|",
  lvert: "|",
  rvert: "|",
  Vert: "‖",
  lVert: "‖",
  rVert: "‖",
  parallel: "∥",
  simeq: "≃",
  cong: "≅",
  ll: "≪",
  gg: "≫",
  preceq: "⪯",
  succeq: "⪰",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  nsubseteq: "⊈",
  nsupseteq: "⊅",
  land: "∧",
  lor: "∨",
  wedge: "∧",
  vee: "∨",
  neg: "¬",
  perp: "⊥",
  angle: "∠",
  prime: "′",
  degree: "°",
  emptyset: "∅",
  varnothing: "∅",
  setminus: "∖",
  circ: "∘",
  star: "∗",
  ast: "∗",
  bullet: "∙",
  oplus: "⊕",
  ominus: "⊖",
  otimes: "⊗",
  // Flèches et implications courantes.
  longrightarrow: "→",
  longleftarrow: "←",
  Longrightarrow: "⇒",
  Longleftarrow: "⇐",
  longleftrightarrow: "↔",
  uparrow: "↑",
  downarrow: "↓",
  updownarrow: "↕",
  mapsto: "↦",
  hookrightarrow: "↪",
  gets: "←",
  implies: "⇒",
  iff: "⇔",
  because: "∵",
  therefore: "∴",
  // Environnements orphelins (ouverture sans fermeture) : le nom ne doit
  // jamais réapparaître comme du texte.
  begin: "",
  end: "",
};

/**
 * Accents LaTeX appliqués à un groupe → marques combinantes Unicode portées
 * par le dernier caractère du groupe rendu.
 *
 * Sans elles, `\overline{x}` ressortait « overlinex » : le nom de la commande
 * restait collé au symbole, illisible. `x̄`, `v⃗`, `x̂` se lisent d'un coup d'œil.
 */
const ACCENTS: Record<string, string> = {
  bar: "\u0304",
  overline: "\u0304",
  vec: "\u20D7",
  hat: "\u0302",
  widehat: "\u0302",
  tilde: "\u0303",
  widetilde: "\u0303",
  dot: "\u0307",
  ddot: "\u0308",
};

/**
 * Délimiteurs usuels des environnements `\begin{…}…\end{…}`.
 * Tout environnement inconnu (align, gathered, equation…) garde son corps sans
 * délimiteur ajouté. L'accolade de `cases` se met entre `\uE000`/`\uE001` pour
 * survivre à l'effacement global des accolades de regroupement, exactement
 * comme les accolades d'ensemble.
 */
function delimiteursEnvironnement(nom: string): [string, string] {
  const stable = nom.replace(/\*+$/, "");
  switch (stable) {
    case "cases":
      return ["\uE000 ", " \uE001"];
    case "matrix":
    case "pmatrix":
    case "smallmatrix":
      return ["( ", " )"];
    case "bmatrix":
      return ["[ ", " ]"];
    case "vmatrix":
      return ["| ", " |"];
    case "Vmatrix":
      return ["‖ ", " ‖"];
    default:
      return ["", ""];
  }
}

/**
 * Un environnement inconnu ne doit jamais réapparaître sous son nom brut
 * (`\begin{pmatrix}` produisait « beginpmatrix »). On le réécrit en son corps
 * couplé à son délimiteur, colonnes séparées par deux espaces, lignes par ` ; `.
 */
function corpsEnvironnement(nom: string, corps: string): string {
  // Environnements imbriqués : traiter l'intérieur avant le séparateur de ligne,
  // sans quoi une matrice interne porterait les `&` du niveau externe.
  const net = rendreEnvironnements(corps).replace(/\\\\/g, " ; ").replace(/&/g, "  ").trim();
  const [ouvre, ferme] = delimiteursEnvironnement(nom);
  const rendu = `${ouvre}${net}${ferme}`.trim();
  return rendu.length > 0 ? rendu : "";
}

/**
 * Prépasse les environnements `\begin{nom} … \end{nom}`.
 *
 * Le nom du délimiteur fermant est réutilisé par rétro-référence : un
 * `\end{align}` ne ferme pas un `\begin{cases}`. Une ouverture jamais fermée
 * (flux SSE écourté) est consommée jusqu'à la fin du texte, sans bloquer.
 */
function rendreEnvironnements(src: string): string {
  let t = src.replace(/\\begin\{([A-Za-z*]+)\}([\s\S]*?)\\end\{\1\}/g, (_brut, nom, corps) =>
    corpsEnvironnement(String(nom), String(corps)),
  );
  t = t.replace(/\\begin\{([A-Za-z*]+)\}([\s\S]*?)(?=\\begin\{|$)/g, (_brut, nom, corps) =>
    corpsEnvironnement(String(nom), String(corps)),
  );
  return t;
}

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

    // `\binom{n}{k}` → `C(n, k)` : plus lisible que « binomnk », l'ancien rendu.
    const binom = /^\\binom\s*/.exec(reste);
    if (binom) {
      const haut = groupeApres(src, i + binom[0].length);
      const bas = haut ? groupeApres(src, haut.fin) : null;
      if (haut && bas) {
        sortie += `C(${developperCommandesAGroupes(haut.contenu)}, ${developperCommandesAGroupes(bas.contenu)})`;
        i = bas.fin;
        continue;
      }
    }

    // Accents `\bar{x}`, `\vec{F}`, `\hat{x}` : la commande disparaît, la marque
    // combinante se porte sur le symbole. `\overline` est tenté avant `\bar`,
    // dont il est préfixe.
    const accent = /^\\(?:overline|widehat|widetilde|bar|vec|hat|tilde|ddot|dot)\s*/.exec(reste);
    if (accent) {
      const arg = groupeApres(src, i + accent[0].length);
      if (arg) {
        const nom = accent[0].slice(1).trim();
        sortie += developperCommandesAGroupes(arg.contenu) + ACCENTS[nom];
        i = arg.fin;
        continue;
      }
    }
    // `\mathbb{R}` → ℝ (ensembles usuels des mathématiques), sinon le texte nu.
    const ensemble = /^\\mathbb\s*/.exec(reste);
    if (ensemble) {
      const arg = groupeApres(src, i + ensemble[0].length);
      if (arg) {
        const lettres: Record<string, string> = {
          R: "ℝ",
          N: "ℕ",
          Z: "ℤ",
          Q: "ℚ",
          C: "ℂ",
        };
        const cle = arg.contenu.trim();
        sortie += Object.hasOwn(lettres, cle)
          ? lettres[cle]
          : developperCommandesAGroupes(arg.contenu);
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
  // Accolades d'ensemble échappées (`\{ … \}`) : mises de côté le temps du
  // passage pour survivre à l'effacement des accolades de regroupement, puis
  // réintégrées à la fin. Sans cela `\left\{ x \right\}` affichait « \ x \ ».
  t = t.replace(/\\{/g, "\uE000").replace(/\\}/g, "\uE001");
  // Environnements `\begin{…}…\end{…}` AVANT la coupure des `\\` : les fins de
  // lignes d'une matrice ou d'un `cases` sont précisément ces `\\`.
  t = rendreEnvironnements(t);
  t = t.replace(/\\(?:quad|qquad)/g, "  ");
  t = t.replace(/\\[,;:!]/g, " ");
  t = t.replace(/\\\\/g, "\n");

  t = developperCommandesAGroupes(t);

  // Commandes à un mot, les plus longues d'abord (`\Sigma` avant `\sigma`).
  // `Object.hasOwn` : sans lui, `\constructor` remonterait une fonction du prototype.
  t = t.replace(/\\([A-Za-z]+)/g, (_brut, nom: string) =>
    Object.hasOwn(SYMBOLES, nom) ? SYMBOLES[nom] : nom,
  );

  t = appliquerExposantsEtIndices(t);

  // Les accolades de regroupement n'ont plus de sens une fois les groupes
  // résolus ; on les efface, puis on réintègre les accolades d'ensemble.
  t = t.replace(/[{}]/g, "");
  t = t.replace(/\uE000/g, "{").replace(/\uE001/g, "}");
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
