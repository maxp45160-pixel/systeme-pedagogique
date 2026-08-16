"use client";

import { useState } from "react";
import { CaptureIntention } from "@/components/intention/capture-intention";

/**
 * Traiter une ligne de la marge.
 *
 * ## Ce que ce bouton remplace
 *
 * Un lien « En faire une séance » qui pointait vers `/seances?composer=1&intention=…`.
 * Deux défauts, et le second est le plus grave :
 *
 *  1. **Le sujet était inventé.** Sans code dans l'URL, le compositeur se
 *     rabattait sur la première recommandation du moteur : une note sur les
 *     maths ouvrait une séance « Compétence : SYSC-01 », en annonçant « le sujet
 *     est déjà choisi ». La phrase écrite servait de décor, pas de sujet.
 *  2. **Une seule issue était offerte.** Tout ce qu'on note ne se travaille pas
 *     en séance : un sujet peut demander une ressource à déposer, un projet à
 *     produire, ou des compétences qui n'existent pas encore. Ne proposer que la
 *     séance forçait la réponse à la forme d'une seule question.
 *
 * `CaptureIntention` répond déjà aux deux : elle lit la phrase, la traduit en
 * l'un des quatre genres — s'entraîner, produire, déposer, étendre le
 * référentiel — et propose des alternatives. La marge n'ouvre donc aucun chemin
 * neuf, elle rejoint le point d'entrée unique (ADR-073) au lieu de le
 * court-circuiter vers une seule de ses sorties.
 */
export function TraiterLigneMarge({
  compteId,
  texte,
}: {
  compteId: string;
  texte: string;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs font-medium text-primaire hover:underline"
      >
        Traiter
      </button>
      {ouvert && (
        <CaptureIntention
          compteId={compteId}
          besoinInitial={texte}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}
