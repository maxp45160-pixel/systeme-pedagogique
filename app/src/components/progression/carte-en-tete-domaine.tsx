import type { Domaine } from "@/lib/domain/types";
import type { DerniereObservationSourcee } from "@/lib/engine/lecture-domaine";
import { formatDateCourte } from "@/lib/engine/dates";
import { Carte, CorpsCarte } from "@/components/ui/primitives";
import { IconeDomaine } from "@/components/ui/icones";

/**
 * L'en-tête d'une lecture filtrée par domaine.
 *
 * Il remplace le héros quand un domaine est choisi : mêmes règles que la page
 * globale, périmètre réduit. Trois faits, aucun substitut :
 *   - ce qui a été MESURÉ et ce qui est en veille — jamais un « zéro » là où
 *     rien n'a encore été observé (P2) ;
 *   - la dernière observation avec sa SOURCE (date + origine) — une date sans
 *     provenance ne serait qu'une affirmation (P3) ;
 *   - la tendance, dérivée du rejeu du journal (`evolutionScore`), donc
 *     recalculée à chaque lecture et jamais issue du temps passé (ADR-017).
 */
const ORIGINES: Record<DerniereObservationSourcee["origine"], string> = {
  exercice: "exercice",
  projet: "projet",
  session: "séance",
  tuteur: "tuteur",
  manuel: "saisie manuelle",
};

export function CarteEnTeteDomaine({
  domaine,
  score,
  competencesMesurees,
  competencesEnVeille,
  observationsTotal,
  derniereObservation,
  variation7j,
}: {
  domaine: Domaine;
  /** Score pondéré du domaine — `null` tant qu'aucune compétence n'est mesurée. */
  score: number | null;
  competencesMesurees: number;
  /** Compétences mesurées dont la dernière observation a quitté la fenêtre. */
  competencesEnVeille: number;
  observationsTotal: number;
  derniereObservation: DerniereObservationSourcee | null;
  /** Variation du score du domaine sur 7 jours, déjà dérivée par `evolutionScore`. */
  variation7j: number | null;
}) {
  const aucuneObservation = observationsTotal === 0;

  return (
    <Carte>
      <CorpsCarte>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primaire-faible text-primaire">
              <IconeDomaine className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
                Lecture par domaine
              </p>
              <h2 className="truncate font-serif text-xl font-medium tracking-tight text-texte">
                {domaine.nom}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-baseline gap-2">
            <span className={`chiffres text-3xl font-semibold ${score === null ? "text-texte-discret" : "text-primaire"}`}>
              {score === null ? "—" : score}
            </span>
            <span className="text-xs text-texte-discret">/ 100 là où mesuré</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-bordure pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-texte-discret">Compétences mesurées</p>
            {aucuneObservation ? (
              /*
               * Pas de « 0 mesurées » : l'absence de preuve n'est pas une
               * mesure nulle, elle se dit en toutes lettres (P2).
               */
              <p className="mt-1 text-xs italic text-texte-discret">Rien encore observé dans ce domaine.</p>
            ) : (
              <p className="chiffres mt-1 font-semibold text-texte">
                {competencesMesurees}
                {competencesEnVeille > 0 && (
                  <span className="font-normal text-texte-attenue">
                    {" "}
                    · {competencesEnVeille} en veille
                  </span>
                )}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-texte-discret">Dernière observation</p>
            {derniereObservation === null ? (
              <p className="mt-1 text-xs italic text-texte-discret">Aucune observation</p>
            ) : (
              <p className="mt-1 text-texte">
                <span className="chiffres">{formatDateCourte(derniereObservation.date)}</span>
                <span className="text-xs text-texte-attenue"> · source : {ORIGINES[derniereObservation.origine]}</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-texte-discret">Tendance sur 7 jours</p>
            {variation7j === null ? (
              <p className="mt-1 text-xs italic text-texte-discret">
                Pas encore deux mesures assez éloignées pour comparer
              </p>
            ) : (
              <p className={`chiffres mt-1 font-semibold ${variation7j > 0 ? "text-succes" : variation7j < 0 ? "text-alerte" : "text-texte"}`}>
                {variation7j > 0 ? "+" : ""}
                {variation7j} pts
              </p>
            )}
          </div>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
