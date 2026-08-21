import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { evaluerExplication } from "@/lib/tutor/explication";
import { verifierTexteExplication } from "@/lib/domain/explication";

export const maxDuration = 120;

interface CorpsEvaluerExplication {
  skillCode?: string;
  texteExplication?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsEvaluerExplication;
  try {
    corps = (await request.json()) as CorpsEvaluerExplication;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const skillCode = (corps.skillCode ?? "").trim();
  const texteExplication = (corps.texteExplication ?? "").trim();

  if (!skillCode) {
    return Response.json({ erreur: "competence-absente" }, { status: 400 });
  }

  const verif = verifierTexteExplication(texteExplication);
  if (!verif.valide) {
    return Response.json({ erreur: "texte-invalide", message: verif.erreur }, { status: 400 });
  }

  const ctx = await chargerContexte();
  const skill = ctx.referentiel.parCode.get(skillCode);
  if (!skill) {
    return Response.json(
      { erreur: "competence-introuvable", message: "Cette compétence n'existe pas dans votre référentiel." },
      { status: 404 },
    );
  }

  const domaine = ctx.referentiel.domainesParId.get(skill.domaine);

  const resolu = resoudreMoteur(corps.config, {
    conseil: "Configurez une clé d'API dans les réglages pour utiliser le tuteur.",
  });
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      const resultat = await evaluerExplication(moteur, skill, texteExplication, domaine, signal, (evenement, donnees) => {
        if (evenement === "proposition") return;
        envoyer(evenement, donnees);
      });

      if (resultat.erreur) {
        envoyer("erreur", { message: resultat.erreur });
        return;
      }

      envoyer("proposition", { evaluation: resultat.evaluation });
    },
    (e) => (e instanceof Error ? e.message : "Erreur pendant l'évaluation."),
  );
}
