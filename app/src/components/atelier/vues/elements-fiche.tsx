"use client";

import { formatDateCourte } from "@/lib/engine/dates";
import type { ObservationAtelier } from "@/lib/documents/vue-atelier";
import { cx } from "@/components/ui/primitives";

export const LIBELLES_PALIERS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export const LIBELLES_CONFIANCE: Record<string, string> = {
  nulle: "Aucune",
  faible: "Faible",
  moyenne: "Moyenne",
  forte: "Forte",
};

export function dateCourte(date: string | null): string {
  if (!date) return "Aucune activité";
  return formatDateCourte(date);
}

export function pourcentage(valeur: number | null): string {
  return valeur === null ? "—" : `${Math.round(valeur * 100)} %`;
}

export function libelleResultatObservation(resultat: "reussi" | "partiel" | "echec"): string {
  return resultat === "reussi" ? "Réussie" : resultat === "partiel" ? "Partielle" : "À revoir";
}

export function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  const estEvalue = valeur > 0;
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)_3.25rem] items-center gap-4 text-sm">
      <span className="truncate text-texte-attenue">{libelle}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cx("block h-full rounded-full", estEvalue ? "bg-primaire" : "bg-transparent")}
          style={{ width: `${Math.round(valeur * 100)}%` }}
        />
      </span>
      <span className={cx("chiffres text-right font-medium", estEvalue ? "text-texte" : "text-texte-discret")}>
        {Math.round(valeur * 100)}%
      </span>
    </div>
  );
}

export function Indicateur({ libelle, valeur, precision }: { libelle: string; valeur: string; precision: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-bordure bg-surface px-5 py-4 shadow-[var(--ombre-posee)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">{libelle}</p>
      <p className="chiffres mt-2 truncate text-2xl font-semibold tracking-tight text-texte">{valeur}</p>
      <p className="mt-1 text-xs leading-relaxed text-texte-discret">{precision}</p>
    </div>
  );
}

/**
 * Une mesure, posée sans boîte et sur deux lignes.
 */
export function Mesure({ libelle, valeur, precision }: { libelle: string; valeur: string; precision: string }) {
  return (
    <div className="min-w-0 px-4">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">{libelle}</p>
      <p className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className="chiffres shrink-0 text-base font-semibold tracking-tight text-texte">{valeur}</span>
        <span className="truncate text-[0.6875rem] text-texte-discret">{precision}</span>
      </p>
    </div>
  );
}

/**
 * Une observation, cliquable quand elle a un document.
 */
export function ObservationLiee({
  observation,
  ouvrirElement,
}: {
  observation: ObservationAtelier;
  ouvrirElement: (id: string) => void;
}) {
  const corps = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-medium leading-snug text-texte">{observation.contexte}</span>
        <span
          className={cx(
            "shrink-0 rounded px-1.5 py-0.5 text-[0.625rem]",
            observation.resultat === "reussi"
              ? "bg-succes-faible text-succes"
              : observation.resultat === "partiel"
                ? "bg-info-faible text-info"
                : "bg-danger-faible text-danger",
          )}
        >
          {observation.resultat === "reussi" ? "Solide" : observation.resultat === "partiel" ? "Partiel" : "À revoir"}
        </span>
      </span>
      <span className="mt-1 block text-[0.6875rem] text-texte-discret">
        {dateCourte(observation.date)} · observation {observation.niveauObservation} · {observation.autonomie}
      </span>
    </>
  );

  if (!observation.documentId) {
    return <div className="rounded-lg border border-bordure bg-surface px-3 py-2.5">{corps}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => ouvrirElement(observation.documentId!)}
      className="block w-full rounded-lg border border-bordure bg-surface px-3 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
    >
      {corps}
    </button>
  );
}
