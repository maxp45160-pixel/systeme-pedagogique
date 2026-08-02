import type { ReactNode } from "react";

/** En-tête de page : sur-titre (date), titre serif souligné, sous-titre, actions. */
export function EntetePage({
  titre,
  sousTitre,
  surtitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  /** Petit sur-titre en serif italique (ex. la date du jour). */
  surtitre?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {surtitre && (
          <div className="font-serif text-sm italic text-texte-discret">{surtitre}</div>
        )}
        <h1 className="mt-0.5 font-serif text-[1.75rem] font-medium leading-tight tracking-tight">
          <span className="souligne">{titre}</span>
        </h1>
        {sousTitre && (
          <p className="mt-2 max-w-2xl text-sm text-texte-attenue">{sousTitre}</p>
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
