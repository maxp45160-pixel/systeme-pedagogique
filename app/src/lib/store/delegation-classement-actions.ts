"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { evaluerDelegationClassement } from "@/lib/documents/delegation-classement";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { definirChampsFrontMatter } from "@/lib/documents/markdown";
import { lireContexteOrganisationDepotAction } from "./depot-actions";
import { lireDocument, modifierDocument } from "./documents";
import { encoderCreationDomaineDeleguee, prefixeCreationDeleguee, type CreationDomaineDeleguee } from "@/lib/documents/creation-domaine-deleguee";
import { preparerCreationDomaine } from "@/lib/domain/gouvernance-referentiel";
import { slugifier } from "@/lib/domain/referentiel-compte";
import { dorsaleCompte, type DorsaleCompte } from "./db";
import { lireReferentiel } from "./referentiel";

export interface ResultatDelegationClassement {
  statut: "rattache" | "a-controler" | "preserve";
  ressource: DepotDocumentaire;
  raison?: string;
}

async function lireEtat(documentId: string, analyseId: string) {
  // Le contexte exige le compte courant et le lecteur documentaire le pilote.
  const { ressources, referentiel } = await lireContexteOrganisationDepotAction([documentId]);
  const ressource = ressources.find((r) => r.id === documentId);
  if (!ressource) throw new Error("Ressource introuvable ou incompatible avec le classement délégué.");
  const document = await lireDocument(documentId);
  if (document.updatedAt !== ressource.modifieLe) throw new Error("La ressource a changé pendant la lecture. Actualisez son classement.");
  return { ressource, document, referentiel, decision: evaluerDelegationClassement(ressource, analyseId, referentiel, document.frontmatter) };
}

type Etat = Awaited<ReturnType<typeof lireEtat>>;
const cleCreation = (cle: string) => `delegation:${cle}:domaine`;
function reservation(etat: Etat, analyseId: string): CreationDomaineDeleguee {
  if (etat.decision.statut !== "a-creer") throw new Error("Création non proposée.");
  const proposition = etat.ressource.analyses.find((a) => a.id === analyseId)?.restitution;
  const cle = createHash("sha256").update(JSON.stringify([
    etat.referentiel.compteId, etat.ressource.id, analyseId, proposition,
  ])).digest("hex");
  const recu: CreationDomaineDeleguee = { version: 1, cle, compteId: etat.referentiel.compteId,
    documentId: etat.ressource.id, analyseId, domaineId: slugifier(etat.decision.nom), nom: etat.decision.nom, statut: "reservee" };
  if (etat.ressource.creationDomaineDeleguee && etat.ressource.creationDomaineDeleguee.cle !== cle) {
    throw new Error("L'analyse a changé depuis la réservation. Contrôlez le rangement.");
  }
  return recu;
}
async function creationEnregistree(dorsale: DorsaleCompte, recu: CreationDomaineDeleguee): Promise<boolean> {
  if (dorsale.userId !== recu.compteId) throw new Error("Le compte courant a changé.");
  const { data, error } = await dorsale.supabase.from("referentiel_changes").select("domaine_id,type,origine")
    .eq("user_id", dorsale.userId).eq("request_id", cleCreation(recu.cle)).maybeSingle();
  if (error) throw new Error("La création de ce domaine doit être vérifiée. Votre document reste conservé.");
  if (!data) return false;
  if (data.type !== "creer_domaine" || data.origine !== "tuteur" || data.domaine_id !== recu.domaineId) {
    throw new Error("Le reçu de création ne correspond pas au rangement délégué.");
  }
  return true;
}
const resultatSansEffet = (etat: Etat): ResultatDelegationClassement => ({
  statut: etat.decision.statut === "rattache" ? "rattache" : etat.decision.statut === "preserve" ? "preserve" : "a-controler",
  ressource: etat.ressource,
  raison: "raison" in etat.decision ? etat.decision.raison : "Le classement a changé : contrôlez le rangement.",
});
function resultatApresCreation(etat: Etat, recu: CreationDomaineDeleguee): ResultatDelegationClassement {
  const resultat = resultatSansEffet(etat);
  if (resultat.statut !== "rattache") resultat.raison = `Le domaine « ${recu.nom} » a été créé ; votre choix actuel est conservé, aucun rattachement supplémentaire n'a été effectué.`;
  return resultat;
}

