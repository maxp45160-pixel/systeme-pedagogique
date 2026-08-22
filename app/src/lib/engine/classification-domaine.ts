/**
 * Situer un domaine de compte sur la carte des savoirs.
 *
 * ADR-104 laissait ouverte la question : « rattacher un domaine à une
 * organisation plus globale reste un sujet de conception. Aucun arbre
 * implicite ni regroupement automatique ne doit être ajouté avant une
 * décision et des données permettant de l'évaluer. » Ce module est la
 * proposition, et il tient dans une phrase : **il propose, il ne rattache
 * pas**.
 *
 * ## Ce qui est dérivé, ce qui est déclaré
 *
 * Ce module vit en couche 3 : il calcule des candidats, à chaque lecture,
 * sans rien stocker. Le rattachement effectif, lui, est un fait **déclaré**
 * par une personne (couche 1) — c'est l'arbitrage qui le crée, pas le calcul.
 * La frontière est exactement celle de CLAUDE.md : « 1 et 2 ne se
 * recalculent pas, 3 ne se stocke pas ».
 *
 * ## Pourquoi ce classement est reproductible
 *
 * L'IDF est calculée sur la seule carte, qui est une constante versionnée
 * (`VERSION_CARTE`). Le même nom de domaine, avec les mêmes compétences,
 * produit donc toujours exactement le même classement — sur ce poste, sur un
 * autre, aujourd'hui et dans six mois. C'est la condition pour qu'un
 * rapprochement soit discutable : un classement qui change tout seul ne se
 * conteste pas.
 *
 * ## Ce que le module refuse
 *
 * - **Rattacher sous le seuil.** En dessous, il ne rend rien. Une proposition
 *   fausse coûte plus qu'une absence de proposition : elle place un domaine
 *   sous une région erronée et donne à cette erreur l'autorité d'un calcul
 *   (invariant 6, et « ne jamais fabriquer une valeur à partir d'une donnée
 *   invalide »).
 * - **Trancher une ambiguïté.** Quand les deux premiers candidats sont au
 *   coude à coude, les deux sont rendus, marqués comme tels. C'est à la
 *   personne de choisir, pas au module de tirer au sort.
 * - **Écrire quoi que ce soit.** Aucun chemin d'écriture ne part d'ici.
 */

import {
  RACINE_CARTE,
  VERSION_CARTE,
  cheminCarte,
  noeudCarte,
  noeudsRattachables,
} from "@/lib/domain/carte-savoirs";
import {
  classerParProximiteTextuelle,
  type DocumentTexte,
} from "./similarite-textuelle";

/**
 * En deçà, aucune proposition n'est faite.
 *
 * Ce n'est pas un seuil de calibration au sens du protocole d'évaluation : il
 * ne pondère aucune mesure et n'entre dans aucun niveau. Il règle le silence
 * d'une suggestion — se tromper coûte un refus d'un clic, ne rien proposer
 * coûte un choix manuel dans une liste de quarante-cinq entrées.
 */
export const SEUIL_PROPOSITION = 0.12;

/**
 * En deçà de cet écart relatif entre les deux premiers candidats, la
 * proposition est déclarée ambiguë et les deux sont montrés.
 */
export const ECART_DECISIF = 0.15;

/** Combien de candidats au maximum. Au-delà, ce n'est plus une proposition. */
export const NOMBRE_CANDIDATS = 3;

export type OrigineRattachement = "lexical" | "tuteur" | "manuel";

/**
 * Pourquoi ce candidat est proposé.
 *
 * Volontairement PAS le type `Explication` du domaine : celui-ci porte un
 * `nombreObservations`, et une classification ne repose sur aucune
 * observation. Le remplir à zéro dirait « zéro preuve » là où la vérité est
 * « la question ne se pose pas » — c'est l'invariant 3 pris à l'envers.
 */
export interface JustificationRattachement {
  resume: string;
  facteurs: Array<{ libelle: string; valeur: string }>;
}

export interface CandidatRattachement {
  /** Identifiant du nœud de carte — c'est lui qui serait enregistré. */
  noeud: string;
  /** « Savoirs humains › Créations humaines › Mathématiques ». */
  chemin: string;
  score: number;
  /** Vrai quand ce candidat et le suivant sont au coude à coude. */
  ambigu: boolean;
  explication: JustificationRattachement;
}

