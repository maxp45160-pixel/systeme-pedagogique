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
import { Bouton } from "@/components/ui/primitives";
import { ModaleEngagement, type InitialisationEngagement } from "./modale-engagement";

export function BoutonEcheance({
  competences,
  modules = [],
  initial,
  libelle = "Déclarer une échéance",
  mode = "pastille",
}: {
  competences: { code: string; intitule: string }[];
  /** Modules (domaines vivants) du compte, pour le rattachement facultatif (ADR-137). */
  modules?: { id: string; nom: string }[];
  /** Pré-remplissage (chemin assisté ou déclaration depuis un module). */
  initial?: InitialisationEngagement;
  libelle?: string;
  /** Variante utilisée par le chantier d'orchestration ; la pastille reste le défaut historique. */
  mode?: "pastille" | "action";
}) {
  const [ouverte, setOuverte] = useState(false);
  const declencheur = mode === "action" ? (
    <Bouton variante="secondaire" onClick={() => setOuverte(true)} aria-haspopup="dialog">
      <IconeCalendrier className="size-4" aria-hidden />
      {libelle}
    </Bouton>
  ) : (
    <button
      type="button"
      onClick={() => setOuverte(true)}
      aria-haspopup="dialog"
      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-bordure bg-surface/80 px-2.5 py-0.5 text-[0.6875rem] text-texte-attenue shadow-2xs transition-all hover:border-primaire/40 hover:bg-surface hover:text-texte"
    >
      <IconeCalendrier className="size-3 text-texte-discret transition-colors group-hover:text-primaire" />
      <span>{libelle}</span>
    </button>
  );

  return (
    <>
      {declencheur}
      {ouverte && (
        <ModaleEngagement
          competences={competences}
          modules={modules}
          initial={initial}
          onFermer={() => setOuverte(false)}
        />
      )}
    </>
  );
}
