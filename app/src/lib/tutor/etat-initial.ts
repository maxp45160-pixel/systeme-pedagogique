import "server-only";

/**
 * Contexte initial du tuteur, assemblé côté serveur.
 *
 * Le même bloc était recopié dans plusieurs écrans (fiche exercice, fiche
 * compétence, tiroir global). Il n'a jamais divergé, mais
 * rien ne l'en empêchait : les trois champs viennent de deux appels dont
 * l'ordre et les arguments comptent.
 *
 * Assemblé ici plutôt que par un `fetch("/api/tutor")` au montage du chat :
 * cette requête-là repayait un `chargerContexte()` complet — le `cache()` de
 * React ne franchit pas la frontière d'une requête HTTP — plus un aller-retour
 * d'authentification, pour un contexte déjà chargé par la page.
 */

import type { Contexte } from "@/lib/store/context";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, decrireChoix } from "@/lib/tutor/moteurs";
import type { EtatContexteTuteur } from "@/lib/tutor/etat-contexte";

export async function construireEtatInitialTuteur(
  ctx: Contexte,
  /** Exercice depuis lequel on ouvre le tuteur — son énoncé part au tuteur. */
  exerciceId?: string,
): Promise<EtatContexteTuteur> {
  // `messages` est vide, donc le protocole de synthèse est chargé (ADR-021 §4).
  const pedagogique = await construireContexte(ctx, [], exerciceId);
  const choix = choisirConfiguration(process.env);

  return {
    // Conserve le nom historique du champ : l'interface s'en sert pour décider
    // d'afficher le chat ou le repli « copier le contexte ».
    cleConfiguree: choix.kind !== "aucun",
    modele: decrireChoix(choix),
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  };
}