export interface PropositionClassification {
  domaineId: string;
  /** La version de carte sur laquelle porte ce classement. */
  versionCarte: string;
  origine: OrigineRattachement;
  /** Vide quand rien n'atteint le seuil — un résultat, pas un échec. */
  candidats: CandidatRattachement[];
}

export interface EntreeClassification {
  domaineId: string;
  nom: string;
  description?: string;
  /** Intitulés des compétences du domaine — le vocabulaire qui le décrit vraiment. */
  intitules?: string[];
}

/* ------------------------------------------------------------------ */
/* Corpus de référence — dérivé de la carte, jamais du compte          */
/* ------------------------------------------------------------------ */

function corpusCarte(): DocumentTexte[] {
  return noeudsRattachables().map((noeud) => ({
    id: noeud.id,
    fragments: [noeud.nom, ...noeud.motsCles],
  }));
}

/* ------------------------------------------------------------------ */
/* Proposition                                                         */
/* ------------------------------------------------------------------ */

export function proposerClassification(
  entree: EntreeClassification,
  options: { seuil?: number; nombreCandidats?: number } = {},
): PropositionClassification {
  const { seuil = SEUIL_PROPOSITION, nombreCandidats = NOMBRE_CANDIDATS } = options;

  const fragments = [
    entree.nom,
    entree.description ?? "",
    ...(entree.intitules ?? []),
  ].filter((fragment) => fragment.trim().length > 0);

  const classement = classerParProximiteTextuelle(fragments, corpusCarte(), {
    topK: nombreCandidats,
    seuilMin: seuil,
  });

  const meilleur = classement[0]?.score ?? 0;

  const candidats: CandidatRattachement[] = classement.map((proximite, rang) => {
    const suivant = classement[rang + 1];
    const ambigu =
      rang === 0 &&
      suivant !== undefined &&
      meilleur > 0 &&
      (meilleur - suivant.score) / meilleur < ECART_DECISIF;

    return {
      noeud: proximite.id,
      chemin: libelleChemin(proximite.id),
      score: proximite.score,
      ambigu,
      explication: {
        resume: ambigu
          ? "Deux régions sont au coude à coude sur ce vocabulaire : le choix vous revient."
          : `Vocabulaire partagé avec « ${noeudCarte(proximite.id)?.nom ?? proximite.id} ».`,
        facteurs: [
          {
            libelle: "Mots partagés",
            valeur:
              proximite.motsPartages.length > 0
                ? proximite.motsPartages.slice(0, 6).join(", ")
                : "aucun mot distinctif — le rapprochement tient au reste du vocabulaire",
          },
          {
            libelle: "Proximité mesurée",
            valeur: `${proximite.score.toFixed(2)} (seuil de proposition : ${seuil})`,
          },
          {
            libelle: "Version de carte",
            valeur: VERSION_CARTE,
          },
        ],
      },
    };
  });

  return {
    domaineId: entree.domaineId,
    versionCarte: VERSION_CARTE,
    origine: "lexical",
    candidats,
  };
}

/**
 * Le libellé d'un chemin de carte, racine comprise.
 *
 * La racine y figure : « Créations humaines › Mathématiques » sans elle se
 * lirait comme une hiérarchie du compte, alors que c'est une position dans un
 * référentiel partagé.
 */
export function libelleChemin(noeudId: string): string {
  const chemin = cheminCarte(noeudId);
  if (chemin.length === 0) return noeudId;
  return chemin.map((noeud) => noeud.nom).join(" › ");
}

/* ------------------------------------------------------------------ */
/* Garde-fou du tuteur                                                 */
/* ------------------------------------------------------------------ */

/**
 * L'énumération fermée que le serveur fournit au tuteur.
 *
 * Même garde-fou que pour les codes de compétence : « les codes proposés par
 * le tuteur doivent venir d'un `enum` fourni par le serveur ». Le tuteur ne
 * nomme jamais une région de la carte de sa propre initiative — il choisit
 * dans cette liste, ou il ne propose rien.
 */
export function enumNoeudsCarte(): string[] {
  return noeudsRattachables().map((noeud) => noeud.id);
}

/**
 * Valide un identifiant venu de l'extérieur — tuteur, formulaire, import.
 *
 * La racine est refusée : rattacher un domaine à « Savoirs humains » ne le
 * situe nulle part et donnerait l'apparence d'un classement là où il n'y en a
 * pas.
 */
export function estNoeudCarteValide(id: unknown): id is string {
  return typeof id === "string" && id !== RACINE_CARTE && noeudCarte(id) !== undefined;
}
