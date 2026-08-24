/**
 * Ce qui existe déjà, avant de proposer de le créer une seconde fois.
 *
 * ## Le défaut constaté
 *
 * Le 24/08/2026, la relecture a proposé de créer « Résilience et optimisation
 * des réseaux logistiques » alors qu'un domaine « Résilience logistique »
 * existait, à trois compétences de là. Les deux contrôles du dépôt ont laissé
 * passer, et pour deux raisons différentes :
 *
 *  - `validerDomaine` compare des noms **exacts** (`slugifier`, casse mise à
 *    part). Deux formulations du même sujet ne se rencontrent jamais ;
 *  - surtout, ces contrôles jouent **à l'écriture**. La carte s'affichait, et
 *    n'aurait échoué qu'au clic — sur un nom identique, jamais voisin.
 *
 * Ce module comble le second trou : une proposition qui redit ce qui existe est
 * écartée **avant** d'atteindre l'écran.
 *
 * ## Écarter, jamais fusionner
 *
 * Rien ici ne rapproche deux choses existantes, et rien ne se réécrit. La seule
 * décision prise est « ne pas proposer », et son coût est borné : une
 * proposition non faite. C'est ce qui sépare cette règle de
 * `competenceHomonyme`, dont le rapprochement reste délibérément **exact**
 * parce qu'il commande une écriture — « Modéliser un flux » n'a pas le même
 * sens en Logistique et en Développement, et le système n'a rien pour en juger.
 * Refuser d'écrire sur une ressemblance serait un jugement ; refuser de
 * proposer n'en est pas un.
 *
 * ## Pourquoi le candidat entre dans le corpus
 *
 * `classerParProximiteTextuelle` calcule l'IDF **sur le seul corpus**. Un mot
 * du candidat absent du corpus y pèse alors zéro et disparaît du vecteur : la
 * requête se réduit à son vocabulaire partagé, et tout se met à ressembler à
 * tout — « Gestion des stocks » scorerait haut contre « Gestion de production »
 * parce que « stocks » se serait évaporé. Le candidat est donc ajouté au corpus
 * le temps du calcul, puis retiré du classement : ses mots propres comptent, et
 * ce sont eux qui font retomber le score quand le sujet diffère.
 */

import { classerParProximiteTextuelle } from "@/lib/engine/similarite-textuelle";

/**
 * Au-dessus de ce score, deux noms de domaine disent le même sujet.
 *
 * Calibré sur les cas de `doublons-proposition.test.ts`, et sur rien d'autre :
 * « Résilience logistique » contre « Résilience et optimisation des réseaux
 * logistiques » doit passer le seuil, « Gestion des stocks » contre « Gestion
 * de production » ne doit pas. Le relever écarte des propositions légitimes,
 * l'abaisser laisse revenir le doublon. Ne pas le bouger sans un cas réel.
 */
export const SEUIL_DOUBLON_DOMAINE = 0.5;

/**
 * Au-dessus de ce score, deux intitulés décrivent le même savoir-faire.
 *
 * Plus haut que celui des domaines, et c'est voulu : un intitulé de compétence
 * est une phrase, pas une étiquette. Deux savoir-faire voisins d'un même
 * domaine partagent beaucoup de vocabulaire sans se confondre — « Interpréter
 * un z-score » et « Interpréter un intervalle de confiance » sont deux
 * compétences.
 */
export const SEUIL_DOUBLON_COMPETENCE = 0.7;

/** L'identifiant réservé au candidat pendant le calcul. Jamais rendu. */
const ID_CANDIDAT = "\u0000candidat";

export interface Voisin {
  id: string;
  /** Le nom ou l'intitulé de ce qui existe déjà — il s'affiche dans un journal. */
  texte: string;
  score: number;
  motsPartages: string[];
}

interface Existant {
  id: string;
  texte: string;
}

/**
 * Ce qui, dans `existants`, dit déjà ce que `texte` propose — ou `null`.
 *
 * Le rapprochement exact passe en premier : un corpus d'un seul élément ne
 * porte aucune IDF exploitable (`log(1/1) = 0`), et le cas le plus évident ne
 * doit pas dépendre du plus subtil.
 */
export function voisinTextuel(
  texte: string,
  existants: readonly Existant[],
  seuil: number,
): Voisin | null {
  const recherche = texte.trim().toLocaleLowerCase("fr-FR");
  if (!recherche) return null;

  const exact = existants.find(
    (e) => e.texte.trim().toLocaleLowerCase("fr-FR") === recherche,
  );
  if (exact) return { id: exact.id, texte: exact.texte, score: 1, motsPartages: [] };

  const corpus = [
    ...existants.map((e) => ({ id: e.id, fragments: [e.texte] })),
    { id: ID_CANDIDAT, fragments: [texte] },
  ];
  const [proche] = classerParProximiteTextuelle([texte], corpus, {
    topK: 2,
    seuilMin: seuil,
  }).filter((p) => p.id !== ID_CANDIDAT);
  if (!proche) return null;

  const existant = existants.find((e) => e.id === proche.id);
  if (!existant) return null;
  return {
    id: existant.id,
    texte: existant.texte,
    score: proche.score,
    motsPartages: proche.motsPartages,
  };
}

/** Le domaine vivant que ce nom redirait, ou `null`. */
export function domaineVoisin(
  nom: string,
  domaines: readonly { id: string; nom: string }[],
): Voisin | null {
  return voisinTextuel(
    nom,
    domaines.map((d) => ({ id: d.id, texte: d.nom })),
    SEUIL_DOUBLON_DOMAINE,
  );
}

/** La compétence vivante que cet intitulé redirait, ou `null`. */
export function competenceVoisine(
  intitule: string,
  competences: readonly { code: string; intitule: string }[],
): Voisin | null {
  return voisinTextuel(
    intitule,
    competences.map((c) => ({ id: c.code, texte: c.intitule })),
    SEUIL_DOUBLON_COMPETENCE,
  );
}
