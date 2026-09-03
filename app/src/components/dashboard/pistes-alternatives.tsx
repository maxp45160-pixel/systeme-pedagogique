import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import { formatDuree } from "@/lib/engine/dates";
import { Bouton, Carte, classesLienBouton } from "@/components/ui/primitives";
import { demarrerExerciceEnFocus } from "@/lib/store/seance-actions";
import { IconeFleche } from "@/components/ui/icones";
import { INFOBULLE_GENERER_PUIS_COMMENCER } from "@/lib/domain/navigation-exercice";

/**
 * Présentation épurée des alternatives de travail proposées par le moteur.
 *
 * Sans surcharge : titre clair, type d'activité, domaine et action directe.
 */
export function PistesAlternatives({
  recommandations,
}: {
  recommandations: readonly Recommandation[];
}) {
  // On prend les 2 meilleures alternatives qui suivent la recommandation principale
  const alternatives = recommandations.slice(1, 3);
  if (alternatives.length === 0) return null;

  return (
    <Carte className="h-full overflow-hidden">
      <section className="p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight text-texte">
          Vous préférez autre chose&nbsp;?
        </h2>

        <div className="mt-5 divide-y divide-bordure/60">
          {alternatives.map((rec) => {
          const code = rec.etat.skill.code;
          const duree = rec.exercice?.dureeEstimeeMin ?? rec.dureeEstimeeMin;
          const estExercice = Boolean(rec.exercice);
          const intituleCompetence = rec.etat.skill.intitule;
          const titreExercice = rec.exercice?.titre;
          const description = estExercice ? intituleCompetence : rec.etat.prochaineEtape;

          return (
            <article
              key={code}
              className="py-6 first:pt-4"
            >
              <div className="space-y-2">
                <h3 className="font-serif text-lg font-medium leading-snug text-texte">
                  {estExercice && titreExercice ? titreExercice : intituleCompetence}
                </h3>

                <p className="line-clamp-2 text-xs leading-relaxed text-texte-attenue" title={description}>
                  {description} · ≈ {formatDuree(duree)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {estExercice && rec.exercice ? (
                  <form action={demarrerExerciceEnFocus.bind(null, rec.exercice.id)}>
                    <Bouton type="submit" variante="secondaire" taille="petite">
                      Commencer maintenant
                      <IconeFleche className="size-3.5" />
                    </Bouton>
                  </form>
                ) : rec.etat.niveau === 0 ? (
                  <Link
                    href={`/expliquer?code=${encodeURIComponent(code)}`}
                    className={`${classesLienBouton("secondaire")} !py-1 !px-2.5 !text-xs`}
                  >
                    Expliquer
                    <IconeFleche className="size-3.5" />
                  </Link>
                ) : (
                  /*
                   * Pas d'exercice derrière cette recommandation : le lien mène
                   * au compositeur, qui proposera la génération avant le
                   * démarrage — le libellé ne promet que ce qui existe.
                   */
                  <Link
                    href={`/seances?composer=1&code=${encodeURIComponent(code)}`}
                    className={`${classesLienBouton("secondaire")} !py-1 !px-2.5 !text-xs`}
                    title={INFOBULLE_GENERER_PUIS_COMMENCER}
                  >
                    Générer puis commencer
                    <IconeFleche className="size-3.5" />
                  </Link>
                )}
                <Link
                  href={`/atelier?document=${encodeURIComponent(code)}`}
                  className="text-xs text-texte-attenue transition-colors hover:text-primaire"
                >
                  Fiche compétence
                </Link>
              </div>
            </article>
          );
          })}
        </div>
      </section>
    </Carte>
  );
}
