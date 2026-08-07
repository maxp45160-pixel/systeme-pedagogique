"use client";

import { useState, type ReactNode } from "react";
import { Carte, cx } from "@/components/ui/primitives";

/**
 * Une carte dont l'en-tête plie et déplie le contenu.
 *
 * Deux règles, et la seconde est celle qui a motivé le composant :
 *
 *  - **la flèche seule est le bouton de repli** — le titre est un contenu
 *    libre rendu à côté d'elle. S'il contient un lien, ce lien navigue sans
 *    conflit avec le repli : un bouton dans un bouton n'est pas du HTML
 *    valide, et le clic y devient ambigu (retour utilisateur R3) ;
 *  - **l'en-tête reste lisible déplié** — fond propre et position collante. Un
 *    panneau ouvert de seize lignes perdait le nom du domaine hors de l'écran,
 *    et replier n'aide pas si l'on ne sait plus ce qu'on est en train de lire.
 *
 * L'état d'ouverture est interne et volatile : rien n'est persisté, donc pas de
 * clé de stockage navigateur, donc pas de question de cloisonnement par compte
 * (ADR-029).
 */
export function PanneauPliable({
  titre,
  actions,
  sousEntete,
  ouvertParDefaut = true,
  children,
  pied,
}: {
  /** Contenu de l'en-tête : nom, étiquettes, compteurs — peut contenir un lien. */
  titre: ReactNode;
  /** Boutons du panneau, rendus à côté du titre et hors du bouton de repli. */
  actions?: ReactNode;
  /** Rendu sous la ligne de titre, dans le bloc collant : description, avertissement. */
  sousEntete?: ReactNode;
  ouvertParDefaut?: boolean;
  children: ReactNode;
  /** Rendu après le contenu, et seulement quand le panneau est ouvert. */
  pied?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  return (
    <Carte>
      <div className="sticky top-0 z-[1] rounded-t-carte border-b border-bordure bg-surface px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOuvert((o) => !o)}
              aria-expanded={ouvert}
              aria-label={ouvert ? "Replier" : "Déplier"}
              className="shrink-0 rounded p-0.5 text-left transition-colors hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={cx(
                  "block text-[0.625rem] text-texte-discret transition-transform",
                  ouvert ? "rotate-0" : "-rotate-90",
                )}
              >
                ▼
              </span>
            </button>
            {titre}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
        {sousEntete}
      </div>

      {ouvert && children}
      {ouvert && pied}
    </Carte>
  );
}
