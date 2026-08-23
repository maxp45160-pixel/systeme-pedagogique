import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { proposerReferentiel } from "@/lib/tutor/generation-referentiel";
import { prefixesDistincts } from "@/lib/domain/referentiel-compte";

/**
 * Route de proposition d'un référentiel complet — plusieurs branches.
 *
 * **Route distincte** de `/api/referentiel/suggerer`, et non un drapeau
 * `complet?` sur elle : l'événement terminal change de forme (`branches` au
 * pluriel contre `branche`). Surcharger un événement terminal est la façon dont
 * on casse en silence — le lecteur SSE déréférencerait un champ absent.
 *
 * Les préfixes sont résolus **ici**, côté serveur, par `prefixesDistincts` :
 * « Stoïcisme antique » et « Stoïcisme moderne » donnent tous deux `STO`, et
 * `validerDomaine` refuse un préfixe déjà pris. Sans ce départage, la création
 * multi-branches échouerait sur son entrée la plus probable. Ils restent
 * éditables à l'écran.
 */

export const maxDuration = 300;

interface CorpsProposer {
  sujet?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsProposer;
  try {
    corps = (await request.json()) as CorpsProposer;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const sujet = (corps.sujet ?? "").trim();
  if (!sujet) return Response.json({ erreur: "sujet-vide" }, { status: 400 });

  const resolu = await resoudreMoteur(corps.config, {
    conseil: "Tu peux créer une branche à la main depuis un domaine existant.",
  });
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

  const ctx = await chargerContexte();

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      const resultat = await proposerReferentiel(moteur, ctx.referentiel, sujet, signal, (evenement, donnees) => {
        if (evenement === "proposition") return;
        envoyer(evenement, donnees);
      });

      if (resultat.erreur) {
        envoyer("erreur", { message: resultat.erreur });
        return;
      }

      // Préfixes départagés contre ceux du compte ET entre eux.
      const prefixes = prefixesDistincts(
        resultat.branches.map((b) => ({ nom: b.domaine, prefixe: b.prefixe })),
        ctx.referentiel.domaines.map((d) => d.prefixe),
      );

      envoyer("propositions", {
        resume: resultat.resume,
        ecartees: resultat.ecartees,
        branches: resultat.branches.map((b, i) => ({ ...b, prefixe: prefixes[i] })),
      });
    },
    (e) =>
      e instanceof Error ? e.message : "Erreur inattendue pendant la proposition.",
  );
}
