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

/**
 * Marqueurs des deux gabarits.
 *
 * Constantes partagées, et non chaînes recopiées : le prompt (`contexte.ts`)
 * et les parseurs ci-dessous doivent employer exactement le même texte. Une
 * désynchronisation ne lèverait aucune erreur — le message resterait lisible
 * dans le chat et l'extraction cesserait simplement de fonctionner, sans
 * bruit. C'est le maillon « génération » de la boucle : il ne doit pas pouvoir
 * tomber en silence.
 */
export const MARQUEUR_PREUVE = "PROPOSITION DE MISE À JOUR";
export const MARQUEUR_EXERCICE = "PROPOSITION D'EXERCICE";
export const MARQUEUR_REFERENTIEL = "PROPOSITION DE RÉFÉRENTIEL";

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

/* ------------------------------------------------------------------ */
/* Lecture d'une ligne « Étiquette : valeur »                          */
/*                                                                     */
/* Le gabarit demande une étiquette nue. Les modèles la mettent en     */
/* gras — observé sur mistral-large-2512, qui écrit systématiquement   */
/* `**Titre** : …`, et parfois `**Titre :**`. Une correspondance       */
/* littérale échouait alors sur TOUS les champs : la proposition       */
/* perdait son titre, se faisait rejeter, et aucun bouton n'était      */
/* proposé. C'est exactement la panne silencieuse que ce module existe */
/* pour empêcher.                                                      */
/*                                                                     */
/* On tolère donc le balisage autour de l'étiquette, sans rien relâcher */
/* d'autre : le préfixe, une fois débarrassé de son emphase, doit être */
/* l'étiquette ENTIÈRE (une numérotation « Indice 2 » admise), sans    */
/* quoi la ligne n'est pas un champ.                                   */
/* ------------------------------------------------------------------ */

