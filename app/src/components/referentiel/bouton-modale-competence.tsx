"use client";

/**
 * Bouton `+ Compétence` / `+ Domaine` + modale — le point d'entrée du lot 2.
 *
 * Encapsule l'état d'ouverture de la modale pour pouvoir être monté depuis un
 * composant serveur (carte de domaine, en-tête de `/competences`) sans
 * transformer ces pages en composants client.
 */

import { useState } from "react";
import { classesBouton } from "@/components/ui/primitives";
import type { OrigineReferentiel } from "@/lib/domain/types";
import { ModaleCompetence } from "./modale-competence";

export function BoutonModaleCompetence({
  domainesExistants,
  compteId,
  domaineInitial = "",
  libelle = "+ Compétence",
  variante = "secondaire",
  origine = "utilisateur",
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  domaineInitial?: string;
  libelle?: string;
  variante?: "principal" | "secondaire" | "discret";
  origine?: OrigineReferentiel;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={classesBouton(variante === "discret" ? "discret" : variante)}
      >
        {libelle}
      </button>
      {ouvert && (
        <ModaleCompetence
          onFermer={() => setOuvert(false)}
          domainesExistants={domainesExistants}
          compteId={compteId}
          domaineInitial={domaineInitial}
          origine={origine}
        />
      )}
    </>
  );
}