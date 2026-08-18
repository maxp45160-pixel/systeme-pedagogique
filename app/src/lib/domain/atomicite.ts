/**
 * L'atomicité d'une compétence, tenue par le code — ADR-086.
 *
 * ## Le protocole disait déjà tout, et rien ne l'appliquait
 *
 * `app/data/00_instructions/00_SYSTEME_PROTOCOLE_REFERENTIEL.txt` §2 pose cinq
 * conditions nécessaires : savoir-faire observable, notable, testable en deux
 * contextes, exerçable, et **prouvable en 20 à 60 minutes**. C'est une consigne
 * en prose, adressée à un modèle. `validerCompetence` ne vérifiait, elle, que
 * la longueur (10 à 200 caractères), le palier, l'importance et l'homonymie
 * exacte.
 *
 * Relevé en base le 18/08/2026, sur les 115 compétences du compte :
 *
 * | Défaut | Compétences |
 * | --- | --- |
 * | Intitulé de plus de 90 caractères | 47 |
 * | Deux verbes d'action coordonnés | 28 |
 * | Énumération parenthésée de 3 éléments ou plus | 27 |
 * | Verbe non observable en tête | 3 |
 * | **Au moins un des quatre** | **67 (58 %)** |
 *
 * Le cas qui résume tout — LOG-01, 192 caractères, et la compétence la **mieux
 * mesurée** du système avec cinq preuves :
 *
 * > « Modéliser **et** résoudre un problème de gestion de stock à demande
 * > déterministe **ou** variable (quantité économique**,** point de commande**,**
 * > stock de sécurité) **et** évaluer l'impact des paramètres choisis. »
 *
 * Trois verbes, cinq objets. Son « niveau 3 » est une moyenne sur cinq
 * savoir-faire distincts : la personne peut être excellente sur la quantité
 * économique et nulle sur le stock de sécurité, le système affiche un seul
 * nombre et ne peut rien recommander de précis.
 *
 * ## Principe : le prompt demande, le validateur impose
 *
 * Une consigne en prose est respectée « la plupart du temps ». Ce module est la
 * moitié qui ne se contourne pas. La seconde moitié est le schéma d'outil, qui
 * empêche d'écrire trois verbes dans un champ qui n'en accepte qu'un.
 *
 * ## Ce que ces règles ne font pas
 *
 * Elles sont des heuristiques de **forme**. Une compétence peut être courte,
 * mono-verbe, et trop large quand même. Le seul test d'atomicité qui ne soit
 * pas du style est une **mesure** — durées de tentative systématiquement
 * au-delà de 60 minutes, ou dimensions divergentes selon la famille de
 * situation — et il vit dans `lib/engine/candidats-referentiel.ts`.
 */

/**
 * Longueur maximale d'un intitulé atomique.
 *
 * 90, contre 200 auparavant. L'ancienne borne était calibrée **deux fois
 * au-dessus** de la moyenne observée (97 caractères) : son message d'erreur
 * disait déjà « la compétence est sans doute à découper », et elle ne se
 * déclenchait jamais.
 *
 * 90 laisse la place à « verbe + objet + une précision », ce que le schéma
 * d'outil demande désormais au tuteur, et coupe court aux phrases à trois
 * propositions.
 */
export const INTITULE_MAX_ATOMIQUE = 90;

/**
 * Les verbes d'action observables, en position de tête.
 *
 * Liste **fermée**, et construite depuis le référentiel réel : ce sont les
 * verbes que le tuteur emploie déjà spontanément (`analyser` 9 fois,
 * `identifier` 7, `calculer` 5…), plus ceux du protocole. Fermée pour deux
 * usages : détecter un second verbe coordonné ici, et servir d'`enum` au schéma
 * d'outil là-bas — un modèle ne peut pas écrire trois verbes dans un champ qui
 * n'en accepte qu'un.
 *
 * Une liste ouverte (« tout mot en -er ») produirait des faux positifs sur les
 * noms : « et ordre », « et devoir », « et hiver » se termineraient comme des
 * infinitifs. La liste fermée n'en produit aucun.
 */
