import Link from "next/link";
import type { Recommandation } from "@/lib/engine/recommend";
import type { Referentiel } from "@/lib/domain/types";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { formatDuree } from "@/lib/engine/dates";
import { Bouton, classesLienBouton, Etiquette } from "@/components/ui/primitives";
import { demarrerExerciceEnFocus } from "@/lib/store/seance-actions";
import { IconeFleche } from "@/components/ui/icones";

/**
 * Présentation épurée des alternatives de travail proposées par le moteur.
 *
 * Sans surcharge : titre clair, type d'activité, domaine et action directe.
 */
export function PistesAlternatives({
  recommandations,
  referentiel,
}: {
  recommandations: readonly Recommandation[];
  referentiel: Referentiel;
}) {
  // On prend les 2 meilleures alternatives qui suivent la recommandation principale
  const alternatives = recommandations.slice(1, 3);
  if (alternatives.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
          Autres pistes suggérées
        </h3>
        <Link
          href="/atelier"
          className="group flex items-center gap-1 text-xs font-medium text-texte-attenue hover:text-primaire transition-colors"
        >
          <span>Voir tout l’Atelier</span>
          <IconeFleche className="size-2.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alternatives.map((rec) => {
          const code = rec.etat.skill.code;
          const nomDomaine = libelleDomaine(referentiel, rec.etat.skill.domaine);
          const duree = rec.exercice?.dureeEstimeeMin ?? rec.dureeEstimeeMin;
          const difficulte = rec.exercice?.difficulte ?? rec.difficulteCible;
          const estExercice = Boolean(rec.exercice);
          const intituleCompetence = rec.etat.skill.intitule;
          const titreExercice = rec.exercice?.titre;

          return (
            <div
              key={code}
              className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface p-3.5 shadow-2xs transition-all hover:border-primaire/40 hover:bg-surface-2/30"
            >
              <div className="space-y-1.5">
                {/* En-tête : badge type d'activité + domaine + difficulté/durée */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Etiquette ton={estExercice ? "primaire" : "info"}>
                      {estExercice ? "Exercice" : "Séance"}
                    </Etiquette>
                    <span className="text-[0.6875rem] text-texte-discret truncate max-w-[170px]" title={nomDomaine}>
                      {nomDomaine}
                    </span>
                  </div>
                  <span className="text-[0.6875rem] text-texte-attenue shrink-0 font-mono">
                    Diff. {difficulte}/5 · ≈ {formatDuree(duree)}
                  </span>
                </div>

                {/* Titre principal */}
                <h4 className="font-serif text-sm font-medium text-texte leading-snug">
                  {estExercice && titreExercice ? titreExercice : intituleCompetence}
                </h4>

                {/* Sous-titre indicatif */}
                {estExercice && intituleCompetence && (
                  <p className="text-[0.6875rem] text-texte-discret line-clamp-1" title={intituleCompetence}>
                    {intituleCompetence}
                  </p>
                )}
                {!estExercice && (
                  <p className="text-[0.6875rem] text-texte-discret line-clamp-1">
                    {rec.etat.prochaineEtape}
                  </p>
                )}
              </div>

              {/* Action directe */}
              <div className="mt-3 flex items-center justify-between border-t border-bordure/60 pt-2.5">
                {estExercice && rec.exercice ? (
                  <form action={demarrerExerciceEnFocus.bind(null, rec.exercice.id)}>
                    <Bouton type="submit" variante="secondaire" taille="petite">
                      Commencer l’exercice →
                    </Bouton>
                  </form>
                ) : rec.etat.niveau === 0 ? (
                  <Link
                    href={`/expliquer?code=${encodeURIComponent(code)}`}
                    className={`${classesLienBouton("secondaire")} !py-1 !px-2.5 !text-xs`}
                  >
                    Expliquer →
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
                    title="Aucun exercice existe encore : tu pourras les générer puis commencer"
                  >
                    Générer puis commencer →
                  </Link>
                )}
                <Link
                  href={`/atelier?document=${encodeURIComponent(code)}`}
                  className="text-xs text-texte-discret hover:text-primaire transition-colors"
                >
                  Fiche compétence
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
