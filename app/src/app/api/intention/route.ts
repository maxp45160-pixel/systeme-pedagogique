import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { traduireIntention, type CompetenceCandidate } from "@/lib/tutor/intention";
import {
  analyserDemandeReferentiel,
  besoinValide,
  demandeSeanceSansSujet,
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

interface CorpsIntention {
  /** Le besoin, en langage libre. */
  besoin?: string;
  /** Contexte d'origine de la demande (ex: "domaine"). */
  contexte?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
}

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

  // Point d'entrée unique : la config client est validée avant de toucher
  // l'environnement du serveur (SSRF, voir lib/tutor/url-fournisseur.ts).
  const resolution = envTuteur(corps.config);
  if (!resolution.ok) return resolution.reponse;
  const choix = choisirConfiguration(resolution.env);
  const moteur = creerMoteur(choix);

  if (!moteur) {
    return Response.json(
      {
        erreur: "moteur-absent",
        message:
          choix.kind === "aucun"
            ? `${choix.raison} En attendant, les destinations restent accessibles depuis le menu.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const ctx = await chargerContexte();

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

  const encodeur = new TextEncoder();
  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  const flux = new ReadableStream({
    async start(controller) {
      const envoyer = (evenement: string, donnees: unknown) => {
        if (abandon.signal.aborted) return;
        controller.enqueue(
          encodeur.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`),
        );
      };

      try {
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
          abandon.signal,
          (evenement, donnees) => {
            if (evenement === "proposition") return;
            envoyer(evenement, donnees);
          },
          serialiserProfilDeclare(ctx.donnees.user),
          corps.contexte,
        );

        if (resultat.erreur) {
          envoyer("erreur", { message: resultat.erreur });
          return;
        }

        /*
         * Les cadrages déterministes (`forcer*`) peuvent contredire la
         * traduction du modèle — c'est leur rôle : ils corrigent des lectures
         * erronées déjà mesurées. Mais une contradiction silencieuse se vit
         * comme une incompréhension : « j'ai demandé X, on me propose Y ».
         * Chaque forçage qui s'applique est donc annoncé à l'écran avant la
         * proposition, avec sa raison.
         */
        const cadrage = analyserDemandeReferentiel(besoin, corps.contexte);
        let raisonForcage: string | null = null;
        let traduction: TraductionIntention | null = resultat.traduction;

        if (corps.contexte === "domaine") {
          raisonForcage =
            "Tu écris depuis le point d'entrée « nouveau domaine » : la demande est traitée comme la structuration d'un domaine.";
          traduction = forcerDomaineReferentiel(resultat.traduction, besoin);
        } else if (demandeSeanceSansSujet(besoin)) {
          raisonForcage =
            "Ta demande ne désigne aucun sujet précis : elle est traitée comme la préparation d'une séance libre.";
          traduction = forcerSeanceSansSujet(resultat.traduction, besoin);
        } else if (
          resultat.traduction &&
          cadrage.explicite &&
          (cadrage.type === "competence" || cadrage.portee === "large")
        ) {
          raisonForcage =
            cadrage.type === "competence"
              ? "Ta demande désigne explicitement une ou plusieurs compétences à ajouter : elle est traitée comme une extension du référentiel."
              : "Ta demande porte sur une vue d'ensemble : elle est traitée comme la structuration d'un domaine plutôt que comme un entraînement.";
          traduction = forcerExtensionReferentiel(
            resultat.traduction,
            besoin,
            cadrage.type === "competence",
            cadrage.intitules,
          );
        }

        if (raisonForcage) {
          envoyer("avertissement", { message: raisonForcage });
        }

        envoyer("proposition", { traduction });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue lors de la traduction.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* flux déjà annulé côté client */
        }
      }
    },
    cancel() {
      abandon.abort();
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

function forcerDomaineReferentiel(
  traduction: TraductionIntention | null,
  besoin: string,
): TraductionIntention {
  const sujet = besoin.trim();
  return {
    ...(traduction ?? { alternatives: [] }),
    action: {
      ...(traduction?.action ?? {
        codes: [],
      }),
      genre: "referentiel",
      titre: `Structurer le domaine « ${sujet} »`,
      pourquoi: "Ce domaine sera découpé en compétences pour enrichir ton Atelier.",
      codes: [],
      sujet,
    },
  };
}

function forcerSeanceSansSujet(
  traduction: TraductionIntention | null,
  besoin: string,
): TraductionIntention {
  return {
    ...(traduction ?? { alternatives: [] }),
    action: {
      ...(traduction?.action ?? {
        genre: "travail" as const,
        titre: "Préparer une séance",
        pourquoi: "Aucun sujet n’a été imposé.",
      }),
      genre: "travail",
      titre: "Préparer une séance",
      pourquoi: "Aucun sujet n’a été imposé : tu choisiras la portée dans le compositeur.",
      codes: [],
      sujet: besoin.trim(),
    },
  };
}

function forcerExtensionReferentiel(
  traduction: TraductionIntention,
  besoin: string,
  competence: boolean,
  intitules: string[],
): TraductionIntention {
  const sujet = besoin.trim();
  const libelle =
    competence && intitules.length === 1
      ? `Ajouter la compétence « ${intitules[0]} »`
      : competence
        ? "Ajouter les compétences précisées dans la demande"
        : "Structurer le domaine demandé";

  return {
    ...traduction,
    action: {
      ...traduction.action,
      genre: "referentiel",
      titre: libelle,
      pourquoi: competence
        ? "La demande désigne explicitement une ou plusieurs compétences à ajouter."
        : "La demande porte sur une vue d’ensemble qui doit être organisée avant l’apprentissage.",
      codes: [],
      sujet,
    },
  };
}
