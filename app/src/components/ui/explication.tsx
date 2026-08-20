import type { ReactNode } from "react";
import type { Explication } from "@/lib/domain/types";
import { cx } from "./primitives";

/**
 * Bloc dépliable natif (`<details>`) — fonctionne sans JavaScript.
 *
 * Support de la règle de traçabilité (protocole anti-hallucination §4) :
 * tout nombre affiché doit pouvoir répondre à « d'où vient-il ? ».
 */
export function Depliant({
  resume,
  children,
  className,
  ouvertParDefaut,
}: {
  resume: string;
  children: ReactNode;
  className?: string;
  /** Ouvre le bloc dès le rendu initial (ex. formulaire pré-rempli). */
  ouvertParDefaut?: boolean;
}) {
  return (
    <details open={ouvertParDefaut} className={cx("group", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-texte-discret transition-colors hover:text-texte marker:content-['']">
        <svg
          viewBox="0 0 12 12"
          className="size-3 shrink-0 transition-transform group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {resume}
      </summary>
      <div className="apparition mt-2">{children}</div>
    </details>
  );
}

/** Rend une trace de calcul : facteurs, assise en observations, réserves. */
export function PanneauExplication({
  explication,
  titre = "Pourquoi ce résultat ?",
}: {
  explication: Explication;
  titre?: string;
}) {
  return (
    <Depliant resume={titre}>
      <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
        <p className="text-texte-attenue">{explication.resume}</p>

        {explication.facteurs.length > 0 && (
          <dl className="mt-3 space-y-1">
            {explication.facteurs.map((f, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0">
                <dt className="text-texte-attenue">
                  {f.libelle}
                  {f.poids !== undefined && (
                    <span className="ml-1 text-texte-discret">
                      (poids {Math.round(f.poids * 100)} %)
                    </span>
                  )}
                </dt>
                <dd className="chiffres shrink-0 font-medium">{f.valeur}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-3 text-texte-discret">
          {explication.nombreObservations === 0
            ? "Aucune observation directe."
            : `Calculé à partir de ${explication.nombreObservations} observation${
                explication.nombreObservations > 1 ? "s" : ""
              }.`}
        </p>

        {/*
          Deux lignes voisines, deux choses différentes : le niveau dit jusqu'où
          la démonstration est allée, la confiance dit à quel point on peut s'y
          fier. Côte à côte dans la même liste, elles se lisaient comme deux
          notes — d'où cette précision, affichée seulement quand la confiance
          figure réellement parmi les facteurs.
        */}
        {explication.facteurs.some((f) => f.libelle === "Confiance") && (
          <p className="mt-1 text-texte-discret">
            Le niveau dit ce qui a été démontré ; la confiance dit combien de
            observations l&apos;établissent, et depuis combien de temps.
          </p>
        )}

        {explication.reserves.length > 0 && (
          <ul className="mt-2 space-y-1">
            {explication.reserves.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-texte-attenue">
                <span aria-hidden className="mt-px text-alerte">
                  ·
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Depliant>
  );
}

/** Liste de réserves affichée à plat, sans dépliant. */
export function Reserves({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-texte-attenue">
      {items.map((r, i) => (
        <li key={i} className="flex gap-1.5">
          <span aria-hidden className="mt-px text-texte-discret">
            ·
          </span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}
