"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { BlocUsageDomaine } from "./bloc-usage-domaine";
import { declarerUsageDomaine } from "@/lib/store/referentiel-actions";
import {
  motifRefusUsageDomaine,
  type EntreeUsageDomaine,
  type TypeUsage,
} from "@/lib/domain/usage-domaine";
import type { UsageDomaine } from "@/lib/domain/types";

/**
 * Petit geste de classement d'un domaine existant.
 *
 * La création et la requalification réutilisent le même bloc de choix et la
 * même validation. Aucun domaine, tag ou score n'est recréé : seule la nature
 * déclarée du domaine est écrite par la commande gouvernée.
 */
export function ModaleUsageDomaine({
  domaineId,
  domaineNom,
  usageInitial,
  onFermer,
  onEnregistre,
}: {
  domaineId: string;
  domaineNom: string;
  usageInitial?: UsageDomaine;
  onFermer: () => void;
  onEnregistre?: () => void;
}) {
  const initialType: TypeUsage = usageInitial?.type ?? "indetermine";
  const [usageChoisi, setUsageChoisi] = useState<TypeUsage>(initialType);
  const [usageAnnee, setUsageAnnee] = useState(
    usageInitial?.type === "module" ? usageInitial.module.anneeAcademique : "",
  );
  const [usagePeriode, setUsagePeriode] = useState(
    usageInitial?.type === "module" ? usageInitial.module.periode ?? "" : "",
  );
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const entree: EntreeUsageDomaine = {
    type: usageChoisi,
    anneeAcademique: usageAnnee,
    periode: usagePeriode,
  };
  const refus = motifRefusUsageDomaine(entree);

  function enregistrer() {
    if (refus || enCours) return;
    setErreurAction(null);
    demarrer(async () => {
      try {
        await declarerUsageDomaine(domaineId, entree);
        onEnregistre?.();
        onFermer();
      } catch (erreur) {
        setErreurAction(erreur instanceof Error ? erreur.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <Modale
      titre={`Préciser le cadre de « ${domaineNom} »`}
      sousTitre="Ce choix organise vos vues sans modifier les compétences ni leur historique."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            Annuler
          </Bouton>
          <Bouton variante="principal" onClick={enregistrer} disabled={Boolean(refus) || enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer le cadre"}
          </Bouton>
        </>
      }
    >
      <div className="space-y-3">
        <BlocUsageDomaine
          usageChoisi={usageChoisi}
          onUsageChange={setUsageChoisi}
          usageAnnee={usageAnnee}
          onAnneeChange={setUsageAnnee}
          usagePeriode={usagePeriode}
          onPeriodeChange={setUsagePeriode}
          erreur={refus}
        />
        {erreurAction && <p className="text-xs text-danger">{erreurAction}</p>}
      </div>
    </Modale>
  );
}
