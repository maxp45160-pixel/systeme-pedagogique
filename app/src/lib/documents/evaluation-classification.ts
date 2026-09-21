/** Évaluation hors ligne d'annotations, jamais juge sémantique ni preuve fournisseur.
 * « humaine » et les sources sont déclarées par l'auteur du corpus : l'outil ne
 * vérifie pas l'identité de cet auteur. Les fixtures synthétiques restent UNKNOWN.
 */
export const FORMATS_CLASSIFICATION = ["pdf", "epub", "image", "manuscrit", "texte-libre"] as const;
export const FONCTIONS_CLASSIFICATION = ["sujet", "domaine", "competences", "rattachement", "hierarchie"] as const;
export type FormatClassification = typeof FORMATS_CLASSIFICATION[number];
export type FonctionClassification = typeof FONCTIONS_CLASSIFICATION[number];
export type VerdictClassification = "SOUS_SEUIL" | "HORS_SEUIL" | "UNKNOWN";

export interface CasEvaluationClassification {
  id: string;
  format: FormatClassification;
  fonction: FonctionClassification;
  reference: {
    origine: "humaine" | "synthetique";
    source: string;
    couverture: "entiere" | "partielle";
    attendus: { id: string; optionnel: boolean }[];
  } | null;
  sortie: {
    source: string;
    couverture: "entiere" | "partielle" | "inconnue";
    /** L'inventaire comprend toutes les propositions, même refusées/incorrectes. */
    inventaireComplet: boolean;
    annotationHumaine: string | null;
    propositions: {
      id: string;
      jugement: "correcte" | "incorrecte" | "UNKNOWN";
      /** Correspondance annotée humainement, sans rapprochement automatique. */
      attendusCouverts: string[];
    }[];
  } | null;
}

export interface MesureClassification {
  erreurs: number | null;
  total: number | null;
  tauxErreurs: number | null;
  verdict: VerdictClassification;
}

export interface ResultatClassification {
  format: FormatClassification;
  fonction: FonctionClassification;
  cas: string[];
  inconnues: { cas: string | null; motif: string }[];
  erreursPropositions: MesureClassification;
  omissionsCompetences: MesureClassification | null;
  /** Un calcul sur petit corpus n'est pas une garantie statistique de généralisation. */
  verdict: VerdictClassification;
}

function objet(valeur: unknown): Record<string, unknown> {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) throw new Error("Objet attendu.");
  return valeur as Record<string, unknown>;
}
function texte(valeur: unknown): string {
  if (typeof valeur !== "string" || !valeur.trim()) throw new Error("Texte non vide attendu.");
  return valeur;
}
function choix<T extends string>(valeur: unknown, choixPossibles: readonly T[]): T {
  if (typeof valeur !== "string" || !choixPossibles.includes(valeur as T)) throw new Error(`Valeur inconnue : ${String(valeur)}.`);
  return valeur as T;
}
function booleen(valeur: unknown): boolean {
  if (typeof valeur !== "boolean") throw new Error("Booléen attendu.");
  return valeur;
}
function liste<T>(valeur: unknown, lire: (element: unknown) => T): T[] {
  if (!Array.isArray(valeur)) throw new Error("Liste attendue.");
  return valeur.map(lire);
}
function uniques(ids: string[], libelle: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(`Identifiant répété : ${libelle}.`);
}

/** Frontière JSON stricte : aucune conversion d'une donnée invalide en valeur. */
export function lireCorpusClassification(valeur: unknown): CasEvaluationClassification[] {
  const corpus = liste(valeur, (element): CasEvaluationClassification => {
    const cas = objet(element);
    const ref = cas.reference === null ? null : objet(cas.reference);
    const sortie = cas.sortie === null ? null : objet(cas.sortie);
    const resultat: CasEvaluationClassification = {
      id: texte(cas.id),
      format: choix(cas.format, FORMATS_CLASSIFICATION),
      fonction: choix(cas.fonction, FONCTIONS_CLASSIFICATION),
      reference: ref === null ? null : {
        origine: choix(ref.origine, ["humaine", "synthetique"]),
        source: texte(ref.source),
        couverture: choix(ref.couverture, ["entiere", "partielle"]),
        attendus: liste(ref.attendus, (element) => {
          const attendu = objet(element);
          return { id: texte(attendu.id), optionnel: booleen(attendu.optionnel) };
        }),
      },
      sortie: sortie === null ? null : {
        source: texte(sortie.source),
        couverture: choix(sortie.couverture, ["entiere", "partielle", "inconnue"]),
        inventaireComplet: booleen(sortie.inventaireComplet),
        annotationHumaine: sortie.annotationHumaine === null ? null : texte(sortie.annotationHumaine),
        propositions: liste(sortie.propositions, (element) => {
          const proposition = objet(element);
          return {
            id: texte(proposition.id),
            jugement: choix(proposition.jugement, ["correcte", "incorrecte", "UNKNOWN"]),
            attendusCouverts: liste(proposition.attendusCouverts, texte),
          };
        }),
      },
    };
    uniques(resultat.reference?.attendus.map((a) => a.id) ?? [], resultat.id);
    uniques(resultat.sortie?.propositions.map((p) => p.id) ?? [], resultat.id);
    // Un même attendu ne crédite pas plusieurs propositions correctes : les
    // répétitions doivent être arbitrées dans l'annotation, pas gonfler le taux.
    uniques(resultat.sortie?.propositions.filter((p) => p.jugement === "correcte").flatMap((p) => p.attendusCouverts) ?? [], "correspondance des attendus");
    for (const proposition of resultat.sortie?.propositions ?? []) {
      uniques(proposition.attendusCouverts, proposition.id);
      if (proposition.jugement !== "correcte" && proposition.attendusCouverts.length) {
        throw new Error("Une proposition non correcte ne couvre aucun attendu.");
      }
      if (resultat.reference && proposition.attendusCouverts.some((id) => !resultat.reference!.attendus.some((a) => a.id === id))) {
        throw new Error(`Attendu inconnu dans ${proposition.id}.`);
      }
    }
    return resultat;
  });
  uniques(corpus.map((cas) => cas.id), "corpus");
  return corpus;
}

