/**
 * L'intention déclarée, et sa traduction en une action déjà connue du système.
 *
 * Le produit demandait à l'utilisateur de choisir **l'objet** qu'il voulait
 * créer — une compétence, un exercice, une séance, une note, un
 * projet — soit treize modales de création pour sept écrans. Choisir l'objet
 * suppose de connaître le modèle de données ; personne n'ouvre l'application
 * pour ça. On lui demande maintenant **ce dont il a besoin**, en une phrase, et
 * le système choisit l'objet.
 *
 * ## Ce que ce fichier n'est pas
 *
 * Ce n'est pas une nouvelle entité. Rien n'est persisté : une intention est
 * traduite, exécutée, et disparaît. Les quatre genres ci-dessous pointent tous
 * vers une surface qui existait déjà — le compositeur de séance, la création de
 * note, la proposition de branche. Aucun écran ne naît de ce fichier.
 *
 * ## Frontière
 *
 * Couche 1 (domaine pur) : aucune dépendance au tuteur, au store ni à React.
 * La traduction par le modèle vit dans `lib/tutor/intention.ts` ; ce fichier
 * détient la seule validation qui fasse autorité, et les tests qui la tiennent.
 */

import { EXERCICES_PAR_LOT_MAX } from "./exercice";

/* ------------------------------------------------------------------ */
/* Genres                                                              */
/* ------------------------------------------------------------------ */

/**
 * Les quatre traductions possibles d'un besoin exprimé.
 *
 * - `travail` — s'entraîner sur des compétences qui existent déjà. Mène au
 *   compositeur de séance, qui sait déjà générer un ou plusieurs exercices.
 * - `projet` — produire un artefact qui mobilise plusieurs compétences à la
 *   fois. Mène au parcours de projet, qui recible lui-même les compétences.
 * - `note` — déposer une ressource ou un contexte. Ne mesure rien (P5).
 * - `referentiel` — le sujet demandé n'existe pas encore : il faut d'abord des
 *   compétences pour pouvoir mesurer quoi que ce soit.
 * - `clarification` — les indices ne suffisent pas à distinguer deux gestes
 *   qui ne mènent pas au même écran ; le tuteur pose alors une question.
 *
 * Il n'y a délibérément **pas** de genre « reprendre » : un travail déjà ouvert
 * est un fait lu en base, pas une intention à interpréter. Le tableau de bord
 * le signale lui-même, sans passer par le modèle — le faire proposer
 * reviendrait à laisser le tuteur affirmer un état du compte.
 */
export const GENRES_INTENTION = [
  "travail",
  "projet",
  "note",
  "referentiel",
  "clarification",
] as const;

export type GenreIntention = (typeof GENRES_INTENTION)[number];

export type GranulariteReferentiel = "fine" | "standard" | "large";

export interface DemandeReferentiel {
  /** Domaine/branches à structurer, ou compétence précise à ajouter. */
  type: "domaine" | "competence";
  /** Vrai uniquement quand la personne a formulé explicitement cette cible. */
  explicite: boolean;
  /** Intitulés repris mot pour mot quand la personne en a fourni. */
  intitules: string[];
  nombreDomaines?: number;
  nombreCompetences?: number;
  granularite?: GranulariteReferentiel;
  /** Vue d'ensemble demandée, par opposition à une capacité ciblée. */
  portee?: "large" | "ciblee";
  /** Niveau explicitement déclaré par la personne. */
  niveau?: "debutant";
}

const NOMBRES = new Map<string, number>([
  ["un", 1],
  ["une", 1],
  ["deux", 2],
  ["trois", 3],
  ["quatre", 4],
  ["cinq", 5],
  ["six", 6],
]);

function nombreDemande(valeur: string): number | undefined {
  const propre = valeur.toLowerCase();
  const numerique = Number(propre);
  if (Number.isInteger(numerique) && numerique > 0 && numerique <= 8) return numerique;
  return NOMBRES.get(propre);
}

