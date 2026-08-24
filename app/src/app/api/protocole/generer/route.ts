import { chargerContexte } from "@/lib/store/context";
import { lireDocument } from "@/lib/store/documents";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { extraireTexteSupportAction } from "@/lib/store/extraction-pdf";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { genererProtocole } from "@/lib/tutor/generation-protocole";
import {
  estIntentionCours,
  motifRefusIntentionLibre,
} from "@/lib/domain/protocole-cours";

/**
 * Route de génération du plan de révision d'un cours (ADR-130).
 *
 * Calquée sur `/api/intention` : même choix de moteur via `resoudreMoteur`
 * (le quota de la clé serveur est décompté là et nulle part ailleurs,
 * ADR-116), même abandon propagé, même honnêteté. La différence est dans la
 * demande : le serveur relit lui-même la fiche, le texte extrait du PDF et le
 * référentiel actif — le client ne porte que l'intention déclarée, qui est un
 * fait de la personne, pas une donnée de confiance.
 *
 * **Route et non Server Action** : seule la requête client peut porter la
 * config `localStorage` (`cle-client.ts`), et la progression part en SSE.
 *
 * La sortie est une proposition : rien n'est écrit ici. La relecture case par
 * case, puis la création des séances, appartiennent à l'écran et aux actions
 * d'écriture (`protocole-actions.ts`).
 */

export const maxDuration = 300;

interface CorpsProtocole {
  ficheId?: string;
  intention?: string;
  intentionLibre?: string;
  config?: ConfigTuteurClient;
}

/**
 * Délai de la conception seule (appel fournisseur), en millisecondes.
 *
 * Mesuré en isolation le 24/08/2026 : le fournisseur répond en ~4 s avec le
 * vrai schéma et 149 codes. Au-delà de deux minutes, ce n'est plus « lent »,
 * c'est en panne.
 */
const DELAI_CONCEPTION_MS = 120_000;

/**
 * Délai global du chemin entier, préparation comprise.
 *
 * Le hang du 24/08/2026 (9 minutes sans un seul événement) ne s'est JAMAIS
 * produit dans la génération — il est arrivé avant, dans une étape de
 * préparation qui laissait la requête sans réponse et l'écran sans événement.
 * Toutes les étapes vivent donc DANS le flux, et ce budget global les couvre
 * toutes : quoi qu'il arrive, l'écran reçoit un verdict avant 2 min 30.
 */
const DELAI_GLOBAL_MS = 150_000;

