import { estPiloteDepot } from "@/lib/store/depot-budget";
import { dorsaleCompte, lireParId } from "@/lib/store/db";
import { creerEngagement } from "@/lib/store/engagement-actions";
import { idEngagementEnvoi } from "@/lib/store/engagement-cle";
import { ErreurAccueil, cleEnvoiAccueil, comprendreAccueil, lireEnvoiAccueil, recuEcheance } from "@/lib/tutor/accueil-tour";
import { resoudreMoteur, repondreParFluxSse } from "@/lib/tutor/reponse-flux";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { repondreRessource } from "@/lib/tutor/reponse-ressource";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!await estPiloteDepot()) return Response.json({ message: "Ce parcours est réservé au pilote." }, { status: 403 });
  const brut = await request.json().catch(() => null);
  const envoi = lireEnvoiAccueil(brut);
  if (!envoi) return Response.json({ message: "Envoi invalide ou conversation trop longue. Ouvrez une nouvelle conversation." }, { status: 400 });
  if (brut.ressource !== undefined) return repondreRessource(request, envoi, brut.ressource, brut.config);
  const dorsale = await dorsaleCompte();
  const cle = cleEnvoiAccueil(envoi);
  const existant = await lireParId("engagements", idEngagementEnvoi(dorsale.userId, cle), dorsale);
  // Lecture seule : récupérer un reçu ne réserve aucun quota ni appel fournisseur.
  if (envoi.verifier) return Response.json({ message: existant ? recuEcheance(existant) : null });
  if (existant) return repondreParFluxSse(request, async (envoyer) => {
    envoyer("texte", { delta: recuEcheance(existant) }); envoyer("fin", {});
  });
  const resolu = await resoudreMoteur(brut.config as ConfigTuteurClient | undefined, { profil: "rapide" });
  if (!resolu.ok) return resolu.reponse;
  return repondreParFluxSse(request, async (envoyer, signal) => {
    envoyer("tronque", { message: "Je vérifie votre demande…" });
    const borne = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
    const retour = await comprendreAccueil(resolu.moteur, envoi.messages, borne);
    if (retour.action === "repondre") {
      envoyer("texte", { delta: `${retour.reponse}\n\nAucune échéance enregistrée pour cet échange.` });
    } else {
      borne.throwIfAborted();
      envoyer("tronque", { message: "J'enregistre l'échéance…" });
      const engagement = await creerEngagement({ type: "examen", libelle: retour.libelle, echeanceLe: retour.echeanceLe }, cle);
      envoyer("texte", { delta: recuEcheance(engagement) });
    }
    envoyer("fin", {});
  }, (erreur) => erreur instanceof ErreurAccueil ? erreur.message : "L'échange n'a pas pu aboutir. Vérifiez l'enregistrement avant de réessayer ; aucun nouvel appel payant n'est lancé automatiquement.");
}
