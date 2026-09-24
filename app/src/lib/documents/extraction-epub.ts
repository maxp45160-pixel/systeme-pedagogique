import { Unzip, UnzipInflate } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { SectionDepot } from "./depot";
import { MAX_PIECE_OCTETS, MIME_EPUB } from "./pieces-jointes";
import { lireStylesEpub, positionCssEpub, transcrireMathmlEpub, transcrirePositionEpub, type StylesEpub } from "./extraction-epub-notations";

/** Extraction locale : aucune ressource externe n'est chargée, aucun HTML n'est exécuté. */
export const VERSION_EXTRACTION_EPUB = "epub-texte-spine-v2";
export const MAX_TEXTE_SECTION_EPUB = 50_000;
const MAX_ENTREES = 2000;
const MAX_XML = 1_000_000;
const MAX_DECOMPRESSE = 8_000_000;
export interface SectionExtraiteEpub { section: SectionDepot; texte: string; incertain: boolean }
type Noeud = Record<string, unknown>;

function cheminInterne(chemin: string): string {
  if (!chemin || chemin.length > 500 || /[\\\u0000-\u001f:?#]/u.test(chemin) || chemin.startsWith("/") || chemin.split("/").some((p) => p === "." || p === ".." || !p)) {
    throw new Error("L'EPUB contient un chemin interne invalide.");
  }
  return chemin;
}

function resoudre(base: string, relatif: string): string {
  if (/^[a-z][a-z\d+.-]*:|^\/|\\|\?/iu.test(relatif)) throw new Error("Une ressource EPUB externe ou ambiguë n'est pas prise en charge.");
  let decode: string;
  try { decode = decodeURIComponent(relatif.split("#")[0]); } catch { throw new Error("Chemin EPUB mal encodé."); }
  const segments = base.split("/").slice(0, -1);
  for (const partie of decode.split("/")) {
    if (partie === ".") continue;
    if (partie === "..") { if (!segments.length) throw new Error("Chemin EPUB sortant de l'archive."); segments.pop(); }
    else segments.push(partie);
  }
  return cheminInterne(segments.join("/"));
}

/** L'enveloppe complète est vérifiée avant la décompression progressive. */
function verifierZip(octets: Uint8Array): number {
  if (octets.length < 22 || octets.length > MAX_PIECE_OCTETS) throw new Error("EPUB vide, incomplet ou supérieur à 10 Mio.");
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (vue.getUint32(0, true) !== 0x04034b50) throw new Error("Ce fichier n'est pas une archive EPUB.");
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i--) {
    if (vue.getUint32(i, true) !== 0x06054b50 || i + 22 + vue.getUint16(i + 20, true) !== octets.length) continue;
    const nombre = vue.getUint16(i + 10, true);
    if (vue.getUint16(i + 4, true) || vue.getUint16(i + 6, true) || vue.getUint16(i + 8, true) !== nombre || nombre > MAX_ENTREES || !nombre || vue.getUint32(i + 12, true) + vue.getUint32(i + 16, true) !== i) {
      throw new Error("Structure ZIP EPUB hors limites ou multi-volume.");
    }
    // Contrôler les marqueurs de chiffrement que le décompresseur ne traite pas.
    let entree = vue.getUint32(i + 16, true);
    for (let n = 0; n < nombre; n++) {
      if (entree + 46 > i || vue.getUint32(entree, true) !== 0x02014b50) throw new Error("Index ZIP EPUB incomplet.");
      const drapeaux = vue.getUint16(entree + 8, true);
      const local = vue.getUint32(entree + 42, true);
      if (local + 30 > entree || vue.getUint32(local, true) !== 0x04034b50) throw new Error("En-tête ZIP EPUB invalide.");
      if ((drapeaux | vue.getUint16(local + 6, true)) & 0x41) throw new Error("Les archives EPUB chiffrées ne sont pas prises en charge.");
      entree += 46 + vue.getUint16(entree + 28, true) + vue.getUint16(entree + 30, true) + vue.getUint16(entree + 32, true);
    }
    if (entree !== i) throw new Error("Index ZIP EPUB incohérent.");
    return nombre;
  }
  throw new Error("Archive EPUB incomplète ou ZIP64 non pris en charge.");
}

