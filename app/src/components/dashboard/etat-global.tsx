import Link from "next/link";
import type { EtatGlobal } from "@/lib/engine/progression";
import type { SkillState } from "@/lib/domain/types";
import { Carte, CorpsCarte, EnTeteCarte, Statistique } from "@/components/ui/primitives";
import { Depliant, Reserves } from "@/components/ui/explication";
import { RepartitionNiveaux } from "@/components/charts";

/**
 * Ce que valent les mesures — pas ce qu'elles totalisent.
 *
 * Le score global, la confiance et le nombre de preuves ne sont plus ici : ils
 * ouvrent la page, dans l'en-tête du profil. Cette carte les répétait mot pour
 * mot deux blocs plus bas, si bien que le même « 42 / 100 » apparaissait deux
 * fois sur un écran — deux affichages d'une seule valeur, dont l'un finit
 * toujours par diverger.
 *
 * La règle des deux nombres tient toujours : le score dit l'avancement sur le
 * référentiel complet, le niveau moyen dit la qualité là où c'est mesuré, et
 * l'un sans l'autre ment. Ils restent tous deux sur cet écran — à une carte de
 * distance, pas en double.
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
      <EnTeteCarte titre="Détail des mesures" legende="Indicateurs de suivi, pas des notes" />

      <CorpsCarte>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
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

          <Link
            href="/atelier?document=domaines"
            className="group block rounded-md p-1 -m-1 transition-colors hover:bg-surface-2 cursor-pointer"
            title="Explorer la couverture par domaine dans l'Atelier"
          >
            <Statistique
              libelle="Référentiel couvert"
              valeur={`${global.competencesEvaluees}/${global.competencesTotal}`}
              precision="compétences avec au moins une preuve →"
            />
          </Link>

          <Statistique
            libelle="Robustesse moyenne"
            valeur={global.robustesseMoyenne === null ? null : global.robustesseMoyenne.toFixed(2)}
            precision="solidité des acquis, de 0 à 1"
          />
        </div>

        {!aucunePreuve && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Link
              href="/atelier?document=domaines"
              className="group block rounded-lg p-2 -m-2 transition-colors hover:bg-surface-2 cursor-pointer"
              title="Voir la répartition par domaine dans l'Atelier"
            >
              <div className="mb-2 flex items-center justify-between text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                <span>Répartition des niveaux</span>
                <span className="text-primaire text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Explorer les domaines →</span>
              </div>
              <RepartitionNiveaux compte={repartition} />
            </Link>
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
