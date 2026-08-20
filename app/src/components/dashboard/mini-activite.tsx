import Link from "next/link";
import type { Activite } from "@/lib/engine/historique";
import { Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";
import { GrilleActivite, LegendeActivite } from "@/components/charts";
import { formatDateRelative, formatDuree } from "@/lib/engine/dates";
import { IconeFleche } from "@/components/ui/icones";

/**
 * Widget compact d'activité et de continuité pour la colonne latérale du tableau de bord.
 *
 * Donne un repère visuel calme sur le rythme des dernières semaines sans jamais
 * culpabiliser l'utilisateur (aucune pénalité, pas de streak).
 */
export function MiniActivite({
  activite,
  now,
}: {
  activite: Activite;
  now: Date;
}) {
  const aucuneSeance = activite.minutesParJour.size === 0;

  return (
    <Carte>
      <EnTeteCarte
        titre="Continuité"
        legende={
          activite.derniereSeance
            ? `Dernière séance ${formatDateRelative(activite.derniereSeance, now)}`
            : "Rythme de travail"
        }
      />

      <CorpsCarte>
        <div className="space-y-3">
          {/* Grille d'activité qui remplit généreusement la largeur de la carte */}
          <div className="w-full flex justify-center overflow-x-auto pb-0.5">
            <GrilleActivite
              minutesParJour={activite.minutesParJour}
              semaines={22}
              cellule={11}
              now={now}
            />
          </div>

          <div className="flex items-center justify-between text-[0.6875rem] text-texte-discret">
            <span>
              {aucuneSeance
                ? "Se remplit au fil des séances"
                : "22 dernières semaines"}
            </span>
            <LegendeActivite />
          </div>

          {/* Statistiques clés compactes */}
          <div className="grid grid-cols-2 gap-2 border-t border-bordure/60 pt-2.5">
            <div className="rounded-lg bg-surface-2 p-2 text-center">
              <span className="block text-[0.6875rem] text-texte-discret">Jours actifs</span>
              <span className="font-serif text-sm font-semibold text-texte">
                {activite.joursActifs30}
                <span className="text-xs font-normal text-texte-attenue"> / 30 j.</span>
              </span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2 text-center">
              <span className="block text-[0.6875rem] text-texte-discret">Temps investi</span>
              <span className="font-serif text-sm font-semibold text-texte">
                {activite.minutes30 > 0 ? formatDuree(activite.minutes30) : "0 min"}
              </span>
            </div>
          </div>

          {/* Lien vers progression */}
          <div className="border-t border-bordure/60 pt-2">
            <Link
              href="/progression"
              className="group flex items-center justify-between text-xs font-medium text-texte-attenue hover:text-primaire transition-colors"
            >
              <span>Voir le détail de progression</span>
              <IconeFleche className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
