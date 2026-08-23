import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { traduireIntention, type CompetenceCandidate } from "@/lib/tutor/intention";
import {
  besoinValide,
  demandeSeanceSansSujet,
  forcerTraductionIntention,
  type TraductionIntention,
} from "@/lib/domain/intention";
import { serialiserProfilDeclare } from "@/lib/domain/profil";

/**
 * Route de traduction d'un besoin — le chemin du bouton `+`.
 *
 * Calquée sur `/api/referentiel/suggerer` : même choix de moteur, même abandon
 * propagé par `request.signal`, même honnêteté (503 sans moteur), même flux SSE
 * pour que l'écran ne soit jamais figé pendant un appel d'outil, qui n'émet
 * aucun texte.
 *
 * **Route et non Server Function** : seule la requête client peut porter la
 * config `localStorage` (`cle-client.ts`).
 *
 * Les compétences mises en avant sont calculées **ici**, par le moteur, et
 * passées au tuteur en tant que faits. Le tuteur choisit parmi elles ; il ne
 * les découvre pas et n'en affirme jamais l'état (P5).
 */

export const maxDuration = 300;

/**
 * Combien de compétences le prompt met en avant.
 *
 * Le référentiel entier voyagerait à chaque ouverture du `+`, pour une décision
 * qui se joue sur les premières lignes du classement. Les codes *désignables*,
 * eux, ne sont pas plafonnés : ils sont dans l'`enum` du schéma, où ils coûtent
 * beaucoup moins qu'un intitulé et une raison.
 */
const CANDIDATES_MAX = 12;

/**
 * Budget de temps de la traduction, côté serveur.
 *
 * Le garde-fou du moteur est à cinq minutes : il protège du silence, pas de la
 * lenteur. Sur ce chemin-ci, une attente d'une minute et demie a été mesurée
 * pour une décision entre cinq genres — l'écran ne peut rien en faire, et la
 * personne a déjà abandonné.
 *
 * Au-delà de ce budget l'appel est coupé et l'écran le dit, avec le besoin
 * intact dans la zone de saisie : reformuler ou réessayer reste possible, ce
 * qu'une attente ouverte n'offrait pas.
 */
const DELAI_TRADUCTION_MS = 25_000;

interface CorpsIntention {
  /** Le besoin, en langage libre. */
  besoin?: string;
  /** Contexte d'origine de la demande (ex: "domaine", ou l'indice d'amorçage "projet"/"referentiel"). */
  contexte?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
}

/**
 * Les contextes connus de la traduction. Toute autre valeur est ignorée plutôt
 * que transmise : un client qui inventerait un contexte ne doit pas glisser une
 * chaîne arbitraire dans le prompt.
 */
const CONTEXTES_CONNUS = new Set(["general", "domaine", "projet", "referentiel"]);

