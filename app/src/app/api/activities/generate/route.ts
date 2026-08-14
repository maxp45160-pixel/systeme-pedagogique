import { chargerContexte } from "@/lib/store/context";
import { chargerDemandesGeneration } from "@/lib/store/adaptive-learning";
import { lireContexteInstant } from "@/lib/engine/action-unifiee";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { envTuteur } from "@/lib/tutor/env-requete";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import {
  genererContenuActivite,
  type ContratGenerationActivite,
} from "@/lib/tutor/adaptive-generation";

export const maxDuration = 300;

interface GenerateBody {
  generationRequestId?: string;
  /** Contexte d'instant, tel qu'il a produit la proposition. Jamais persisté. */
  temps?: string;
  capacite?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = await request.json() as GenerateBody;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }
  if (!body.generationRequestId) {
    return Response.json({ erreur: "requete-incomplete" }, { status: 400 });
  }
  const ctx = await chargerContexte();
  if (ctx.donnees.user.learningLoopMode !== "adaptive-v1") {
    return Response.json({ erreur: "beta-inactive" }, { status: 403 });
  }
  const demandes = await chargerDemandesGeneration(
    ctx,
    lireContexteInstant({ temps: body.temps, capacite: body.capacite }),
  );
  const generation = demandes.find((item) => item.id === body.generationRequestId);
  if (!generation) {
    return Response.json({ erreur: "generation-inconnue" }, { status: 404 });
  }
  const skills = generation.target.skillCodes.flatMap((code) => {
    const skill = ctx.referentiel.parCode.get(code);
    return skill ? [{ code: skill.code, intitule: skill.intitule }] : [];
  });
  if (skills.length !== generation.target.skillCodes.length) {
    return Response.json({ erreur: "competence-hors-perimetre" }, { status: 400 });
  }
  const contract: ContratGenerationActivite = {
    famille: generation.family === "explorer" ? "explorer" : "produire",
    objectif: generation.title,
    competences: skills,
    dureeEstimeeMin: generation.estimatedDurationMinutes,
    demandeCognitive: generation.cognitiveDemand,
    workspace: generation.family === "explorer" ? "exploration-guidee" : "mini-projet",
    modePreuve: generation.proofMode === "support-seul"
      ? "aucune"
      : generation.proofMode === "jalons-contractuels"
        ? "jalon-contractualise"
        : "soumission-finale",
    contraintes: generation.constraints,
    ressourcesAutorisees: generation.authorizedResources.map((resource) => ({
      id: resource.id,
      libelle: resource.label,
      usage: resource.usage === "normale" ? "normal" : "aide-autorisee",
    })),
    contratEvaluation: generation.evaluationContract.criteria.map((criterion) => ({
      id: criterion.id,
      libelle: criterion.label,
      attendu: criterion.label,
      caractere: criterion.dimension === "transfert"
        ? "transfert"
        : criterion.dimension === "integration"
          ? "integration"
          : "standard",
    })),
    versionContrat: 1,
  };
  const resolution = envTuteur(body.config);
  if (!resolution.ok) return resolution.reponse;
  const moteur = creerMoteur(choisirConfiguration(resolution.env));
  if (!moteur) {
    return Response.json({ erreur: "moteur-absent", message: "Aucun moteur de tuteur disponible." }, { status: 503 });
  }
  const result = await genererContenuActivite(moteur, contract, request.signal);
  if (!result.proposition) {
    return Response.json(
      { erreur: "generation-refusee", message: result.erreur ?? "Le tuteur n'a rendu aucun contenu valide." },
      { status: 422 },
    );
  }
  return Response.json({ proposition: result.proposition });
}

