import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
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

  const resolu = resoudreMoteur(corps.config);
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

  const ctx = await chargerContexte();

  // Les compétences demandées doivent appartenir au périmètre actif : un
  // exercice attaché à une compétence inexistante produirait des observations que
  // rien ne lirait. `creerExercice` refuse déjà, mais on le dit ici avant de
  // dépenser une génération.
  /*
   * Un code hors périmètre n'est pas retiré en silence : il est écarté de la
   * demande ET annoncé au client (événement `avertissement`). Sans cela,
   * demander deux compétences dont une archivée produisait un exercice unique
   * sans explication — l'utilisateur croyait à un refus partiel du tuteur.
   */
  const ignorees: string[] = [];
  const demandes = codes.flatMap((code) => {
    const etat = ctx.etatsParCode.get(code.toUpperCase());
    if (!etat) {
      ignorees.push(code);
      return [];
    }
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

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      if (ignorees.length > 0) {
        envoyer("avertissement", {
          message: `${ignorees.length} compétence${ignorees.length > 1 ? "s" : ""} ignorée${ignorees.length > 1 ? "s" : ""} — hors périmètre actif : ${ignorees.join(", ")}.`,
          codes: ignorees,
        });
      }

      const resultat = await genererExercices(moteur, ctx.referentiel, demandes, signal, envoyer);

      if (resultat.erreur) {
        envoyer("erreur", { message: resultat.erreur });
        return;
      }

      // Les propositions sont renvoyées au client pour prévisualisation.
      // L'écriture n'a lieu qu'après validation explicite de l'utilisateur.
      envoyer("propositions", { exercices: resultat.exercices });
    },
    (e) =>
      e instanceof Error ? e.message : "Erreur inattendue lors de la génération.",
  );
}
