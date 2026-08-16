/**
 * Lire une fiche projet comme une structure, pas comme un pavé de Markdown.
 *
 * ## Le problème
 *
 * `ouvrirProjetCompose` écrit trois sections auto-générées — Énoncé, Étapes,
 * Critères d'évaluation — dans un format qu'il maîtrise entièrement. Le
 * workspace, lui, les affichait en texte brut : `**Compétences visées**`,
 * `[[LOG-01]]` et `- ` s'affichaient littéralement, et un projet composé de six
 * compétences et cinq jalons se lisait comme un fichier de configuration.
 *
 * ## Pourquoi relire le Markdown plutôt que stocker la structure
 *
 * Parce que la fiche **est** la source (P1, ne pas stocker ce qui est
 * dérivable) : elle s'exporte, se relit hors de l'application, et se corrige à
 * la main. Dupliquer jalons et critères en front-matter donnerait deux vérités
 * dès la première correction manuelle. Ce module ne fait donc que lire, et il
 * lit exactement ce que `remplirFicheProjet` écrit.
 *
 * **Aucune tolérance inventée** : une ligne qui ne correspond à rien reste dans
 * `reste`, affichée telle quelle par le rendu Markdown ordinaire. On ne devine
 * pas ce qu'une fiche corrigée à la main a voulu dire.
 */

import type { ValeursSections } from "./sections-markdown";
import { separerFrontMatterEtCorps, type FrontMatter } from "./markdown";

export interface JalonProjet {
  titre: string;
  consigne: string;
  /** Absent quand la ligne « Attendu » n'a pas été écrite. */
  attendu?: string;
}

export interface CritereProjet {
  code: string;
  label: string;
}

export interface SectionRendu {
  section: string;
  consigne: string;
}

export interface CompetenceVisee {
  code: string;
  intitule: string;
}

export interface FicheProjet {
  /** Le brief, en Markdown — rendu tel quel par `Markdown`. */
  brief: string;
  dureeMin?: number;
  segmentMin?: number;
  competences: CompetenceVisee[];
  jalons: JalonProjet[];
  sectionsRendu: SectionRendu[];
  criteres: CritereProjet[];
  /** Les avertissements en citation, sous les critères. */
  notes: string[];
}

const LIGNE_DUREE = /^\*Durée estimée\s*:\s*(\d+)\s*min(?:.*?segments de\s*(\d+)\s*min)?/i;
const TITRE_COMPETENCES = /^\*\*Compétences visées\*\*$/i;
const TITRE_SECTIONS_RENDU = /^\*\*Sections attendues du rendu\*\*$/i;
const TITRE_CRITERES = /^\*\*Critères d'évaluation\*\*$/i;
/** `- [[LOG-01]] — Modéliser…` : le tiret cadratin est celui qu'écrit la fiche. */
const PUCE_CODE = /^-\s*\[\[([^\]]+)\]\]\s*—\s*(.+)$/;
/** `- **Analyse** — ce qu'on attend de cette section`. */
const PUCE_SECTION = /^-\s*\*\*(.+?)\*\*\s*—\s*(.+)$/;
/** `1. **Modéliser les flux** — consigne`. */
const LIGNE_JALON = /^\d+\.\s*\*\*(.+?)\*\*\s*—\s*(.*)$/;
const LIGNE_ATTENDU = /^\s*\*Attendu\s*:\*\s*(.+)$/;

function lignes(valeur: string): string[] {
  return valeur.replace(/\r\n/g, "\n").split("\n");
}

/**
 * L'énoncé : un brief, une durée, des compétences nommées.
 *
 * La durée et les compétences sont écrites **après** le brief, dans cet ordre.
 * Tout ce qui précède la première de ces marques est du brief — y compris les
 * paragraphes multiples, que rien n'oblige à recoller.
 */
function analyserEnonce(valeur: string): Pick<FicheProjet, "brief" | "dureeMin" | "segmentMin" | "competences"> {
  const corps = lignes(valeur);
  const brief: string[] = [];
  const competences: CompetenceVisee[] = [];
  let dureeMin: number | undefined;
  let segmentMin: number | undefined;
  let zone: "brief" | "apres" | "competences" = "brief";

  for (const ligne of corps) {
    const duree = LIGNE_DUREE.exec(ligne.trim());
    if (duree) {
      dureeMin = Number(duree[1]);
      if (duree[2]) segmentMin = Number(duree[2]);
      zone = "apres";
      continue;
    }
    if (TITRE_COMPETENCES.test(ligne.trim())) {
      zone = "competences";
      continue;
    }
    if (zone === "competences") {
      const puce = PUCE_CODE.exec(ligne.trim());
      if (puce) competences.push({ code: puce[1].trim(), intitule: puce[2].trim() });
      continue;
    }
    if (zone === "brief") brief.push(ligne);
  }

  return { brief: brief.join("\n").trim(), dureeMin, segmentMin, competences };
}

