/**
 * Le format d'échange d'un jeu de données de simulation.
 *
 * Un fichier JSON décrit tout ce qu'il faut pour rejouer un parcours : le
 * référentiel, le catalogue d'exercices, et soit une liste d'événements datés,
 * soit un pilote (« l'apprenant fait ce que le moteur propose, N jours »).
 * Rien d'autre. Aucun identifiant de compte, aucune donnée réelle : un jeu de
 * données de simulation ne doit jamais pouvoir être confondu avec un export.
 *
 * ## Pourquoi une validation stricte, et pas un `JSON.parse` suivi d'un cast
 *
 * Un jeu invalide qu'on « rattrape » produirait des chiffres — donc des
 * chiffres inventés, exactement ce que ce simulateur existe pour débusquer. La
 * lecture échoue et dit pourquoi, ligne par ligne ; elle ne complète jamais un
 * champ manquant (invariant 6, et le garde-fou « ne jamais fabriquer une valeur
 * à partir d'une donnée invalide »).
 */

import { RESULTATS_TENTATIVE, type Difficulte, type Domaine, type Exercise, type Skill } from "@/lib/domain/types";
import type { ProfilApprenant } from "./apprenant";
import type { EvenementScenario, Scenario } from "./types";

export const FORMAT_JEU = "simulation-parcours";
export const VERSION_JEU = 1;

export type DerouleJeu =
  | { mode: "evenements"; evenements: EvenementScenario[] }
  | {
      mode: "pilote";
      /** Date du premier pas (ISO). */
      depart: string;
      /** Nombre de jours simulés. */
      pas: number;
      joursEntrePas?: number;
      /** Graine du tirage : deux lectures du même jeu donnent le même journal. */
      graine: number;
      profil: ProfilApprenant;
    };

export interface JeuDonnees {
  format: typeof FORMAT_JEU;
  version: typeof VERSION_JEU;
  id: string;
  nom: string;
  intention: string;
  domaines: Domaine[];
  competences: Skill[];
  exercices: Exercise[];
  deroule: DerouleJeu;
}

export type LectureJeu =
  | { ok: true; jeu: JeuDonnees }
  | { ok: false; erreurs: string[] };

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function estDate(valeur: unknown): boolean {
  return typeof valeur === "string" && !Number.isNaN(new Date(valeur).getTime());
}

function lireTableau(
  source: Record<string, unknown>,
  champ: string,
  erreurs: string[],
): Record<string, unknown>[] {
  const valeur = source[champ];
  if (!Array.isArray(valeur)) {
    erreurs.push(`« ${champ} » doit être un tableau.`);
    return [];
  }
  const objets: Record<string, unknown>[] = [];
  valeur.forEach((element, i) => {
    if (!estObjet(element)) erreurs.push(`${champ}[${i}] doit être un objet.`);
    else objets.push(element);
  });
  return objets;
}

function exigerTexte(
  source: Record<string, unknown>,
  champ: string,
  chemin: string,
  erreurs: string[],
): string | null {
  const valeur = source[champ];
  if (typeof valeur !== "string" || valeur.trim() === "") {
    erreurs.push(`${chemin}.${champ} : texte non vide attendu.`);
    return null;
  }
  return valeur;
}

function exigerNombre(
  source: Record<string, unknown>,
  champ: string,
  chemin: string,
  erreurs: string[],
  bornes?: { min: number; max: number },
): number | null {
  const valeur = source[champ];
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
    erreurs.push(`${chemin}.${champ} : nombre attendu.`);
    return null;
  }
  if (bornes && (valeur < bornes.min || valeur > bornes.max)) {
    erreurs.push(
      `${chemin}.${champ} : ${valeur} hors bornes (${bornes.min} à ${bornes.max}).`,
    );
    return null;
  }
  return valeur;
}

/**
 * Lit un jeu de données depuis du JSON déjà désérialisé.
 *
 * Renvoie TOUTES les erreurs, pas seulement la première : corriger un fichier
 * à l'aveugle, une erreur par tentative, est le meilleur moyen d'abandonner.
 */
