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
      <EnTeteCarte titre="Où vous en êtes" legende="Des repères, pas des notes" />

      <CorpsCarte>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Statistique
            libelle="Niveau moyen"
            valeur={global.niveauMoyen}
            unite="/ 5"
            precision={
              global.competencesEvaluees > 0
                ? `sur ${global.competencesEvaluees} compétence${global.competencesEvaluees > 1 ? "s" : ""}`
                : "pas encore de mesure"
            }
          />

          <Link
            href="/atelier?document=domaines"
            className="group block rounded-md p-1 -m-1 transition-colors hover:bg-surface-2 cursor-pointer"
            title="Voir le détail par sujet dans l'Atelier"
          >
            <Statistique
              libelle="Compétences déjà testées"
              valeur={`${global.competencesEvaluees}/${global.competencesTotal}`}
              precision="au moins un exercice fait →"
            />
          </Link>

          <Statistique
            libelle="Ancrage des acquis"
            valeur={
              global.robustesseMoyenne === null
                ? null
                : `${Math.round(global.robustesseMoyenne * 100)}`
            }
            unite="%"
            precision="à quel point c'est solide"
          />
        </div>

        {!aucunePreuve && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Link
              href="/atelier?document=domaines"
              className="group block rounded-lg p-2 -m-2 transition-colors hover:bg-surface-2 cursor-pointer"
              title="Voir le détail par sujet dans l'Atelier"
            >
              <div className="mb-2 flex items-center justify-between text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                <span>Répartition des niveaux</span>
                <span className="text-primaire text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Voir par sujet →</span>
              </div>
              <RepartitionNiveaux compte={repartition} />
            </Link>
            <div className="flex items-end gap-x-6">
              <Statistique
                libelle="Travaillées ce mois-ci"
                valeur={global.competencesActives}
                precision="sur les 30 derniers jours"
              />
              <Statistique
                libelle="En progrès"
                valeur={global.competencesAmeliorees}
                precision="réussite sur 30 jours"
              />
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-bordure pt-3">
          <Depliant resume="D'où viennent ces chiffres ?">
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
