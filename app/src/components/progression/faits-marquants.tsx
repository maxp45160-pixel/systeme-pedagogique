import type { EvolutionScore } from "@/lib/engine/evolution";
import type { Carriere } from "@/lib/engine/carriere";
import type { EtatGlobal } from "@/lib/engine/progression";
import { IconeCompetences, IconeExercices, IconePreuve, IconeValide } from "@/components/ui/icones";

/**
 * Les faits marquants de la pratique — la ligne qu'on balaie en entrant.
 *
 * Chaque carte compte un événement déjà écrit dans le journal : un palier
 * franchi, une première mesure, un jour d'une série. Rien ici ne se débloque
 * et rien ne s'accumule hors des observations : sur un compte sans
 * observation, chaque carte affiche « — » plutôt qu'un zéro qui prétendrait
 * une histoire vide mesurée (P2).
 */
export function FaitsMarquants({
  evolution,
  carriere,
  global,
}: {
  evolution: EvolutionScore;
  carriere: Carriere;
  global: EtatGlobal;
}) {
  const aucuneObservation = global.nombreObservations === 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Fait
        icone={<IconeValide className="size-4" />}
        tonIcone="text-accent"
        valeur={aucuneObservation ? null : String(evolution.franchissementsTotal)}
        libelle="Paliers franchis"
        precision="depuis le premier jour"
      />
      <Fait
        icone={<IconeCompetences className="size-4" />}
        tonIcone="text-info"
        valeur={String(evolution.premieresMesuresTotal)}
        libelle="Compétences essayées"
        precision="avec au moins un résultat"
      />
      <Fait
        icone={<IconeExercices className="size-4" />}
        tonIcone="text-accent"
        valeur={carriere.meilleureSerie > 0 ? `${carriere.meilleureSerie} j` : null}
        libelle="Meilleure série"
        precision={
          carriere.serieEnCours > 0 ? `${carriere.serieEnCours} j en cours` : "jours consécutifs"
        }
      />
      <Fait
        icone={<IconePreuve className="size-4" />}
        tonIcone="text-succes"
        valeur={
          global.robustesseMoyenne === null
            ? null
            : `${Math.round(global.robustesseMoyenne * 100)} %`
        }
        libelle="Ancrage moyen"
        precision="à quel point c'est solide"
      />
    </div>
  );
}

function Fait({
  icone,
  tonIcone,
  valeur,
  libelle,
  precision,
}: {
  icone: React.ReactNode;
  /** La couleur dit l'espèce de fait (progression, exploration, mesure) — jamais une magnitude. */
  tonIcone: string;
  valeur: string | null;
  libelle: string;
  precision?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-carte border border-bordure bg-surface p-4 shadow-[var(--ombre-carte)]">
      <span aria-hidden className={`absolute right-3 top-3 opacity-70 ${tonIcone}`}>
        {icone}
      </span>
      <p
        className={`chiffres text-3xl font-semibold tracking-tight ${
          valeur === null ? "text-texte-discret" : "text-texte"
        }`}
      >
        {valeur ?? "—"}
      </p>
      <p className="mt-1 text-xs font-medium text-texte-attenue">{libelle}</p>
      {precision && <p className="mt-0.5 text-[0.6875rem] text-texte-discret">{precision}</p>}
    </div>
  );
}
