import type { Activite } from "@/lib/engine/historique";
import { Carte, CorpsCarte, EnTeteCarte, Statistique } from "@/components/ui/primitives";
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
export function CarteActivite({
  activite,
  now,
  semaines,
  cellule,
}: {
  activite: Activite;
  now: Date;
  /** Profondeur de la grille. Le tableau de bord l'étale sur une année. */
  semaines?: number;
  /** Côté d'une case, en pixels — sert à faire de la grille un bandeau. */
  cellule?: number;
}) {
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

      {/*
        La grille passe devant les statistiques : c'est elle qu'on vient lire,
        et l'étaler en bandeau lui rend la largeur de la carte — elle n'occupait
        qu'un quart de la surface disponible.
      */}
      <CorpsCarte>
        <GrilleActivite
          minutesParJour={activite.minutesParJour}
          semaines={semaines}
          cellule={cellule}
          now={now}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.6875rem] text-texte-discret">
            {aucuneSeance
              ? "La grille se remplira au fil des séances."
              : "Une case vide est un jour sans séance"}
          </p>
          <LegendeActivite />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-bordure pt-3">
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
      </CorpsCarte>
    </Carte>
  );
}
