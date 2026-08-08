"use client";

/**
 * Bouton d'ouverture de la modale de compétences.
 *
 * Monté sur `/competences` : `+ Domaine` en tête de page, `+ Compétence` sur
 * chaque carte de domaine. La modale est montée à l'ouverture et démontée à la
 * fermeture — l'état repart neuf à chaque fois.
 */

import { useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { ModaleCompetence } from "./modale-competence";

export function BoutonAjouterCompetence({
  domainesExistants,
  compteId,
  domaineInitial,
  libelle = "+ Compétence",
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Domaine pré-rempli — quand on ouvre depuis une carte de domaine. */
  domaineInitial?: string;
  libelle?: string;
}) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <Bouton onClick={() => setOuverte(true)} variante="secondaire" taille="petite">
        {libelle}
      </Bouton>

      {ouverte && (
        <ModaleCompetence
          onFermer={() => setOuverte(false)}
          domainesExistants={domainesExistants}
          compteId={compteId}
          domaineInitial={domaineInitial}
        />
      )}
    </>
  );
}