export async function POST(request: Request) {
  let corps: CorpsProtocole;
  try {
    corps = (await request.json()) as CorpsProtocole;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const ficheId = (corps.ficheId ?? "").trim();
  if (!ficheId) return Response.json({ erreur: "fiche-vide" }, { status: 400 });

  const intention = corps.intention;
  if (!estIntentionCours(intention)) {
    return Response.json({ erreur: "intention-inconnue" }, { status: 400 });
  }
  const intentionLibre = (corps.intentionLibre ?? "").trim();
  const refusLibre = motifRefusIntentionLibre(intentionLibre);
  if (refusLibre) {
    return Response.json({ erreur: "intention-libre-invalide", message: refusLibre }, { status: 400 });
  }

  const debut = Date.now();
  const loguer = (etape: string) =>
    console.error(`[protocole] ${Date.now() - debut}ms — ${etape}`);

  return repondreParFluxSse(
    request,
    async (envoyer, signal) => {
      /*
       * Le budget global court sur TOUT le chemin — lecture de la fiche,
       * extraction du PDF, quota, contexte, génération. Chaque étape est
       * journalisée avec son horodatage : si un jour ça rame encore, le
       * terminal dit quelle étape, au millimètre.
       */
      const budgetGlobal = AbortSignal.timeout(DELAI_GLOBAL_MS);
      const verdictDelai = new Promise<"delai">((resoudre) => {
        budgetGlobal.addEventListener("abort", () => resoudre("delai"), { once: true });
      });

      const travail = (async (): Promise<"fin"> => {
        loguer("flux ouvert — lecture de la fiche");
        // La fiche est relue côté serveur : seule une fiche support — celle
        // qui porte le PDF — a un plan à concevoir.
        const fiche = await lireDocument(ficheId).catch((cause: unknown) => {
          loguer(`échec lecture fiche : ${cause instanceof Error ? cause.message : "inconnu"}`);
          return null;
        });
        if (!fiche) {
          envoyer("erreur", { message: "La fiche du cours n'a pas pu être relue." });
          return "fin";
        }
        const analyse = analyserDocumentMarkdown(fiche.id, fiche.contenuMd);
        if (analyse.frontMatter.role !== "support") {
          envoyer("erreur", { message: "Ce document n'est pas une fiche support de cours." });
          return "fin";
        }
        loguer(`fiche lue (« ${analyse.titre} »)`);

        // Le texte du PDF vient du cache borné existant (ADR-113). Un échec
        // d'extraction est un échec affiché : rien n'est fabriqué.
        const extrait = await extraireTexteSupportAction(ficheId).catch((cause: unknown) => {
          loguer(`échec extraction : ${cause instanceof Error ? cause.message : "inconnu"}`);
          return null;
        });
        if (!extrait?.extrait?.trim()) {
          envoyer("erreur", {
            message:
              "Le texte du PDF n'a pas pu être extrait. Réessaie ; si ça persiste, dépose à nouveau le PDF.",
          });
          return "fin";
        }
        loguer(`extraction ok (${extrait.extrait.length} caractères)`);

        const resolu = await resoudreMoteur(corps.config, {
          conseil: "Vous pouvez composer vos séances à la main en attendant.",
        });
        if (!resolu.ok) {
          const message = await resolu.reponse
            .clone()
            .json()
            .catch(() => null)
            .then((d) => (d as { message?: string } | null)?.message)
            .catch(() => null);
          envoyer("erreur", { message: message ?? "La conception n'a pas pu démarrer." });
          return "fin";
        }
        loguer(`moteur résolu (${resolu.modele ?? "inconnu"})`);

        const ctx = await chargerContexte();
        const competences = ctx.referentiel.actifs.map((skill) => ({
          code: skill.code,
          intitule: skill.intitule,
        }));
        loguer(`contexte chargé (${competences.length} compétences actives)`);

        const echeance = AbortSignal.timeout(DELAI_CONCEPTION_MS);
        const signalCombine = AbortSignal.any([signal, echeance]);

        let resultat;
        try {
          resultat = await genererProtocole(
            resolu.moteur,
            {
              titre: analyse.titre,
              extrait: extrait.extrait,
              intention,
              intentionLibre,
              competences,
            },
            signalCombine,
            (evenement, donnees) => {
              if (evenement === "proposition") return;
              envoyer(evenement, donnees);
            },
          );
        } catch (cause) {
          if (echeance.aborted && !signal.aborted) {
            envoyer("erreur", {
              message:
                "La conception du plan a pris trop de temps et a été interrompue (2 minutes). Réessaie ; si ça se reproduit, change de modèle dans les réglages du tuteur.",
            });
            return "fin";
          }
          throw cause;
        }
        loguer(
          resultat.erreur
            ? `génération en échec : ${resultat.erreur}`
            : "génération aboutie",
        );

        if (resultat.erreur || !resultat.protocole) {
          envoyer("erreur", { message: resultat.erreur ?? "La conception du plan a échoué." });
          return "fin";
        }

        envoyer("protocole", {
          resume: resultat.protocole.resume,
          seances: resultat.protocole.seances,
        });
        return "fin";
      })();

      const issue = await Promise.race([travail, verdictDelai]);
      if (issue === "delai" && !signal.aborted) {
        envoyer("erreur", {
          message:
            "La préparation du plan a pris trop de temps (2 min 30) — la panne est côté serveur ou base de données, pas dans la génération. Réessaie ; si ça persiste, vérifie ta connexion à Supabase.",
        });
        loguer("budget global dépassé — coupure annoncée à l'écran");
      }
    },
    (e) =>
      e instanceof Error ? e.message : "Erreur inattendue pendant la conception du plan.",
  );
}
