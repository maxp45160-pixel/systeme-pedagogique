"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { classesLienBouton } from "@/components/ui/primitives";

/**
 * Geste de rappel dans une LearningSession.
 *
 * La restitution reste locale à l'écran : elle n'est ni une tentative ni une
 * Observation. Le lien vers la source est explicite et la personne peut la
 * relire avant de déclarer l'intervention terminée.
 */
export function RappelIntervention({
  sourceHref,
  sourceLabel = "la source du rappel",
}: {
  sourceHref?: string;
  sourceLabel?: string;
}) {
  const id = useId();
  const [restitution, setRestitution] = useState("");

  return (
    <div className="space-y-3 text-sm">
      <label htmlFor={id} className="font-medium text-texte">
        Votre restitution de mémoire
      </label>
      <textarea
        id={id}
        value={restitution}
        onChange={(event) => setRestitution(event.target.value)}
        rows={6}
        placeholder="Écrivez ce dont vous vous souvenez avant de relire la source."
        className="w-full resize-y rounded-md border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire"
      />
      <p className="text-xs leading-relaxed text-texte-discret" role="status">
        Cette restitution reste dans cette page. Elle ne crée aucune mesure ni observation.
      </p>
      {sourceHref ? (
        <Link href={sourceHref} className={classesLienBouton("secondaire", "petite")}>
          Ouvrir {sourceLabel}
        </Link>
      ) : (
        <p className="text-xs leading-relaxed text-texte-attenue">
          La source est conservée avec la séance, mais son ouverture n&apos;est pas disponible ici.
        </p>
      )}
    </div>
  );
}
