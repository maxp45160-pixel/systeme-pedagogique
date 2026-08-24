"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cx, classesLienBouton } from "@/components/ui/primitives";
import { IconeFeuille, IconeFermer, IconeFleche, IconeMinuteur } from "@/components/ui/icones";

interface Props {
  userId: string;
  joursSansActivite: number;
  nombreCompetencesActives: number;
  recommandationCode?: string;
  recommandationTitre?: string;
}

export function BandeauRepriseBienveillante({
  userId,
  joursSansActivite,
  nombreCompetencesActives,
  recommandationCode,
  recommandationTitre,
}: Props) {
  const [estMasque, setEstMasque] = useState(true);

  useEffect(() => {
    // Ne s'affiche que si l'utilisateur a au moins 5 jours d'inactivité et des compétences suivies
    if (joursSansActivite < 5 || nombreCompetencesActives === 0) {
      return;
    }
    const cleStockage = `reprise_bienveillante_masquee_${userId}`;
    const dateMasquage = sessionStorage.getItem(cleStockage);
    const aujourdhui = new Date().toISOString().slice(0, 10);

    if (dateMasquage !== aujourdhui) {
      setEstMasque(false);
    }
  }, [userId, joursSansActivite, nombreCompetencesActives]);

  const fermer = () => {
    setEstMasque(true);
    const cleStockage = `reprise_bienveillante_masquee_${userId}`;
    sessionStorage.setItem(cleStockage, new Date().toISOString().slice(0, 10));
  };

  if (estMasque) return null;

  return (
    <aside
      aria-label="Accueil après interruption"
      className="relative overflow-hidden rounded-carte border border-primaire/30 bg-surface-2 p-4 shadow-[var(--ombre-carte)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
            <IconeFeuille className="size-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-sm font-medium text-texte sm:text-base">
                Vos acquis restent documentés
              </h2>
              <span className="rounded-full border border-bordure bg-surface px-2 py-0.5 font-mono text-[0.6875rem] text-texte-discret">
                Dernière séance il y a {joursSansActivite} jours
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-texte-attenue sm:text-sm">
              Ici, pas de score qui s&apos;efface ni de pénalité de retard. Ce que vous avez
              démontré reste enregistré. Pour reprendre en douceur sans surcharge, 15 minutes
              suffisent aujourd&apos;hui.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <Link
                href="/app?temps=15&capacite=moderee"
                className={cx(classesLienBouton("principal"), "!py-1 !px-3 !text-xs")}
              >
                <IconeMinuteur className="size-3.5" />
                Séance douce de 15 minutes
                <IconeFleche className="size-3.5" />
              </Link>

              {recommandationTitre && (
                <span className="text-xs text-texte-discret">
                  Sujet suggéré : <strong className="font-medium text-texte">{recommandationTitre}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer ce message"
          className="rounded p-1 text-texte-discret transition-colors hover:bg-surface hover:text-texte"
        >
          <IconeFermer className="size-4" />
        </button>
      </div>
    </aside>
  );
}
