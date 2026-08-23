"use client";

import { useMemo, useRef, useState } from "react";
import type { ElementAtelier } from "./types-atelier";
import { cx } from "@/components/ui/primitives";

/**
 * Sélecteur de cible pour rattacher une compétence ou ressource à une fiche.
 *
 * Remplace le `<select>` natif : avec plusieurs dizaines de compétences, une
 * liste déroulante non filtrable était un parcours d'obstacles. Ici : une
 * recherche texte sur l'intitulé et le code, les résultats groupés par nature,
 * triés alphabétiquement en amont.
 */
export function SelectionCibleLien({
  fiches,
  valeur,
  onSelectionner,
}: {
  fiches: ElementAtelier[];
  valeur: string;
  onSelectionner: (id: string) => void;
}) {
  const [terme, setTerme] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);

  const selectionnee = fiches.find((fiche) => fiche.id === valeur) ?? null;

  const groupes = useMemo(() => {
    const filtre = terme.trim().toLocaleLowerCase("fr-FR");
    const correspondantes = filtre
      ? fiches.filter((fiche) =>
          `${fiche.titre} ${fiche.id}`.toLocaleLowerCase("fr-FR").includes(filtre),
        )
      : fiches;
    return [
      { libelle: "Compétences", items: correspondantes.filter((f) => f.type === "competence") },
      {
        libelle: "Notes & Documents",
        items: correspondantes.filter(
          (f) => f.type === "note" || f.type === "document" || f.source === "document",
        ),
      },
      { libelle: "Exercices", items: correspondantes.filter((f) => f.type === "exercice") },
      {
        libelle: "Autres",
        items: correspondantes.filter(
          (f) =>
            !(
              f.type === "competence" ||
              f.type === "note" ||
              f.type === "document" ||
              f.type === "exercice" ||
              f.source === "document"
            ),
        ),
      },
    ].filter((groupe) => groupe.items.length > 0);
  }, [fiches, terme]);

  const totalResultats = groupes.reduce((total, groupe) => total + groupe.items.length, 0);

  return (
    <div className="relative flex-1 min-w-0" ref={racineRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls="liste-cibles-lien"
        aria-autocomplete="list"
        value={ouvert ? terme : selectionnee ? `${selectionnee.type === "competence" ? `${selectionnee.id} — ` : ""}${selectionnee.titre}` : terme}
        placeholder="Rechercher une compétence ou ressource…"
        onFocus={() => {
          setOuvert(true);
          setTerme("");
        }}
        onBlur={() => {
          window.setTimeout(() => setOuvert(false), 150);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOuvert(false);
        }}
        onChange={(event) => {
          setTerme(event.target.value);
          setOuvert(true);
        }}
        className="w-full rounded-md border border-bordure bg-surface-2 px-2.5 py-1.5 text-xs text-texte outline-none focus:border-primaire"
      />
      {ouvert && (
        <div
          id="liste-cibles-lien"
          role="listbox"
          aria-label="Cibles possibles"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-bordure bg-surface p-1 shadow-[var(--ombre-surcouche)]"
        >
          {totalResultats === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-texte-discret">Aucun résultat.</p>
          ) : (
            groupes.map((groupe) => (
              <div key={groupe.libelle}>
                <p className="px-2 pt-1.5 pb-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
                  {groupe.libelle}
                </p>
                {groupe.items.map((fiche) => (
                  <button
                    key={fiche.id}
                    type="button"
                    role="option"
                    aria-selected={fiche.id === valeur}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelectionner(fiche.id);
                      setTerme("");
                      setOuvert(false);
                    }}
                    className={cx(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                      fiche.id === valeur
                        ? "bg-primaire-faible font-medium text-primaire"
                        : "text-texte hover:bg-surface-2",
                    )}
                  >
                    {fiche.type === "competence" && (
                      <span className="font-mono text-[0.625rem] text-primaire">{fiche.id} — </span>
                    )}
                    {fiche.titre}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
