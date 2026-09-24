/** Lecteurs structurels bornés, sans moteur CSS ni exécution de contenu. */
export type NoeudEpub = Record<string, unknown>;
export function attributEpub(n: NoeudEpub, nom: string): string | undefined {
  const a = n[":@"] as Record<string, unknown> | undefined;
  return typeof a?.[`@_${nom}`] === "string" ? a[`@_${nom}`] as string : undefined;
}

type Regle = { tag?: string; id?: string; classes: string[]; valeur: string; important: boolean; poids: number };
export interface StylesEpub { regles: Regle[]; ambigu: boolean }
const RESERVE_CSS = "Position CSS complexe ou ressource de style non locale : certaines notations restent ambiguës ; vérifiez l’original.";

/** Seuls les sélecteurs simples vérifiables sont interprétés ; jamais le nom des classes. */
export function lireStylesEpub(styles: string[], limites: Set<string>): StylesEpub {
  const resultat: StylesEpub = { regles: [], ambigu: false };
  for (const source of styles) {
    let css = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*@charset\s+["']utf-8["']\s*;/i, "");
    if (css.includes("\ufffd") || /@charset\b/i.test(css)) resultat.ambigu = true;
    if (/@import\b/i.test(css)) { resultat.ambigu = true; css = css.replace(/@import\b[^;]*;/gi, ""); }
    // Pas de cascade conditionnelle, de variable ou de syntaxe imbriquée simulée.
    if (/(?:all\s*:|vertical-align\s*:\s*(?:var\(|inherit|revert|unset))/i.test(css)) resultat.ambigu = true;
    const blocs: { selecteur: string; corps: string }[] = [];
    let debut = 0, ouverture = -1, profondeur = 0;
    for (let i = 0; i < css.length; i++) {
      if (css[i] === "{") { if (profondeur++) resultat.ambigu = true; else ouverture = i; }
      if (css[i] === "}") {
        if (profondeur <= 0) { resultat.ambigu = true; debut = i + 1; continue; }
        if (--profondeur === 0) { blocs.push({ selecteur: css.slice(debut, ouverture), corps: css.slice(ouverture + 1, i) }); debut = i + 1; }
      }
    }
    if (profondeur || /vertical-align/i.test(css.slice(debut))) resultat.ambigu = true;
    for (const bloc of blocs) {
      if (!/vertical-align/i.test(bloc.corps)) continue;
      // Pas d'interprétation d'une déclaration dissimulée dans une chaîne CSS.
      if (/["'{}]/.test(bloc.corps)) { resultat.ambigu = true; continue; }
      const declarations = [...bloc.corps.matchAll(/(?:^|;)\s*vertical-align\s*:\s*([^;]+)/gi)];
      if (!declarations.length) continue;
      const valeurs = declarations.map((d) => ({ valeur: d[1].replace(/\s*!important\s*$/i, "").trim().toLowerCase(), important: /!important\s*$/i.test(d[1]) }));
      const declaration = valeurs.filter((d) => d.important).at(-1) ?? valeurs.at(-1)!;
      for (const selecteur of bloc.selecteur.split(",")) {
        const s = selecteur.trim();
        if (!/^(?:[a-z][\w-]*|\*)?(?:[.#][\w-]+)*$/i.test(s) || !s) { resultat.ambigu = true; continue; }
        const tag = s.match(/^[a-z][\w-]*/i)?.[0].toLowerCase();
        const ids = [...s.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
        if (ids.length > 1) { resultat.ambigu = true; continue; }
        const classes = [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        resultat.regles.push({ tag, id: ids[0], classes, ...declaration, poids: ids.length * 100 + classes.length * 10 + Number(Boolean(tag)) });
        if (resultat.regles.length > 4000) throw new Error("Styles EPUB trop complexes.");
      }
    }
  }
  if (resultat.ambigu) limites.add(RESERVE_CSS);
  return resultat;
}

export function positionCssEpub(n: NoeudEpub, tag: string, styles: StylesEpub, limites: Set<string>): string | undefined {
  const classes = (attributEpub(n, "class") ?? "").split(/\s+/);
  const candidats = styles.regles.filter((r) => (!r.tag || r.tag === tag) && (!r.id || r.id === attributEpub(n, "id")) && r.classes.every((c) => classes.includes(c)));
  const inline = attributEpub(n, "style");
  if (inline) {
    const lu = lireStylesEpub([`*{${inline}}`], limites);
    if (lu.ambigu) return "incertaine";
    candidats.push(...lu.regles.map((r) => ({ ...r, poids: 1000 })));
  }
  // Une classe n'est pas une preuve de position : les règles inconnues ont une
  // réserve de section, sans ajouter un marqueur inventé à chaque fragment HTML.
  if (styles.ambigu && candidats.length) return "incertaine";
  // Tri stable : à importance et spécificité égales, la dernière déclaration gagne.
  return candidats.sort((a, b) => Number(a.important) - Number(b.important) || a.poids - b.poids).at(-1)?.valeur;
}

export function transcrirePositionEpub(texte: string, position: string, limites: Set<string>): string {
  if (position === "baseline" || position === "initial") return texte;
  limites.add("Exposants et indices transcrits avec leur position ; vérifiez les formules dans l’original.");
  if (position === "sub" || position === "super") return `${position === "super" ? "^" : "_"}{${texte}}`;
  limites.add("Alignement CSS conservé comme position visuelle, sans lui attribuer une signification mathématique.");
  return `[position CSS ${position.replace(/[\[\]{}]/g, "").slice(0, 80)} : ${texte}]`;
}

/** Présentation MathML vers notation structurelle ; aucun calcul ni récupération d’alttext. */
export function transcrireMathmlEpub(noeuds: NoeudEpub[], limites: Set<string>, surTexte?: () => void): string {
  limites.add("MathML transcrit structurellement ; mise en forme et sens mathématique à vérifier dans l’original.");
  let texteSource = false;
  function lire(n: NoeudEpub, profondeur: number): string {
    if (profondeur > 100) throw new Error("Imbrication MathML EPUB trop profonde.");
    const nom = Object.keys(n).find((k) => k !== ":@");
    if (!nom) throw new Error("MathML incomplet");
    if (nom === "#text") { const texte = String(n[nom]).trim(); if (texte) texteSource = true; return texte; }
    const enfants = (Array.isArray(n[nom]) ? n[nom] as NoeudEpub[] : []).filter((v) => !("#text" in v) || String(v["#text"]).trim());
    const a = (cle: string) => attributEpub(n, cle);
    if ((a("mathvariant") && a("mathvariant") !== "normal") || a("style") || a("dir") === "rtl") throw new Error("Présentation MathML non transcrite");
    if (["mi", "mn", "mo", "mtext", "ms"].includes(nom)) {
      if (enfants.some((e) => !("#text" in e))) throw new Error("Jeton MathML ambigu");
      const texte = enfants.map((e) => String(e["#text"])).join("");
      if (texte.trim()) texteSource = true;
      return nom === "ms" ? `${a("lquote") ?? '"'}${texte}${a("rquote") ?? '"'}` : texte;
    }
    if (nom === "semantics") {
      if (!enfants.length) throw new Error("MathML sans présentation");
      return lire(enfants[0], profondeur + 1);
    }
    const valeurs = enfants.map((e) => lire(e, profondeur + 1));
    const nombre = (attendu: number) => { if (valeurs.length !== attendu || valeurs.some((v) => !v)) throw new Error("Arity MathML invalide"); };
    if (["math", "mrow", "mstyle"].includes(nom)) return valeurs.join(" ");
    if (nom === "mspace") return " ";
    if (nom === "msub" || nom === "msup") { nombre(2); return `{${valeurs[0]}}${nom === "msup" ? "^" : "_"}{${valeurs[1]}}`; }
    if (nom === "msubsup") { nombre(3); return `{${valeurs[0]}}_{${valeurs[1]}}^{${valeurs[2]}}`; }
    if (nom === "mfrac") { nombre(2); if (a("linethickness") !== undefined && a("linethickness") !== "medium") throw new Error("Fraction visuelle spéciale"); return `frac{${valeurs[0]}}{${valeurs[1]}}`; }
    if (nom === "msqrt") return `sqrt{${valeurs.join(" ")}}`;
    if (nom === "mroot") { nombre(2); return `root{${valeurs[1]}}{${valeurs[0]}}`; }
    if (nom === "mover" || nom === "munder") { nombre(2); return `${nom === "mover" ? "overset" : "underset"}{${valeurs[1]}}{${valeurs[0]}}`; }
    if (nom === "munderover") { nombre(3); return `overset{${valeurs[2]}}{underset{${valeurs[1]}}{${valeurs[0]}}}`; }
    if (nom === "mfenced") {
      const separateurs = [...(a("separators") ?? ",").replace(/\s/g, "")];
      return `${a("open") ?? "("}${valeurs.map((v, i) => `${i ? separateurs[Math.min(i - 1, separateurs.length - 1)] ?? "" : ""}${v}`).join("")}${a("close") ?? ")"}`;
    }
    throw new Error(`MathML non pris en charge : ${nom}`);
  }
  try { const texte = noeuds.map((n) => lire(n, 0)).join(" "); if (texteSource) surTexte?.(); return ` ${texte} `; }
  catch (e) {
    if (e instanceof Error && e.message.includes("profonde")) throw e;
    limites.add("Une expression MathML non prise en charge reste non transcrite ; consultez l’original.");
    return " [expression MathML non transcrite] ";
  }
}
