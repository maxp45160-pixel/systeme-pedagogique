import type { Activite } from "@/lib/engine/historique";
import { Carte, EnTeteCarte, Statistique } from "@/components/ui/primitives";
import { GrilleActivite, LegendeActivite } from "@/components/charts";
import { formatDateRelative, formatDuree } from "@/lib/engine/dates";

/**
 * Indicateur de continuité.
 *
 * Volontairement descriptif : jours travaillés, temps investi, séances.
 * Aucun compteur de série consécutive, aucun message de perte, aucune alerte
 * en cas d'interruption. La régularité est valorisée quand elle existe, jamais
 * transformée en dette quand elle manque.
 */
export function CarteActivite({ activite, now }: { activite: Activite; now: Date }) {
  const aucuneSeance = activite.minutesParJour.size === 0;

  return (
    <Carte>
      <EnTeteCarte
        titre="Activité récente"
        legende={
          activite.derniereSeance
            ? `Dernière séance ${formatDateRelative(activite.derniereSeance, now)}`
            : "Aucune séance enregistrée"
        }
      />

      <div className="px-4 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Statistique
            libelle="Jours travaillés"
            valeur={aucuneSeance ? null : activite.joursActifs30}
            precision="sur les 30 derniers jours"
          />
          <Statistique
            libelle="Temps investi"
            valeur={aucuneSeance ? null : formatDuree(activite.minutes30)}
            precision="sur 30 jours"
          />
          <Statistique
            libelle="Séances"
            valeur={aucuneSeance ? null : activite.seances30}
            precision="sur 30 jours"
          />
          <Statistique
            libelle="Total cumulé"
            valeur={aucuneSeance ? null : formatDuree(activite.minutesTotal)}
            precision="depuis le début du suivi"
          />
        </div>

        <div className="mt-5">
          <GrilleActivite minutesParJour={activite.minutesParJour} now={now} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.6875rem] text-texte-discret">
              {aucuneSeance
                ? "La grille se remplira au fil des séances."
                : "Une case vide est un jour sans séance — rien de plus."}
            </p>
            <LegendeActivite />
          </div>
        </div>
      </div>
    </Carte>
  );
}
