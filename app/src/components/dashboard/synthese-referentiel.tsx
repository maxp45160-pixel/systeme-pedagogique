import Link from "next/link";
import type { Referentiel, SkillState } from "@/lib/domain/types";
import type { EtatGlobal } from "@/lib/engine/progression";
import { Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";
import { IconeFleche, IconeLivre } from "@/components/ui/icones";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";

/**
 * Synthèse passive du référentiel pour le tableau de bord.
 *
 * Donne à voir l'étendue du corpus et l'avancement de la découverte
 * sans sollicitation active de l'utilisateur.
 */
export function SyntheseReferentiel({
  referentiel,
  global,
  etats,
}: {
  referentiel: Referentiel;
  global: EtatGlobal;
  etats: SkillState[];
}) {
  const total = referentiel.actifs.length;
  const evaluees = global.competencesEvaluees;
  const nonEvaluees = Math.max(0, total - evaluees);
  const pourcentageDecouverte = total > 0 ? Math.round((evaluees / total) * 100) : 0;

  // Calculer la répartition par domaine
  const statsParDomaine = referentiel.domaines.map((domaine) => {
    const skillsDuDomaine = referentiel.actifs.filter((s) => s.domaine === domaine.id);
    const codesDuDomaine = new Set(skillsDuDomaine.map((s) => s.code));
    const evalueesDuDomaine = etats.filter(
      (e) => codesDuDomaine.has(e.skill.code) && e.niveau !== null,
    ).length;

    return {
      domaine,
      total: skillsDuDomaine.length,
      evaluees: evalueesDuDomaine,
    };
  }).filter((d) => d.total > 0);

  return (
    <Carte>
      <EnTeteCarte
        titre="Votre référentiel"
        legende={
          evaluees === 0
            ? `${total} compétences à tester`
            : `${total} compétence${total > 1 ? "s" : ""} dans votre parcours`
        }
      />

      <CorpsCarte>
        <div className="space-y-3">
          {/* Jauge d'exploration */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-texte-attenue">Progression de découverte</span>
              <span className="font-medium text-texte">{pourcentageDecouverte}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 border border-bordure/60">
              <div
                className="h-full bg-primaire transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(pourcentageDecouverte, evaluees > 0 ? 4 : 0)}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[0.6875rem] text-texte-discret">
              <span>
                <strong className="font-medium text-texte">{evaluees}</strong> évaluée{evaluees > 1 ? "s" : ""}
              </span>
              <span>
                <strong className="font-medium text-texte">{nonEvaluees}</strong> à découvrir
              </span>
            </div>
          </div>

          {/* Domaines d'apprentissage */}
          {statsParDomaine.length > 0 && (
            <div className="border-t border-bordure/60 pt-2.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-1.5">
                Domaines actifs
              </p>
              <ul className="space-y-1.5">
                {statsParDomaine.slice(0, 4).map(({ domaine, total: t, evaluees: ev }) => {
                  const nomDomaine = libelleDomaine(referentiel, domaine.id);
                  return (
                    <li key={domaine.id} className="flex items-center justify-between text-xs gap-3">
                      <span className="truncate text-texte-attenue min-w-0 flex-1" title={nomDomaine}>
                        {nomDomaine}
                      </span>
                      <span className="font-mono text-[0.6875rem] text-texte-discret shrink-0">
                        {ev}/{t}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Lien direct Atelier */}
          <div className="border-t border-bordure/60 pt-2.5">
            <Link
              href="/atelier"
              className="group flex items-center justify-between text-xs font-medium text-texte-attenue hover:text-primaire transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <IconeLivre className="size-3.5" />
                Explorer dans l’Atelier
              </span>
              <IconeFleche className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
