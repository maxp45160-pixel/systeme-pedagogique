"use client";

/**
 * Où ce domaine se situe dans le référentiel du compte (ADR-107).
 *
 * Un domaine peut en contenir d'autres, sans plafond de profondeur et sans
 * qu'aucune table ne les distingue : un sous-domaine est un domaine avec un
 * parent. Ce panneau montre le chemin, les enfants, et laisse déplacer.
 *
 * Trois choses qu'il ne fait pas, et c'est délibéré :
 *
 * - **il ne propose pas de parent.** Aucun classement lexical automatique ne
 *   range un domaine sous un autre (ADR-107) ; la liste est celle des domaines
 *   du compte, à la personne de choisir ;
 * - **il ne cache pas ce qu'un déplacement change**, parce qu'il ne change
 *   rien d'écrit : ni compétence, ni observation, ni score. Seule la
 *   visibilité héritée est recalculée ;
 * - **il ne propose pas une destination qui fermerait une boucle.** La
 *   descendance du domaine est retirée de la liste. Le refus qui compte reste
 *   celui de la commande SQL.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deplacerDomaine } from "@/lib/store/referentiel-actions";
import { cx } from "@/components/ui/primitives";

export function ParenteDomaine({
  domaineId,
  /*
   * Les trois listes ont une valeur par défaut, et ce n'est pas de la
   * complaisance : une vue rendue avant le déploiement de la hiérarchie ne les
   * porte pas, et un panneau secondaire ne doit pas faire tomber la fiche
   * entière. Sans elles, un onglet resté ouvert casse au premier rendu.
   */
  chemin = [],
  enfants = [],
  destinations = [],
  modifiable,
  ouvrirDomaine,
}: {
  domaineId: string;
  /** De la racine jusqu'à ce domaine inclus. Vide = on ne sait pas où il est. */
  chemin?: Array<{ id: string; nom: string }>;
  enfants?: Array<{ id: string; nom: string }>;
  /** Les domaines où il peut aller — sa propre descendance en est déjà retirée. */
  destinations?: Array<{ id: string; nom: string }>;
  /** Faux sur un domaine mis de côté : on ne réorganise pas ce qui ne sert plus. */
  modifiable: boolean;
  ouvrirDomaine: (id: string) => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [listeOuverte, setListeOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const parent = chemin.length > 1 ? chemin[chemin.length - 2] : null;
  const triees = useMemo(
    () => [...destinations].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [destinations],
  );

  function deplacer(parentId: string | null) {
    setErreur(null);
    demarrer(async () => {
      try {
        await deplacerDomaine(domaineId, parentId);
        setListeOuverte(false);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le déplacement n’a pas abouti.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-bordure bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
          Place dans le référentiel
        </span>
        {chemin.length > 1 ? (
          <span className="text-sm text-texte">
            {chemin.map((etape, rang) => (
              <span key={etape.id}>
                {rang > 0 && <span className="text-texte-discret"> › </span>}
                {etape.id === domaineId ? (
                  <span className="font-medium">{etape.nom}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => ouvrirDomaine(etape.id)}
                    className="cursor-pointer underline-offset-2 transition-colors hover:text-primaire hover:underline"
                  >
                    {etape.nom}
                  </button>
                )}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-sm text-texte-attenue">À la racine</span>
        )}

        {modifiable && (
          <button
            type="button"
            onClick={() => setListeOuverte((ouvert) => !ouvert)}
            aria-expanded={listeOuverte}
            disabled={enCours}
            className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/50 hover:text-primaire disabled:opacity-60"
          >
            Déplacer
          </button>
        )}
        {modifiable && parent && (
          <button
            type="button"
            onClick={() => deplacer(null)}
            disabled={enCours}
            className="cursor-pointer text-xs text-texte-discret underline-offset-2 transition-colors hover:text-primaire hover:underline disabled:opacity-60"
          >
            remettre à la racine
          </button>
        )}
      </div>

      {listeOuverte && (
        <div className="mt-3 flex flex-wrap gap-2">
          {triees.length === 0 ? (
            <p className="text-xs text-texte-attenue">
              Aucun autre domaine ne peut l’accueillir : tous descendent de celui-ci.
            </p>
          ) : (
            triees.map((destination) => (
              <button
                key={destination.id}
                type="button"
                onClick={() => deplacer(destination.id)}
                disabled={enCours || destination.id === parent?.id}
                className={cx(
                  "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50",
                  destination.id === parent?.id
                    ? "border-primaire bg-primaire-faible text-primaire"
                    : "border-bordure bg-surface-2 text-texte hover:border-primaire/50 hover:text-primaire",
                )}
              >
                {destination.nom}
              </button>
            ))
          )}
        </div>
      )}

      {enfants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs text-texte-discret">Contient</span>
          {enfants.map((enfant) => (
            <button
              key={enfant.id}
              type="button"
              onClick={() => ouvrirDomaine(enfant.id)}
              className="cursor-pointer rounded-lg border border-bordure bg-surface-2 px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/50 hover:text-primaire"
            >
              {enfant.nom}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-[0.6875rem] leading-relaxed text-texte-attenue">
        Un domaine montre aussi les compétences de ses sous-domaines. Le déplacer ne change
        aucune compétence, aucune trace de travail et aucun score : seule la lecture est refaite.
      </p>

      {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}
    </section>
  );
}
