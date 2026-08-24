"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * Démonstration « Ailleurs / Ici » : le même profil de compétences, lu selon
 * deux conventions. Ailleurs, ce qui n'a jamais été travaillé compte comme
 * zéro et fait baisser la moyenne ; ici, seul le travail réel est mesuré.
 *
 * Données fictives de démonstration — aucune lecture de la base, aucun
 * calcul du moteur. Les deux scores (40 et 60) sont écrits en dur.
 */

type Mode = "ailleurs" | "ici";

interface LigneProfil {
  nom: string;
  source: string;
  niveau: number | null;
}

const PROFIL: LigneProfil[] = [
  { nom: "Dériver une fonction composée", source: "Maths · 4 exercices", niveau: 3 },
  { nom: "Rédiger une démonstration", source: "Maths · 2 exercices", niveau: 2 },
  { nom: "Employer le subjonctif à l'écrit", source: "Espagnol · 3 exercices", niveau: 4 },
  { nom: "Résoudre une équation du second degré", source: "Jamais travaillé", niveau: null },
  { nom: "Comprendre un texte à l'oral", source: "Jamais travaillé", niveau: null },
  { nom: "Accorder les temps du passé", source: "Espagnol · 1 exercice", niveau: 3 },
];

const MODES: { cle: Mode; libelle: string }[] = [
  { cle: "ailleurs", libelle: "Ailleurs" },
  { cle: "ici", libelle: "Ici" },
];

export function ComparaisonMoyenne() {
  const [mode, setMode] = useState<Mode>("ici");
  const ailleurs = mode === "ailleurs";

  return (
    <div className="mt-8 overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-carte)]">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">
          Ce que vous travaillez
        </span>
        <div className="flex rounded-md border border-bordure-forte bg-fond p-0.5" role="group" aria-label="Mode de lecture">
          {MODES.map((option) => {
            const estActif = option.cle === mode;
            return (
              <button
                key={option.cle}
                type="button"
                aria-pressed={estActif}
                onClick={() => setMode(option.cle)}
                className={cx(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  estActif
                    ? "bg-texte text-fond"
                    : "text-texte-attenue hover:bg-surface-2 hover:text-texte",
                )}
              >
                {option.libelle}
              </button>
            );
          })}
        </div>
      </div>

      <ul>
        {PROFIL.map((ligne) => {
          const absente = ligne.niveau === null;
          const compteZero = absente && ailleurs;
          const largeur = absente ? "0%" : `${((ligne.niveau ?? 0) / 5) * 100}%`;
          return (
            <li
              key={ligne.nom}
              className={cx(
                "grid grid-cols-[1fr_auto] items-center gap-4 border-t border-bordure px-5 py-3 transition-colors duration-300 sm:grid-cols-[1fr_8rem_4rem]",
                compteZero && "bg-alerte-faible",
              )}
            >
              <div className="min-w-0">
                <p className={cx("truncate text-sm", compteZero ? "font-medium text-alerte" : "text-texte")}>
                  {ligne.nom}
                </p>
                <p className={cx("mt-0.5 text-xs", compteZero ? "font-medium text-alerte" : "text-texte-discret")}>
                  {compteZero ? "Jamais travaillé — compté comme un zéro" : absente ? "Jamais travaillé — hors calcul" : ligne.source}
                </p>
              </div>
              <div
                className={cx(
                  "hidden h-[7px] overflow-hidden rounded-sm border sm:block",
                  compteZero && "border-alerte/60 bg-surface",
                  absente && !compteZero && "border-dashed border-bordure bg-transparent",
                  !absente && "border-bordure bg-surface-3",
                )}
                aria-hidden
              >
                <div
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: largeur,
                    background: compteZero ? "var(--alerte)" : absente ? "transparent" : "var(--primaire)",
                  }}
                />
              </div>
              <span
                className={cx(
                  "chiffres text-right font-mono text-[0.8125rem]",
                  compteZero && "font-semibold text-alerte",
                  absente && !compteZero && "text-texte-discret",
                )}
              >
                {compteZero ? "0 / 5" : absente ? "—" : `${ligne.niveau} / 5`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-bordure-forte bg-surface-2 px-5 py-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">Niveau global</p>
          <p key={mode} className="apparition chiffres flex items-baseline gap-2 font-serif text-3xl tracking-tight">
            <span className={ailleurs ? "text-alerte" : "text-primaire"}>
              {ailleurs ? 40 : 60}
            </span>
            <span className="font-mono text-sm text-texte-discret">/ 100</span>
            <span
              className={
                ailleurs
                  ? "rounded-full border border-alerte/40 bg-alerte-faible px-2 py-0.5 font-mono text-xs font-medium text-alerte"
                  : "rounded-full border border-succes/40 bg-succes-faible px-2 py-0.5 font-mono text-xs font-medium text-succes"
              }
            >
              {ailleurs ? "−20 pts" : "+20 pts"}
            </span>
          </p>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-texte-attenue">
          {ailleurs ? (
            <>
              Les deux sujets jamais travaillés comptent pour zéro.{" "}
              <b className="font-semibold text-alerte">
                Ajoutez un chapitre à votre programme et votre moyenne baisse
              </b>{" "}
              — alors que vous n&apos;avez rien oublié de ce que vous saviez faire.
            </>
          ) : (
            <>
              Calculé sur ce qui a été testé, et sur rien d&apos;autre.{" "}
              <b className="font-semibold text-texte">4 sujets sur 6 testés.</b> Ajouter un
              chapitre ne fait pas baisser votre niveau — ça montre juste qu&apos;il reste du
              terrain devant vous.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
