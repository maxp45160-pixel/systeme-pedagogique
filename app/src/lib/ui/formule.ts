/**
 * Formules LaTeX rendues lisibles — la partie qui décide, sans rendu.
 *
 * Le tuteur écrit spontanément du LaTeX quand on lui demande une formule
 * (`\[ SS = Z \times \sqrt{...} \]`). Le rendu markdown maison n'en savait
 * rien : la personne lisait la source, pas la formule. Le contenu était bon,
 * illisible.
 *
 * Le choix initial était la **conversion en Unicode**, sans moteur de rendu :
 * une librairie mathématique (KaTeX, MathJax) pèse plusieurs centaines de
 * kilo-octets et contredit « aucune librairie UI tierce ». Révisé le 23/08/2026
 * par ADR-109 : KaTeX porte désormais la composition visée, et CE MODULE reste
 * le filet — formules refusées par KaTeX, texte de secours, environnement node
 * (les tests Vitest ne chargent pas de CSS).
 *
 * Ce qui n'est pas couvert est rendu tel quel, allégé de ses commandes :
 * dégradé lisible, jamais une erreur.
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
  iint: "∬",
  iiint: "∭",
  oint: "∮",
  partial: "∂",
  nabla: "∇",
  forall: "∀",
  exists: "∃",
  nexists: "∄",
  in: "∈",
  notin: "∉",
  ni: "∋",
  subset: "⊂",
  cup: "∪",
  cap: "∩",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  leftrightarrow: "↔",
  Leftrightarrow: "⇔",
  ldots: "…",
  dots: "…",
  cdots: "⋯",
  vdots: "⋮",
  ddots: "⋱",
  percent: "%",
  // Fonctions et opérateurs usuels (algèbre linéaire, analyse, trigo).
  det: "det",
  ker: "ker",
  dim: "dim",
  rg: "rg",
  rank: "rank",
  tr: "tr",
  trace: "trace",
  cos: "cos",
  sin: "sin",
  tan: "tan",
  cosh: "cosh",
  sinh: "sinh",
  tanh: "tanh",
  arccos: "arccos",
  arcsin: "arcsin",
  arctan: "arctan",
  exp: "exp",
  ln: "ln",
  log: "log",
  lim: "lim",
  min: "min",
  max: "max",
  sup: "sup",
  inf: "inf",
  gcd: "gcd",
  deg: "deg",
  top: "⊤",
  bot: "⊥",
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
  vartheta: "ϑ",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  varpi: "ϖ",
  rho: "ρ",
  varrho: "ϱ",
  sigma: "σ",
  varsigma: "ς",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "ϕ",
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
  Upsilon: "Υ",
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
  overrightarrow: "\u20D7",
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
    case "Bmatrix":
      return ["\uE000 ", " \uE001"];
    case "matrix":
    case "pmatrix":
    case "smallmatrix":
    case "array":
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
  // Pour \begin{array}{cc}..., éliminer la spécification de colonnes
  let nettoye = corps.replace(/^\s*\{[lcr|:\s*]+\}\s*/i, "");

  // Environnements imbriqués : traiter l'intérieur d'abord
  nettoye = rendreEnvironnements(nettoye);

  // Normalisation des séparateurs de lignes LaTeX :
  // - \\ éventuellement suivi de [opt] comme \\[6pt]
  // - \cr ou \newline
  // - une barre oblique \ suivie d'un espace ou de fin (cas des chaînes JSON déséchappées où \\ est devenu \ )
  const sepCanonique = "\uE002";
  nettoye = nettoye.replace(/\\\\(?:\s*\[[^\]]*\])?|\\cr\b|\\newline\b/g, sepCanonique);
  nettoye = nettoye.replace(/\\(?:\s+|$)/g, `${sepCanonique} `);

  // Découper sur le séparateur canonique ou sur les retours à la ligne
  const lignesBrutes = nettoye.split(new RegExp(`[${sepCanonique}\r\n]+`));
  const lignesFiltrees: string[] = [];

  for (const ligne of lignesBrutes) {
    const lTrim = ligne.trim();
    if (lTrim.length === 0) continue;

    // Découper les colonnes sur &
    const cellules = lTrim
      .split("&")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cellules.length > 0) {
      lignesFiltrees.push(cellules.join(" "));
    }
  }

  const [ouvre, ferme] = delimiteursEnvironnement(nom);
  const contenu = lignesFiltrees.join(" ; ").trim();
  const rendu = `${ouvre}${contenu}${ferme}`.trim();
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
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
  A: "ᴬ",
  B: "ᴮ",
  D: "ᴰ",
  E: "ᴱ",
  G: "ᴳ",
  H: "ᴴ",
  I: "ᴵ",
  J: "ᴶ",
  K: "ᴷ",
  L: "ᴸ",
  M: "ᴹ",
  N: "ᴺ",
  O: "ᴼ",
  P: "ᴾ",
  R: "ᴿ",
  T: "ᵀ",
  U: "ᵁ",
  V: "ⱽ",
  W: "ᵂ",
  "*": "﹡",
  "′": "′",
  "'": "′",
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
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
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
          K: "𝕂",
          P: "ℙ",
          E: "𝔼",
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
    const habillage =
      /^\\(?:text|textrm|textbf|textit|mathrm|mathbf|boldsymbol|bm|mathit|mathsf|mathtt|operatorname|mathcal|mathscr)\s*/.exec(
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
export type SegmentTexte = {
  formule: boolean;
  texte: string;
  /** LaTeX d'origine du segment — présent uniquement sur une formule. */
  latex?: string;
};

/**
 * Découpe une ligne de prose sur ses formules en ligne : `\(...\)`, `\[...\]`, `$...$`,
 * ou environnement LaTeX `\begin{nom}...\end{nom}`.
 *
 * Le `$` est délibérément sévère. « payer 30$ puis 40$ » entourerait un
 * intervalle de prose ; la paire n'est donc retenue que si son contenu porte
 * une marque de notation — commande, exposant ou indice — et aucun espace
 * autour des délimiteurs. Un montant en dollars n'y répond jamais.
 */
export function segmenterFormulesEnLigne(texte: string): SegmentTexte[] {
  const segments: SegmentTexte[] = [];
  const motif =
    /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([^$\n]+?)\$\$|\$([^$\n]+?)\$|(\\begin\{([A-Za-z*]+)\}[\s\S]*?(?:\\end\{\6\}|(?=\\begin\{|$)))/g;
  let curseur = 0;

  for (const trouve of texte.matchAll(motif)) {
    const brut = trouve[1] ?? trouve[2] ?? trouve[3] ?? trouve[4] ?? trouve[5] ?? "";
    const estDollar = trouve[4] !== undefined;

    // Garde-fou pour le dollar simple : « 30$ puis 40$ » reste de la prose.
    if (estDollar && !/[\\^_]/.test(brut)) continue;
    if (estDollar && /^\s|\s$/.test(brut)) continue;

    const debut = trouve.index ?? 0;
    if (debut > curseur) segments.push({ formule: false, texte: texte.slice(curseur, debut) });
    segments.push({ formule: true, texte: latexVersTexte(brut), latex: brut });
    curseur = debut + trouve[0].length;
  }

  if (curseur < texte.length) segments.push({ formule: false, texte: texte.slice(curseur) });
  return segments;
}
