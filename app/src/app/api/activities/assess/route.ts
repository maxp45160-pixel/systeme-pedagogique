import { chargerContexte } from "@/lib/store/context";
import { loadAdaptiveWorkspace } from "@/lib/store/adaptive-learning";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import { envTuteur } from "@/lib/tutor/env-requete";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { proposerEvaluationProjet, type DemandeEvaluationProjet } from "@/lib/tutor/adaptive-generation";

export const maxDuration = 300;

interface AssessBody {
  runId?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let body: AssessBody;
  try {
    body = await request.json() as AssessBody;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }
  if (!body.runId) return Response.json({ erreur: "requete-incomplete" }, { status: 400 });
  const ctx = await chargerContexte();
  /*
   * Pas de garde `learningLoopMode`.
   *
   * Le drapeau protège l'arbitrage automatique du moteur. Ici l'exécution
   * existe déjà et la personne demande une relecture de sa propre production :
   * refuser au motif que l'arbitrage est éteint rendrait un projet ouvert
   * inévaluable. Ce que la relecture peut faire reste borné par le contrat,
   * et sa proposition n'est jamais une mesure.
   */
  const state = await loadAdaptiveWorkspace(body.runId);
  if (!state || state.activity.family !== "produire" || state.run.status !== "en-cours") {
    return Response.json({ erreur: "projet-introuvable" }, { status: 404 });
  }
  const content = state.artifact?.content.body;
  if (typeof content !== "string" || !content.trim()) {
    return Response.json({ erreur: "artefact-absent", message: "Enregistre un artefact avant la relecture." }, { status: 400 });
  }
  if (state.run.currentArtifact?.kind === "lien-externe") {
    return Response.json({ erreur: "artefact-non-gele", message: "Un lien modifiable reste un support et n'est pas relu comme preuve." }, { status: 400 });
  }
  const demand: DemandeEvaluationProjet = {
    titre: state.activity.title,
    brief: state.activity.workspaceContent?.brief ?? state.activity.description,
    artefact: {
      id: `${state.run.id}:version:${state.artifact!.version}`,
      type: "contenu-copie",
      contenu: content,
    },
    criteres: state.activity.evaluationContract.criteria.map((criterion) => ({
      id: criterion.id,
      libelle: criterion.label,
      attendu: criterion.label,
      caractere: criterion.dimension === "transfert"
        ? "transfert"
        : criterion.dimension === "integration"
          ? "integration"
          : "standard",
    })),
    ressourcesAutorisees: state.activity.authorizedResources.map((resource) => ({
      id: resource.id,
      libelle: resource.label,
      usage: resource.usage === "normale" ? "normal" : "aide-autorisee",
    })),
    aidesObservees: state.events.flatMap((event) => event.type === "aide" ? [{
      type: event.helpKind === "correction" ? "autre" as const : event.helpKind,
      description: event.detail ?? event.helpKind,
      ressourceId: event.resourceId ?? null,
    }] : []),
  };
  const resolution = envTuteur(body.config);
  if (!resolution.ok) return resolution.reponse;
  const moteur = creerMoteur(choisirConfiguration(resolution.env));
  if (!moteur) {
    return Response.json({ erreur: "moteur-absent", message: "Aucun moteur de tuteur disponible." }, { status: 503 });
  }
  const result = await proposerEvaluationProjet(moteur, demand, request.signal);
  if (!result.proposition) {
    return Response.json(
      { erreur: "evaluation-refusee", message: result.erreur ?? "Aucune proposition exploitable." },
      { status: 422 },
    );
  }
  return Response.json({ proposition: result.proposition, artifactVersion: state.artifact!.version });
}