async function creerEtRattacher(initial: Etat, analyseId: string, updatedAtAttendu: string): Promise<ResultatDelegationClassement> {
  const documentId = initial.ressource.id;
  const recu = reservation(initial, analyseId);
  if (initial.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");
  // Les collisions sont contrôlées avant de réserver, puis de nouveau avant SQL.
  let dorsale = await dorsaleCompte();
  if (dorsale.userId !== recu.compteId) throw new Error("Le compte courant a changé.");
  if (!await creationEnregistree(dorsale, recu)) prefixeCreationDeleguee(recu.nom, await lireReferentiel(dorsale));
  let actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== recu.compteId) throw new Error("Le compte courant a changé.");
  if (actuel.decision.statut !== "a-creer") return resultatSansEffet(actuel);
  if (reservation(actuel, analyseId).cle !== recu.cle) throw new Error("La proposition de domaine a changé.");
  if (actuel.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");
  if (!actuel.ressource.creationDomaineDeleguee) {
    try {
      await modifierDocument(documentId, definirChampsFrontMatter(actuel.document.contenuMd, {
        classement_creation_deleguee: encoderCreationDomaineDeleguee(recu),
      }), false, updatedAtAttendu);
    } catch (erreur) {
      actuel = await lireEtat(documentId, analyseId);
      if (actuel.ressource.creationDomaineDeleguee?.cle !== recu.cle) throw erreur;
    }
  }
  // Le CAS réserve d'abord le document ; une relecture empêche de continuer
  // un choix humain ou une réanalyse intervenus entre les deux écritures.
  actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== recu.compteId) throw new Error("Le compte courant a changé.");
  if (actuel.decision.statut !== "a-creer") return resultatSansEffet(actuel);
  if (actuel.ressource.creationDomaineDeleguee?.cle !== recu.cle || reservation(actuel, analyseId).cle !== recu.cle) throw new Error("La réservation a changé.");
  dorsale = await dorsaleCompte();
  if (dorsale.userId !== recu.compteId) throw new Error("Le compte courant a changé.");
  let cree = await creationEnregistree(dorsale, recu);
  if (!cree) {
    const referentiel = await lireReferentiel(dorsale);
    const { commande } = preparerCreationDomaine({ domaine: recu.nom, description: actuel.decision.description,
      prefixe: prefixeCreationDeleguee(recu.nom, referentiel), origine: "tuteur", competences: [] }, referentiel);
    if (commande?.type !== "creer_domaine" || commande.domaine.id !== recu.domaineId) throw new Error("La création demande un contrôle du rangement.");
    const avantCreation = await lireEtat(documentId, analyseId);
    if (avantCreation.referentiel.compteId !== recu.compteId) throw new Error("Le compte courant a changé.");
    if (avantCreation.decision.statut !== "a-creer") return resultatSansEffet(avantCreation);
    if (avantCreation.ressource.modifieLe !== actuel.ressource.modifieLe
      || avantCreation.ressource.creationDomaineDeleguee?.cle !== recu.cle
      || reservation(avantCreation, analyseId).cle !== recu.cle) throw new Error("La ressource ou sa réservation a changé. Actualisez son classement.");
    try {
      const { error } = await dorsale.supabase.rpc("appliquer_commande_referentiel", {
        p_request_id: cleCreation(recu.cle), p_expected_version: null, p_origine: "tuteur",
        p_motif: "Organisation déléguée d'une nouvelle ressource", p_commande: commande,
      });
      if (error) throw new Error("La création de ce domaine n'a pas abouti. Votre document reste conservé. Contrôlez son rangement ou reprenez-le explicitement.");
    } catch (erreur) {
      // Une réponse perdue ne déclenche pas un autre essai de création.
      if (!await creationEnregistree(dorsale, recu)) throw erreur;
    }
    cree = await creationEnregistree(dorsale, recu);
    if (!cree) throw new Error("La création de ce domaine doit être vérifiée. Votre document reste conservé.");
    revalidatePath("/", "layout");
  }
  actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== recu.compteId) throw new Error("Le compte courant a changé.");
  if (actuel.decision.statut !== "a-creer") return resultatApresCreation(actuel, recu);
  if (actuel.ressource.creationDomaineDeleguee?.cle !== recu.cle || reservation(actuel, analyseId).cle !== recu.cle) throw new Error("La réservation a changé.");
  const referentiel = await lireReferentiel(dorsale);
  const domaine = referentiel.domainesParId.get(recu.domaineId);
  if (!domaine || domaine.archive || domaine.nom !== recu.nom) return { statut: "a-controler", ressource: actuel.ressource,
    raison: "Le domaine créé a été modifié ou archivé. Contrôlez le rangement avant de rattacher la source." };
  try {
    await modifierDocument(documentId, definirChampsFrontMatter(actuel.document.contenuMd, {
      classement_creation_deleguee: encoderCreationDomaineDeleguee({ ...recu, statut: "cree" }),
      domaine: recu.domaineId, rangement_origine: "assistant", rangement_analyse_id: analyseId,
      rangement_revu_le: new Date().toISOString(), rangement_statut: "rangee",
    }), false, actuel.ressource.modifieLe);
  } catch (erreur) {
    const relu = await lireEtat(documentId, analyseId);
    if (relu.decision.statut !== "rattache") {
      if (relu.decision.statut === "preserve") return resultatApresCreation(relu, recu);
      throw new Error("Le domaine a été créé, mais son rattachement n'a pas abouti. Votre document reste conservé. Reprenez son rangement pour terminer.", { cause: erreur });
    }
  }
  revalidatePath("/app");
  return resultatSansEffet(await lireEtat(documentId, analyseId));
}