export async function POST(request: Request) {
  let corps: CorpsIntention;
  try {
    corps = (await request.json()) as CorpsIntention;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const besoin = (corps.besoin ?? "").trim();
  if (!besoinValide(besoin)) {
    return Response.json({ erreur: "besoin-invalide" }, { status: 400 });
  }
  const contexte =
    corps.contexte && CONTEXTES_CONNUS.has(corps.contexte) ? corps.contexte : undefined;

  /*
   * Court-circuit déterministe — le moteur n'est pas appelé quand sa réponse
   * est de toute façon réécrite.
   *
   * Les recadrages « domaine » et « séance sans sujet » remplacent CHAQUE
   * champ de l'action : genre, titre, pourquoi, codes, sujet. Il ne restait de
   * la traduction du modèle que `alternatives`, que l'écran n'affiche pas
   * quand le genre est imposé. Le compte payait donc la latence complète d'un
   * appel dont rien n'était conservé.
   *
   * L'implémentation est celle du domaine (`forcerTraductionIntention`),
   * partagée avec le recadrage post-appel appliqué par `traduireIntention` —
   * une seule définition des libellés et des raisons annoncés.
   *
   * Placé AVANT `envTuteur` : ces deux chemins n'ont plus besoin d'un moteur
   * configuré, donc plus de 503 possible sur eux. (Le troisième recadrage —
   * demande explicite de compétences ou vue d'ensemble — reste post-appel :
   * la traduction du modèle y est conservée quand elle ne contredit pas.)
   */
  if (contexte === "domaine" || demandeSeanceSansSujet(besoin)) {
    const reponse = courtCircuit(besoin, contexte);
    if (reponse) return reponse;
  }

  /*
   * Profil `rapide` : cette route choisit une action, elle n'écrit aucun
   * contenu et ne produit aucune mesure. Le schéma de `traduire_intention`
   * ferme déjà les genres et les codes désignables — ce qu'un modèle plus petit
   * pourrait inventer est refusé avant d'arriver ici. Voir `ProfilMoteur`.
   */
  const resolu = await resoudreMoteur(corps.config, {
    profil: "rapide",
    conseil: "En attendant, les destinations restent accessibles depuis le menu.",
  });
  if (!resolu.ok) return resolu.reponse;
  const { moteur, modele } = resolu;

  const debutContexte = Date.now();
  const ctx = await chargerContexte();
  const dureeContexteMs = Date.now() - debutContexte;

  const candidates: CompetenceCandidate[] = ctx.recommandations
    .slice(0, CANDIDATES_MAX)
    .map((recommandation) => ({
      code: recommandation.etat.skill.code,
      intitule: recommandation.etat.skill.intitule,
      domaine:
        ctx.referentiel.domainesParId.get(recommandation.etat.skill.domaine)?.nom
        ?? recommandation.etat.skill.domaine,
      raison: recommandation.raison,
    }));

  return repondreParFluxSse(request, async (envoyer, signal) => {
    /*
     * Les durées passent au client avant tout le reste : quand la traduction
     * échoue ou traîne, c'est le découpage — lecture du compte contre appel
     * au fournisseur — qui dit où chercher. L'écran les ignore ; l'onglet
     * réseau, non.
     */
    envoyer("mesure", { etape: "contexte", dureeMs: dureeContexteMs });
    const debutTraduction = Date.now();

    /*
     * Le relais est filtré sur `proposition`, pour la même raison que dans
     * `/api/referentiel/suggerer` : le moteur émet `proposition` avec
     * `{ genre, traduction }`, cette route émet son propre `proposition`
     * terminal avec `{ traduction }`. Le lecteur SSE de l'écran déréférence
     * `traduction.action` — une proposition d'un autre genre le ferait
     * lever. Le reste (`proposition-en-cours`, `proposition-rejetee`…)
     * passe au fil de l'eau, ce qui est tout l'objet du relais.
     */
    const resultat = await traduireIntention(
      moteur,
      ctx.referentiel,
      besoin,
      candidates,
      signal,
      (evenement, donnees) => {
        if (evenement === "proposition") return;
        envoyer(evenement, donnees);
      },
      serialiserProfilDeclare(ctx.donnees.user),
      contexte,
      DELAI_TRADUCTION_MS,
    );

    envoyer("mesure", {
      etape: "traduction",
      dureeMs: Date.now() - debutTraduction,
      modele,
    });

    if (resultat.erreur) {
      envoyer("erreur", { message: resultat.erreur });
      return;
    }

    /*
     * Les recadrages déterministes (`forcerTraductionIntention`, appliqués
     * dans `traduireIntention`) peuvent contredire la traduction du modèle —
     * c'est leur rôle : ils corrigent des lectures erronées déjà mesurées.
     * Mais une contradiction silencieuse se vit comme une incompréhension :
     * « j'ai demandé X, on me propose Y ». Chaque recadrage qui s'applique
     * est donc annoncé à l'écran avant la proposition, avec sa raison.
     *
     * Les deux recadrages inconditionnels — contexte « domaine » et séance
     * sans sujet — sont rendus en court-circuit avant tout appel : ils ne
     * peuvent plus se présenter ici.
     */
    if (resultat.raisonRecadrage) {
      envoyer("avertissement", { message: resultat.raisonRecadrage });
    }

    envoyer("proposition", { traduction: resultat.traduction });
  }, (e) =>
    e instanceof Error ? e.message : "Erreur inattendue lors de la traduction.");
}

/**
 * Rend un flux SSE d'un seul tenant pour un recadrage déjà connu — aucun
 * réseau n'est touché, la réponse part dans la milliseconde. Les conditions
 * d'appel garantissent que le recadrage s'applique ; sinon la route suit le
 * chemin normal plutôt que de rendre une réponse vide.
 */
function courtCircuit(besoin: string, contexte?: string): Response | null {
  const forcee = forcerTraductionIntention(null, besoin, contexte);
  if (!forcee.traduction || !forcee.raison) return null;
  return fluxImmediat(forcee.traduction, forcee.raison);
}

/**
 * Un flux SSE d'un seul tenant, pour une traduction déjà connue.
 *
 * Même forme d'événements que le chemin avec moteur — `avertissement` puis
 * `proposition` — parce que le lecteur de l'écran est le même. Ce qui change
 * est qu'aucun réseau n'est touché : la réponse part dans la milliseconde.
 */
function fluxImmediat(traduction: TraductionIntention, avertissement: string): Response {
  const encodeur = new TextEncoder();
  const flux = new ReadableStream({
    start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        controller.enqueue(
          encodeur.encode(`event: ${evenement}
data: ${JSON.stringify(donnees)}

`),
        );
      };
      envoyer("avertissement", { message: avertissement });
      envoyer("proposition", { traduction });
      controller.close();
    },
  });

  return new Response(flux, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

