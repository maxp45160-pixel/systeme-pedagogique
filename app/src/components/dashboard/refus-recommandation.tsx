"use client";

/**
 * Bouton « Passer cette suggestion » (R1).
 *
 * Un refus est un fait observé : l'utilisateur a écarté une suggestion.
 * Il est stocké en base via la Server Function `refuserRecommandation`,
 * et le moteur de recommandation l'exclut de la file pour 7 jours.
 *
 * Le refus est un fait observé : il ne modifie pas le moteur, il le filtre.
 * Le moteur reste pur et testé — il reçoit un Set de codes refusés.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { classesBouton } from "@/components/ui/primitives";
import { refuserRecommandation } from "@/lib/store/actions";

export function BoutonRefusRecommandation({ code }: { code: string }) {
  const router = useRouter();
  const [refuse, setRefuse] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function refuser() {
    setErreur(null);
    demarrer(async () => {
      try {
        await refuserRecommandation(code);
        setRefuse(true);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible d'enregistrer le refus.");
      }
    });
  }

  if (refuse) {
    return (
      <span className="text-xs text-texte-discret">
        Suggestion passée — la suivante prend sa place.
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={refuser}
        disabled={enCours}
        className={classesBouton("secondaire", "petite")}
        title="Écarte cette suggestion pendant 7 jours"
      >
        {enCours ? "Passage…" : "Passer"}
      </button>
      {erreur && <span className="text-[0.6875rem] text-alerte">{erreur}</span>}
    </div>
  );
}