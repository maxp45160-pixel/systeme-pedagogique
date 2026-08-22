import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { suggererBranche } from "@/lib/tutor/generation-referentiel";
import { serialiserProfilDeclare } from "@/lib/domain/profil";

/**
 * Route de suggestion d'une branche de compétences — sans conversation.
 *
 * Calquée sur `/api/exercices/generer` : même choix de moteur, même abandon
 * propagé par `request.signal`, même honnêteté (503 sans moteur). La
 * différence est dans l'outil : `proposer_referentiel` ne porte AUCUN code —
 * l'application les attribue à l'enregistrement (ADR-026).
 *
 * **Route et non Server Function** : seule la requête client peut porter la
 * config `localStorage` (`cle-client.ts`).
 *
 * La progression est diffusée en SSE pour que la modale ne soit jamais un
 * écran figé. La proposition est renvoyée au client, qui la prévisualise puis
 * l'enregistre via `creerBranche` — le tuteur propose, l'utilisateur valide
 * (P5).
 */

export const maxDuration = 300;

interface CorpsSuggerer {
  /** Le sujet sur lequel on veut une branche. */
  sujet?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsSuggerer;
  try {
    corps = (await request.json()) as CorpsSuggerer;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const sujet = (corps.sujet ?? "").trim();
  if (sujet.length === 0) {
    return Response.json({ erreur: "sujet-vide" }, { status: 400 });
  }

  const resolu = resoudreMoteur(corps.config);
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

  const ctx = await chargerContexte();

  return repondreParFluxSse(request, async (envoyer, signal) => {
    /*
     * Le relais est filtré sur `proposition`, et ce n'est pas un détail.
     *
     * Le moteur émet `proposition` avec `{ genre, branche }` ; cette route
     * émet son propre `proposition` terminal avec `{ branche }`. Les deux
     * portent le même nom pour le lecteur SSE de la modale, qui déréférence
     * `parsed.branche.domaine` — une proposition d'un autre genre le ferait
     * lever. Seul l'événement terminal, construit après validation, sort
     * sous ce nom. Le reste (`proposition-en-cours`, `proposition-rejetee`,
     * `tronque`…) passe au fil de l'eau, ce qui est tout l'objet du relais.
     */
    const resultat = await suggererBranche(
      moteur,
      ctx.referentiel,
      sujet,
      signal,
      (evenement, donnees) => {
        if (evenement === "proposition") return;
        envoyer(evenement, donnees);
      },
      serialiserProfilDeclare(ctx.donnees.user),
    );

    if (resultat.erreur) {
      envoyer("erreur", { message: resultat.erreur });
      return;
    }

    // La proposition est renvoyée au client pour prévisualisation.
    // L'écriture n'a lieu qu'après validation explicite de l'utilisateur.
    envoyer("proposition", { branche: resultat.branche });
  });
}