/** Les jalons : un titre, une consigne, et le résultat attendu sur la ligne suivante. */
function analyserJalons(valeur: string): JalonProjet[] {
  const jalons: JalonProjet[] = [];
  for (const ligne of lignes(valeur)) {
    const debut = LIGNE_JALON.exec(ligne);
    if (debut) {
      jalons.push({ titre: debut[1].trim(), consigne: debut[2].trim() });
      continue;
    }
    const attendu = LIGNE_ATTENDU.exec(ligne);
    if (attendu && jalons.length > 0) {
      jalons[jalons.length - 1].attendu = attendu[1].trim();
    }
  }
  return jalons;
}

/** Les critères : les sections attendues d'abord, les critères ensuite, les notes en citation. */
function analyserCriteres(valeur: string): Pick<FicheProjet, "sectionsRendu" | "criteres" | "notes"> {
  const sectionsRendu: SectionRendu[] = [];
  const criteres: CritereProjet[] = [];
  const notes: string[] = [];
  let zone: "aucune" | "sections" | "criteres" = "aucune";

  for (const brute of lignes(valeur)) {
    const ligne = brute.trim();
    if (TITRE_SECTIONS_RENDU.test(ligne)) {
      zone = "sections";
      continue;
    }
    if (TITRE_CRITERES.test(ligne)) {
      zone = "criteres";
      continue;
    }
    if (ligne.startsWith(">")) {
      const note = ligne.replace(/^>\s?/, "").trim();
      if (note) notes.push(note);
      continue;
    }
    if (zone === "criteres") {
      const puce = PUCE_CODE.exec(ligne);
      if (puce) criteres.push({ code: puce[1].trim(), label: puce[2].trim() });
      continue;
    }
    if (zone === "sections") {
      const puce = PUCE_SECTION.exec(ligne);
      if (puce) sectionsRendu.push({ section: puce[1].trim(), consigne: puce[2].trim() });
    }
  }

  return { sectionsRendu, criteres, notes };
}

/**
 * La fiche entière, lue depuis ses sections déjà découpées.
 *
 * Les noms de sections sont ceux du registre (`types-documents.ts`) : les
 * réécrire ici en dur créerait une seconde déclaration qui dériverait.
 */
export function analyserFicheProjet(valeurs: ValeursSections): FicheProjet {
  return {
    ...analyserEnonce(valeurs["Énoncé"] ?? ""),
    jalons: analyserJalons(valeurs["Étapes"] ?? ""),
    ...analyserCriteres(valeurs["Critères d'évaluation"] ?? ""),
  };
}

/* ------------------------------------------------------------------ */
/* Avancement — une déclaration, jamais une mesure                     */
/* ------------------------------------------------------------------ */

/** Le champ de front-matter où vit l'avancement déclaré. */
export const CHAMP_JALONS_FAITS = "projet_jalons_faits";

/**
 * Les jalons cochés, tels que déclarés.
 *
 * ⚠️ **Ce n'est pas une mesure** (P5, ADR-064). Cocher un jalon dit « je
 * considère cette étape faite » ; aucune preuve, aucun niveau, aucun score n'en
 * découle. Seule une évaluation validée produit une preuve.
 *
 * Les index sont ceux des jalons dans la fiche, à partir de 1 — un index reste
 * lisible dans le front-matter exporté, contrairement à un identifiant opaque,
 * et les jalons ne bougent pas : ils sont écrits une fois à l'ouverture.
 */
export function lireJalonsFaits(frontMatter: FrontMatter): Set<number> {
  const brut = frontMatter[CHAMP_JALONS_FAITS];
  const valeurs = Array.isArray(brut)
    ? brut
    : typeof brut === "number"
      ? [brut]
      : typeof brut === "string"
        ? brut.split(",")
        : [];
  const faits = new Set<number>();
  for (const valeur of valeurs) {
    const numero = Number(String(valeur).trim());
    if (Number.isInteger(numero) && numero > 0) faits.add(numero);
  }
  return faits;
}

/**
 * Réécrit le front-matter avec l'avancement déclaré, sans toucher au corps.
 *
 * Le champ est retiré quand plus rien n'est coché : une clé vide traînant dans
 * l'export dirait qu'un avancement existe alors qu'il n'y en a aucun. Un
 * document sans front-matter n'en reçoit pas un : il n'y a rien à y accrocher,
 * et en fabriquer un modifierait un document qu'on n'a pas écrit.
 */
export function ecrireJalonsFaits(contenuMd: string, faits: Iterable<number>): string {
  const { frontmatterBrut, corps } = separerFrontMatterEtCorps(contenuMd);
  if (frontmatterBrut === "") return contenuMd;

  const tries = [...new Set(faits)].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
  const lignesFront = frontmatterBrut.split("\n");
  const conservees = lignesFront.filter(
    (ligne, index) =>
      // La dernière ligne est le `---` de fermeture : elle reste en place.
      index === lignesFront.length - 1 || !ligne.startsWith(`${CHAMP_JALONS_FAITS}:`),
  );
  if (tries.length > 0) {
    conservees.splice(conservees.length - 1, 0, `${CHAMP_JALONS_FAITS}: ${tries.join(", ")}`);
  }
  return `${conservees.join("\n")}\n\n${corps}`;
}
