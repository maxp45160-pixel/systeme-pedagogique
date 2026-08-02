"use client";

/**
 * Bouton « Générer » + modale — le point d'entrée du lot 1.
 *
 * Encapsule l'état d'ouverture de la modale pour pouvoir être monté depuis un
 * composant serveur (carte Prochaine action, en-tête des exercices, fiche
 * compétence) sans transformer ces pages en composants client.
 */

import { useState } from "react";
import { classesBouton } from "@/components/ui/primitives";
import {
  ModaleExercice,
  type CalibrageModale,
  type CompetenceModale,
} from "./modale-exercice";

export function BoutonGenerer({
  competences,
  competenceInitiale,
  calibrage,
  compteId,
  libelle = "Générer un exercice",
  variante = "principal",
  surEnregistre,
}: {
  competences: CompetenceModale[];
  competenceInitiale: string;
  calibrage: CalibrageModale | null;
  compteId: string;
  libelle?: string;
  variante?: "principal" | "secondaire";
  surEnregistre?: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={classesBouton(variante)}
      >
        {libelle}
      </button>
      <ModaleExercice
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        competences={competences}
        competenceInitiale={competenceInitiale}
        calibrage={calibrage}
        compteId={compteId}
        surEnregistre={surEnregistre}
      />
    </>
  );
}