export function lireJeuDonnees(source: unknown): LectureJeu {
  const erreurs: string[] = [];

  if (!estObjet(source)) {
    return { ok: false, erreurs: ["Le fichier doit contenir un objet JSON."] };
  }
  if (source.format !== FORMAT_JEU) {
    erreurs.push(`« format » doit valoir « ${FORMAT_JEU} ».`);
  }
  if (source.version !== VERSION_JEU) {
    erreurs.push(`« version » doit valoir ${VERSION_JEU}.`);
  }

  const id = exigerTexte(source, "id", "racine", erreurs);
  const nom = exigerTexte(source, "nom", "racine", erreurs);
  const intention = typeof source.intention === "string" ? source.intention : "";

  const domaines = lireTableau(source, "domaines", erreurs);
  const competences = lireTableau(source, "competences", erreurs);
  const exercices = lireTableau(source, "exercices", erreurs);

  const idsDomaines = new Set<string>();
  domaines.forEach((d, i) => {
    const identifiant = exigerTexte(d, "id", `domaines[${i}]`, erreurs);
    exigerTexte(d, "nom", `domaines[${i}]`, erreurs);
    if (identifiant) {
      if (idsDomaines.has(identifiant)) erreurs.push(`Domaine en double : ${identifiant}.`);
      idsDomaines.add(identifiant);
    }
  });

  const codes = new Set<string>();
  competences.forEach((c, i) => {
    const code = exigerTexte(c, "code", `competences[${i}]`, erreurs);
    exigerTexte(c, "intitule", `competences[${i}]`, erreurs);
    exigerNombre(c, "importance", `competences[${i}]`, erreurs, { min: 0, max: 1 });
    const domaine = exigerTexte(c, "domaine", `competences[${i}]`, erreurs);
    if (domaine && !idsDomaines.has(domaine)) {
      erreurs.push(`competences[${i}].domaine : domaine inconnu « ${domaine} ».`);
    }
    if (code) {
      if (codes.has(code)) erreurs.push(`Compétence en double : ${code}.`);
      codes.add(code);
    }
  });

  competences.forEach((c, i) => {
    const prerequis = c.prerequis;
    if (prerequis === undefined) return;
    if (!Array.isArray(prerequis)) {
      erreurs.push(`competences[${i}].prerequis : tableau attendu.`);
      return;
    }
    for (const p of prerequis) {
      if (typeof p !== "string" || !codes.has(p)) {
        erreurs.push(`competences[${i}].prerequis : code inconnu « ${String(p)} ».`);
      }
    }
  });

  const idsExercices = new Set<string>();
  exercices.forEach((e, i) => {
    const identifiant = exigerTexte(e, "id", `exercices[${i}]`, erreurs);
    exigerTexte(e, "titre", `exercices[${i}]`, erreurs);
    exigerNombre(e, "difficulte", `exercices[${i}]`, erreurs, { min: 1, max: 5 });
    exigerNombre(e, "dureeEstimeeMin", `exercices[${i}]`, erreurs, { min: 1, max: 600 });
    if (!Array.isArray(e.indices)) erreurs.push(`exercices[${i}].indices : tableau attendu.`);
    if (!Array.isArray(e.competences) || e.competences.length === 0) {
      erreurs.push(`exercices[${i}].competences : au moins une compétence visée.`);
    } else {
      for (const code of e.competences) {
        if (typeof code !== "string" || !codes.has(code)) {
          erreurs.push(`exercices[${i}].competences : code inconnu « ${String(code)} ».`);
        }
      }
    }
    if (identifiant) {
      if (idsExercices.has(identifiant)) erreurs.push(`Exercice en double : ${identifiant}.`);
      idsExercices.add(identifiant);
    }
  });

  lireDeroule(source.deroule, idsExercices, codes, erreurs);

  if (erreurs.length > 0) return { ok: false, erreurs };

  // Le cast n'a lieu qu'ici, une fois chaque champ vérifié. Les champs
  // facultatifs des types du domaine (archive, origine…) sont complétés par
  // `normaliser`, qui pose des valeurs neutres — jamais des valeurs de mesure.
  return {
    ok: true,
    jeu: normaliser({
      format: FORMAT_JEU,
      version: VERSION_JEU,
      id: id!,
      nom: nom!,
      intention,
      domaines: domaines as unknown as Domaine[],
      competences: competences as unknown as Skill[],
      exercices: exercices as unknown as Exercise[],
      deroule: source.deroule as DerouleJeu,
    }),
  };
}

