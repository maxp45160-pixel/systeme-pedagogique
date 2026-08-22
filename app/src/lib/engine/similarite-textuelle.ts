/**
 * Similarité de vocabulaire entre compétences — TF-IDF + cosinus + top-K mutuel.
 *
 * Remplace `lib/ui/micro-embedding.ts` (chantier graphe, ADR-056). Ce que
 * l'ancien module faisait mal :
 *
 *  - fréquences BRUTES, sans IDF : un mot présent partout (« compétence »,
 *    « exercice ») pèse autant qu'un mot rare et distinctif ;
 *  - pas de normalisation par longueur de texte ;
 *  - le nom du domaine tripé en dur comme pondération (`[nom, nom, nom, ...]`) ;
 *  - un seul niveau, le domaine — deux domaines entiers étaient déclarés
 *    « proches » sur la foi de quelques intitulés.
 *
 * Ce module travaille au niveau **compétence** et retient les paires en
 * top-K **mutuel** (A dans le top-K de B ET B dans le top-K de A) : c'est la
 * règle standard d'un graphe de plus-proches-voisins, elle évite qu'un hub
 * générique se retrouve relié à tout le monde.
 *
 * Toujours zéro dépendance externe, calcul pur et déterministe, testable.
 */

/* ------------------------------------------------------------------ */
/* Mots vides français — reprise de micro-embedding.ts (ADR-056)       */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set([
  // Articles
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d",
  // Prépositions
  "à", "a", "au", "aux", "en", "dans", "par", "pour", "sur", "avec",
  "sans", "sous", "entre", "vers", "chez",
  // Conjonctions
  "et", "ou", "mais", "ni", "car", "donc", "que", "qu",
  // Pronoms
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "te", "se", "ce", "qui", "dont",
  // Verbes auxiliaires / très communs
  "est", "sont", "être", "avoir", "fait", "faire", "peut", "doit",
  "sa", "son", "ses", "leur", "leurs", "cette", "ces", "cet",
  // Divers
  "ne", "pas", "plus", "moins", "très", "bien", "tout", "tous",
  "toute", "toutes", "autre", "autres", "même", "aussi",
  "si", "y", "ci", "là",
  // Ponctuation résiduelle
  "—", "–", "…",
]);

/**
 * Normalisation de pluriel — le minimum qui serve, et rien de plus.
 *
 * Sans elle, « statistiques » et « statistique » sont deux mots sans rapport,
 * et un domaine nommé « Statistiques et probabilités » ne rejoint pas les
 * mathématiques dont c'est pourtant le vocabulaire déclaré. Un racinisateur
 * français complet (Snowball) trancherait bien plus large et confondrait des
 * mots distincts ; on s'arrête au « s » et au « x » finals, sur les mots d'au
 * moins cinq lettres, jamais après un « s » déjà double.
 *
 * La règle s'applique des deux côtés de la comparaison : elle ne peut donc pas
 * créer d'appariement asymétrique.
 */
function normaliserPluriel(mot: string): string {
  if (mot.length < 5) return mot;
  if (mot.endsWith("ss")) return mot;
  return mot.endsWith("s") || mot.endsWith("x") ? mot.slice(0, -1) : mot;
}

function tokeniser(texte: string): string[] {
  return texte
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((m) => m.replace(/^['-]+|['-]+$/g, ""))
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m))
    .map(normaliserPluriel);
}

/* ------------------------------------------------------------------ */
/* TF-IDF                                                              */
/* ------------------------------------------------------------------ */

type Vecteur = Map<string, number>;

/**
 * Vecteur TF-IDF normalisé L2 pour un document, étant donné l'IDF global du
 * corpus. La normalisation L2 est ce qui empêche un intitulé long de dominer
 * un intitulé court par pur effet de longueur.
 */
function construireVecteurTfIdf(mots: string[], idf: Map<string, number>): Vecteur {
  const tf: Vecteur = new Map();
  for (const mot of mots) tf.set(mot, (tf.get(mot) ?? 0) + 1);

  const vecteur: Vecteur = new Map();
  for (const [mot, freq] of tf) {
    const poidsIdf = idf.get(mot) ?? 0;
    if (poidsIdf > 0) vecteur.set(mot, freq * poidsIdf);
  }

  let norme = 0;
  for (const v of vecteur.values()) norme += v * v;
  norme = Math.sqrt(norme);
  if (norme === 0) return vecteur;
  for (const [mot, v] of vecteur) vecteur.set(mot, v / norme);
  return vecteur;
}

