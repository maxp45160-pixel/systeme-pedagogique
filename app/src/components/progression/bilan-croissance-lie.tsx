"use client";

import { useRouter } from "next/navigation";
import { BilanCroissance } from "./bilan-croissance";
import type { ResumeCroissance } from "@/lib/engine/croissance";
import type { EnsemblePropose } from "@/lib/engine/ensembles";

/**
 * Le bilan de croissance, relié à l'Atelier.
 *
 * `BilanCroissance` cite des compétences, des domaines et des thèmes, et sait
 * les rendre cliquables — mais il ignore où ils s'ouvrent. Dans l'Atelier,
 * cliquer changeait une sélection locale ; ici, il faut naviguer. Ce composant
 * ne fait que cette traduction : un identifiant devient une URL d'Atelier.
 *
 * Il existe pour que `BilanCroissance` reste sans dépendance au routeur — c'est
 * ce qui permettrait de le remonter ailleurs sans le réécrire.
 */
export function BilanCroissanceLie({
  resume,
  ensemblesSuggeres,
  intitules,
}: {
  resume: ResumeCroissance;
  ensemblesSuggeres: EnsemblePropose[];
  intitules: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <BilanCroissance
      resume={resume}
      ensemblesSuggeres={ensemblesSuggeres}
      intitules={intitules}
      ouvrirElement={(id) => router.push(`/atelier?document=${encodeURIComponent(id)}`)}
    />
  );
}
