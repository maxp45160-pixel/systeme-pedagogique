import Link from "next/link";
import type { Engagement } from "@/lib/domain/engagement";
import {
  couvertureCompetences,
  joursRestants,
  libelleCompte,
  prioriserCouverture,
} from "@/lib/domain/engagement";
import type { SkillState } from "@/lib/domain/types";
import { Carte, CodeCompetence, Etiquette } from "@/components/ui/primitives";
import { IconeCalendrier } from "@/components/ui/icones";

/** Combien de points ciblés le bloc nomme avant de compter le reste. */
const POINTS_AFFICHES = 3;

/**
 * L'échéance qui ouvre l'écran : elle, puis son module, puis ce qui y reste
 * fragile ou jamais observé — la lecture demandée par PRODUCT.md §5.
 *
 * Rien n'est calculé ici que le moteur n'ait déjà produit : la couverture se
 * dérive des états courants (`couvertureCompetences` — « rien encore observé »
 * ne devient jamais zéro), et le module ne s'affiche que s'il a été DÉCLARÉ
 * sur l'échéance (ADR-137) et vit toujours dans le référentiel. Absente tant
 * qu'aucune échéance pertinente n'existe : le bloc ne comble jamais le vide.
 */
export function BlocEcheancePrioritaire({
  engagement,
  module,
  etatsParCode,
  now,
}: {
  engagement: Engagement;
  /** Le domaine vivant désigné par `moduleDomaineId`, résolu côté serveur. */
  module: { id: string; nom: string } | null;
  etatsParCode: Map<string, SkillState>;
  now: Date;
}) {
  const points =
    engagement.codes.length > 0
      ? prioriserCouverture(couvertureCompetences(engagement.codes, etatsParCode))
      : [];
  const affiches = points.slice(0, POINTS_AFFICHES);
  const restants = Math.max(0, points.length - affiches.length);

  return (
    <Carte>
      <div className="px-4 py-3.5 sm:px-5" data-testid="echeance-prioritaire">
        <div className="flex flex-wrap items-center gap-2">
          <IconeCalendrier className="size-4 text-primaire" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Échéance à venir
          </span>
          <Etiquette ton="primaire">{libelleCompte(joursRestants(engagement.echeanceLe, now))}</Etiquette>
        </div>

        <p className="mt-1.5 font-serif text-lg font-medium leading-snug tracking-tight text-texte">
          {engagement.libelle}
        </p>

        {module && (
          <Link
            href={`/atelier?document=${encodeURIComponent(module.id)}`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primaire hover:underline"
          >
            Module : <span className="font-semibold">{module.nom}</span> →
          </Link>
        )}

        {affiches.length > 0 && (
          <div className="mt-3 border-t border-bordure/60 pt-2.5">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-texte-discret">
              Ce qui y demande encore du travail
            </p>
            <ul className="mt-1.5 space-y-1">
              {affiches.map((point) => (
                <li key={point.code} className="flex flex-wrap items-center gap-2 text-xs">
                  <CodeCompetence code={point.code} />
                  <span className={point.observe ? "text-texte-attenue" : "font-medium text-alerte"}>
                    {point.observe
                      ? point.niveau === null
                        ? "Observé sans niveau établi"
                        : `Niveau ${point.niveau}`
                      : "Rien encore observé"}
                  </span>
                </li>
              ))}
            </ul>
            {restants > 0 && (
              <p className="mt-1.5 text-[0.6875rem] text-texte-discret">
                Et {restants} autre{restants > 1 ? "s" : ""} ciblé{restants > 1 ? "s" : ""}.
              </p>
            )}
          </div>
        )}
      </div>
    </Carte>
  );
}
