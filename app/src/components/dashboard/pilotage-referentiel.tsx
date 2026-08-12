import Link from "next/link";

import { BoutonCreerReferentiel } from "@/components/referentiel/modale-referentiel";
import { IconeCompetences, IconeFleche } from "@/components/ui/icones";
import type { Referentiel } from "@/lib/domain/types";

export function PilotageReferentiel({
  referentiel,
  compteId,
}: {
  referentiel: Referentiel;
  compteId: string;
}) {
  const domaines = referentiel.domaines.filter(
    (domaine) =>
      !domaine.archive && referentiel.skills.some((skill) => skill.domaine === domaine.id && skill.active && !skill.archive),
  );

  return (
    <details className="group rounded-xl border border-bordure bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primaire-faible text-primaire">
          <IconeCompetences className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Piloter le référentiel</span>
          <span className="mt-0.5 block text-xs text-texte-discret">
            {referentiel.actifs.length} compétences actives · {domaines.length} domaines
          </span>
        </span>
        <span className="text-xs font-medium text-primaire">Faire évoluer</span>
        <IconeFleche className="size-4 rotate-90 text-texte-discret transition-transform group-open:-rotate-90" />
      </summary>
      <div className="border-t border-bordure px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-relaxed text-texte-attenue">
            Décris un nouveau sujet pour obtenir une proposition complète, ou ouvre un domaine pour demander au tuteur de le réviser. Les changements restent soumis à ta validation.
          </p>
          <BoutonCreerReferentiel compteId={compteId} libelle="Couvrir un nouveau sujet" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {domaines.map((domaine) => (
            <Link
              key={domaine.id}
              href={`/atelier?document=${encodeURIComponent(`domaine:${domaine.id}`)}&mode=referentiel`}
              className="rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-xs font-medium text-texte-attenue transition-colors hover:border-primaire/35 hover:text-primaire"
            >
              Réviser {domaine.nom}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
