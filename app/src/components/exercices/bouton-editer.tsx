"use client";

/**
 * Ouvre l'écran de correction d'un exercice (ADR-047).
 *
 * Séparé de la modale pour la même raison que `BoutonGenerer` : la fiche
 * d'exercice est un composant serveur, elle ne peut porter ni état ni
 * `onClick`. Le montage conditionnel garde aussi l'état de la modale neuf à
 * chaque ouverture — on ne rouvre jamais sur une saisie abandonnée.
 */

import { useState } from "react";
import type { Exercise } from "@/lib/domain/types";
import { Bouton } from "@/components/ui/primitives";
import { ModaleEdition } from "@/components/exercices/modale-edition";

export function BoutonEditer({
  exercice,
  tentatives,
  libelle = "Corriger cet exercice",
}: {
  exercice: Exercise;
  tentatives: number;
  libelle?: string;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <Bouton variante="secondaire" taille="petite" onClick={() => setOuvert(true)}>
        {libelle}
      </Bouton>

      {ouvert && (
        <ModaleEdition
          exercice={exercice}
          tentatives={tentatives}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}