function extraireFichiers(octets: Uint8Array, souhaites: Set<string>, nombre: number, budget: { total: number }, css = false): Map<string, string> {
  const fichiers = new Map<string, string>();
  const noms = new Set<string>();
  const terminees = new Set<string>();
  const zip = new Unzip((fichier) => {
    // Les répertoires ZIP sont permis, mais jamais un chemin qui remonte.
    const nom = fichier.name.endsWith("/") ? fichier.name.slice(0, -1) : fichier.name;
    cheminInterne(nom);
    if (noms.has(fichier.name) || noms.size >= MAX_ENTREES) throw new Error("Entrées EPUB répétées ou trop nombreuses.");
    noms.add(fichier.name);
    if (fichier.name === "META-INF/encryption.xml") throw new Error("Cet EPUB utilise des ressources chiffrées ; exportez une version non protégée.");
    if (!souhaites.has(fichier.name)) return;
    if (fichier.originalSize !== undefined && fichier.originalSize > MAX_XML) throw new Error("Une section EPUB dépasse la limite de lecture locale.");
    let taille = 0;
    const blocs: Uint8Array[] = [];
    fichier.ondata = (erreur, bloc, fin) => {
      if (erreur) throw new Error("Décompression EPUB impossible.");
      taille += bloc.length; budget.total += bloc.length;
      if (taille > MAX_XML || budget.total > MAX_DECOMPRESSE) throw new Error("EPUB trop volumineux après décompression.");
      blocs.push(bloc);
      if (fin) {
        const contenu = new Uint8Array(taille);
        let position = 0;
        for (const b of blocs) { contenu.set(b, position); position += b.length; }
        // CSS : les octets invalides deviennent U+FFFD ; le lecteur de règles refuse
        // de conclure s'ils touchent autre chose qu'un commentaire. XHTML reste strict.
        try { fichiers.set(fichier.name, new TextDecoder("utf-8", { fatal: !css }).decode(contenu)); }
        catch { throw new Error("Cet EPUB n'est pas encodé en UTF-8 valide."); }
        terminees.add(fichier.name);
      }
    };
    fichier.start();
  });
  zip.register(UnzipInflate);
  // Borne aussi les blocs de sortie produits avant notre contrôle de taille.
  for (let i = 0; i < octets.length; i += 1024) zip.push(octets.subarray(i, i + 1024), i + 1024 >= octets.length);
  if (noms.size !== nombre || [...souhaites].some((nom) => !terminees.has(nom))) throw new Error("Une ressource déclarée de l'EPUB est absente ou incomplète.");
  return fichiers;
}

