"use server";

/**
 * Écritures du protocole de traitement d'un cours (ADR-130, ADR-131).
 *
 * Le protocole lui-même n'est pas une entité : il devient des `LearningSession`
 * planifiées, dont le `blueprint.origine` porte la trace de la fiche cours qui
 * les a fait naître. Trois gestes, qu'il faut tenir séparés :
 *
 * 1. **`planifierSeanceProtocoleAction`** — la séance relue et cochée devient
 *    une vraie séance planifiée IMMÉDIATEMENT : composition avec le stock
 *    existant, écriture, et c'est tout. Aucun appel au tuteur : ce qui manque
 *    reste un manquant annoncé, et la commande (`origine.codes` + `consigne`)
 *    voyage dans l'origine (ADR-131). Créer un plan entier coûte des
 *    millisecondes — plus jamais une file d'appels LLM à la validation.
 *
 * 2. **`preparerSeancePlanifieeAction`** — AU DÉMARRAGE de la séance, les
 *    manquants sont générés (le manquant est la commande passée au tuteur,
 *    ADR-049 — passée au moment du besoin, décision ADR-131), écrits, puis la
 *    séance est recomposée et mise à jour. Un plan abandonné avant travail
 *    n'a coûté ni quota ni attente ; une préparation ratée n'empêche pas de
 *    relancer celle-là seule.
 *
 * 3. **`enregistrerProtocoleAction`** — le fait daté : l'intention déclarée
 *    et le plan validé s'inscrivent dans la section « Journal » de la fiche
 *    cours. C'est une déclaration, pas une mesure ; les dates des séances,
 *    elles, ne sont PAS recopiées — elles se dérivent des `sessions` à la
 *    lecture (`lireTraceProtocole`), comme tout ce qui est dérivable (P1).
 *
 * Même discipline que les autres écritures : `dorsaleCompte()` redirige sans
 * session, RLS reste la barrière, `revalidatePath` après écriture.
 */

import { revalidatePath } from "next/cache";
import { ajouterDansSection, lireValeursSections } from "@/lib/documents/sections-markdown";
import {
  analyserDocumentMarkdown,
  definirChampsFrontMatter,
} from "@/lib/documents/markdown";
import { lireDocument, modifierDocument } from "./documents";
import { extraireTexteSupportAction } from "./extraction-pdf";
import { dorsaleCompte, lire, modifier } from "./db";
import { chargerContexte } from "./context";
import { creerSeance } from "./seance-actions";
import { creerExercice } from "./actions";
import { composerSeance } from "@/lib/engine/caf";
import { genererExercices } from "@/lib/tutor/generation";
import { convertirProposition } from "@/lib/tutor/conversion-exercice";
import { resoudreMoteur } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { DUREE_ESTIMEE_MAX, DUREE_ESTIMEE_MIN } from "@/lib/domain/exercice";
import { EXERCICES_PAR_SEANCE_MAX, motifRefusDemande } from "@/lib/domain/seance";
import { exercicesDeLaSeance, statutSeance } from "@/lib/domain/seance";
import {
  LIBELLES_INTENTION_COURS,
  estIntentionCours,
  exerciceExplicationPour,
  exerciceRappelPour,
  motifRefusIntentionLibre,
  motifRefusProtocole,
  type DimensionSeance,
  type IntentionCours,
  type ProtocoleCours,
  type SeanceProtocole,
} from "@/lib/domain/protocole-cours";
import type { Exercise, LearningSession } from "@/lib/domain/types";

/** Le budget par exercice passé au tuteur, dérivé du temps déclaré. */
function budgetParExercice(dureeCibleMin: number, nombreExercices: number): number {
  return Math.min(
    DUREE_ESTIMEE_MAX,
    Math.max(DUREE_ESTIMEE_MIN, Math.round(dureeCibleMin / nombreExercices)),
  );
}

export interface EntreeSeanceProtocole {
  ficheId: string;
  titre: string;
  dimension: DimensionSeance;
  codes: string[];
  consigne: string;
  dureeCibleMin: number;
}

export interface ResultatPlanificationProtocole {
  seanceId: string;
  /** Places tenues par un exercice réel au moment de la planification. */
  activitesRetenues: number;
  /**
   * Vrai quand des places restent sans exercice : la séance est écrite
   * planifiée, sa commande attend le démarrage (ADR-131).
   */
  preparationRequise: boolean;
}

