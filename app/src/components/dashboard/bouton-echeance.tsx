"use client";

/**
 * Entrée sobre « Déclarer une échéance », posée près du déclencheur « + ».
 *
 * Une entrée dédiée et non une suggestion : déclarer une échéance est un geste
 * humain que rien ne devine. La modale ne propose rien d'elle-même — le
 * tuteur n'intervient pas ici.
 */

import { useState } from "react";
import { IconeCalendrier } from "@/components/ui/icones";
import { ModaleEngagement, type InitialisationEngagement } from "./modale-engagement";

export function BoutonEcheance({
  competences,
  initial,
  libelle = "Déclarer une échéance",
}: {
  competences: { code: string; intitule: string }[];
  /** Pré-remplissage (chemin assisté). */
  initial?: InitialisationEngagement;
  libelle?: string;
}) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-bordure bg-surface/80 px-2.5 py-0.5 text-[0.6875rem] text-texte-attenue shadow-2xs transition-all hover:border-primaire/40 hover:bg-surface hover:text-texte cursor-pointer"
      >
        <IconeCalendrier className="size-3 text-texte-discret transition-colors group-hover:text-primaire" />
        <span>{libelle}</span>
      </button>
      {ouverte && (
        <ModaleEngagement
          competences={competences}
          initial={initial}
          onFermer={() => setOuverte(false)}
        />
      )}
    </>
  );
}
