"use client";

import { useState, useTransition } from "react";
import type { Dimension, Exercise } from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { terminerExercice } from "@/lib/store/actions";
import { classesBouton, cx } from "@/components/ui/primitives";

const APPRECIATIONS = [
  { valeur: 0, libelle: "Non" },
  { valeur: 0.5, libelle: "En partie" },
  { valeur: 1, libelle: "Oui" },
] as const;

const RESULTATS = [
  { valeur: "reussi", libelle: "Réussi", aide: "Méthode et résultat corrects" },
  { valeur: "partiel", libelle: "Partiellement", aide: "Méthode correcte, résultat incomplet" },
  { valeur: "echec", libelle: "Non abouti", aide: "Je n'ai pas su faire" },
] as const;

/**
 * Auto-évaluation après lecture de la correction.
 *
 * L'utilisateur juge sa performance critère par critère ; le système en tire
 * les dimensions de la preuve. Il ne choisit PAS son niveau d'autonomie :
 * celui-ci est déduit du nombre d'indices réellement consultés, donc observé
 * et non déclaré.
 */
export function FormulaireBilan({
  exercice,
  attemptId,
  dureeSuggeree,
  indicesUtilises,
}: {
  exercice: Exercise;
  attemptId: string;
  dureeSuggeree: number;
  indicesUtilises: number;
}) {
  const [resultat, setResultat] = useState<"reussi" | "partiel" | "echec">("reussi");
  const [criteres, setCriteres] = useState<Record<number, number>>({});
  const [duree, setDuree] = useState(dureeSuggeree);
  const [notes, setNotes] = useState("");
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const tousRenseignes = exercice.criteres.every((_, i) => criteres[i] !== undefined);

  const autonomiePrevue =
    indicesUtilises >= exercice.indices.length && exercice.indices.length > 0
      ? "A1 — fortement guidé"
      : indicesUtilises >= 1
        ? "A2 — quelques indices nécessaires"
        : "A3 — résolution autonome";

  function soumettre() {
    setErreur(null);

    // Agrège les critères par dimension : moyenne des critères qui la visent.
    const parDimension = new Map<Dimension, number[]>();
    exercice.criteres.forEach((c, i) => {
      const v = criteres[i];
      if (v === undefined) return;
      parDimension.set(c.dimension, [...(parDimension.get(c.dimension) ?? []), v]);
    });
    const autoEvaluation: Partial<Record<Dimension, number>> = {};
    for (const [d, valeurs] of parDimension) {
      autoEvaluation[d] = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
    }

    demarrer(async () => {
      try {
        await terminerExercice({
          attemptId,
          exerciseId: exercice.id,
          resultat,
          autoEvaluation,
          dureeMin: duree,
          notes: notes.trim() || undefined,
        });
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Résultat global */}
      <div>
        <div className="mb-2 text-xs font-medium">Comment évalues-tu ta résolution ?</div>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {RESULTATS.map((r) => (
            <button
              key={r.valeur}
              type="button"
              onClick={() => setResultat(r.valeur)}
              className={cx(
                "rounded-md border px-3 py-2 text-left transition-colors",
                resultat === r.valeur
                  ? "border-primaire/40 bg-primaire-faible"
                  : "border-bordure hover:bg-surface-2",
              )}
            >
              <div
                className={cx(
                  "text-xs font-medium",
                  resultat === r.valeur && "text-primaire",
                )}
              >
                {r.libelle}
              </div>
              <div className="mt-0.5 text-[0.625rem] text-texte-discret">{r.aide}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Critères */}
      <div>
        <div className="mb-2 text-xs font-medium">
          Critère par critère
          <span className="ml-1.5 font-normal text-texte-discret">
            — sois honnête : c'est ce qui rend le suivi utile
          </span>
        </div>
        <ul className="space-y-2">
          {exercice.criteres.map((c, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs">{c.libelle}</p>
                <p className="mt-0.5 text-[0.625rem] text-texte-discret">
                  {LIBELLES_DIMENSIONS[c.dimension]}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {APPRECIATIONS.map((a) => (
                  <button
                    key={a.valeur}
                    type="button"
                    onClick={() => setCriteres((p) => ({ ...p, [i]: a.valeur }))}
                    className={cx(
                      "rounded border px-2 py-1 text-[0.6875rem] font-medium transition-colors",
                      criteres[i] === a.valeur
                        ? "border-primaire/40 bg-primaire text-primaire-contraste"
                        : "border-bordure bg-surface text-texte-attenue hover:bg-surface-3",
                    )}
                  >
                    {a.libelle}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Durée et notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium">Temps passé</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              value={duree}
              onChange={(e) => setDuree(Math.max(1, Number(e.target.value) || 1))}
              className="chiffres w-20 rounded-md border border-bordure bg-surface px-2 py-1 text-sm focus:border-primaire focus:outline-none"
            />
            <span className="text-xs text-texte-attenue">minutes</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium">Note personnelle (optionnelle)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ce qui a bloqué, ce que je retiens…"
            className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
          />
        </label>
      </div>

      {/* Ce qui sera enregistré — annoncé avant l'écriture, pas après. */}
      <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2.5 text-[0.6875rem] text-texte-attenue">
        <p className="font-medium text-texte">Ce qui sera enregistré</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            · Une preuve directe pour <strong>{exercice.competences[0]}</strong>
            {exercice.competences.length > 1 && (
              <>
                , et une preuve indirecte pour {exercice.competences.slice(1).join(", ")}
              </>
            )}
          </li>
          <li>
            · Autonomie <strong>{autonomiePrevue}</strong>, déduite des {indicesUtilises} indice(s)
            consulté(s)
          </li>
          <li>· Une entrée de journal datée</li>
        </ul>
        <p className="mt-1.5">
          Le niveau n'évoluera que si cette preuve le justifie au regard du protocole
          d'évaluation. Une réussite isolée ne suffit pas à dépasser le niveau 2.
        </p>
      </div>

      {erreur && (
        <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={soumettre}
          disabled={!tousRenseignes || enCours}
          className={classesBouton("principal")}
        >
          {enCours ? "Enregistrement…" : "Enregistrer la preuve"}
        </button>
        {!tousRenseignes && (
          <span className="text-xs text-texte-discret">
            Renseigne chaque critère pour continuer.
          </span>
        )}
      </div>
    </div>
  );
}