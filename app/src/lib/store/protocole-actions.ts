"use server";

/**
 * Écritures du protocole de traitement d'un cours (ADR-130).
 *
 * Le protocole lui-même n'est pas une entité : il devient des `LearningSession`
 * planifiées, dont le `blueprint.origine` porte la trace de la fiche cours qui
 * les a fait naître. Ce module fait deux gestes, et il faut les tenir séparés :
 *
 * 1. **`preparerSeanceProtocoleAction`** — une séance du protocole relu et
 *    cochée devient une vraie séance : composition (`composerSeance`),
 *    génération des exercices manquants (le manquant est la commande passée au
 *    tuteur, ADR-049 — ici la personne a choisi d'encaisser la commande d'un
 *    coup, décision ADR-130), écriture des exercices, puis écriture de la
 *    séance planifiée. Une séance par appel : la génération d'un lot coûte
 *    des dizaines de secondes, et un appel unique pour tout le protocole
 *    dépasserait toute durée de fonction. La progression est affichée par
 *    l'écran, séance par séance.
 *
 * 2. **`enregistrerProtocoleAction`** — le fait daté : l'intention déclarée
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
import { dorsaleCompte } from "./db";
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
import {
  LIBELLES_INTENTION_COURS,
  estIntentionCours,
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

export interface ResultatSeanceProtocole {
  seanceId: string;
  /** Places tenues par un exercice réel au moment de l'écriture. */
  activitesRetenues: number;
  /** Exercices écrits par le tuteur pendant la préparation. */
  exercicesGeneres: number;
  /** Compétences restées sans exercice — annoncé, jamais tu (ADR-036). */
  codesSansExercice: string[];
}

/**
 * Prépare UNE séance du protocole : compose, génère les manquants, écrit.
 *
 * La validation passe par `motifRefusProtocole` — la même autorité que la
 * relecture à l'écran : une séance qui désignerait un code hors référentiel
 * est refusée ici aussi, quoi qu'ait fait le client.
 */
export async function preparerSeanceProtocoleAction(
  entree: EntreeSeanceProtocole,
  config?: ConfigTuteurClient,
): Promise<ResultatSeanceProtocole> {
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
  let composition = composerSeance(
    demande,
    ctx.etats,
    ctx.donnees.exercises,
    ctx.donnees.attempts,
    ctx.calibrations,
    now,
  );

  let generes = 0;
  if (composition.manquants.length > 0) {
    const resolu = await resoudreMoteur(config, {
      conseil: "Vous pouvez préparer cette séance à la main depuis le concepteur.",
    });
    if (!resolu.ok) throw new Error("La génération des exercices n'a pas pu démarrer.");
    const budget = budgetParExercice(seance.dureeCibleMin, nombreExercices);
    const demandesGeneration = composition.manquants.flatMap((manquant) => {
      const etat = ctx.etatsParCode.get(manquant.code);
      if (!etat) return [];
      return [
        {
          competence: etat.skill,
          calibration: ctx.calibrations.get(manquant.code) ?? null,
          theme: seance.consigne,
          dureeCibleMin: budget,
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

    const nouveaux: Exercise[] = [];
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

    if (nouveaux.length > 0) {
      // Recomposition avec le corpus qui vient de s'enrichir : les places
      // manquantes sont tenues par les exercices qui viennent d'être écrits.
      composition = composerSeance(
        demande,
        ctx.etats,
        [...ctx.donnees.exercises, ...nouveaux],
        ctx.donnees.attempts,
        ctx.calibrations,
        now,
      );
    }
  }

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

  const tenus = new Set(composition.activites.map((activite) => activite.code));
  return {
    seanceId,
    activitesRetenues: composition.activites.length,
    exercicesGeneres: generes,
    codesSansExercice: seance.codes.filter((code) => !tenus.has(code)),
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