/**
 * Planifie UNE séance du protocole, sans générer quoi que ce soit.
 *
 * La validation passe par `motifRefusProtocole` — la même autorité que la
 * relecture à l'écran : une séance qui désignerait un code hors référentiel
 * est refusée ici aussi, quoi qu'ait fait le client. La demande mécanique
 * (nombre d'exercices dérivé des compétences visées et de la durée déclarée)
 * est calculée UNE fois ici : c'est elle que le blueprint persiste, et que la
 * préparation relira telle quelle.
 */
export async function planifierSeanceProtocoleAction(
  entree: EntreeSeanceProtocole,
): Promise<ResultatPlanificationProtocole> {
  // Garde d'authentification : redirige sans session, comme toute écriture.
  await dorsaleCompte();
  const ctx = await chargerContexte();

  const seance: SeanceProtocole = {
    titre: entree.titre,
    dimension: entree.dimension,
    codes: entree.codes,
    consigne: entree.consigne,
    dureeCibleMin: entree.dureeCibleMin,
  };
  // Une séance seule, dans le moule d'un protocole : la validation est la
  // même que celle du plan entier, sans seconde implémentation.
  const candidat: ProtocoleCours = { resume: "séance unique", seances: [seance] };
  const refus = motifRefusProtocole(candidat, ctx.referentiel.codesActifs);
  if (refus) throw new Error(refus);

  /*
   * La demande mécanique : le nombre d'exercices suit les compétences visées
   * (une place par compétence, borné au lot), relevé si la durée déclarée
   * dépasse ce que le nombre peut tenir. La durée, elle, est celle que la
   * personne a relue — le calage est annoncé par `motifRefusDemande` s'il
   * rendait la demande infaisable.
   */
  const nombreExercices = Math.max(
    Math.min(seance.codes.length, EXERCICES_PAR_SEANCE_MAX),
    Math.ceil(seance.dureeCibleMin / DUREE_ESTIMEE_MAX),
  );
  const domaines = [
    ...new Set(
      seance.codes
        .map((code) => ctx.referentiel.parCode.get(code)?.domaine)
        .filter((domaine): domaine is string => Boolean(domaine)),
    ),
  ];
  const demande = {
    dureeCibleMin: seance.dureeCibleMin,
    nombreExercices,
    portee:
      domaines.length === 1
        ? { type: "mono" as const, domaine: domaines[0] }
        : { type: "transverse" as const, domaines },
    codesImposes: seance.codes,
  };
  const refusDemande = motifRefusDemande(demande);
  if (refusDemande) throw new Error(refusDemande);

  const now = new Date();
  const composition = composerSeance(
    demande,
    ctx.etats,
    ctx.donnees.exercises,
    ctx.donnees.attempts,
    ctx.calibrations,
    now,
  );

  const seanceId = await creerSeance(
    {
      besoin: {
        codesVises: seance.codes,
        tempsDisponibleMin: seance.dureeCibleMin,
        declareLe: now.toISOString(),
      },
      blueprint: {
        ...composition.blueprint,
        origine: {
          genre: "protocole-cours",
          ficheId: entree.ficheId,
          titre: seance.titre,
          dimension: seance.dimension,
          // La commande différée (ADR-131) : ce que le démarrage passera au
          // tuteur pour combler les places sans exercice.
          codes: seance.codes,
          consigne: seance.consigne,
        },
      },
      activites: composition.activites.map(({ type, ref, libelle }) => ({
        type,
        ref,
        libelle,
      })),
    },
    "planifiee",
  );

  revalidatePath("/", "layout");

  const activitesRetenues = composition.activites.length;
  return {
    seanceId,
    activitesRetenues,
    preparationRequise: activitesRetenues < nombreExercices,
  };
}

export interface ResultatPreparationSeance {
  /** Exercices écrits par le tuteur pendant la préparation. */
  exercicesGeneres: number;
  /** Places tenues après préparation. */
  activitesRetenues: number;
  /** Compétences restées sans exercice — annoncé, jamais tu (ADR-036). */
  codesSansExercice: string[];
  /**
   * Vrai quand l'extrait du cours n'a pas pu être relu pour ancrer la
   * génération (ADR-132) : les exercices naissent de la seule consigne. Un
   * échec d'extraction n'empêche jamais de préparer — il se dit.
   */
  ancrageManquant: boolean;
}

