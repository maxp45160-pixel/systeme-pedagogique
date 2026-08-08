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

/**
 * Tiroir replié léger — sans `Carte`, sans en-tête collant, sans slots.
 *
 * `PanneauPliable` a une forme (carte, en-tête collant) qui ne convient qu'à
 * une seule section par écran. Trois endroits repliaient des compétences ou
 * des référentiels archivés avec la même flèche ▼/▶ et le même
 * `aria-expanded`, mais dans une ligne ou un bandeau, jamais une carte
 * autonome — les y forcer aurait cassé leur mise en page. Ce composant ne
 * possède que ce que les trois partagent réellement : la flèche, l'état, le
 * câblage ARIA. Le chrome (bordure, fond, rayon) reste au choix de
 * l'appelant via `className`, posé sur le `<button>` lui-même.
 *
 * Contrôlé, pas de `useState` interne : deux des trois usages gèrent l'état
 * depuis le parent (plusieurs tiroirs à la fois, ou un état partagé au-delà
 * de ce composant) ; le troisième ajoute son propre `useState` en deux
 * lignes, comme n'importe quel composant contrôlé.
 */
export function TiroirRepliable({
  ouvert,
  onBasculer,
  libelle,
  className,
  children,
}: {
  ouvert: boolean;
  onBasculer: () => void;
  /** Contenu du bouton, à côté de la flèche — texte ou composition de `<span>`. */
  libelle: ReactNode;
  className?: string;
  /**
   * Rendu seulement quand `ouvert` est vrai. Facultatif : un des trois
   * usages réels ne fait que basculer un drapeau consulté ailleurs (un
   * filtre appliqué dans une liste voisine) — il n'a rien à rendre ici.
   */
  children?: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouvert}
        className={cx("flex w-full items-center gap-2 text-left transition-colors", className)}
      >
        <span aria-hidden className="shrink-0 text-[0.625rem] text-texte-discret">
          {ouvert ? "▼" : "▶"}
        </span>
        {libelle}
      </button>
      {ouvert && children}
    </>
  );
}
