import "server-only";

import { chargerContexte } from "@/lib/store/context";
import { calibragesPourModale } from "@/lib/domain/proprietes-generation";
import type { DonneesSeance } from "./concepteur-seance";

/**
 * Les données du concepteur de séance, assemblées une seule fois.
 *
 * Le même bloc était recopié à l'identique par le tableau de bord et par le hub
 * du cahier, et l'espace de travail d'une note de séance en aurait fait une
 * troisième copie. Onze champs recopiés à la main dérivent : il suffit qu'un
 * appelant oublie `contexteDocumentaire` pour que le concepteur compose sans le
 * contexte documentaire, silencieusement.
 *
 * Rien n'est calculé ici : `chargerContexte` a déjà dérivé états, calibrages et
 * classement. Cette fonction ne fait que sérialiser pour le client. Elle ne
 * coûte pas un second chargement — `chargerContexte` est mémorisé par requête.
 */
export async function chargerDonneesSeance(): Promise<DonneesSeance> {
  const ctx = await chargerContexte();
  return {
    etats: ctx.etats,
    actifs: ctx.referentiel.actifs,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    calibrations: Array.from(ctx.calibrations.entries()),
    calibragesModale: calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations),
    recommandations: ctx.recommandations,
    contexteDocumentaire: Array.from(ctx.contexteDocumentaire.entries()),
    domaines: ctx.referentiel.domaines
      .filter(
        (domaine) =>
          !domaine.archive &&
          ctx.referentiel.actifs.some((skill) => skill.domaine === domaine.id),
      )
      .map((d) => ({ id: d.id, nom: d.nom, prefixe: d.prefixe })),
    compteId: ctx.donnees.user.id,
  };
}
