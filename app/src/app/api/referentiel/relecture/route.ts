import { produireLot } from "@/lib/store/relecture-referentiel";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { ELARGISSEMENT_ACTIF } from "@/lib/domain/propositions-referentiel";

/**
 * Route de relecture du référentiel (ADR-108).
 *
 * ## Pourquoi elle est SÉPARÉE du chemin d'écriture
 *
 * C'est un refus explicite d'ADR-108 : « une création de compétence ne doit
 * jamais échouer parce qu'un fournisseur de modèle a mis quatre secondes ».
 * Aucune commande de référentiel n'appelle cette route, et cette route n'entre
 * dans aucune transaction de référentiel. Elle produit des propositions ; les
 * commandes gouvernées écrivent, et les deux ne se croisent pas.
 *
 * ## Ce que le corps transporte, et ce qu'il ne transporte pas
 *
 * Rien du référentiel. Les intitulés, l'arbre des domaines, les relations
 * déclarées, le travail récent et les deux textes du profil sont relus **côté
 * serveur** sous RLS. C'est ce qui garantit qu'aucun compte ne fait relire le
 * référentiel d'un autre, et que l'`enum` fermé est bien construit à partir du
 * référentiel réel — un `enum` construit depuis le corps de la requête ne
 * fermerait rien du tout.
 *
 * ## Réponse JSON, pas SSE
 *
 * L'appel est unique et ne produit aucun texte à afficher au fil de l'eau :
 * seul l'appel d'outil compte. Même choix que `POST /api/referentiel/tags`.
 *
 * ## Elle n'écrit rien AU RÉFÉRENTIEL
 *
 * Elle enregistre le lot — des faits datés, dans `propositions_referentiel` —
 * et s'arrête là. Retenir une proposition reste un geste de personne, par
 * `retenirProposition`.
 */

export const maxDuration = 300;

interface CorpsRelecture {
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsRelecture = {};
  try {
    corps = (await request.json()) as CorpsRelecture;
  } catch {
    /*
     * Un corps vide est LÉGITIME : la relecture ne prend aucun paramètre, et le
     * déclenchement en tâche de fond au chargement de l'Atelier n'en envoie
     * aucun. Seule la configuration client du moteur peut y figurer.
     */
    corps = {};
  }

  const resolution = envTuteur(corps.config);
  /*
   * Sans moteur, on produit quand même.
   *
   * Les quatre détecteurs déterministes n'ont besoin d'aucun fournisseur, et ce
   * sont eux qui tournaient dans le vide depuis le 18/08. Rendre 503 ici les
   * priverait de surface une seconde fois, pour une raison qui ne les concerne
   * pas. Le lot dit ce qui manque.
   */
  const moteur = resolution.ok ? creerMoteur(choisirConfiguration(resolution.env)) : null;

  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  try {
    const resultat = await produireLot(moteur, {
      elargissementActif: ELARGISSEMENT_ACTIF,
      signal: abandon.signal,
    });
    return Response.json({
      enregistrees: resultat.enregistrees,
      ecartees: resultat.ecartees,
      // Le message d'un fournisseur absent ou lent s'affiche, il ne se masque
      // pas : un lot amputé qui se présente comme complet est pire qu'un lot
      // qui dit ce qui lui manque.
      avertissement: resultat.erreurTuteur,
    });
  } catch (e) {
    if (abandon.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      {
        erreur: "echec",
        message: e instanceof Error ? e.message : "Erreur inattendue pendant la relecture.",
      },
      { status: 500 },
    );
  }
}