function lireDeroule(
  deroule: unknown,
  idsExercices: Set<string>,
  codes: Set<string>,
  erreurs: string[],
): void {
  if (!estObjet(deroule)) {
    erreurs.push("« deroule » doit être un objet.");
    return;
  }

  if (deroule.mode === "evenements") {
    const evenements = lireTableau(deroule, "evenements", erreurs);
    if (evenements.length === 0) erreurs.push("deroule.evenements : au moins un événement.");
    evenements.forEach((e, i) => {
      const chemin = `deroule.evenements[${i}]`;
      if (!estDate(e.date)) erreurs.push(`${chemin}.date : date ISO attendue.`);
      switch (e.type) {
        case "attente":
          exigerNombre(e, "jours", chemin, erreurs, { min: 0, max: 3650 });
          break;
        case "tentative-abandonnee":
        case "tentative": {
          const exercice = exigerTexte(e, "exercice", chemin, erreurs);
          if (exercice && !idsExercices.has(exercice)) {
            erreurs.push(`${chemin}.exercice : exercice inconnu « ${exercice} ».`);
          }
          exigerNombre(e, "dureeMin", chemin, erreurs, { min: 0, max: 1440 });
          if (e.type === "tentative") {
            exigerNombre(e, "indicesUtilises", chemin, erreurs, { min: 0, max: 20 });
            if (!(RESULTATS_TENTATIVE as readonly string[]).includes(String(e.resultat))) {
              erreurs.push(`${chemin}.resultat : « reussi », « partiel » ou « echec ».`);
            }
          }
          break;
        }
        default:
          erreurs.push(`${chemin}.type : type d'événement inconnu « ${String(e.type)} ».`);
      }
    });
    return;
  }

  if (deroule.mode === "pilote") {
    if (!estDate(deroule.depart)) erreurs.push("deroule.depart : date ISO attendue.");
    exigerNombre(deroule, "pas", "deroule", erreurs, { min: 1, max: 2000 });
    exigerNombre(deroule, "graine", "deroule", erreurs, { min: 0, max: 2 ** 32 });
    if (deroule.joursEntrePas !== undefined) {
      exigerNombre(deroule, "joursEntrePas", "deroule", erreurs, { min: 1, max: 30 });
    }
    if (!estObjet(deroule.profil)) {
      erreurs.push("deroule.profil : objet attendu.");
      return;
    }
    const profil = deroule.profil;
    exigerNombre(profil, "apprentissage", "deroule.profil", erreurs, { min: 0, max: 1 });
    exigerNombre(profil, "tauxIgnore", "deroule.profil", erreurs, { min: 0, max: 1 });
    exigerNombre(profil, "lenteur", "deroule.profil", erreurs, { min: 0.1, max: 5 });
    if (!estObjet(profil.aptitude)) {
      erreurs.push("deroule.profil.aptitude : objet { code: aptitude } attendu.");
      return;
    }
    for (const [code, valeur] of Object.entries(profil.aptitude)) {
      if (!codes.has(code)) {
        erreurs.push(`deroule.profil.aptitude : compétence inconnue « ${code} ».`);
      }
      if (typeof valeur !== "number" || valeur < 0 || valeur > 5) {
        erreurs.push(`deroule.profil.aptitude.${code} : nombre entre 0 et 5 attendu.`);
      }
    }
    return;
  }

  erreurs.push('deroule.mode : « evenements » ou « pilote » attendu.');
}

/**
 * Complète les champs que le domaine exige mais qu'un jeu de données n'a pas à
 * écrire — des valeurs neutres, jamais des valeurs qui pèsent sur une mesure.
 */
function normaliser(jeu: JeuDonnees): JeuDonnees {
  return {
    ...jeu,
    domaines: jeu.domaines.map((d, i) => ({
      ...d,
      description: d.description ?? "",
      prefixe: d.prefixe ?? d.id.slice(0, 3).toUpperCase(),
      ordre: d.ordre ?? i,
      version: d.version ?? 1,
      archive: d.archive ?? false,
      origine: d.origine ?? "manuel",
    })),
    competences: jeu.competences.map((c, i) => ({
      ...c,
      palier: c.palier ?? "fondamentaux",
      prerequis: c.prerequis ?? [],
      ordre: c.ordre ?? i,
      active: c.active ?? true,
      archive: c.archive ?? false,
      origine: c.origine ?? "manuel",
    })),
    exercices: jeu.exercices.map((e) => ({
      ...e,
      type: e.type ?? "probleme",
      enonce: e.enonce ?? `Énoncé de simulation — ${e.titre}.`,
      indices: e.indices ?? [],
      correction: e.correction ?? "Correction de simulation.",
      criteres: e.criteres ?? [],
      origine: e.origine ?? "manuel",
      difficulte: Math.round(e.difficulte) as Difficulte,
    })),
  };
}

/** Le référentiel et le catalogue, sous la forme attendue par le simulateur. */
export function scenarioDuJeu(jeu: JeuDonnees): Scenario {
  return {
    id: jeu.id,
    nom: jeu.nom,
    intention: jeu.intention,
    domaines: jeu.domaines,
    competences: jeu.competences,
    exercices: jeu.exercices,
    evenements:
      jeu.deroule.mode === "evenements"
        ? jeu.deroule.evenements
        : [{ type: "attente", date: jeu.deroule.depart, jours: 0 }],
  };
}

/** Le jeu sérialisé, lisible et re-lisible — c'est le gabarit d'un jeu maison. */
export function ecrireJeuDonnees(jeu: JeuDonnees): string {
  return JSON.stringify(jeu, null, 2);
}

export type { EvenementScenario };