/**
 * Prépare une séance planifiée du protocole : génère ses manquants, MAINTENANT.
 *
 * Appelée au démarrage (ADR-131) : la séance porte encore sa commande dans
 * `origine`, la demande mécanique est relue dans son propre blueprint — rien
 * n'est recalculé ailleurs. Idempotente par construction : une séance complète
 * (ou déjà démarrée) revient sans écrire, sans erreur.
 */
export async function preparerSeancePlanifieeAction(
  { seanceId }: { seanceId: string },
  config?: ConfigTuteurClient,
): Promise<ResultatPreparationSeance> {
  const dorsale = await dorsaleCompte();
  const seance = (await lire("sessions", dorsale)).find((s) => s.id === seanceId);
  if (!seance) throw new Error(`Séance introuvable : ${seanceId}`);

  const activitesActuelles = exercicesDeLaSeance(seance);
  /*
   * Narrowing explicite de la commande : une séance qui n'attend rien revient
   * sans écrire — idempotence par construction plutôt qu'une assertion.
   */
  const blueprint = seance.blueprint;
  const origine = blueprint?.origine;
  const codes = origine?.codes;
  if (
    !blueprint ||
    !origine ||
    !codes ||
    codes.length === 0 ||
    statutSeance(seance) !== "planifiee" ||
    activitesActuelles.length >= blueprint.nombreExercices
  ) {
    return {
      exercicesGeneres: 0,
      activitesRetenues: activitesActuelles.length,
      codesSansExercice: [],
      ancrageManquant: false,
    };
  }

  const ctx = await chargerContexte();
  const demande = {
    dureeCibleMin: blueprint.dureeCibleMin,
    nombreExercices: blueprint.nombreExercices,
    portee: blueprint.portee,
    codesImposes: codes,
  };
  const refusDemande = motifRefusDemande(demande);
  if (refusDemande) throw new Error(refusDemande);

  const now = new Date();
  let composition = composerSeance(
    demande,
    ctx.etats,
    ctx.donnees.exercises,
    ctx.donnees.attempts,
    ctx.calibrations,
    now,
  );

  let generes = 0;
  let ancrageManquant = false;
  const nouveaux: Exercise[] = [];
  const budget = budgetParExercice(demande.dureeCibleMin, demande.nombreExercices);

  const deterministe =
    origine.dimension === "comprehension" || origine.dimension === "memorisation";
  if (deterministe && composition.manquants.length > 0) {
    /*
     * ADR-133 & ADR-134 — compréhension et mémorisation ne demandent pas au
     * tuteur des exercices à produire : elles demandent un geste de la
     * PERSONNE. Compréhension = reformuler (méthode Feynman). Mémorisation =
     * restituer d'abord de mémoire, vérifier ensuite contre le cours réel.
     * Les manquants deviennent des activités écrites par le serveur,
     * déterministes, sans aucun appel LLM — la préparation est instantanée.
     * La mesure naît ensuite comme partout : tentative menée, critères relus,
     * correction du tuteur si sollicitée.
     */
    let titreCours = "";
    if (origine.dimension === "memorisation") {
      // La vérification du rappel désigne LE cours porteur — son titre suffit,
      // le PDF reste dans l'atelier où il est déjà.
      try {
        titreCours = (await lireDocument(origine.ficheId)).titre ?? "";
      } catch {
        titreCours = "";
      }
    }
    for (const manquant of composition.manquants) {
      const etat = ctx.etatsParCode.get(manquant.code);
      const competence = ctx.referentiel.parCode.get(manquant.code);
      if (!etat || !competence) continue;
      const modele =
        origine.dimension === "comprehension"
          ? exerciceExplicationPour({
              code: manquant.code,
              intitule: etat.skill.intitule,
              consigne: origine.consigne ?? "",
              dureeEstimeeMin: budget,
            })
          : exerciceRappelPour({
              code: manquant.code,
              intitule: etat.skill.intitule,
              consigne: origine.consigne ?? "",
              titreCours,
              dureeEstimeeMin: budget,
            });
      const id = await creerExercice({ ...modele, domaine: competence.domaine });
      generes += 1;
      nouveaux.push({ ...modele, id, domaine: competence.domaine });
    }
  } else if (composition.manquants.length > 0) {
    /*
     * Ancrage au cours réel (ADR-132) : la commande porte l'extrait du cours
     * désigné par l'origine — le même document que la conception du plan
     * (ADR-130), jamais un autre, jamais le contexte permanent (ADR-124). Un
     * échec d'extraction n'empêche pas de préparer : les exercices naissent
     * alors de la seule consigne, et le résultat le dit.
     */
    let ancrage: string | undefined;
    try {
      const extrait = await extraireTexteSupportAction(origine.ficheId);
      ancrage = extrait.extrait.trim() || undefined;
    } catch {
      ancrage = undefined;
    }
    ancrageManquant = !ancrage;

    const resolu = await resoudreMoteur(config, {
      conseil: "Vous pouvez préparer cette séance à la main depuis le concepteur.",
    });
    if (!resolu.ok) throw new Error("La génération des exercices n'a pas pu démarrer.");
    const demandesGeneration = composition.manquants.flatMap((manquant) => {
      const etat = ctx.etatsParCode.get(manquant.code);
      if (!etat) return [];
      return [
        {
          competence: etat.skill,
          calibration: ctx.calibrations.get(manquant.code) ?? null,
          theme: origine.consigne ?? "",
          dureeCibleMin: budget,
          ...(ancrage ? { ancrage } : {}),
        },
      ];
    });

    const resultat = await genererExercices(
      resolu.moteur,
      ctx.referentiel,
      demandesGeneration,
    );

    if (resultat.erreur && composition.activites.length === 0) {
      throw new Error(resultat.erreur);
    }

    for (const proposition of resultat.exercices) {
      const conversion = convertirProposition(proposition);
      if (!conversion.ok) continue;
      const codeCible = proposition.competences[0] ?? conversion.valeur.competences[0];
      const competence = ctx.referentiel.parCode.get(codeCible ?? "");
      if (!competence) continue;
      const id = await creerExercice({
        ...conversion.valeur,
        domaine: competence.domaine,
        origine: "tuteur",
      });
      generes += 1;
      nouveaux.push({
        id,
        titre: conversion.valeur.titre,
        domaine: competence.domaine,
        type: conversion.valeur.type,
        difficulte: conversion.valeur.difficulte,
        competences: conversion.valeur.competences,
        dureeEstimeeMin: conversion.valeur.dureeEstimeeMin,
        enonce: conversion.valeur.enonce,
        indices: conversion.valeur.indices,
        correction: conversion.valeur.correction,
        criteres: conversion.valeur.criteres,
        diagnostic: false,
        origine: "tuteur",
      });
    }
  }

  if (nouveaux.length > 0) {
    // Recomposition avec le corpus qui vient de s'enrichir : les places
    // manquantes sont tenues par les activités qui viennent de naître.
    composition = composerSeance(
      demande,
      ctx.etats,
      [...ctx.donnees.exercises, ...nouveaux],
      ctx.donnees.attempts,
      ctx.calibrations,
      now,
    );
  }

  const nouvellesActivites = composition.activites.map(({ type, ref, libelle }) => ({
    type,
    ref,
    libelle,
  }));
  const nouveauBlueprint = {
    ...composition.blueprint,
    origine,
  };

  await modifier(
    "sessions",
    seanceId,
    {
      activites: nouvellesActivites,
      blueprint: nouveauBlueprint,
      skillCodes: [
        ...new Set([...seance.skillCodes, ...nouveauBlueprint.cibles.map((c) => c.code)]),
      ],
      domaines: [...new Set(seance.domaines)],
    },
    dorsale,
  );
  revalidatePath("/", "layout");

  const tenus = new Set(composition.activites.map((activite) => activite.code));
  return {
    exercicesGeneres: generes,
    activitesRetenues: composition.activites.length,
    codesSansExercice: codes.filter((code) => !tenus.has(code)),
    ancrageManquant,
  };
}