function intitulésExplicites(besoin: string): string[] {
  const trouves: string[] = [];
  const motifs = [
    /compétences?\s+(?:intitulée?s?|nommée?s?|appelée?s?)?\s*[«"]([^»"]+)[»"]/giu,
    /compétences?\s*:\s*[«"]([^»"]+)[»"]/giu,
  ];
  for (const motif of motifs) {
    for (const correspondance of besoin.matchAll(motif)) {
      const intitule = correspondance[1]?.trim();
      if (intitule && !trouves.includes(intitule)) trouves.push(intitule);
    }
  }
  const objectif = /\bapprendre\s+à\s+([^.!?]+)[.!?]?$/iu.exec(besoin);
  const intituleObjectif = objectif?.[1]?.trim();
  if (intituleObjectif && !trouves.includes(intituleObjectif)) {
    trouves.push(intituleObjectif.charAt(0).toUpperCase() + intituleObjectif.slice(1));
  }
  return trouves.slice(0, 12);
}

/**
 * Lit les contraintes explicites d’une demande de référentiel.
 *
 * Ce n’est pas une classification sémantique : la fonction ne déduit pas un
 * domaine à partir d’un mot. Elle ne fait que conserver les formes que la
 * personne a écrites elle-même — notamment un intitulé entre guillemets — afin
 * que l’écran ouvre la bonne relecture.
 */