function similariteCosinus(a: Vecteur, b: Vecteur): number {
  let dot = 0;
  const [petit, grand] = a.size <= b.size ? [a, b] : [b, a];
  for (const [mot, va] of petit) {
    const vb = grand.get(mot);
    if (vb !== undefined) dot += va * vb;
  }
  return dot;
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

export interface DocumentTexte {
  id: string;
  /** Fragments de texte concaténés — intitulé, palier, nom de domaine, etc. */
  fragments: string[];
}

export interface SimilariteTextuelle {
  a: string;
  b: string;
  /** Similarité cosinus, 0 = aucun mot en commun, 1 = vecteurs identiques. */
  score: number;
}

/**
 * Similarités top-K **mutuelles** entre documents (ici, des compétences).
 *
 * Une paire {A, B} n'est retenue que si B figure dans le top-K de A ET A dans
 * le top-K de B : c'est ce qui empêche un document au vocabulaire générique
 * de se retrouver « proche » de la moitié du corpus.
 */
export function calculerSimilaritesTextuelles(
  documents: DocumentTexte[],
  topK = 3,
  seuilMin = 0.1,
): SimilariteTextuelle[] {
  const motsParDoc = documents.map((d) => tokeniser(d.fragments.join(" ")));

  // IDF global : log(N / nombre de documents contenant le mot).
  const dfParMot = new Map<string, number>();
  for (const mots of motsParDoc) {
    for (const mot of new Set(mots)) {
      dfParMot.set(mot, (dfParMot.get(mot) ?? 0) + 1);
    }
  }
  const n = documents.length;
  const idf = new Map<string, number>();
  for (const [mot, df] of dfParMot) idf.set(mot, Math.log(n / df));

  const vecteurs = documents.map((d, i) => ({
    id: d.id,
    vecteur: construireVecteurTfIdf(motsParDoc[i], idf),
  }));

  // Top-K par document, au-dessus du seuil.
  const topParDoc = new Map<string, { id: string; score: number }[]>();
  for (let i = 0; i < vecteurs.length; i++) {
    const scores: { id: string; score: number }[] = [];
    for (let j = 0; j < vecteurs.length; j++) {
      if (i === j) continue;
      const score = similariteCosinus(vecteurs[i].vecteur, vecteurs[j].vecteur);
      if (score >= seuilMin) scores.push({ id: vecteurs[j].id, score });
    }
    scores.sort((a, b) => b.score - a.score);
    topParDoc.set(vecteurs[i].id, scores.slice(0, topK));
  }

  // Mutualité : ne garder {A, B} que si chacun apparaît dans le top-K de l'autre.
  const resultats: SimilariteTextuelle[] = [];
  const vus = new Set<string>();
  for (const [idA, voisinsA] of topParDoc) {
    for (const { id: idB, score } of voisinsA) {
      const voisinsB = topParDoc.get(idB) ?? [];
      const estMutuel = voisinsB.some((v) => v.id === idA);
      if (!estMutuel) continue;
      const [a, b] = idA < idB ? [idA, idB] : [idB, idA];
      const cle = `${a}:${b}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      resultats.push({ a, b, score });
    }
  }

  return resultats;
}


/* ------------------------------------------------------------------ */
/* Classement dirigé — un texte contre un corpus de référence fixe     */
/* ------------------------------------------------------------------ */

export interface ProximiteTextuelle {
  id: string;
  /** Similarité cosinus, 0 = aucun mot en commun, 1 = vecteurs identiques. */
  score: number;
  /** Les mots qui portent le score, du plus contributif au moins. */
  motsPartages: string[];
}

/**
 * Classe un texte contre un corpus de référence, du plus proche au moins.
 *
 * Deux différences avec `calculerSimilaritesTextuelles`, et elles comptent :
 *
 *  - le classement est **dirigé** : la requête n'entre pas dans le corpus et
 *    n'a pas à figurer dans le top-K de qui que ce soit. Il n'y a pas de
 *    relation à établir, seulement un ordre à rendre ;
 *  - l'IDF est calculée **sur le seul corpus**, jamais sur la requête. Quand
 *    le corpus est fixe (la carte des savoirs), le même texte reçoit donc
 *    toujours exactement le même classement, quel que soit le compte qui
 *    interroge et quel que soit le moment. C'est ce qui rend une
 *    classification reproductible, et donc discutable.
 *
 * Les `motsPartages` accompagnent chaque score parce qu'un rapprochement sans
 * justification n'est pas présentable à une personne qui doit l'arbitrer.
 */
export function classerParProximiteTextuelle(
  fragmentsRequete: string[],
  corpus: DocumentTexte[],
  options: { topK?: number; seuilMin?: number } = {},
): ProximiteTextuelle[] {
  const { topK = 3, seuilMin = 0.1 } = options;
  if (corpus.length === 0) return [];

  const motsParDoc = corpus.map((d) => tokeniser(d.fragments.join(" ")));

  const dfParMot = new Map<string, number>();
  for (const mots of motsParDoc) {
    for (const mot of new Set(mots)) {
      dfParMot.set(mot, (dfParMot.get(mot) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [mot, df] of dfParMot) idf.set(mot, Math.log(corpus.length / df));

  const vecteurRequete = construireVecteurTfIdf(tokeniser(fragmentsRequete.join(" ")), idf);
  if (vecteurRequete.size === 0) return [];

  const resultats: ProximiteTextuelle[] = [];
  for (let i = 0; i < corpus.length; i++) {
    const vecteur = construireVecteurTfIdf(motsParDoc[i], idf);
    const score = similariteCosinus(vecteurRequete, vecteur);
    if (score < seuilMin) continue;
    const contributions: Array<{ mot: string; part: number }> = [];
    for (const [mot, poids] of vecteurRequete) {
      const autre = vecteur.get(mot);
      if (autre !== undefined) contributions.push({ mot, part: poids * autre });
    }
    contributions.sort((a, b) => b.part - a.part || a.mot.localeCompare(b.mot));
    resultats.push({
      id: corpus[i].id,
      score,
      motsPartages: contributions.map((c) => c.mot),
    });
  }

  resultats.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return resultats.slice(0, topK);
}