export const VERBES_ACTION = [
  "adapter",
  "analyser",
  "appliquer",
  "argumenter",
  "automatiser",
  "calculer",
  "choisir",
  "comparer",
  "concevoir",
  "configurer",
  "construire",
  "corriger",
  "créer",
  "décrire",
  "développer",
  "dimensionner",
  "discuter",
  "documenter",
  "élaborer",
  "écrire",
  "estimer",
  "évaluer",
  "expliquer",
  "formuler",
  "identifier",
  "implémenter",
  "interpréter",
  "justifier",
  "lire",
  "manipuler",
  "mesurer",
  "modéliser",
  "optimiser",
  "ordonnancer",
  "planifier",
  "présenter",
  "prévoir",
  "proposer",
  "réaliser",
  "résoudre",
  "situer",
  "structurer",
  "synthétiser",
  "tester",
  "tracer",
  "typer",
  "utiliser",
  "vérifier",
] as const;

export type VerbeAction = (typeof VERBES_ACTION)[number];

/**
 * Les verbes que le protocole §2a refuse explicitement.
 *
 * « Comprendre Kant » y figure en contre-exemple : « comprendre » ne s'observe
 * pas. Trois compétences du compte commencent pourtant par ce mot — ce sont
 * précisément celles dont aucun exercice ne peut démontrer la maîtrise.
 */
export const VERBES_NON_OBSERVABLES = [
  "comprendre",
  "connaître",
  "connaitre",
  "savoir",
  "maîtriser",
  "maitriser",
  "apprendre",
  "être",
  "etre",
  "avoir",
  "assimiler",
  "retenir",
] as const;

export interface MotifNonAtomique {
  /** Identifiant stable de la règle, pour les tests et le retour au tuteur. */
  regle: "longueur" | "deux-verbes" | "enumeration" | "verbe-non-observable";
  /** Phrase adressée à qui lit — utilisateur ou tuteur. */
  message: string;
}

function normaliser(intitule: string): string {
  return intitule.trim().toLocaleLowerCase("fr-FR");
}

