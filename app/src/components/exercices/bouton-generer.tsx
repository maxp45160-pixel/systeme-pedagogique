"use client";

/**
 * Bouton « Générer » + modale — le point d'entrée du lot 1.
 *
 * Encapsule l'état d'ouverture de la modale pour pouvoir être monté depuis un
 * composant serveur (carte Prochaine action, en-tête des exercices, fiche
 * compétence) sans transformer ces pages en composants client.
 *
 * La modale n'est **montée** que lorsqu'elle est ouverte, et non rendue puis
 * masquée : chaque ouverture repart donc d'un état neuf, sans traîner la
 * prévisualisation ni l'erreur de la fois précédente. Le démontage abandonne
 * la génération en cours (`useEffect` de nettoyage, côté modale).
 */

import { useState } from "react";
import { classesBouton } from "@/components/ui/primitives";
import { ModaleExercice } from "./modale-exercice";
import type { CalibrageModale, CompetenceModale } from "./proprietes-generation";

export function BoutonGenerer({
  competences,
  competenceInitiale,
  calibrages,
  compteId,
  libelle = "Générer un exercice",
  variante = "principal",
  surEnregistre,
}: {
  competences: CompetenceModale[];
  competenceInitiale: string;
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
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
      {ouvert && (
        <ModaleExercice
          onFermer={() => setOuvert(false)}
          competences={competences}
          competenceInitiale={competenceInitiale}
          calibrages={calibrages}
          compteId={compteId}
          surEnregistre={surEnregistre}
        />
      )}
    </>
  );
}
