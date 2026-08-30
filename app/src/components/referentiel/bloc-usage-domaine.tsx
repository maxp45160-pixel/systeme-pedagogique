"use client";

import { cx } from "@/components/ui/primitives";
import type { TypeUsage } from "@/lib/domain/usage-domaine";

const USAGES_DOMAINE: Array<{
  id: TypeUsage;
  libelle: string;
  desc: string;
}> = [
  { id: "indetermine", libelle: "À préciser", desc: "Je déciderai plus tard" },
  { id: "continu", libelle: "Apprentissage personnel", desc: "Sujet durable, hors cours" },
  { id: "module", libelle: "Module de cours", desc: "Matière et période définies" },
];

/** Choix partagé par la création et la requalification d'un domaine. */
export function BlocUsageDomaine({
  usageChoisi,
  onUsageChange,
  usageAnnee,
  onAnneeChange,
  usagePeriode,
  onPeriodeChange,
  erreur,
}: {
  usageChoisi: TypeUsage;
  onUsageChange: (usage: TypeUsage) => void;
  usageAnnee: string;
  onAnneeChange: (valeur: string) => void;
  usagePeriode: string;
  onPeriodeChange: (valeur: string) => void;
  erreur: string | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-bordure bg-surface-2/30 p-3.5">
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
          Type d’apprentissage
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
          Ce choix est déclaré par vous ; il ne sera pas déduit du nom ou du contenu.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {USAGES_DOMAINE.map((usage) => {
          const actif = usageChoisi === usage.id;
          return (
            <button
              key={usage.id}
              type="button"
              onClick={() => onUsageChange(usage.id)}
              aria-pressed={actif}
              className={cx(
                "flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all cursor-pointer",
                actif
                  ? "border-primaire bg-primaire-faible text-primaire shadow-xs"
                  : "border-bordure bg-surface hover:border-primaire/40 hover:bg-surface-2 text-texte-attenue",
              )}
            >
              <span className="text-xs font-semibold">{usage.libelle}</span>
              <span className="mt-0.5 hidden text-[0.625rem] opacity-75 sm:inline">
                {usage.desc}
              </span>
            </button>
          );
        })}
      </div>
      {usageChoisi === "module" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
          <label className="block">
            <span className="block text-[0.6875rem] font-medium text-texte-attenue">
              Année académique *
            </span>
            <input
              value={usageAnnee}
              onChange={(event) => onAnneeChange(event.target.value)}
              placeholder="Ex : 2026-2027"
              className="mt-1 w-full rounded-lg border border-bordure bg-surface px-3 py-1.5 text-sm text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-[0.6875rem] font-medium text-texte-attenue">
              Période
            </span>
            <input
              value={usagePeriode}
              onChange={(event) => onPeriodeChange(event.target.value)}
              placeholder="Ex : S1"
              className="mt-1 w-full rounded-lg border border-bordure bg-surface px-3 py-1.5 text-sm text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
            />
          </label>
        </div>
      )}
      {erreur && <p className="text-[0.6875rem] text-alerte">{erreur}</p>}
    </div>
  );
}
