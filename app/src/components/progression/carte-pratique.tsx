import type { Carriere } from "@/lib/engine/carriere";
import { formatDuree } from "@/lib/engine/dates";
import { Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";

/**
 * Les totaux de la pratique, en lignes pleines.
 *
 * Chaque ligne compte un fait déjà écrit — une séance tenue, un exercice mené,
 * un jour actif. Aucune de ces valeurs ne s'agrège en rang ni en note : elles
 * se lisent côte à côte comme un inventaire, pas comme une échelle.
 */
export function CartePratique({ carriere }: { carriere: Carriere }) {
  return (
    <Carte>
      <EnTeteCarte titre="La pratique" legende="Toute l'histoire, comptée" />
      <CorpsCarte>
        <div className="space-y-1.5">
          <Ligne libelle="Temps travaillé" valeur={carriere.minutesTotal > 0 ? formatDuree(carriere.minutesTotal) : "—"} />
          <Ligne libelle="Séances tenues" valeur={String(carriere.seancesTotal)} />
          <Ligne libelle="Exercices menés" valeur={String(carriere.exercicesMenes)} />
          <Ligne libelle="Résultats observés" valeur={String(carriere.observationsTotal)} />
          <Ligne libelle="Jours actifs" valeur={String(carriere.joursActifsTotal)} />
          <Ligne
            libelle="Meilleure série"
            valeur={carriere.meilleureSerie > 0 ? `${carriere.meilleureSerie} j` : "—"}
            precision={
              carriere.serieEnCours > 0 ? (
                <span className="text-accent">{carriere.serieEnCours} j en cours</span>
              ) : undefined
            }
          />
        </div>
      </CorpsCarte>
    </Carte>
  );
}

function Ligne({
  libelle,
  valeur,
  precision,
}: {
  libelle: string;
  valeur: string;
  precision?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
      <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-texte-attenue">
        {libelle}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        {/* `chiffres` sur la valeur seule : les lignes ne portent pas d'unité partagée à aligner. */}
        <span className="chiffres text-sm font-semibold text-texte">{valeur}</span>
        {precision && <span className="text-[0.625rem]">{precision}</span>}
      </span>
    </div>
  );
}
