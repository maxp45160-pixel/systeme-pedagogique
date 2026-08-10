/**
 * Micro-embedding par sac de mots — similarité cosinus entre domaines.
 *
 * Le problème : deux domaines sémantiquement proches (« Développement
 * logiciel » et « Cybersécurité ») n'ont pas forcément de lien de prérequis
 * croisé ni de thème commun. Le graphe les place donc à distance égale de
 * tout le reste, ce qui est faux.
 *
 * La solution : on construit un vecteur de fréquences de mots pour chaque
 * domaine à partir de son nom, sa description et les intitulés de ses
 * compétences. La similarité cosinus entre ces vecteurs donne un score 0–1
 * qui sert de poids d'attraction dans le moteur de forces.
 *
 * Pas de dépendance externe, pas de modèle, pas d'appel réseau. C'est un
 * calcul pur sur du texte français, exécuté côté serveur à la construction
 * du graphe.
 */

/* ------------------------------------------------------------------ */
/* Mots vides français — les plus fréquents, suffisants pour filtrer   */
/* le bruit sans librairie NLP                                         */
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

/* ------------------------------------------------------------------ */
/* Tokenisation                                                        */
/* ------------------------------------------------------------------ */

/**
 * Découpe un texte en mots significatifs : minuscules, accents conservés,
 * mots vides retirés, mots de moins de 3 caractères ignorés.
 */
function tokeniser(texte: string): string[] {
  return texte
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((m) => m.replace(/^['-]+|['-]+$/g, "")) // trim hyphens/apostrophes
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

/* ------------------------------------------------------------------ */
/* Vecteur de fréquences                                               */
/* ------------------------------------------------------------------ */

type Vecteur = Map<string, number>;

function construireVecteur(textes: string[]): Vecteur {
  const freq: Vecteur = new Map();
  for (const texte of textes) {
    for (const mot of tokeniser(texte)) {
      freq.set(mot, (freq.get(mot) ?? 0) + 1);
    }
  }
  return freq;
}

/* ------------------------------------------------------------------ */
/* Similarité cosinus                                                  */
/* ------------------------------------------------------------------ */

function similariteCosinus(a: Vecteur, b: Vecteur): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [mot, fa] of a) {
    normA += fa * fa;
    const fb = b.get(mot);
    if (fb !== undefined) dot += fa * fb;
  }
  for (const [, fb] of b) {
    normB += fb * fb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

export interface CorpusDomaine {
  id: string;
  nom: string;
  description: string;
  /** Intitulés des compétences du domaine. */
  intitules: string[];
}

export interface SimilariteDomaine {
  domaineA: string;
  domaineB: string;
  /** Similarité cosinus, 0 = rien en commun, 1 = identique. */
  score: number;
}

/**
 * Calcule la similarité cosinus et renvoie les Top-K plus proches voisins
 * pour chaque domaine (par défaut K=2, seuil min 0.05).
 *
 * Cela garantit que chaque domaine a au moins 1-2 connexions sémantiques
 * pertinentes dans le graphe, sans créer Toile d'araignée.
 */
export function calculerSimilarites(
  domaines: CorpusDomaine[],
  topK = 2,
  seuilMin = 0.05,
): SimilariteDomaine[] {
  const vecteurs = domaines.map((d) => ({
    id: d.id,
    vecteur: construireVecteur([
      d.nom, d.nom, d.nom,
      d.description,
      ...d.intitules,
    ]),
  }));

  const resultats: SimilariteDomaine[] = [];
  const areteSet = new Set<string>();

  for (let i = 0; i < vecteurs.length; i++) {
    const vA = vecteurs[i];
    const scores: { id: string; score: number }[] = [];

    for (let j = 0; j < vecteurs.length; j++) {
      if (i === j) continue;
      const vB = vecteurs[j];
      const score = similariteCosinus(vA.vecteur, vB.vecteur);
      if (score >= seuilMin) {
        scores.push({ id: vB.id, score });
      }
    }

    // Sort descending by similarity
    scores.sort((a, b) => b.score - a.score);

    // Keep top K neighbors for domain A
    const top = scores.slice(0, topK);
    for (const item of top) {
      const [a, b] = [vA.id, item.id].sort();
      const cle = `${a}:${b}`;
      if (!areteSet.has(cle)) {
        areteSet.add(cle);
        resultats.push({
          domaineA: a,
          domaineB: b,
          score: item.score,
        });
      }
    }
  }

  return resultats;
}