/** Caractères d'emphase markdown susceptibles d'entourer une étiquette. */
const EMPHASE = /[*_~`]/g;

/**
 * Retire une paire d'emphase enveloppant une valeur — `*application*` →
 * `application`. N'est appliqué qu'aux champs d'une seule ligne : sur un
 * énoncé ou une correction, le markdown intérieur doit rester intact.
 */
function sansEmphaseEnveloppante(valeur: string): string {
  const m = valeur.match(/^(\*\*|__|\*|_)([\s\S]+)\1$/);
  return m ? m[2].trim() : valeur;
}

/**
 * Sépare `ligne` en `{ etiquette, valeur }` si elle porte l'une des
 * `etiquettes` attendues, `null` sinon.
 */
function lireChamp(
  ligne: string,
  etiquettes: readonly string[],
): { etiquette: string; valeur: string } | null {
  const coupure = ligne.indexOf(":");
  if (coupure === -1) return null;

  const prefixe = ligne.slice(0, coupure).replace(EMPHASE, "").trim();
  const motif = new RegExp(`^(${etiquettes.join("|")})(?:\\s+\\d+)?$`);
  const trouve = prefixe.match(motif);
  if (!trouve) return null;

  // `**Titre :**` laisse une emphase fermante orpheline en tête de valeur.
  // Le `(?=\s|$)` la distingue d'une valeur qui commence légitimement par
  // du gras, comme « **Attention** : … » dans un énoncé.
  const valeur = ligne
    .slice(coupure + 1)
    .trim()
    .replace(/^(\*\*|__|\*|_)(?=\s|$)/, "")
    .trim();

  return { etiquette: trouve[1], valeur };
}

const ETIQUETTES_PREUVE = CHAMPS.map((c) => c.etiquette);

export function extrairePropositions(texte: string): PropositionTuteur[] {
  const blocs = texte.split(MARQUEUR_PREUVE).slice(1);
  return blocs
    .map((bloc) => {
      const lus = new Map<string, string>();
      for (const ligne of bloc.split("\n")) {
        const champ = lireChamp(ligne, ETIQUETTES_PREUVE);
        // Première occurrence seulement : le bloc décrit une proposition, la
        // prose qui suit ne doit pas écraser ses champs.
        if (champ && !lus.has(champ.etiquette)) lus.set(champ.etiquette, champ.valeur);
      }

      const valeurs = {} as PropositionTuteur;
      for (const { cle, etiquette } of CHAMPS) {
        valeurs[cle] = sansEmphaseEnveloppante(lus.get(etiquette) ?? "");
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
function decouperChamps(
  bloc: string,
  etiquettes: readonly string[] = ETIQUETTES_EXERCICE,
  multilignes: ReadonlySet<string> = CHAMPS_MULTILIGNES,
): Map<string, string[]> {
  const champs = new Map<string, string[]>();
  let courante: string | null = null;
  /* Un champ mono-ligne ouvert faute de valeur sur sa propre ligne se referme
   * à la première ligne vide — sans quoi la prose finale du tuteur, « Dis-moi
   * si tu veux commencer. », serait avalée par le dernier indice. */
  let fermeSurLigneVide = false;

  for (const ligne of bloc.split("\n")) {
    if (FIN_DE_BLOC.test(ligne)) {
      courante = null;
      continue;
    }

    const trouve = lireChamp(ligne, etiquettes);
    if (trouve) {
      const etiquette = trouve.etiquette;
      const liste = champs.get(etiquette) ?? [];
      liste.push(trouve.valeur);
      champs.set(etiquette, liste);

      if (multilignes.has(etiquette)) {
        courante = etiquette;
        fermeSurLigneVide = false;
      } else if (trouve.valeur === "") {
        // `**Indice** :` seul sur sa ligne, contenu en dessous — la forme que
        // produit spontanément mistral-large. Sans cette reprise, l'indice
        // était perdu, et avec lui la mesure de l'autonomie qui en dépend.
        courante = etiquette;
        fermeSurLigneVide = true;
      } else {
        courante = null;
      }
      continue;
    }

    if (!courante) continue;

    if (fermeSurLigneVide && ligne.trim() === "") {
      courante = null;
      continue;
    }

    const liste = champs.get(courante)!;
    const dejaVide = liste[liste.length - 1] === "";
    liste[liste.length - 1] = dejaVide
      ? ligne
      : `${liste[liste.length - 1]}\n${ligne}`;
  }

  return champs;
}

function premier(champs: Map<string, string[]>, etiquette: string): string {
  return (champs.get(etiquette)?.[0] ?? "").trim();
}

/** Comme `premier`, en retirant l'emphase qui enveloppe la valeur entière. */
function premierNet(champs: Map<string, string[]>, etiquette: string): string {
  return sansEmphaseEnveloppante(premier(champs, etiquette));
}

function tous(champs: Map<string, string[]>, etiquette: string): string[] {
  return (champs.get(etiquette) ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
}

function nettoyerDimension(brut: string): string {
  return brut.replace(EMPHASE, "").trim().toLowerCase();
}

/** « comprehension — Sait expliquer X » → { dimension, libelle }. */
function decouperCritere(brut: string): { dimension: string; libelle: string } {
  // `[\s\S]` plutôt que le drapeau `s` : la cible TypeScript du projet est
  // antérieure à ES2018, où ce drapeau n'existe pas.
  const separation = brut.match(/^([\s\S]*?)\s*[—–-]\s*([\s\S]*)$/);
  // La dimension doit rester comparable au référentiel : le tuteur l'écrit
  // souvent en italique (`*application*`), et « application » n'est pas
  // « *application* » pour le formulaire qui la relit.
  if (!separation) {
    return { dimension: nettoyerDimension(brut), libelle: "" };
  }
  return {
    dimension: nettoyerDimension(separation[1]),
    libelle: sansEmphaseEnveloppante(separation[2].trim()),
  };
}

export function extrairePropositionsExercice(texte: string): PropositionExercice[] {
  const blocs = texte.split(MARQUEUR_EXERCICE).slice(1);

  return blocs
    .map((bloc) => {
      const champs = decouperChamps(bloc);
      return {
        titre: premierNet(champs, "Titre"),
        domaine: premierNet(champs, "Domaine").toLowerCase(),
        type: premierNet(champs, "Type").toLowerCase(),
        difficulte: premierNet(champs, "Difficulté"),
        competences: premierNet(champs, "Compétences")
          .split(",")
          .map((c) => c.trim().replace(EMPHASE, "").toUpperCase())
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

/**
 * Ce qu'un exercice exige, indépendamment de la forme de ses champs.
 *
 * Signature structurelle volontaire : la proposition brute porte des chaînes,
 * le formulaire porte des valeurs typées, et les deux doivent répondre à la
 * même question — « y a-t-il là de quoi faire un exercice ? ». Une seule
 * définition, appelée des deux côtés de la frontière.
 */
export interface ExerciceEsquisse {
  titre: string;
  enonce: string;
  correction: string;
  competences: string[];
  criteres: { libelle: string }[];
}

/**
 * L'esquisse porte-t-elle tout ce qu'un exercice exige ?
 *
 * À distinguer du filtre d'`extrairePropositionsExercice` ci-dessus, qui ne
 * retient que le minimum *affichable*. Ici on répond à une autre question :
 * peut-on en faire un exercice ?
 *
 * La distinction n'est pas théorique. Les champs arrivent dans l'ordre du
 * gabarit, et `Correction` puis `Critère` viennent en dernier : pendant le
 * flux, une proposition satisfait `titre + enonce` bien avant d'être entière.
 * Sans ce prédicat, l'interface offrait un bouton sur un bloc encore en cours
 * de rédaction, et le clic déposait un exercice tronqué que le formulaire
 * acceptait à moitié.
 *
 * Un critère dont le libellé est vide ne compte pas : la création le filtre de
 * toute façon (`creerExercice`), et un exercice sans aucun critère retenu ne
 * mesurerait plus rien.
 */
export function exerciceComplet(x: ExerciceEsquisse): boolean {
  return (
    x.titre.trim().length > 0 &&
    x.enonce.trim().length > 0 &&
    x.correction.trim().length > 0 &&
    x.competences.length > 0 &&
    x.criteres.some((c) => c.libelle.trim().length > 0)
  );
}

/* ------------------------------------------------------------------ */
/* Proposition de référentiel (ADR-026)                                */
/* ------------------------------------------------------------------ */

/**
 * Une branche proposée : un domaine — existant ou neuf — et les compétences à
 * y ajouter.
 *
 * Comme pour l'exercice, tout est en chaînes brutes : la normalisation
 * appartient à `lib/domain/referentiel-validation.ts` et la décision à
 * l'utilisateur. Un champ mal rempli doit rester visible et corrigeable, pas
 * être rejeté en silence.
 *
 * **Aucun code de compétence n'est lu ici**, et c'est délibéré : le gabarit
 * interdit au tuteur d'en écrire. Un code est la clé étrangère des preuves ;
 * l'application les attribue à partir du préfixe du domaine.
 */
export interface PropositionReferentiel {
  domaine: string;
  prefixe: string;
  description: string;
  /** Une entrée par ligne « Compétence : <palier> | <importance> | <intitulé> ». */
  competences: { palier: string; importance: string; intitule: string }[];
  justification: string;
}

/**
 * Clé de passage du chat vers l'écran de validation du référentiel.
 *
 * Comme pour l'exercice, et pour la même raison : une branche de huit
 * compétences dépasse la longueur exploitable d'une adresse, et la troncature
 * serait silencieuse.
 */
export const CLE_PROPOSITION_REFERENTIEL = "systeme-pedagogique:proposition-referentiel";

const ETIQUETTES_REFERENTIEL = [
  "Domaine",
  "Préfixe",
  "Description",
  "Compétence",
  "Justification",
] as const;

/** Aucun champ ne s'étend sur plusieurs lignes dans ce gabarit. */
const MULTILIGNES_REFERENTIEL: ReadonlySet<string> = new Set<string>();

/**
 * « fondamentaux | 0.8 | Sait reconstruire un argument » → les trois parties.
 *
 * Séparateur `|` plutôt que `—` : le tiret cadratin apparaît naturellement dans
 * un intitulé de compétence, la barre verticale non.
 */
function decouperCompetence(brut: string): {
  palier: string;
  importance: string;
  intitule: string;
} {
  const parts = brut.split("|").map((p) => sansEmphaseEnveloppante(p.trim()));
  if (parts.length < 3) {
    // Gabarit non respecté : on garde tout comme intitulé plutôt que de perdre
    // la compétence. L'écran de validation montrera les champs manquants.
    return { palier: "", importance: "", intitule: sansEmphaseEnveloppante(brut.trim()) };
  }
  return {
    palier: parts[0].replace(EMPHASE, "").toLowerCase(),
    importance: parts[1].replace(EMPHASE, ""),
    // L'intitulé peut légitimement contenir une barre : on ne recolle que le
    // reste, sans le tronquer à la troisième part.
    intitule: parts.slice(2).join(" | ").trim(),
  };
}

export function extrairePropositionsReferentiel(texte: string): PropositionReferentiel[] {
  const blocs = texte.split(MARQUEUR_REFERENTIEL).slice(1);

  return blocs
    .map((bloc) => {
      const champs = decouperChamps(bloc, ETIQUETTES_REFERENTIEL, MULTILIGNES_REFERENTIEL);
      return {
        domaine: premierNet(champs, "Domaine"),
        prefixe: premierNet(champs, "Préfixe").replace(EMPHASE, "").toUpperCase(),
        description: premierNet(champs, "Description"),
        competences: tous(champs, "Compétence").map(decouperCompetence),
        justification: premierNet(champs, "Justification"),
      };
    })
    // Un domaine et au moins une compétence : en dessous, il n'y a rien à
    // valider. Une branche vide ne se distinguerait pas d'un faux positif.
    .filter((p) => p.domaine.length > 0 && p.competences.length > 0);
}
