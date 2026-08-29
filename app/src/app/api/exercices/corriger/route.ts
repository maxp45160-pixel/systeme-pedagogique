import { chargerContexte } from "@/lib/store/context";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { corrigerReponse, REPONSE_MAX_CARACTERES } from "@/lib/tutor/correction";
import { reponseSuffisante } from "@/lib/domain/tentative";

/**
 * Route de correction d'une réponse — sans conversation.
 *
 * ⚠️ **Le corps ne porte ni l'exercice, ni la correction, ni la réponse.** Il
 * ne porte qu'un `attemptId`. Le serveur relit tout via `chargerContexte()`,
 * donc sous RLS, donc pour le compte connecté seulement.
 *
 * Ce choix est le sixième verrou de l'exception à ADR-036, et il en fait plus
 * que ce que son nom suggère. Si le client envoyait l'exercice, n'importe qui
 * pourrait demander une correction sur un énoncé fabriqué ; s'il envoyait la
 * correction de référence, il pourrait la faire dire ce qu'il veut ; et s'il
 * envoyait un `exerciseId` arbitraire, il obtiendrait la correction d'un
 * exercice qu'il ne possède pas — c'est-à-dire une fuite de contenu par un
 * chemin que ADR-036 croyait fermé.
 *
 * Les refus portent des codes distincts. Un 400 générique dirait « ça n'a pas
 * marché » là où l'interface doit savoir s'il faut proposer d'écrire une
 * réponse, de rouvrir une tentative, ou de configurer un moteur.
 */

/**
 * 60 s, et pas une de plus.
 *
 * Le plafond Vercel valait 300 s : personne ne reste devant un écran qui dit
 * « le tuteur relit votre réponse » pendant cinq minutes — mesuré, l'attente
 * vécue dépasse rarement la minute et chaque seconde au-delà de ~20 s se vit
 * comme une panne. C'est désormais le CLIENT qui coupe court (10 s : sortie
 * manuelle proposée ; 25 s : interruption automatique dans
 * `bilan-assiste.tsx`), et l'abandon du flux interrompt la génération côté
 * serveur (`repondreParFluxSse` fusionne `request.signal`). Ce plafond n'est
 * que le dernier filet — il doit rester au-dessus du geste client pour ne pas
 * couper ce que l'interface a déjà arbitré, mais assez bas pour qu'aucune
 * requête orpheline ne consomme le fournisseur pour personne.
 */
export const maxDuration = 60;

interface CorpsCorriger {
  /** La tentative à corriger. Rien d'autre : tout le reste est relu côté serveur. */
  attemptId?: string;
  /** Config saisie côté client (réglages). Prime sur les variables serveur. */
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsCorriger;
  try {
    corps = (await request.json()) as CorpsCorriger;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const attemptId = (corps.attemptId ?? "").trim();
  if (!attemptId) {
    return Response.json({ erreur: "tentative-absente" }, { status: 400 });
  }

  const ctx = await chargerContexte();

  const tentative = ctx.donnees.attempts.find((t) => t.id === attemptId);
  if (!tentative) {
    return Response.json(
      {
        erreur: "tentative-introuvable",
        message: "Cet exercice n'existe pas, ou n'appartient pas à votre compte.",
      },
      { status: 404 },
    );
  }

  // Une tentative close a déjà produit sa observation — ou son abandon. La corriger
  // n'aurait aucun effet sur ce qui est écrit, et ferait croire l'inverse.
  if (tentative.statut !== "en-cours") {
    return Response.json(
      {
        erreur: "tentative-close",
        message: "Cet exercice est déjà terminé. Refaites-en un pour progresser dessus.",
      },
      { status: 400 },
    );
  }

  if (!reponseSuffisante(tentative.reponse)) {
    return Response.json(
      {
        erreur: "reponse-vide",
        message:
          "Il n'y a rien à corriger : écrivez d'abord votre réponse. Le tuteur juge ce qui est écrit, pas ce qu'il devine.",
      },
      { status: 400 },
    );
  }

  /*
   * Refuser plutôt que tronquer.
   *
   * Un verdict rendu sur une réponse amputée aurait l'air d'un verdict rendu
   * sur la réponse entière : l'utilisateur validerait une mesure dérivée d'une
   * entrée partielle sans le savoir. « Une liste tronquée en silence se lirait
   * comme un corpus complet » (ADR-036) — c'est la même règle.
   */
  const reponse = tentative.reponse ?? "";
  if (reponse.length > REPONSE_MAX_CARACTERES) {
    return Response.json(
      {
        erreur: "reponse-trop-longue",
        message: `Réponse trop longue (plus de ${REPONSE_MAX_CARACTERES} caractères). Gardez l'essentiel, puis relancez la correction.`,
      },
      { status: 400 },
    );
  }

  const exercice = ctx.donnees.exercises.find((e) => e.id === tentative.exerciseId);
  if (!exercice) {
    return Response.json(
      { erreur: "exercice-introuvable", message: "L'exercice de cette tentative est introuvable." },
      { status: 404 },
    );
  }

  /*
   * Mesure de la relecture (25/08/2026). Une correction qui dépasse la minute
   * était signalée comme un ressenti, jamais comme un fait : sans chiffre, on
   * ne pouvait ni comparer les fournisseurs, ni savoir si l'attente portait sur
   * le premier jeton (fournisseur lent) ou sur la fin (verdict long à écrire).
   * La ligne part dans les logs de la route : TTFT, durée totale, fournisseur,
   * modèle et issue. Il n'existe aucun retry automatique dans les moteurs —
   * chaque appel est unique, donc `reessais` vaut toujours zéro ; le champ
   * existe pour que la comparaison future ne réécrive pas le format.
   */
  const debutCorrection = Date.now();
  let ttftMs: number | null = null;

  const resolu = await resoudreMoteur(corps.config, {
    conseil: "Réessayez la correction ou terminez sans mesure.",
  });
  if (!resolu.ok) return resolu.reponse;
  const { moteur } = resolu;

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      const resultat = await corrigerReponse(moteur, exercice, reponse, signal, (evenement, donnees) => {
        // Même filtre que la route de suggestion : l'événement terminal
        // s'appelle `proposition` et porte une forme différente de celle du
        // moteur. Surcharger un événement terminal casse en silence.
        if (evenement === "proposition") return;
        ttftMs ??= Date.now() - debutCorrection;
        envoyer(evenement, donnees);
      });

      console.log(
        JSON.stringify({
          mesure: "correction",
          fournisseur: resolu.fournisseur,
          modele: resolu.modele,
          ttft_ms: ttftMs,
          total_ms: Date.now() - debutCorrection,
          reessais: 0,
          issue: resultat.erreur ? "echec" : "ok",
          interrompue: signal.aborted || undefined,
        }),
      );

      if (resultat.erreur) {
        envoyer("erreur", { message: resultat.erreur });
        return;
      }

      // Le verdict part au client pour relecture. Rien n'est écrit ici : la
      // seule écriture reste `terminerExercice`, déclenchée par un clic (P5).
      envoyer("proposition", { correction: resultat.correction });
    },
    (e) =>
      e instanceof Error
        ? e.message
        : "Quelque chose n'a pas fonctionné pendant la correction.",
  );
}
