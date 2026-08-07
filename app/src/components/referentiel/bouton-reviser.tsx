"use client";

/**
 * « Réviser avec le tuteur » — ce que devient `+ Compétence` sur une branche.
 *
 * Le geste attendu sur la page d'un domaine n'est pas « ajouter une ligne » :
 * c'est « ce référentiel ne couvre plus mes besoins, change-le ». La saisie
 * manuelle reste atteignable — depuis la modale de révision, un lien monte
 * l'ancienne `ModaleCompetence` avec le domaine pré-rempli. **La surface ne
 * grossit pas d'un bouton** : c'est le même, qui fait mieux.
 */

import { useState } from "react";
import { classesBouton } from "@/components/ui/primitives";
import { ModaleCompetence } from "./modale-competence";
import { ModaleRevision, type CompetenceRevisable } from "./modale-revision";

export function BoutonReviser({
  domaineId,
  domaineNom,
  competences,
  domainesExistants,
  compteId,
}: {
  domaineId: string;
  domaineNom: string;
  competences: CompetenceRevisable[];
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
}) {
  const [vue, setVue] = useState<"fermee" | "revision" | "manuelle">("fermee");

  return (
    <>
      <button
        type="button"
        onClick={() => setVue("revision")}
        className={classesBouton("secondaire", "petite")}
      >
        Réviser avec le tuteur
      </button>

      {vue === "revision" && (
        <ModaleRevision
          domaineId={domaineId}
          domaineNom={domaineNom}
          competences={competences}
          compteId={compteId}
          onFermer={() => setVue("fermee")}
          onSaisieManuelle={() => setVue("manuelle")}
        />
      )}

      {vue === "manuelle" && (
        <ModaleCompetence
          onFermer={() => setVue("fermee")}
          domainesExistants={domainesExistants}
          compteId={compteId}
          domaineInitial={domaineNom}
        />
      )}
    </>
  );
}
