/**
 * Génération du contenu d'un projet composé explicitement.
 *
 * Distincte de `/api/activities/generate`, qui ne sait servir qu'une demande
 * **dérivée** du classement du moteur. Ici la personne a désigné ses
 * compétences : la demande n'existe dans aucune file, elle est déclarée.
 *
 * Rien n'est écrit. La proposition rendue n'est qu'un brouillon relu avant
 * acceptation — c'est l'action serveur qui persiste, et seulement si la
 * personne accepte.
 */

import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { envTuteur } from "@/lib/tutor/env-requete";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import {
  genererContenuActivite,
  type ContratGenerationActivite,
} from "@/lib/tutor/adaptive-generation";
import {
  criteresProjet,
  parseCompositionProjet,
} from "@/lib/domain/composition-projet";
import { AdaptiveLearningValidationError } from "@/lib/domain/adaptive-learning";

export const maxDuration = 300;

interface CorpsGeneration {
  skillCodes?: unknown;
  objectif?: unknown;
  dureeMin?: unknown;
  capacite?: unknown;
  visee?: unknown;
  contraintes?: unknown;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsGeneration;
  try {
    corps = await request.json() as CorpsGeneration;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const ctx = await chargerContexte();
  /*
   * Pas de garde `learningLoopMode` ici.
   *
   * Le drapeau de bêta protège l'**arbitrage** du moteur — ce qu'il propose
   * de lui-même. Composer un projet est un geste demandé : le refuser au motif
   * que l'arbitrage automatique est éteint reviendrait à confondre les deux.
   */
  let composition;
  try {
    composition = parseCompositionProjet(corps, new Set(ctx.referentiel.parCode.keys()));
  } catch (cause) {
    if (cause instanceof AdaptiveLearningValidationError) {
      return Response.json({ erreur: "composition-invalide", message: cause.message }, { status: 400 });
    }
    throw cause;
  }

  const competences = composition.skillCodes.map((code) => {
    const skill = ctx.referentiel.parCode.get(code)!;
    return { code: skill.code, intitule: skill.intitule };
  });

  const contrat: ContratGenerationActivite = {
    famille: "produire",
    objectif: composition.objectif,
    competences,
    dureeEstimeeMin: composition.dureeMin,
    demandeCognitive: composition.capacite,
    workspace: "mini-projet",
    modePreuve: "soumission-finale",
    contraintes: composition.contraintes,
    ressourcesAutorisees: [],
    // Les critères sont posés par le système, pas par le tuteur : il les reçoit
    // comme contrainte et rend du contenu qui s'y conforme.
    contratEvaluation: criteresProjet(competences, composition.visee).map((critere) => ({
      id: critere.id,
      libelle: critere.label,
      attendu: critere.label,
      caractere: critere.dimension === "transfert"
        ? "transfert"
        : critere.dimension === "integration"
          ? "integration"
          : "standard",
    })),
    versionContrat: 1,
  };

  const resolution = envTuteur(corps.config);
  if (!resolution.ok) return resolution.reponse;
  const moteur = creerMoteur(choisirConfiguration(resolution.env));
  if (!moteur) {
    return Response.json(
      { erreur: "moteur-absent", message: "Aucun moteur de tuteur disponible." },
      { status: 503 },
    );
  }

  const resultat = await genererContenuActivite(moteur, contrat, request.signal);
  if (!resultat.proposition) {
    return Response.json(
      { erreur: "generation-refusee", message: resultat.erreur ?? "Le tuteur n'a rendu aucun contenu valide." },
      { status: 422 },
    );
  }
  return Response.json({
    proposition: resultat.proposition,
    // Renvoyés pour l'affichage de la relecture. L'acceptation les recalcule
    // côté serveur : rien de ce qui vient du client ne fait foi.
    criteres: criteresProjet(competences, composition.visee),
  });
}
