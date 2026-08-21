import type { ReactNode } from "react";
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
