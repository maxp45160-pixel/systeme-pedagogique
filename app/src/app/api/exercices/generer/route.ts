import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { genererExercices } from "@/lib/tutor/generation";
import type { PropositionExercice } from "@/lib/tutor/proposition";

/**
 * Route de génération d'exercices — sans conversation.
 *
 * Calquée sur `/api/tutor` : même choix de moteur, même abandon propagé par
 * `request.signal`, même honnêteté (503 sans moteur). La différence est dans
 * la demande : un seul message synthétique, et `envoyer` collecte les
 * propositions au lieu de les diffuser.
 *
 * **Route et non Server Function** : seule la requête client peut porter la
 * config `localStorage` (`cle-client.ts`). La config saisie dans les réglages
 * prime sur `process.env`, exactement comme pour le chat.
 *
 * La progression est diffusée en SSE pour que la modale ne soit jamais un
 * écran figé. Les propositions sont renvoyées au client, qui les prévisualise
 * puis les enregistre via `creerExercice` — le tuteur propose, l'utilisateur
 * valide (P5).
 */

export const maxDuration = 300;

interface CorpsGenerer {
  /** Codes des compétences cibles. */
  competences?: string[];
  /** Indice de rédaction facultatif. */
  theme?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
  /** Révision d'une proposition non enregistrée, demandée par la personne. */
  modification?: {
    consigne?: string;
    proposition?: PropositionExercice;
  };
}

/*
 * Un champ `combien` a été retiré ici : il était déclaré « Défaut : 1 » et
 * n'était lu nulle part. Les « 2-3 d'avance » du plan (§1.3) supposent une
 * recharge de fond après enregistrement — donc une écriture côté serveur, sans
 * relecture — et c'est un geste à poser explicitement, pas à laisser deviner
 * par un paramètre inerte. Tant qu'il n'est pas branché, la route génère un
 * exercice par compétence demandée, et le dit.
 */

export async function POST(request: Request) {
  let corps: CorpsGenerer;
  try {
    corps = (await request.json()) as CorpsGenerer;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const codes = (corps.competences ?? []).filter((c) => c.trim().length > 0);
  if (codes.length === 0) {
    return Response.json({ erreur: "aucune-competence" }, { status: 400 });
  }

  const consigneModification = corps.modification?.consigne?.trim();
  const propositionModification = corps.modification?.proposition;
  if (corps.modification && (!consigneModification || consigneModification.length > 1_000 || !propositionModification)) {
    return Response.json(
      {
        erreur: "modification-invalide",
        message: "Décris la modification attendue en 1 000 caractères au plus.",
      },
      { status: 400 },
    );
  }

  // La config client (si présente) prime sur `process.env` : l'utilisateur qui
  // a saisi sa clé dans les réglages n'a pas à éditer `app/.env.local`.
  // Point d'entree unique : la config client est validee avant de toucher
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
            ? `${choix.raison} Utilise le mode « copier le contexte » en attendant.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const ctx = await chargerContexte();

  // Les compétences demandées doivent appartenir au périmètre actif : un
  // exercice attaché à une compétence inexistante produirait des preuves que
  // rien ne lirait. `creerExercice` refuse déjà, mais on le dit ici avant de
  // dépenser une génération.
  const demandes = codes.flatMap((code) => {
    const etat = ctx.etatsParCode.get(code.toUpperCase());
    if (!etat) return [];
    return [
      {
        competence: etat.skill,
        calibration: ctx.calibrations.get(etat.skill.code) ?? null,
        theme: corps.theme,
        ...(consigneModification && propositionModification
          ? {
              modification: {
                consigne: consigneModification,
                proposition: propositionModification,
              },
            }
          : {}),
      },
    ];
  });

  if (demandes.length === 0) {
    return Response.json(
      {
        erreur: "competences-hors-perimetre",
        message: "Aucune des compétences demandées n'appartient à ton périmètre actif.",
      },
      { status: 400 },
    );
  }

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
        const resultat = await genererExercices(
          moteur,
          ctx.referentiel,
          demandes,
          abandon.signal,
          envoyer,
        );

        if (resultat.erreur) {
          envoyer("erreur", { message: resultat.erreur });
          return;
        }

        // Les propositions sont renvoyées au client pour prévisualisation.
        // L'écriture n'a lieu qu'après validation explicite de l'utilisateur.
        envoyer("propositions", { exercices: resultat.exercices });
      } catch (e) {
        if (abandon.signal.aborted) return;
        envoyer("erreur", {
          message: e instanceof Error ? e.message : "Erreur inattendue lors de la génération.",
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
