"use client";

/**
 * « Réviser avec le tuteur » — ce que devient `+ Compétence` sur une branche.
 *
 * Le geste attendu sur la page d'un domaine n'est pas « ajouter une ligne » :
 * c'est « ce référentiel ne couvre plus mes besoins, change-le ». Un besoin
 * complémentaire revient au même point d’entrée que le reste de l’application,
 * avec le domaine déjà suggéré dans la phrase.
 */

import { useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { ModaleRevision, type CompetenceRevisable } from "./modale-revision";
import { useIntention } from "@/components/intention/contexte-intention";

export function BoutonReviser({
  domaineId,
  domaineNom,
  competences,
  compteId,
}: {
  domaineId: string;
  domaineNom: string;
  competences: CompetenceRevisable[];
  compteId: string;
}) {
  const [vue, setVue] = useState<"fermee" | "revision">("fermee");
  const { ouvrir } = useIntention();

  return (
    <>
      <Bouton onClick={() => setVue("revision")} variante="secondaire" taille="petite">
        Réviser avec le tuteur
      </Bouton>

      {vue === "revision" && (
        <ModaleRevision
          domaineId={domaineId}
          domaineNom={domaineNom}
          competences={competences}
          compteId={compteId}
          onFermer={() => setVue("fermee")}
          onSaisieManuelle={() => {
            setVue("fermee");
            ouvrir(`Je veux apprendre une compétence de plus dans le domaine « ${domaineNom} ».`);
          }}
        />
      )}
    </>
  );
}
