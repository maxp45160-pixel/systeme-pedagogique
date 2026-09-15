import { creerRessourceDepotAction } from "@/lib/store/depot-actions";
import { preparerTeleversementPieceAction, enregistrerPieceJointeAction } from "@/lib/store/document-actions";
import { createNavigateurClient } from "@/lib/supabase/client";
import { BUCKET_PIECES_JOINTES, mimeDepuisNomFichier } from "./pieces-jointes";
import { nomImport, type FichierImport } from "./import-depot";
import { titreDepuisNomFichier } from "./titre-depuis-fichier";

export interface ReceptionFichierDepot extends FichierImport {
  etat: "attente" | "recu" | "echec";
  cle?: string;
  documentId?: string;
  chemin?: string;
  envoye?: boolean;
  erreur?: string;
}

/** Même transfert V2 pour la conversation et les dépôts historiques.
 * Les étapes réussies sont conservées sur l'entrée pour ne pas les rejouer.
 */
export async function recevoirFichierDepot(entree: ReceptionFichierDepot): Promise<string> {
  if (entree.etat === "recu" && entree.documentId) return entree.documentId;
  entree.cle ??= crypto.randomUUID();
  const mime = mimeDepuisNomFichier(entree.fichier.name);
  if (!mime) throw new Error("Format de fichier non reconnu.");
  const client = createNavigateurClient();
  if (!client) throw new Error("Connexion au stockage indisponible.");
  const id = entree.documentId ?? await creerRessourceDepotAction({
    nature: "fichier", titre: titreDepuisNomFichier(entree.fichier.name), note: "", cheminRelatif: entree.relatif,
  }, entree.cle);
  entree.documentId = id;
  if (!entree.envoye) {
    const upload = await preparerTeleversementPieceAction(id, entree.fichier.name, mime);
    entree.chemin = upload.chemin;
    const resultat = await client.storage.from(BUCKET_PIECES_JOINTES).uploadToSignedUrl(upload.chemin, upload.token, entree.fichier, { contentType: mime });
    if (resultat.error) throw new Error("Le transfert du fichier a échoué.");
    entree.envoye = true;
  }
  await enregistrerPieceJointeAction(id, entree.chemin!, nomImport(entree), entree.fichier.size, mime);
  entree.etat = "recu";
  entree.erreur = undefined;
  return id;
}
