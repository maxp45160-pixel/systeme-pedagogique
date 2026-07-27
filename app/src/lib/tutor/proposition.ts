/**
 * Extraction des blocs structurés émis par le tuteur.
 *
 * Deux gabarits, tous deux fixés côté serveur dans `CONSIGNES_INTERFACE`
 * (`lib/tutor/contexte.ts`) :
 *
 * - `PROPOSITION DE MISE À JOUR` → une **preuve** à enregistrer ;
 * - `PROPOSITION D'EXERCICE` ..... → un **exercice** à ajouter au corpus.
 *
 * Ces parseurs sont purement locaux et testables. Ils ne donnent aucun accès en
 * écriture au tuteur (P5) : ils transforment une proposition en formulaire
 * pré-rempli, et seul l'utilisateur, en validant, déclenche l'écriture.
 *
 * Parsing volontairement tolérant : si le modèle dévie du gabarit, un champ
 * manque simplement (chaîne vide) plutôt que de lever une erreur. Le texte brut
 * reste de toute façon lisible dans le chat.
 */

/* ------------------------------------------------------------------ */
/* Proposition de preuve                                               */
/* ------------------------------------------------------------------ */

export interface PropositionTuteur {
  competence: string;
  niveauActuel: string;
  niveauPropose: string;
  preuve: string;
  autonomieObservee: string;
  qualitePreuve: string;
  reserve: string;
}

const CHAMPS: { cle: keyof PropositionTuteur; etiquette: string }[] = [
  { cle: "competence", etiquette: "Compétence" },
  { cle: "niveauActuel", etiquette: "Niveau actuel" },
  { cle: "niveauPropose", etiquette: "Niveau proposé" },
  { cle: "preuve", etiquette: "Preuve" },
  { cle: "autonomieObservee", etiquette: "Autonomie observée" },
  { cle: "qualitePreuve", etiquette: "Qualité de la preuve" },
  { cle: "reserve", etiquette: "Réserve" },
];

export function extrairePropositions(texte: string): PropositionTuteur[] {
  const blocs = texte.split(/PROPOSITION DE MISE À JOUR/).slice(1);
  return blocs
    .map((bloc) => {
      const valeurs = {} as PropositionTuteur;
      for (const { cle, etiquette } of CHAMPS) {
        const m = bloc.match(new RegExp(`${etiquette}\\s*:\\s*(.+)`));
        valeurs[cle] = m?.[1]?.trim() ?? "";
      }
      return valeurs;
    })
    .filter((p) => p.competence.length > 0);
}

/* ------------------------------------------------------------------ */
/* Proposition d'exercice                                              */
/* ------------------------------------------------------------------ */

/**
 * Valeurs brutes, telles qu'écrites par le tuteur. Volontairement toutes en
 * chaînes : la validation appartient au formulaire et à `creerExercice`, pas au
 * parseur. Un champ mal rempli doit rester visible et corrigeable par
 * l'utilisateur, pas être rejeté silencieusement.
 */
export interface PropositionExercice {
  titre: string;
  domaine: string;
  type: string;
  difficulte: string;
  /** La première compétence est la cible principale (convention `Exercise`). */
  competences: string[];
  dureeEstimeeMin: string;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: string; libelle: string }[];
}

/**
 * Clé de passage du chat vers le formulaire de création, via `sessionStorage`.
 *
 * Pourquoi pas l'URL, comme pour les preuves : un énoncé et sa correction
 * dépassent vite la longueur exploitable d'une adresse, et la troncature serait
 * silencieuse. L'URL ne porte donc qu'un drapeau (`?proposition=1`) qui ouvre
 * le formulaire ; le contenu passe par la session du navigateur.
 */
export const CLE_PROPOSITION_EXERCICE = "systeme-pedagogique:proposition-exercice";

/** Étiquettes reconnues, dans l'ordre du gabarit. */
const ETIQUETTES_EXERCICE = [
  "Titre",
  "Domaine",
  "Type",
  "Difficulté",
  "Compétences",
  "Durée estimée",
  "Énoncé",
  "Indice",
  "Correction",
  "Critère",
] as const;

