import type { ReactNode } from "react";

/** En-tête de page : titre, sous-titre explicatif, actions à droite. */
export function EntetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{titre}</h1>
        {sousTitre && (
          <p className="mt-1 max-w-2xl text-sm text-texte-attenue">{sousTitre}</p>
        )}
      </div>
      {/*
        Pas de `shrink-0` : sur mobile, le bloc d'actions passe à la ligne
        (l'en-tête est en `flex-wrap`) et doit alors pouvoir se replier
        lui-même. Le figer déborderait de l'écran.
      */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
