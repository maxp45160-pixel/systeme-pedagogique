/**
 * Extraction des blocs structurés émis par le tuteur — filet de sécurité.
 *
 * Deux gabarits : `PROPOSITION D'EXERCICE` (un **exercice** à ajouter au
 * corpus) et `PROPOSITION DE RÉFÉRENTIEL` (une **branche** de compétences à
 * valider).
 *
 * Depuis le lot 3.2, les propositions passent par les tool definitions
 * (`validerAppelOutil` dans `lib/tutor/outils.ts`) et les prompts n'émettent
 * plus ces blocs markdown. Ces parseurs restent le filet pour deux cas : un
 * fournisseur compatible OpenAI dont les deux marches d'outils échouent, et
 * les conversations antérieures à la transition restaurées depuis la session.
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

export const MARQUEUR_REFERENTIEL = "PROPOSITION DE RÉFÉRENTIEL";

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
  /** Pourquoi cet exercice, brut — voir `IntentionExercice`. Vide = non renseignée. */
  intention?: string;
}

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

/**
 * Extrait une proposition d'exercice rédigée en markdown/texte libre dans le chat,
 * et assainit le texte du message pour masquer l'énoncé, les indices et la correction
 * (garantissant le respect de la démarche d'apprentissage active).
 */
export function extrairePropositionExerciceDuTexte(texte: string): {
  exercice: PropositionExercice | null;
  texteNettoye: string;
} {
  const aEnonce = /(?:^|\n)\s*(?:[-*#]+\s*)?(?:Énoncé|Enoncé|ÉNONCÉ)\s*:/i.test(texte);
  const aCorrection = /(?:^|\n)\s*(?:[-*#]+\s*)?(?:Correction|CORRECTION)\s*:/i.test(texte);
  const posProposition = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Proposition\s*(?:d'exercice)?|Titre)\s*:/i);

  if (!aEnonce || !aCorrection) {
    return { exercice: null, texteNettoye: texte };
  }

  // 1. Titre
  let titre = "";
  const matchTitre = texte.match(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Proposition\s*(?:d'exercice)?|Titre)\s*:\s*["“«]?([^"\n\r”»]+)["”»]?/i);
  if (matchTitre) {
    titre = matchTitre[1].trim();
  }

  // 2. Domaine
  let domaine = "Développement";
  const matchDomaine = texte.match(/(?:^|\n|[|•-])\s*Domaine\s*:\s*([^|\n\r•]+)/i);
  if (matchDomaine) {
    domaine = matchDomaine[1].trim();
  }

  // 3. Type
  let type = "Application";
  const matchType = texte.match(/(?:^|\n|[|•-])\s*Type\s*:\s*([^|\n\r•]+)/i);
  if (matchType) {
    type = matchType[1].trim();
  }

  // 4. Difficulté
  let difficulte = "1";
  const matchDiff = texte.match(/(?:^|\n|[|•-])\s*Difficult[ée]\s*:\s*(\d+)(?:\/\d+)?/i);
  if (matchDiff) {
    difficulte = matchDiff[1].trim();
  }

  // 5. Compétences
  const competences: string[] = [];
  const matchCompLigne = texte.match(/(?:^|\n|[|•-])\s*Compétence(?:s|\s+cible)?\s*:\s*([^\n\r]+)/i);
  if (matchCompLigne) {
    const codes = matchCompLigne[1].match(/[A-Z]{2,6}-\d{2,4}/g);
    if (codes) competences.push(...codes);
  }
  if (competences.length === 0) {
    const tousCodes = texte.match(/[A-Z]{2,6}-\d{2,4}/g);
    if (tousCodes) competences.push(...Array.from(new Set(tousCodes)));
  }

  if (!titre) {
    titre = competences.length > 0
      ? `Exercice d'application ${competences[0]}`
      : "Exercice d'entraînement";
  }

  // 6. Durée
  let dureeEstimeeMin = "15";
  const matchDuree = texte.match(/(?:^|\n|[|•-])\s*Durée(?:\s+estimée)?\s*:\s*(\d+)/i);
  if (matchDuree) {
    dureeEstimeeMin = matchDuree[1].trim();
  }

  // 7. Intention
  let intention = "Consolidation";
  const matchIntention = texte.match(/(?:^|\n|[|•-])\s*Intention\s*:\s*([^|\n\r•]+)/i);
  if (matchIntention) {
    intention = matchIntention[1].trim();
  }

  // Positions des sections
  const posEnonce = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Énoncé|Enoncé|ÉNONCÉ)\s*:/i);
  const posIndices = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Indices?|INDICES?)\s*(?:\([^)]*\))?\s*:/i);
  const posCorrection = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Correction|CORRECTION)\s*:/i);
  const posCriteres = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Critères?(?:\s+d'évaluation)?|CRITÈRES?)\s*:/i);
  const posPourquoi = texte.search(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Pourquoi\s+cet\s+exercice\s*\?)/i);

  // Énoncé
  let enonce = "";
  if (posEnonce !== -1) {
    const finEnonce = posIndices !== -1 && posIndices > posEnonce
      ? posIndices
      : posCorrection > posEnonce
        ? posCorrection
        : texte.length;
    const brut = texte.slice(posEnonce, finEnonce);
    enonce = brut.replace(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Énoncé|Enoncé|ÉNONCÉ)\s*:\s*/i, "").replace(FIN_DE_BLOC, "").trim();
  }

  // Indices
  const indices: string[] = [];
  if (posIndices !== -1 && posCorrection > posIndices) {
    const brutIndices = texte.slice(posIndices, posCorrection);
    const texteSansHeader = brutIndices.replace(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Indices?|INDICES?)\s*(?:\([^)]*\))?\s*:\s*/i, "");
    const lignes = texteSansHeader.split("\n");
    let indiceCourant = "";
    for (const ligne of lignes) {
      if (FIN_DE_BLOC.test(ligne)) continue;
      const matchInd = ligne.match(/^\s*(?:[-*•]|\d+\.|\bIndice\s*\d*\s*:)\s*(.*)/i);
      if (matchInd) {
        if (indiceCourant.trim()) indices.push(indiceCourant.trim());
        indiceCourant = matchInd[1];
      } else if (indiceCourant) {
        indiceCourant += `\n${ligne}`;
      }
    }
    if (indiceCourant.trim()) indices.push(indiceCourant.trim());
  }

  // Correction
  let correction = "";
  if (posCorrection !== -1) {
    const finCorrection = posCriteres !== -1 && posCriteres > posCorrection
      ? posCriteres
      : posPourquoi !== -1 && posPourquoi > posCorrection
        ? posPourquoi
        : texte.length;
    const brutCorrection = texte.slice(posCorrection, finCorrection);
    correction = brutCorrection.replace(/(?:^|\n)\s*(?:[-*#]+\s*)?(?:Correction|CORRECTION)\s*:/i, "").replace(FIN_DE_BLOC, "").trim();
  }

  // Critères
  const criteres: { dimension: string; libelle: string }[] = [];
  if (posCriteres !== -1) {
    const finCriteres = posPourquoi !== -1 && posPourquoi > posCriteres ? posPourquoi : texte.length;
    const brutCriteres = texte.slice(posCriteres, finCriteres);
    const lignesCriteres = brutCriteres.split("\n");
    for (const ligne of lignesCriteres) {
      if (FIN_DE_BLOC.test(ligne)) continue;
      const nette = ligne.trim();
      if (!nette || nette.toLowerCase().startsWith("dimension") || /^[|\s-]+$/.test(nette)) continue;

      // Format tableau tabulé: Dimension \t Libellé
      if (nette.includes("\t")) {
        const parts = nette.split("\t").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          criteres.push({
            dimension: parts[0].toLowerCase(),
            libelle: parts.slice(1).join(" "),
          });
          continue;
        }
      }

      // Format tableau markdown: | Dimension | Libellé |
      const matchTable = nette.match(/^\|?\s*([A-Za-zÀ-ÿ\s]+)\s*\|\s*([^|]+)\|?$/);
      if (matchTable && !matchTable[1].toLowerCase().includes("dimension")) {
        criteres.push({
          dimension: matchTable[1].trim().toLowerCase(),
          libelle: matchTable[2].trim(),
        });
        continue;
      }

      // Format puce: - Dimension : libellé
      const matchPuce = nette.match(/^[-*•]\s*([A-Za-zÀ-ÿ]+)\s*:\s*(.+)/);
      if (matchPuce) {
        criteres.push({
          dimension: matchPuce[1].trim().toLowerCase(),
          libelle: matchPuce[2].trim(),
        });
      }
    }
  }

  if (criteres.length === 0) {
    criteres.push({ dimension: "application", libelle: "Application de la méthode sans erreur" });
  }

  const exercice: PropositionExercice = {
    titre,
    domaine,
    type,
    difficulte,
    competences: competences.length > 0 ? competences : ["DEV-01"],
    dureeEstimeeMin,
    enonce,
    indices,
    correction,
    criteres,
    intention,
  };

  if (!exerciceComplet(exercice)) {
    return { exercice: null, texteNettoye: texte };
  }

  // Trouver le début du bloc de l'exercice pour préserver l'introduction
  const matchSepAvant = texte.slice(0, posEnonce).match(/(?:^|\n)\s*---+\s*$/m);
  const coupure = matchSepAvant && matchSepAvant.index !== undefined && matchSepAvant.index > 0
    ? matchSepAvant.index
    : posProposition !== -1 && posProposition < posEnonce
      ? posProposition
      : posEnonce;

  const intro = texte.slice(0, coupure).trim();

  // Extraire le bloc "Pourquoi cet exercice ?" si présent
  let pourquoiTexte = "";
  if (posPourquoi !== -1) {
    const apresPourquoi = texte.slice(posPourquoi);
    const finPourquoi = apresPourquoi.search(/(?:^|\n)\s*(?:---+|\*{3,})?\s*Veux-tu\s+que\s+je\s+formalise/i);
    const brutPourquoi = finPourquoi !== -1 ? apresPourquoi.slice(0, finPourquoi) : apresPourquoi;
    pourquoiTexte = brutPourquoi.trim();
  }

  const morceaux: string[] = [];
  if (intro) morceaux.push(intro);
  morceaux.push("> **Exercice interactif prêt.** Il s'ouvre dans le workspace de résolution ci-dessous ; le tuteur t'accompagne pendant la résolution.");
  if (pourquoiTexte) morceaux.push(pourquoiTexte);

  const texteNettoye = morceaux.join("\n\n");

  return { exercice, texteNettoye };
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
 * interdit au tuteur d'en écrire. Un code est la clé étrangère des observations ;
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