export interface EntreeProtocole {
  ficheId: string;
  intention: IntentionCours;
  intentionLibre: string;
  /** Les séances réellement retenues à la relecture. */
  seancesRetenues: { titre: string; dimension: DimensionSeance }[];
}

/**
 * Inscrit le fait daté dans la fiche : l'intention déclarée au front-matter,
 * le plan validé au journal. La fiche reste un Markdown ordinaire — elle se
 * lit exportée, et le journal reste append-only.
 */
export async function enregistrerProtocoleAction(entree: EntreeProtocole): Promise<void> {
  if (!estIntentionCours(entree.intention)) {
    throw new Error("Intention inconnue.");
  }
  const refusLibre = motifRefusIntentionLibre(entree.intentionLibre);
  if (refusLibre) throw new Error(refusLibre);
  if (entree.seancesRetenues.length === 0) {
    throw new Error("Aucune séance retenue : rien à inscrire.");
  }

  const fiche = await lireDocument(entree.ficheId);
  const date = new Date().toISOString();
  const intentionLibre = entree.intentionLibre.trim().replace(/\s+/g, " ");
  const titres = entree.seancesRetenues.map((s) => s.titre.trim()).filter(Boolean);
  const ligne = [
    `- Protocole du ${date.slice(0, 10)}`,
    `intention : ${LIBELLES_INTENTION_COURS[entree.intention]}`,
    intentionLibre ? `précision : « ${intentionLibre} »` : null,
    `${titres.length} séance(s) : ${titres.join(" · ")}`,
  ]
    .filter(Boolean)
    .join(" — ");

  let contenu = ajouterDansSection(fiche.contenuMd, "Journal", [ligne]);
  contenu = definirChampsFrontMatter(contenu, {
    intention_cours: entree.intention,
    ...(intentionLibre ? { intention_libre: intentionLibre.slice(0, 200) } : {}),
  });
  await modifierDocument(entree.ficheId, contenu, false, fiche.updatedAt);
  revalidatePath("/", "layout");
}