/** Séparateurs markdown qui terminent la capture d'un champ multiligne. */
const FIN_DE_BLOC = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * Seuls ces champs s'étendent sur plusieurs lignes.
 *
 * C'est ce qui empêche la prose qui suit le bloc — « Dis-moi si tu veux le
 * commencer. » — d'être avalée par le dernier champ rencontré. Un champ
 * mono-ligne se referme dès sa ligne lue.
 */
const CHAMPS_MULTILIGNES = new Set<string>(["Énoncé", "Correction"]);

/**
 * Découpe un bloc en champs.
 *
 * `Énoncé` et `Correction` s'étendent sur plusieurs lignes : toute ligne qui
 * ne commence pas par une étiquette connue leur est rattachée. `Indice` et
 * `Critère` sont répétables — d'où une liste par étiquette.
 */
function decouperChamps(bloc: string): Map<string, string[]> {
  const motif = new RegExp(`^\\s*(${ETIQUETTES_EXERCICE.join("|")})\\s*:\\s*(.*)$`);
  const champs = new Map<string, string[]>();
  let courante: string | null = null;

  for (const ligne of bloc.split("\n")) {
    if (FIN_DE_BLOC.test(ligne)) {
      courante = null;
      continue;
    }

    const trouve = ligne.match(motif);
    if (trouve) {
      const etiquette = trouve[1];
      const liste = champs.get(etiquette) ?? [];
      liste.push(trouve[2]);
      champs.set(etiquette, liste);
      // Un champ mono-ligne se referme aussitôt : les lignes suivantes ne lui
      // seront pas rattachées.
      courante = CHAMPS_MULTILIGNES.has(etiquette) ? etiquette : null;
      continue;
    }

    if (courante) {
      const liste = champs.get(courante)!;
      liste[liste.length - 1] = `${liste[liste.length - 1]}\n${ligne}`;
    }
  }

  return champs;
}

function premier(champs: Map<string, string[]>, etiquette: string): string {
  return (champs.get(etiquette)?.[0] ?? "").trim();
}

function tous(champs: Map<string, string[]>, etiquette: string): string[] {
  return (champs.get(etiquette) ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

/** « comprehension — Sait expliquer X » → { dimension, libelle }. */
function decouperCritere(brut: string): { dimension: string; libelle: string } {
  // `[\s\S]` plutôt que le drapeau `s` : la cible TypeScript du projet est
  // antérieure à ES2018, où ce drapeau n'existe pas.
  const separation = brut.match(/^([\s\S]*?)\s*[—–-]\s*([\s\S]*)$/);
  if (!separation) return { dimension: brut.trim().toLowerCase(), libelle: "" };
  return {
    dimension: separation[1].trim().toLowerCase(),
    libelle: separation[2].trim(),
  };
}

export function extrairePropositionsExercice(texte: string): PropositionExercice[] {
  const blocs = texte.split(/PROPOSITION D'EXERCICE/).slice(1);

  return blocs
    .map((bloc) => {
      const champs = decouperChamps(bloc);
      return {
        titre: premier(champs, "Titre"),
        domaine: premier(champs, "Domaine").toLowerCase(),
        type: premier(champs, "Type").toLowerCase(),
        difficulte: premier(champs, "Difficulté"),
        competences: premier(champs, "Compétences")
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter((c) => c.length > 0),
        dureeEstimeeMin: premier(champs, "Durée estimée").replace(/[^0-9]/g, ""),
        enonce: premier(champs, "Énoncé"),
        indices: tous(champs, "Indice"),
        correction: premier(champs, "Correction"),
        criteres: tous(champs, "Critère").map(decouperCritere),
      };
    })
    // Un titre et un énoncé sont le minimum exploitable : en dessous, la
    // proposition ne remplirait rien d'utile dans le formulaire.
    .filter((p) => p.titre.length > 0 && p.enonce.length > 0);
}
