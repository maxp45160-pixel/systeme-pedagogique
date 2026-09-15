import { createHash } from "node:crypto";
import type { MessageTuteur, MoteurTuteur } from "./moteurs/types";
import type { Engagement } from "@/lib/domain/engagement";
import { CONSIGNE_ACCUEIL, dateExpliciteDans, outilAccueil, type RetourAccueil } from "./accueil";

export interface EnvoiAccueil { tourId: string; messages: MessageTuteur[]; verifier: boolean }

/** Messages contrôlés : ne pas renvoyer un corps d'erreur fournisseur brut. */
export class ErreurAccueil extends Error {}

function erreurFournisseur(message: string): ErreurAccueil {
  const raison = /réservation|enveloppe|budget/i.test(message) ? "Le budget IA n’a pas pu être réservé. Vérifiez le budget dans Compte et réglages."
    : /Quota/i.test(message) ? "Le fournisseur IA limite actuellement les appels (quota ou débit atteint)."
    : /Clé refusée/.test(message) ? "La clé IA est refusée par le fournisseur. Vérifiez-la dans Compte et réglages."
    : /Modèle ou URL introuvable/.test(message) ? "Le modèle IA configuré est introuvable. Vérifiez Compte et réglages."
    : /AccessDenied\.Unpurchased/.test(message) ? "QwenCloud demande de compléter vos informations de facturation (AccessDenied.Unpurchased). Ouvrez Billing dans QwenCloud et renseignez les informations de paiement avant de réessayer."
    : /403/.test(message) ? "Le fournisseur refuse l'accès au modèle configuré."
    : /HTTP 400/.test(message) ? "Le fournisseur IA refuse le format de la demande (HTTP 400)."
    : /HTTP 404/.test(message) ? "Le modèle IA configuré est introuvable (HTTP 404)."
    : "Le fournisseur IA n'a pas pu répondre.";
  return new ErreurAccueil(`${raison} Cette tentative n'a effectué aucune nouvelle écriture. Aucun réessai n'est automatique.`);
}

export function lireEnvoiAccueil(x: unknown): EnvoiAccueil | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.tourId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(o.tourId) ||
    !Array.isArray(o.messages) || o.messages.length < 1 || o.messages.length > 100) return null;
  const messages: MessageTuteur[] = [];
  for (const m of o.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > 12000) return null;
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.at(-1)?.role !== "user" || messages.reduce((n, m) => n + m.content.length, 0) > 60000) return null;
  return { tourId: o.tourId.toLowerCase(), messages, verifier: o.verifier === true };
}

export function cleEnvoiAccueil(envoi: EnvoiAccueil): string {
  return `${envoi.tourId}:${createHash("sha256").update(JSON.stringify(envoi.messages)).digest("hex")}`;
}

export function recuEcheance(e: Engagement): string {
  return `Échéance enregistrée : « ${e.libelle} », le ${e.echeanceLe.split("-").reverse().join("/")}.${e.clotureLe ? " Cette échéance est maintenant clôturée." : ""}\n\nVous pouvez la retrouver dans Séances et accéder au travail depuis « Commencer à travailler ». Aucune séance n'a été programmée par cet échange.`;
}

export async function comprendreAccueil(moteur: MoteurTuteur, messages: MessageTuteur[], signal: AbortSignal): Promise<RetourAccueil> {
  const propositions: RetourAccueil[] = [];
  let rejet = false;
  let incident: string | null = null;
  let erreur: ErreurAccueil | null = null;
  await moteur.repondre({
    systemeStable: CONSIGNE_ACCUEIL, systemeProfil: "Les niveaux observés ne sont pas fournis dans ce parcours : ne les suppose pas.",
    messages: messages.slice(-12), outils: [outilAccueil()], signal, delaiMs: 45000,
    envoyer: (evenement, donnees) => {
      if (evenement === "proposition") {
        const p = donnees as { genre?: string; accueil?: RetourAccueil };
        if (p.genre === "accueil" && p.accueil) propositions.push(p.accueil);
        else rejet = true;
      }
      if (["proposition-rejetee", "erreur", "refus"].includes(evenement)) {
        rejet = true;
        incident = evenement;
        if (evenement === "erreur") {
          const message = String((donnees as { message?: string }).message ?? "");
          erreur = erreurFournisseur(message);
        }
      }
    },
  });
  signal.throwIfAborted();
  if (erreur) throw erreur;
  if (rejet || propositions.length !== 1) {
    console.warn(`[accueil] ${JSON.stringify({ incident, propositions: propositions.length })}`);
    throw new ErreurAccueil("La réponse n'a pas pu être vérifiée. Cette tentative n'a effectué aucune nouvelle écriture.");
  }
  const retour = propositions[0];
  if (retour.action === "examen") {
    if (!dateExpliciteDans(messages.at(-1)!.content, retour.echeanceLe)) {
      return { action: "repondre", libelle: "", echeanceLe: "", reponse: "Quelle est la date complète du contrôle (jour, mois et année) ?" };
    }
    if (!messages.some((m) => m.role === "user" && m.content.includes(retour.libelle))) {
      throw new ErreurAccueil("Le sujet du contrôle ne correspond pas à vos mots. Précisez son intitulé ; cette tentative n'a effectué aucune nouvelle écriture.");
    }
  }
  return retour;
}