/** Le premier mot, sans ponctuation. */
function premierMot(intitule: string): string {
  return normaliser(intitule).split(/[\s,;:.'’]/)[0] ?? "";
}

/**
 * Un second verbe d'action coordonné par « et » ou « ou ».
 *
 * « Modéliser **et** résoudre », « Lire, interpréter **et** analyser ». Deux
 * verbes, ce sont deux savoir-faire : ils se mesurent séparément ou ne se
 * mesurent pas.
 */
function verbesCoordonnes(intitule: string): string[] {
  const texte = normaliser(intitule);
  return VERBES_ACTION.filter((verbe) =>
    new RegExp(`\\b(et|ou)\\s+${verbe}\\b`, "u").test(texte),
  );
}

/**
 * Une parenthèse qui énumère trois éléments ou plus.
 *
 * « (quantité économique, point de commande, stock de sécurité) » n'est pas une
 * précision, c'est une liste de compétences déguisée en complément. Deux
 * éléments passent : « (variables, contraintes) » précise souvent un même objet.
 */
function enumerationParenthesee(intitule: string): string | null {
  for (const [, contenu] of intitule.matchAll(/\(([^()]*)\)/gu)) {
    if (contenu.split(",").length >= 3) return contenu.trim();
  }
  return null;
}

/**
 * Tout ce qui, dans la forme de cet intitulé, dit qu'il n'est pas atomique.
 *
 * Une liste vide vaut « recevable ». Les quatre règles sont indépendantes et
 * toutes rendues : le tuteur qui redécoupe doit voir tout ce qui cloche, pas
 * seulement le premier défaut (patron d'ADR-032).
 */
export function motifsNonAtomique(intitule: string): MotifNonAtomique[] {
  const motifs: MotifNonAtomique[] = [];
  const propre = intitule.trim();

  if (propre.length > INTITULE_MAX_ATOMIQUE) {
    motifs.push({
      regle: "longueur",
      message: `L'intitulé fait ${propre.length} caractères pour un maximum de ${INTITULE_MAX_ATOMIQUE} : il décrit sans doute plusieurs savoir-faire.`,
    });
  }

  const coordonnes = verbesCoordonnes(propre);
  if (coordonnes.length > 0) {
    motifs.push({
      regle: "deux-verbes",
      message: `Deux verbes d'action coordonnés (« ${coordonnes.join(" », « ")} ») : ce sont deux compétences, à mesurer séparément.`,
    });
  }

  const enumeration = enumerationParenthesee(propre);
  if (enumeration !== null) {
    motifs.push({
      regle: "enumeration",
      message: `La parenthèse « ${enumeration} » énumère trois éléments ou plus : c'est une liste de compétences, pas une précision.`,
    });
  }

  const tete = premierMot(propre);
  if ((VERBES_NON_OBSERVABLES as readonly string[]).includes(tete)) {
    motifs.push({
      regle: "verbe-non-observable",
      message: `« ${tete} » ne s'observe pas dans une production (protocole du référentiel §2a). Nommer ce que la personne SAIT FAIRE.`,
    });
  }

  return motifs;
}

/* ------------------------------------------------------------------ */
/* Composition d'un intitulé structuré                                 */
/* ------------------------------------------------------------------ */

/**
 * Ce que le tuteur remplit désormais, à la place d'une phrase libre.
 *
 * Trois champs, dont un verbe pris dans un `enum` fermé. C'est la moitié du
 * garde-fou que la prose ne pouvait pas tenir : un modèle ne peut pas écrire
 * « Modéliser et résoudre … et évaluer » dans un champ qui n'accepte qu'un
 * verbe. Même mécanique que les codes de compétence, que le tuteur désigne sans
 * jamais les frapper (ADR-026, ADR-031, ADR-043).
 */
export interface IntituleStructure {
  verbeAction: string;
  objet: string;
  precision?: string;
}

/**
 * Les bornes des champs, DÉRIVÉES de la longueur maximale de l'intitulé.
 *
 * Elles ne sont pas choisies : elles sont calculées pour que le pire assemblage
 * possible — le verbe le plus long, un objet plein, une précision pleine —
 * tienne exactement dans `INTITULE_MAX_ATOMIQUE`.
 *
 * ⚠️ C'est un défaut réel qui a imposé ce calcul. Avec des bornes posées à la
 * main (60 et 40), le schéma d'outil autorisait un intitulé de 96 caractères
 * que le validateur refusait ensuite : le tuteur pouvait remplir des champs
 * valides et se faire rejeter, donc boucler sans jamais produire de branche
 * acceptable. Les deux moitiés du garde-fou doivent s'accorder, et le seul
 * accord qui ne dérive pas est celui qu'on calcule.
 */
const VERBE_MAX = Math.max(...VERBES_ACTION.map((v) => v.length));
/** ` (` + `)` autour de la précision. */
const HABILLAGE_PRECISION = 3;

export const PRECISION_MAX = 24;
export const OBJET_MAX =
  INTITULE_MAX_ATOMIQUE - VERBE_MAX - 1 - (PRECISION_MAX + HABILLAGE_PRECISION);

/**
 * Assemble l'intitulé. C'est l'APPLICATION qui écrit la phrase, pas le tuteur.
 *
 * La majuscule initiale et la ponctuation viennent d'ici : deux compétences
 * proposées dans deux échanges différents s'écrivent alors de la même façon,
 * ce que six mois de prose n'ont pas obtenu.
 */
export function composerIntitule(structure: IntituleStructure): string {
  const verbe = structure.verbeAction.trim().toLocaleLowerCase("fr-FR");
  const objet = structure.objet.trim();
  const precision = structure.precision?.trim();

  const tete = verbe.charAt(0).toLocaleUpperCase("fr-FR") + verbe.slice(1);
  const base = `${tete} ${objet}`.trim();
  return precision ? `${base} (${precision})` : base;
}

/** Ce qui empêche une proposition structurée d'être assemblée. */
export function motifsRefusStructure(structure: IntituleStructure): string[] {
  const motifs: string[] = [];
  const verbe = structure.verbeAction.trim().toLocaleLowerCase("fr-FR");

  if (!(VERBES_ACTION as readonly string[]).includes(verbe)) {
    motifs.push(`« ${structure.verbeAction} » n'est pas un verbe d'action de la liste.`);
  }
  if (structure.objet.trim().length === 0) {
    motifs.push("L'objet est vide.");
  }
  if (structure.objet.trim().length > OBJET_MAX) {
    motifs.push(`L'objet dépasse ${OBJET_MAX} caractères : il en contient sans doute deux.`);
  }
  if ((structure.precision?.trim().length ?? 0) > PRECISION_MAX) {
    motifs.push(
      `La précision dépasse ${PRECISION_MAX} caractères : ce n'est plus une précision, c'est une seconde compétence.`,
    );
  }

  return motifs;
}