export function analyserDemandeReferentiel(besoin: string, contexte?: string): DemandeReferentiel {
  const texte = besoin.trim();
  const intitules = intitulésExplicites(texte);
  const demandeCompetence =
    contexte !== "domaine" &&
    (/\b(?:ajoute|ajouter|crée|créer|définis|définir|inscris|inscrire)\b[\s\S]{0,60}\bcompétences?\b/iu.test(
      texte,
    ) || /\bcompétences?\b[\s\S]{0,60}\b(?:intitulée?s?|nommée?s?|appelée?s?)\b/iu.test(texte));
  const objectifCompetence =
    contexte !== "domaine" && /\bapprendre\s+à\s+[^.!?]+[.!?]?$/iu.test(texte);

  const domaines = /\b(\d+|un|une|deux|trois|quatre|cinq|six)\s+(?:domaines?|branches?|axes?)\b/iu.exec(
    texte,
  );
  const competences = /\b(\d+|deux|trois|quatre|cinq|six)\s+compétences?\b/iu.exec(
    texte,
  );

  let granularite: GranulariteReferentiel | undefined;
  if (/\b(?:fine|fin|atomique|détaillée|détaillé)\b/iu.test(texte)) granularite = "fine";
  else if (/\b(?:large|macro|grossière|grossier)\b/iu.test(texte)) granularite = "large";
  else if (/\b(?:standard|équilibrée|équilibré)\b/iu.test(texte)) granularite = "standard";

  const niveauDebutant = /\b(?:débutant(?:e)?|novice|noob)\b/iu.test(texte);
  const verbeApprentissage = /\b(?:apprendre|découvrir|étudier|explorer|se former|me former)\b/iu.test(
    texte,
  );
  const demandeVueEnsemble =
    contexte === "domaine" ||
    /\b(?:apprendre|découvrir|étudier|explorer|se former|me former)\b[\s\S]{0,80}\b(?:la|le|les|l')\s+[\p{L}\d]/iu.test(
      texte,
    ) || (niveauDebutant && verbeApprentissage);

  return {
    type: demandeCompetence || objectifCompetence ? "competence" : "domaine",
    explicite:
      contexte === "domaine" ||
      demandeCompetence ||
      objectifCompetence ||
      demandeVueEnsemble ||
      Boolean(domaines || competences || granularite),
    intitules,
    ...(domaines?.[1] && nombreDemande(domaines[1])
      ? { nombreDomaines: nombreDemande(domaines[1]) }
      : {}),
    ...(competences?.[1] && nombreDemande(competences[1])
      ? { nombreCompetences: nombreDemande(competences[1]) }
      : {}),
    ...(granularite ? { granularite } : {}),
    ...(demandeVueEnsemble ? { portee: "large" as const } : {}),
    ...(niveauDebutant ? { niveau: "debutant" as const } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* L'action traduite                                                   */
/* ------------------------------------------------------------------ */

export interface ActionIntention {
  genre: GenreIntention;
  /** Ce qui sera fait, formulé pour être lu — pas un identifiant. */
  titre: string;
  /** Pourquoi cette action répond au besoin. Jamais vide (P3). */
  pourquoi: string;
  /**
   * Compétences visées. **Toujours** un sous-ensemble des codes actifs : un
   * code inventé est écarté ici, pas plus loin (garde-fou du référentiel —
   * le tuteur ne crée jamais de code).
   */
  codes: string[];
  /**
   * Le sujet en clair, pour les genres qui n'ont pas de code à viser. Pour une
   * clarification, c'est la question affichée à la personne.
   */
  sujet: string;
}

/** Ce que la traduction rend : une action tenue, et ses replis. */
export interface TraductionIntention {
  action: ActionIntention;
  /** Autres lectures du même besoin, proposées en retrait. */
  alternatives: ActionIntention[];
}

/* ------------------------------------------------------------------ */
/* Bornes                                                              */
/* ------------------------------------------------------------------ */

export const BESOIN_MIN = 3;
export const BESOIN_MAX = 400;
const TITRE_MAX = 120;
const POURQUOI_MAX = 300;
const ALTERNATIVES_MAX = 3;

/** Un besoin exploitable : ni vide, ni un roman collé depuis ailleurs. */
export function besoinValide(besoin: string): boolean {
  const t = besoin.trim();
  return t.length >= BESOIN_MIN && t.length <= BESOIN_MAX;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function texte(valeur: unknown, max: number): string {
  if (typeof valeur !== "string") return "";
  const t = valeur.trim();
  return t.length > max ? t.slice(0, max).trim() : t;
}

/**
 * Valide une action rendue par le modèle contre les codes réellement actifs.
 *
 * Rend `null` plutôt qu'une action rabotée quand il manque ce qui la rend
 * exécutable. Une séance générale peut ne viser aucun code : le compositeur
 * laisse alors le sujet ouvert. Elle doit toutefois porter un `sujet` explicite
 * afin de ne pas confondre ce cas avec une sortie incomplète du modèle.
 *
 * Un code hors de l'ensemble actif est écarté sans faire tomber l'action : le
 * reste de la désignation peut rester bon. Mais si l'écrémage vide la liste
 * d'un `travail`, l'action tombe — c'est alors qu'il n'y avait rien de réel
 * derrière.
 */
export function validerActionIntention(
  brut: unknown,
  codesActifs: ReadonlySet<string>,
): ActionIntention | null {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const entree = brut as Record<string, unknown>;

  const genre = GENRES_INTENTION.find(
    (g) => typeof entree.genre === "string" && entree.genre.trim().toLowerCase() === g,
  );
  if (!genre) return null;

  const titre = texte(entree.titre, TITRE_MAX);
  const pourquoi = texte(entree.pourquoi, POURQUOI_MAX);
  if (!titre || !pourquoi) return null;

  const codes = [
    ...new Set(
      (Array.isArray(entree.codes) ? entree.codes : [])
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter((c) => c.length > 0 && codesActifs.has(c)),
    ),
  ].slice(0, EXERCICES_PAR_LOT_MAX);

  /*
   * `projet` et `referentiel` partent d'une phrase, pas d'une liste de codes.
   * Cette phrase, c'est `sujet` — et à défaut `titre`, qui dit déjà en une
   * ligne ce qui sera fait.
   *
   * Le repli n'invente rien : c'est **exactement** ce que les deux
   * consommateurs font depuis toujours (`CaptureIntention.executer` ouvre le
   * parcours sur `action.sujet || action.titre`). L'exiger ici refusait donc
   * des actions parfaitement exécutables : « génère moi un domaine
   * mathématiques » revenait comme « proposition incomplète » alors que le
   * titre portait le sujet. Une phrase relue par la personne dans l'écran
   * suivant, dans les deux cas.
   */
  const sujet = texte(entree.sujet, TITRE_MAX) || (genre === "travail" ? "" : titre);

  if (genre === "travail" && codes.length === 0 && !sujet) return null;
  if (genre === "clarification" && codes.length > 0) return null;
  if (genre === "clarification" && !texte(entree.sujet, TITRE_MAX)) return null;

  return { genre, titre, pourquoi, codes, sujet };
}

/**
 * Valide la traduction entière.
 *
 * L'action principale est obligatoire ; les alternatives sont un confort, et
 * une alternative mal formée est écartée en silence plutôt que de faire tomber
 * une traduction par ailleurs bonne. Un doublon de genre + titre est retiré :
 * proposer deux fois la même chose donne l'impression d'un choix qui n'existe
 * pas.
 */
export function validerTraductionIntention(
  brut: unknown,
  codesActifs: ReadonlySet<string>,
): TraductionIntention | null {
  if (typeof brut !== "object" || brut === null) return null;
  const entree = brut as Record<string, unknown>;

  const action = validerActionIntention(entree.action, codesActifs);
  if (!action) return null;

  const vues = new Set([`${action.genre}|${action.titre.toLowerCase()}`]);
  const alternatives: ActionIntention[] = [];
  for (const candidate of Array.isArray(entree.alternatives) ? entree.alternatives : []) {
    if (alternatives.length >= ALTERNATIVES_MAX) break;
    const valide = validerActionIntention(candidate, codesActifs);
    if (!valide) continue;
    const cle = `${valide.genre}|${valide.titre.toLowerCase()}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    alternatives.push(valide);
  }

  return { action, alternatives };
}

/* ------------------------------------------------------------------ */
/* Recadrages déterministes                                            */
/* ------------------------------------------------------------------ */

export interface TraductionForcee {
  /** La traduction après recadrage. `null` quand aucun recadrage ne s'applique et que l'entrée était nulle. */
  traduction: TraductionIntention | null;
  /**
   * La raison du recadrage, à annoncer à l'écran avant la proposition.
   * Non nulle si et seulement si un recadrage s'est appliqué : une
   * contradiction silencieuse entre le modèle et le déterminisme se vit
   * comme une incompréhension (« j'ai demandé X, on me propose Y »).
   */
  raison: string | null;
}

/**
 * Applique les trois recadrages déterministes d'un besoin, dans l'ordre :
 *
 * 1. contexte « domaine » — l'écran impose la structuration d'un domaine ;
 * 2. séance sans sujet — aucune compétence ne peut être choisie à la place
 *    de la personne ;
 * 3. demande explicite de compétences ou vue d'ensemble — extension du
 *    référentiel plutôt qu'entraînement.
 *
 * Chaque recadrage REMPLACE chaque champ de l'action (genre, titre, pourquoi,
 * codes, sujet) tout en conservant les alternatives du modèle quand il en a
 * produit une. C'est la seule implémentation : la route pré-appel l'utilise
 * pour ses court-circuits (traduction entrante `null`), et la traduction par
 * le modèle l'applique après coup sur sa propre lecture.
 */
export function forcerTraductionIntention(
  precedente: TraductionIntention | null,
  besoin: string,
  contexte?: string,
): TraductionForcee {
  const sujet = besoin.trim();

  if (contexte === "domaine") {
    return {
      traduction: {
        ...(precedente ?? { alternatives: [] }),
        action: {
          ...precedente?.action,
          genre: "referentiel",
          titre: `Structurer le domaine « ${sujet} »`,
          pourquoi: "Ce domaine sera découpé en compétences pour enrichir ton Atelier.",
          codes: [],
          sujet,
        },
      },
      raison:
        "Tu écris depuis le point d'entrée « nouveau domaine » : la demande est traitée comme la structuration d'un domaine.",
    };
  }

  if (demandeSeanceSansSujet(besoin)) {
    return {
      traduction: {
        alternatives: [],
        action: {
          genre: "travail",
          titre: "Préparer une séance",
          pourquoi: "Aucun sujet n’a été imposé : tu choisiras la portée dans le compositeur.",
          codes: [],
          sujet,
        },
      },
      raison:
        "Ta demande ne désigne aucun sujet précis : elle est traitée comme la préparation d'une séance libre.",
    };
  }

  const cadrage = analyserDemandeReferentiel(besoin, contexte);
  if (
    cadrage.explicite &&
    (cadrage.type === "competence" || cadrage.portee === "large")
  ) {
    const competence = cadrage.type === "competence";
    return {
      traduction: {
        ...(precedente ?? { alternatives: [] }),
        action: {
          ...precedente?.action,
          genre: "referentiel",
          titre:
            competence && cadrage.intitules.length === 1
              ? `Ajouter la compétence « ${cadrage.intitules[0]} »`
              : competence
                ? "Ajouter les compétences précisées dans la demande"
                : "Structurer le domaine demandé",
          pourquoi: competence
            ? "La demande désigne explicitement une ou plusieurs compétences à ajouter."
            : "La demande porte sur une vue d’ensemble qui doit être organisée avant l’apprentissage.",
          codes: [],
          sujet,
        },
      },
      raison: competence
        ? "Ta demande désigne explicitement une ou plusieurs compétences à ajouter : elle est traitée comme une extension du référentiel."
        : "Ta demande porte sur une vue d'ensemble : elle est traitée comme la structuration d'un domaine plutôt que comme un entraînement.",
    };
  }

  return { traduction: precedente, raison: null };
}

/* ------------------------------------------------------------------ */
/* Destination                                                         */
/* ------------------------------------------------------------------ */

/**
 * L'URL du compositeur de séance pour un `travail`.
 *
 * Exactement celle que `BoutonGenerer` fabriquait déjà : le point d'entrée
 * unique n'invente aucune destination, il en réutilise une. `intention` porte
 * la phrase de l'utilisateur, que le compositeur affiche comme titre proposé.
 */
export function urlComposition(
  codes: string[],
  intention: string,
  options: { sansTheme?: boolean } = {},
): string {
  const parametres = new URLSearchParams({ composer: "1" });
  for (const code of codes.slice(0, EXERCICES_PAR_LOT_MAX)) parametres.append("code", code);
  const t = intention.trim();
  if (t) parametres.set("intention", t);
  if (options.sansTheme) parametres.set("sans-theme", "1");
  return `/seances?${parametres.toString()}`;
}

/**
 * Reconnaît uniquement la formulation d'une séance sans cible déclarée.
 *
 * « Créer une séance sur les stocks » reste une séance ciblée : le complément
 * désigne son sujet. En revanche « créer une séance » doit ouvrir le
 * compositeur sans sélectionner la première recommandation à la place de la
 * personne.
 */
export function demandeSeanceSansSujet(besoin: string): boolean {
  const texte = besoin.trim();
  const correspondance = /\b(?:crée?r?|compose?r?|prépare?r?|planifie?r?|lance?r?)\s+(?:moi\s+)?(?:une\s+)?séance\b([\s\S]*)$/iu.exec(
    texte,
  );
  if (!correspondance) return false;
  const complément = correspondance[1]?.trim().replace(/^[.!?]+/, "").trim() ?? "";
  return complément === "" || /^(?:d['’]entraînement|de travail)$/iu.test(complément);
}
