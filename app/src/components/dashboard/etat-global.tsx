import Link from "next/link";
import type { EtatGlobal } from "@/lib/engine/progression";
import type { SkillState } from "@/lib/domain/types";
import {
  Carte,
  CorpsCarte,
  EnTeteCarte,
  NombrePreuves,
  Statistique,
  TagConfiance,
} from "@/components/ui/primitives";
import { Depliant, Reserves } from "@/components/ui/explication";
import { RepartitionNiveaux } from "@/components/charts";

/**
 * « Où en suis-je ? »
 *
 * Deux nombres, jamais un seul : le score global dit l'avancement sur le
 * référentiel complet, le niveau moyen dit la qualité là où c'est mesuré.
 * Le premier seul paraîtrait sévère, le second seul surestimerait la
 * couverture — les afficher ensemble est la seule présentation honnête.
 */
export function CarteEtatGlobal({
  global,
  etats,
}: {
  global: EtatGlobal;
  etats: SkillState[];
}) {
  const repartition: Record<number, number> = {};
  for (const e of etats) {
    if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
  }

  const aucunePreuve = global.nombrePreuves === 0;

  return (
    <Carte>
      <EnTeteCarte
        titre="État global"
        legende="Indicateur de suivi, pas une note"
        action={<TagConfiance confiance={global.confiance} />}
      />

      <CorpsCarte>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
              Progression globale
            </div>
            <div className="chiffres mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-3xl font-semibold tracking-tight ${
                  aucunePreuve ? "text-texte-discret" : "text-primaire"
                }`}
              >
                {global.scoreGlobal ?? "—"}
              </span>
              <span className="text-sm text-texte-attenue">/ 100</span>
            </div>
            <div className="mt-1">
              <NombrePreuves n={global.nombrePreuves} />
            </div>
          </div>

          <Statistique
            libelle="Niveau moyen mesuré"
            valeur={global.niveauMoyen}
            unite="/ 5"
            precision={
              global.competencesEvaluees > 0
                ? `sur ${global.competencesEvaluees} compétence${global.competencesEvaluees > 1 ? "s" : ""}`
                : "aucune compétence évaluée"
            }
          />

          <Statistique
            libelle="Référentiel couvert"
            valeur={`${global.competencesEvaluees}/${global.competencesTotal}`}
            precision="compétences avec au moins une preuve"
          />

          <Statistique
            libelle="Robustesse moyenne"
            valeur={global.robustesseMoyenne === null ? null : global.robustesseMoyenne.toFixed(2)}
            precision="solidité des acquis, de 0 à 1"
          />
        </div>

        {!aucunePreuve && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <div className="mb-2 text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                Répartition des niveaux
              </div>
              <RepartitionNiveaux compte={repartition} />
            </div>
            <div className="flex items-end gap-x-6">
              <Statistique
                libelle="Compétences actives"
                valeur={global.competencesActives}
                precision="preuve de moins de 30 jours"
              />
              <Statistique
                libelle="Récemment travaillées"
                valeur={global.competencesAmeliorees}
                precision="réussite sur 30 jours"
              />
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-bordure pt-3">
          <Depliant resume="Comment ce score est-il calculé ?">
            <div className="rounded-md border border-bordure bg-surface-2 p-3 text-xs">
              {global.facteurs.length > 0 && (
                <dl className="space-y-1">
                  {global.facteurs.map((f, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0"
                    >
                      <dt className="text-texte-attenue">{f.libelle}</dt>
                      <dd className="chiffres font-medium">{f.valeur}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-3">
                <Reserves items={global.reserves} />
              </div>
              <p className="mt-3 text-texte-discret">
                Le détail par compétence est consultable dans{" "}
                <Link href="/atelier" className="text-primaire underline decoration-primaire/30">
                  l’Atelier
                </Link>
                .
              </p>
            </div>
          </Depliant>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