function mesure(erreurs: number, total: number, inconnue: boolean): MesureClassification {
  if (inconnue) return { erreurs: null, total: null, tauxErreurs: null, verdict: "UNKNOWN" };
  return {
    erreurs, total, tauxErreurs: total ? erreurs / total : null,
    // Comparaison entière : exactement 5 % ne satisfait pas « moins de 5 % ».
    verdict: !total ? "UNKNOWN" : erreurs * 100 < total * 5 ? "SOUS_SEUIL" : "HORS_SEUIL",
  };
}

/** Résultats par format ET fonction, sans moyenne générale masquant un format. */
export function evaluerClassification(valeur: unknown): ResultatClassification[] {
  const corpus = lireCorpusClassification(valeur);
  return FORMATS_CLASSIFICATION.flatMap((format) => FONCTIONS_CLASSIFICATION.map((fonction) => {
    const casCellule = corpus.filter((cas) => cas.format === format && cas.fonction === fonction);
    const inconnues: ResultatClassification["inconnues"] = [];
    let incorrectes = 0, propositions = 0, omissions = 0, attendues = 0;
    let annotationsInconnues = false;
    if (!casCellule.length) inconnues.push({ cas: null, motif: "Aucun cas pour ce format et cette fonction." });
    for (const cas of casCellule) {
      const { reference, sortie } = cas;
      const motifs: string[] = [];
      if (!reference || reference.origine !== "humaine") motifs.push("Référence humaine absente.");
      if (reference?.couverture === "partielle") motifs.push("Référence ne couvrant pas tout le support.");
      if (!sortie) motifs.push("Sortie absente.");
      if (sortie && (!sortie.inventaireComplet || !sortie.annotationHumaine || sortie.propositions.some((p) => p.jugement === "UNKNOWN"))) {
        motifs.push("Annotation humaine ou inventaire des propositions incomplet.");
      }
      if (motifs.length) annotationsInconnues = true;
      if (sortie && sortie.couverture !== "entiere") motifs.push("Traitement du support incomplet ou de couverture inconnue.");
      inconnues.push(...motifs.map((motif) => ({ cas: cas.id, motif })));
      if (!reference || !sortie) continue;
      propositions += sortie.propositions.length;
      incorrectes += sortie.propositions.filter((p) => p.jugement === "incorrecte").length;
      const couverts = new Set(sortie.propositions.filter((p) => p.jugement === "correcte").flatMap((p) => p.attendusCouverts));
      const obligatoires = reference.attendus.filter((a) => !a.optionnel);
      attendues += obligatoires.length;
      omissions += obligatoires.filter((a) => !couverts.has(a.id)).length;
    }
    const incalculable = annotationsInconnues || !casCellule.length;
    const erreursPropositions = mesure(incorrectes, propositions, incalculable);
    const omissionsCompetences = fonction === "competences" ? mesure(omissions, attendues, incalculable) : null;
    const mesures = [erreursPropositions, ...(omissionsCompetences ? [omissionsCompetences] : [])];
    const verdict: VerdictClassification = mesures.some((m) => m.verdict === "HORS_SEUIL") ? "HORS_SEUIL"
      : inconnues.length || mesures.some((m) => m.verdict === "UNKNOWN") ? "UNKNOWN" : "SOUS_SEUIL";
    return { format, fonction, cas: casCellule.map((cas) => cas.id), inconnues, erreursPropositions, omissionsCompetences, verdict };
  }));
}
