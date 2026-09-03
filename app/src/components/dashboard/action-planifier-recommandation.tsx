"use client";

import { FormEvent, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { planifierExerciceRecommande } from "@/lib/store/seance-actions";

/**
 * Rend explicite l'acceptation d'une recommandation à une date choisie.
 *
 * Le champ reste vide par défaut : la date n'est ni déduite de l'échéance ni
 * fabriquée à partir de l'horloge. Après l'écriture, l'actualisation du
 * tableau de bord permet au bloc « Aujourd'hui » de relire la séance.
 */
export function ActionPlanifierRecommandation({
  exerciceId,
}: {
  exerciceId: string;
}) {
  const router = useRouter();
  const identifiant = useId();
  const [ouvert, setOuvert] = useState(false);
  const [planifieePour, setPlanifieePour] = useState("");
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmee, setConfirmee] = useState(false);

  function soumettre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    const date = new Date(planifieePour);
    if (!planifieePour || !Number.isFinite(date.getTime())) {
      setErreur("Choisissez une date et une heure.");
      return;
    }

    demarrer(async () => {
      try {
        await planifierExerciceRecommande(exerciceId, date.toISOString());
        setConfirmee(true);
        setOuvert(false);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Impossible de planifier la séance.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      {confirmee ? (
        <span role="status" className="text-xs text-succes">
          Séance planifiée.
        </span>
      ) : (
        <Bouton
          type="button"
          variante="secondaire"
          className="!min-h-12 !px-5 !text-base"
          aria-expanded={ouvert}
          aria-controls={identifiant}
          onClick={() => {
            setErreur(null);
            setOuvert((valeur) => !valeur);
          }}
        >
          Planifier
        </Bouton>
      )}

      {ouvert && !confirmee && (
        <form
          id={identifiant}
          onSubmit={soumettre}
          className="w-full min-w-64 rounded-lg border border-bordure bg-surface-2 p-3 shadow-sm"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-texte-attenue">
              Date et heure prévues
            </span>
            <input
              type="datetime-local"
              value={planifieePour}
              onChange={(event) => setPlanifieePour(event.target.value)}
              className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primaire focus:ring-1 focus:ring-primaire/20"
              autoFocus
            />
          </label>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Bouton type="submit" variante="principal" taille="petite" enChargement={enCours}>
              Confirmer
            </Bouton>
            <Bouton
              type="button"
              variante="discret"
              taille="petite"
              onClick={() => setOuvert(false)}
              disabled={enCours}
            >
              Annuler
            </Bouton>
          </div>
          {erreur && (
            <p role="alert" className="mt-2 text-[0.6875rem] text-alerte">
              {erreur}
            </p>
          )}
        </form>
      )}
    </span>
  );
}