/** Aucun appel IA : seulement le rattachement issu de la première analyse. */
export async function rattacherDomaineDelegueAction(
  documentId: string,
  analyseId: string,
  updatedAtAttendu: string,
): Promise<ResultatDelegationClassement> {
  if (![documentId, analyseId, updatedAtAttendu].every((v) => typeof v === "string" && v.trim().length > 0)) throw new Error("Demande de rattachement invalide.");
  const initial = await lireEtat(documentId, analyseId);
  if (initial.decision.statut === "a-creer") return creerEtRattacher(initial, analyseId, updatedAtAttendu);
  if (initial.decision.statut !== "eligible") return { ...initial.decision, ressource: initial.ressource };
  if (initial.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");

  // Analyses, corrections et référentiel vivent hors de la version CAS du
  // document : les relire avant l'effet, puis protéger la fiche par son CAS.
  const actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== initial.referentiel.compteId) throw new Error("Le compte courant a changé.");
  if (actuel.decision.statut !== "eligible") return resultatSansEffet(actuel);
  if (actuel.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez son classement.");
  if (actuel.decision.domaineId !== initial.decision.domaineId) return { statut: "a-controler", raison: "Le domaine proposé a changé pendant la lecture.", ressource: actuel.ressource };
  const contenu = definirChampsFrontMatter(actuel.document.contenuMd, {
    domaine: actuel.decision.domaineId,
    rangement_origine: "assistant",
    rangement_analyse_id: analyseId,
    rangement_revu_le: new Date().toISOString(),
    rangement_statut: "rangee",
  });
  try {
    await modifierDocument(documentId, contenu, false, updatedAtAttendu);
  } catch (erreur) {
    // Une sauvegarde peut réussir avant que sa réponse échoue. Aucun réessai
    // d'écriture : seul le reçu relu autorise à annoncer le rattachement.
    const relu = await lireEtat(documentId, analyseId);
    if (relu.decision.statut !== "rattache") throw erreur;
    revalidatePath("/app");
    return { statut: "rattache", ressource: relu.ressource };
  }
  revalidatePath("/app");
  const relu = await lireEtat(documentId, analyseId);
  if (relu.decision.statut === "eligible") throw new Error("Le rattachement enregistré doit être vérifié. Actualisez la ressource.");
  return resultatSansEffet(relu);
}

function retraitDejaEnregistre(ressource: DepotDocumentaire, analyseId: string): boolean {
  return ressource.rangementOrigine === "personne" && ressource.rangementStatut === "a-trier"
    && ressource.rangementAnalyseId === analyseId && Boolean(ressource.rangementRevuLe) && !ressource.domaineId;
}

/** Le retrait est un choix humain durable, jamais une suppression de source. */
export async function annulerRattachementDelegueAction(
  documentId: string,
  analyseId: string,
  updatedAtAttendu: string,
): Promise<ResultatDelegationClassement> {
  if (![documentId, analyseId, updatedAtAttendu].every((v) => typeof v === "string" && v.trim().length > 0)) throw new Error("Demande de retrait invalide.");
  const retour = (ressource: DepotDocumentaire, retire: boolean): ResultatDelegationClassement => ({
    statut: "preserve", ressource,
    raison: retire ? "Vous avez retiré ce rattachement. La ressource reste à trier." : "Le classement a changé : votre choix actuel est préservé.",
  });
  const initial = await lireEtat(documentId, analyseId);
  if (retraitDejaEnregistre(initial.ressource, analyseId)) return retour(initial.ressource, true);
  if (initial.decision.statut !== "rattache") return retour(initial.ressource, false);
  if (initial.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de retirer son rattachement.");

  const actuel = await lireEtat(documentId, analyseId);
  if (actuel.referentiel.compteId !== initial.referentiel.compteId) throw new Error("Le compte courant a changé.");
  if (retraitDejaEnregistre(actuel.ressource, analyseId)) return retour(actuel.ressource, true);
  if (actuel.decision.statut !== "rattache") return retour(actuel.ressource, false);
  if (actuel.ressource.modifieLe !== updatedAtAttendu) throw new Error("La ressource a été modifiée. Actualisez avant de retirer son rattachement.");
  const contenu = definirChampsFrontMatter(actuel.document.contenuMd, {
    domaine: "",
    rangement_origine: "personne",
    rangement_statut: "a-trier",
  });
  try {
    await modifierDocument(documentId, contenu, false, updatedAtAttendu);
  } catch (erreur) {
    const relu = await lireEtat(documentId, analyseId);
    if (!retraitDejaEnregistre(relu.ressource, analyseId)) throw erreur;
    revalidatePath("/app");
    return retour(relu.ressource, true);
  }
  revalidatePath("/app");
  const relu = await lireEtat(documentId, analyseId);
  return retour(relu.ressource, retraitDejaEnregistre(relu.ressource, analyseId));
}
