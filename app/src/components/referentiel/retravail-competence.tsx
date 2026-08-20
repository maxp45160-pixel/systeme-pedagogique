"use client";

import { useState, useTransition } from "react";
import { VERBES_ACTION, OBJET_MAX, PRECISION_MAX } from "@/lib/domain/atomicite";
import { Bouton } from "@/components/ui/primitives";
import {
  retravaillerCompetence,
  type RemplacanteProposee,
} from "@/lib/store/entretien-actions";

/**
 * Retravailler une compétence gelée — ADR-086, ADR-087.
 *
 * L'écran ne demande PAS une phrase. Il demande les mêmes trois champs que le
 * schéma d'outil du tuteur — verbe pris dans une liste fermée, objet borné,
 * précision bornée — et c'est l'application qui assemble l'intitulé. Deux
 * sources, une seule forme : ce qui sort d'ici passe exactement les mêmes
 * règles que ce qui sort du tuteur.
 *
 * Une ligne = une compétence de remplacement. Une seule ligne réécrit sur
 * place ; plusieurs scindent, et la scission est **sèche** — les observations
 * restent sur l'ancienne, les nouvelles démarrent à zéro. L'écran l'annonce
 * avant, sans quoi le recul du tableau de bord passerait pour un bug.
 */

const PALIERS = ["fondamentaux", "intermediaire", "avance"] as const;

interface Ligne {
  verbeAction: string;
  objet: string;
  precision: string;
  palier: string;
  importance: number;
}

function ligneVide(palier: string, importance: number): Ligne {
  return { verbeAction: "analyser", objet: "", precision: "", palier, importance };
}

export function RetravailCompetence({
  code,
  intitule,
  palier,
  importance,
  aDesObservations,
  onFerme,
}: {
  code: string;
  intitule: string;
  palier: string;
  importance: number;
  aDesObservations: boolean;
  onFerme: () => void;
}) {
  const [lignes, setLignes] = useState<Ligne[]>([ligneVide(palier, importance)]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const scission = lignes.length > 1;

  function majLigne(index: number, champ: keyof Ligne, valeur: string | number) {
    setLignes((actuelles) =>
      actuelles.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)),
    );
  }

  function envoyer() {
    setErreur(null);
    demarrer(async () => {
      try {
        const remplacantes: RemplacanteProposee[] = lignes.map((l) => ({
          verbeAction: l.verbeAction,
          objet: l.objet,
          precision: l.precision.trim() || undefined,
          palier: l.palier,
          importance: l.importance,
        }));
        await retravaillerCompetence(code, remplacantes);
        onFerme();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de l'écriture.");
      }
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-primaire bg-surface p-4">
      <p className="text-xs text-texte-discret">Intitulé actuel</p>
      <p className="mt-1 text-sm text-texte-attenue">{intitule}</p>

      <div className="mt-4 space-y-3">
        {lignes.map((ligne, index) => (
          <div key={index} className="rounded-lg border border-bordure bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ligne.verbeAction}
                onChange={(e) => majLigne(index, "verbeAction", e.target.value)}
                className="rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm text-texte"
                aria-label="Verbe d'action"
              >
                {VERBES_ACTION.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                value={ligne.objet}
                maxLength={OBJET_MAX}
                onChange={(e) => majLigne(index, "objet", e.target.value)}
                placeholder="un stock de sécurité"
                aria-label="Objet"
                className="min-w-0 flex-1 rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm text-texte"
              />
              <input
                value={ligne.precision}
                maxLength={PRECISION_MAX}
                onChange={(e) => majLigne(index, "precision", e.target.value)}
                placeholder="précision (facultatif)"
                aria-label="Précision"
                className="w-44 rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm text-texte"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <select
                value={ligne.palier}
                onChange={(e) => majLigne(index, "palier", e.target.value)}
                className="rounded-md border border-bordure bg-surface px-2 py-1 text-texte"
                aria-label="Palier"
              >
                {PALIERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-texte-discret">
                importance
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={ligne.importance}
                  onChange={(e) => majLigne(index, "importance", Number(e.target.value))}
                  className="w-16 rounded-md border border-bordure bg-surface px-2 py-1 text-texte"
                />
              </label>
              {lignes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLignes((l) => l.filter((_, i) => i !== index))}
                  className="ml-auto text-texte-discret hover:text-danger"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLignes((l) => [...l, ligneVide(palier, importance)])}
        className="mt-3 text-xs font-medium text-primaire hover:underline"
      >
        + Découper en une compétence de plus
      </button>

      {scission && (
        <p className="mt-3 rounded-md border border-alerte bg-alerte-faible p-3 text-xs text-texte-attenue">
          <strong className="font-medium text-alerte">
            {lignes.length} compétences remplaceront {code}.
          </strong>{" "}
          {aDesObservations
            ? "Elle porte des observations : elle sera archivée avec tout son historique, et les nouvelles démarreront à zéro observation, sans niveau. Votre tableau de bord reculera — c'est voulu, une mesure ne se transfère pas."
            : "Elle ne porte aucune observation : elle sera simplement retirée."}
        </p>
      )}

      {erreur && <p className="mt-3 text-xs text-danger">{erreur}</p>}

      <div className="mt-4 flex items-center gap-2">
        <Bouton
          type="button"
          disabled={enCours || lignes.some((l) => !l.objet.trim())}
          onClick={envoyer}
        >
          {enCours
            ? "Écriture…"
            : scission
              ? `Scinder en ${lignes.length}`
              : "Réécrire l'intitulé"}
        </Bouton>
        <button
          type="button"
          onClick={onFerme}
          className="text-xs text-texte-discret hover:text-texte"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