/** La trace d'une séance du protocole, dérivée des sessions à la lecture. */
export interface TraceSeanceProtocole {
  seanceId: string;
  titre: string;
  dimension: DimensionSeance;
  statut: NonNullable<LearningSession["statut"]> | "historique";
  date: string;
  planifieePour?: string;
  renonceeLe?: string;
}

export interface TraceProtocole {
  /** Les séances nées du protocole de cette fiche, les plus récentes d'abord. */
  seances: TraceSeanceProtocole[];
  /** Les lignes du journal de la fiche — intentions et plans datés. */
  journal: string[];
  /** L'intention actuellement posée sur la fiche, si elle l'est. */
  intention?: IntentionCours;
}

/**
 * Le journal du cours, DÉRIVÉ à la lecture.
 *
 * Les dates des séances ne sont recopiées nulle part : elles se lisent dans
 * `sessions`, filtrées par `blueprint.origine.ficheId`. Recopier ici ce que
 * la séance porte déjà ferait deux vérités libres de diverger (P1).
 */
export async function lireTraceProtocole(ficheId: string): Promise<TraceProtocole> {
  await dorsaleCompte();
  const [ctx, fiche] = await Promise.all([chargerContexte(), lireDocument(ficheId)]);
  const analyse = analyserDocumentMarkdown(fiche.id, fiche.contenuMd);

  const seances = ctx.donnees.sessions
    .filter((session) => session.blueprint?.origine?.ficheId === ficheId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      seanceId: session.id,
      titre: session.blueprint?.origine?.titre ?? "Séance du protocole",
      dimension: session.blueprint?.origine?.dimension ?? "application",
      statut: session.statut ?? ("historique" as const),
      date: session.date,
      ...(session.planifieePour ? { planifieePour: session.planifieePour } : {}),
      ...(session.renonceeLe ? { renonceeLe: session.renonceeLe } : {}),
    }));

  const intentionBrute = analyse.frontMatter.intention_cours;

  return {
    seances,
    journal: lireValeursSections(fiche.contenuMd, ["Journal"])["Journal"]
      .split("\n")
      .map((ligne) => ligne.trim())
      .filter(Boolean),
    ...(estIntentionCours(intentionBrute) ? { intention: intentionBrute } : {}),
  };
}
