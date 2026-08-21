"use client";

/**
 * Une action de séance déclenchée depuis un écran, sans formulaire nu.
 *
 * Les boutons « Démarrer / Terminer / Annuler / Abandonner / Reprendre »
 * vivaient dans des `<form action={...}>` serveur : toute erreur levée par
 * l'action — une séance déjà terminée par un double-clic, par exemple —
 * remontait au boundary d'erreur du groupe `(app)` et **remplaçait la page
 * entière** par un écran générique, perdant le contexte de séance.
 *
 * Ici l'action est appelée dans une transition : pendant l'appel, le bouton
 * est désactivé (plus de double-soumission) ; en cas d'échec, le message
 * s'affiche sous le bouton, dans l'écran qui reste debout.
 *
 * `redirect()` appelé par l'action reste géré par Next : il n'atterrit pas
 * dans le `catch`, la navigation se fait normalement.
 */

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/primitives";

export function ActionSeance({
  action,
  seanceId,
  libelle,
  variante = "principal",
  taille = "normale",
  titre,
}: {
  action: (seanceId: string) => Promise<void>;
  seanceId: string;
  libelle: string;
  variante?: "principal" | "secondaire" | "discret" | "danger";
  taille?: "normale" | "compacte" | "petite";
  titre?: string;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Bouton
        type="button"
        variante={variante}
        taille={taille}
        title={titre}
        disabled={enCours}
        enChargement={enCours}
        onClick={() => {
          setErreur(null);
          demarrer(async () => {
            try {
              await action(seanceId);
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "L'action a échoué.");
            }
          });
        }}
      >
        {libelle}
      </Bouton>
      {erreur && (
        <span role="alert" className="max-w-xs text-[0.6875rem] text-alerte">
          {erreur}
        </span>
      )}
    </span>
  );
}