function xml(texte: string): Noeud[] {
  if (/<!ENTITY\b|<!DOCTYPE[^>]*\[/iu.test(texte)) throw new Error("Les entités XML personnalisées ne sont pas prises en charge.");
  if ((texte.match(/</g)?.length ?? 0) > 40000) throw new Error("Structure XML EPUB trop complexe.");
  let resultat: unknown;
  try {
    if (XMLValidator.validate(texte) !== true) throw new Error("XML invalide");
    resultat = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true, htmlEntities: true }).parse(texte);
  } catch { throw new Error("Structure XML EPUB invalide ou trop profonde."); }
  if (!Array.isArray(resultat)) throw new Error("Structure XML EPUB invalide.");
  return resultat as Noeud[];
}
function enfants(noeud: Noeud, nom: string): Noeud[] { return Array.isArray(noeud[nom]) ? noeud[nom] as Noeud[] : []; }
function attribut(noeud: Noeud, nom: string): string {
  const a = noeud[":@"] as Record<string, unknown> | undefined;
  return typeof a?.[`@_${nom}`] === "string" ? a[`@_${nom}`] as string : "";
}
function trouver(noeuds: Noeud[], nom: string, profondeur = 0): Noeud[] {
  if (profondeur > 100) throw new Error("Imbrication XML EPUB trop profonde.");
  return noeuds.flatMap((n) => Object.entries(n).flatMap(([cle, valeur]) => cle === nom ? [n] : Array.isArray(valeur) ? trouver(valeur as Noeud[], nom, profondeur + 1) : []));
}
const BLOC = new Set(["p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "br", "hr", "blockquote", "pre"]);
const IGNORER = new Set(["script", "style", "head"]);
const NON_TEXTUEL = new Set(["img", "svg", "audio", "video", "canvas", "object", "iframe"]);
const POSITION_INLINE = new Set(["span", "sup", "sub", "em", "strong", "i", "b", "a"]);
function texteNoeuds(noeuds: Noeud[], limites: Set<string>, styles: StylesEpub = { regles: [], ambigu: false }, profondeur = 0, source = { presente: false }): string {
  if (profondeur > 100) throw new Error("Imbrication XHTML EPUB trop profonde.");
  return noeuds.map((n) => Object.entries(n).map(([nom, valeur]) => {
    if (nom === "#text") { if (typeof valeur === "string" && valeur.trim()) source.presente = true; return typeof valeur === "string" ? valeur : ""; }
    if (IGNORER.has(nom) || nom === ":@" || nom.startsWith("?")) return "";
    if (nom === "math") return transcrireMathmlEpub([n], limites, () => { source.presente = true; });
    if (NON_TEXTUEL.has(nom)) { limites.add("Illustrations, formules graphiques et médias non analysés : vérifiez l’original."); return ""; }
    const texte = Array.isArray(valeur) ? texteNoeuds(valeur as Noeud[], limites, styles, profondeur + 1, source) : "";
    // L'alignement d'une cellule ou d'un bloc décrit sa mise en page, pas une notation.
    const position = POSITION_INLINE.has(nom) ? positionCssEpub(n, nom, styles, limites) : undefined;
    if (nom === "sup" || nom === "sub") {
      return transcrirePositionEpub(texte, position ?? (nom === "sup" ? "super" : "sub"), limites);
    }
    const positionne = position ? transcrirePositionEpub(texte, position, limites) : texte;
    return BLOC.has(nom) ? `\n${positionne}\n` : nom === "td" || nom === "th" ? `${positionne}\t` : positionne;
  }).join("")).join("");
}

/** Coupures stables aux séparateurs si possible, sinon aux frontières UTF-8 ; aucun caractère perdu. */
function decouperTexte(texte: string): string[] {
  const octets = new TextEncoder().encode(texte), decodeur = new TextDecoder("utf-8", { fatal: true });
  const parties: string[] = [];
  let debut = 0;
  while (debut < octets.length) {
    let fin = Math.min(debut + MAX_TEXTE_SECTION_EPUB, octets.length);
    while (fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin--;
    let partie = decodeur.decode(octets.subarray(debut, fin));
    if (fin < octets.length) {
      const seuil = partie.length / 2;
      const coupe = [partie.lastIndexOf("\n\n"), partie.lastIndexOf("\n"), partie.lastIndexOf(" ")].find((n) => n >= seuil);
      if (coupe !== undefined) { partie = partie.slice(0, coupe + 1); fin = debut + new TextEncoder().encode(partie).length; }
    }
    parties.push(partie); debut = fin;
  }
  return parties.length ? parties : [""];
}

/** Repères de sections du spine, découpées si nécessaire, sans inventer de pagination. */
export function extraireSectionsEpub(octets: Uint8Array): SectionExtraiteEpub[] {
  const nombre = verifierZip(octets);
  const budget = { total: 0 };
  const meta = extraireFichiers(octets, new Set(["mimetype", "META-INF/container.xml"]), nombre, budget);
  if (meta.get("mimetype")?.trim() !== MIME_EPUB) throw new Error("Le type déclaré de l'archive n'est pas EPUB.");
  const racines = trouver(xml(meta.get("META-INF/container.xml")!), "rootfile").filter((n) => attribut(n, "media-type") === "application/oebps-package+xml");
  if (racines.length !== 1) throw new Error("Cet EPUB doit désigner un seul livre principal.");
  const opf = cheminInterne(attribut(racines[0], "full-path"));
  const paquet = xml(extraireFichiers(octets, new Set([opf]), nombre, budget).get(opf)!);
  const manifestes = trouver(paquet, "manifest"), spines = trouver(paquet, "spine");
  if (manifestes.length !== 1 || spines.length !== 1) throw new Error("Sommaire de lecture EPUB absent ou ambigu.");
  const items = new Map<string, { chemin: string; mime: string }>();
  for (const item of trouver(enfants(manifestes[0], "manifest"), "item")) {
    const id = attribut(item, "id");
    if (!id || items.has(id)) throw new Error("Identifiant EPUB absent ou répété.");
    // Seules les ressources de l'ordre de lecture seront chargées.
    items.set(id, { chemin: attribut(item, "href"), mime: attribut(item, "media-type") });
  }
  const ordre = trouver(enfants(spines[0], "spine"), "itemref").map((n) => {
    const item = items.get(attribut(n, "idref"));
    if (!item || item.mime !== "application/xhtml+xml") throw new Error("Une section EPUB n'est pas du XHTML textuel pris en charge.");
    return resoudre(opf, item.chemin);
  });
  if (!ordre.length || ordre.length > MAX_ENTREES || new Set(ordre).size !== ordre.length) throw new Error("Ordre de lecture EPUB vide, répété ou trop long.");
  const contenus = extraireFichiers(octets, new Set(ordre), nombre, budget);
  const racinesXhtml = new Map(ordre.map((chemin) => [chemin, xml(contenus.get(chemin)!)]));
  const stylesParSection = new Map<string, (string | { chemin: string })[]>();
  const reservesStyles = new Map<string, Set<string>>();
  const cheminsCss = new Set<string>();
  for (const [chemin, racine] of racinesXhtml) {
    const styles: (string | { chemin: string })[] = [], limites = new Set<string>();
    function parcourir(noeuds: Noeud[], profondeur = 0) {
      if (profondeur > 100) throw new Error("Imbrication XHTML EPUB trop profonde.");
      for (const n of noeuds) for (const [nom, valeur] of Object.entries(n)) {
        if (nom === "style") {
          if (attribut(n, "media") && attribut(n, "media") !== "all") { limites.add("Styles conditionnels non interprétés ; vérifiez les notations dans l’original."); continue; }
          styles.push(enfants(n, "style").map((v) => v["#text"] ?? "").join(""));
        } else if (nom === "link" && attribut(n, "rel").split(/\s+/).includes("stylesheet")) {
          try {
            if (attribut(n, "media") && attribut(n, "media") !== "all") throw new Error("Style conditionnel");
            const cible = resoudre(chemin, attribut(n, "href"));
            if (![...items.values()].some((i) => i.mime === "text/css" && (() => { try { return resoudre(opf, i.chemin) === cible; } catch { return false; } })())) throw new Error("Style non déclaré");
            cheminsCss.add(cible); styles.push({ chemin: cible });
          } catch { limites.add("Feuille de style externe, conditionnelle ou non déclarée non lue ; vérifiez les notations dans l’original."); }
        } else if (Array.isArray(valeur)) parcourir(valeur as Noeud[], profondeur + 1);
      }
    }
    parcourir(racine); stylesParSection.set(chemin, styles); reservesStyles.set(chemin, limites);
  }
  const fichiersCss = cheminsCss.size ? extraireFichiers(octets, cheminsCss, nombre, budget, true) : new Map<string, string>();
  const resultat: SectionExtraiteEpub[] = [];
  for (const [index, chemin] of ordre.entries()) {
    const racine = racinesXhtml.get(chemin)!;
    const corps = trouver(racine, "body");
    if (corps.length !== 1) throw new Error("Une section EPUB ne contient pas de corps XHTML unique.");
    const limites = reservesStyles.get(chemin)!;
    const styles = lireStylesEpub(stylesParSection.get(chemin)!.map((s) => typeof s === "string" ? s : fichiersCss.get(s.chemin)!), limites);
    if (limites.size) styles.ambigu = true;
    const source = { presente: false };
    const extrait = texteNoeuds(enfants(corps[0], "body"), limites, styles, 0, source);
    const texte = source.presente ? extrait.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim() : "";
    if (!texte) limites.add("Cette section ne contient aucun texte extractible ; son contenu n’a pas été analysé.");
    const titreNoeud = trouver(racine, "title")[0];
    const titre = (titreNoeud ? texteNoeuds(enfants(titreNoeud, "title"), new Set()).trim() : "") || `Section ${index + 1}`;
    const parties = decouperTexte(texte);
    for (const [i, partie] of parties.entries()) {
      const suffixe = parties.length > 1 ? ` — Partie ${i + 1}/${parties.length}` : "";
      const reserves = [...limites];
      const limitesBornees = reserves.length <= 5 ? reserves : [...reserves.slice(0, 4), `Autres réserves d’extraction : ${reserves.slice(4).join(" ")}`.slice(0, 500)];
      resultat.push({ section: { chemin, titre: titre.slice(0, 200 - suffixe.length) + suffixe, ...(limites.size ? { limites: limitesBornees } : {}) }, texte: partie, incertain: limites.size > 0 });
      if (resultat.length > MAX_ENTREES) throw new Error("Trop de sections EPUB après découpage.");
    }
  }
  return resultat;
}
