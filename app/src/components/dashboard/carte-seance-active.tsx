import Link from "next/link";
import { IconeFleche } from "@/components/ui/icones";
import { Carte, classesLienBouton, Filigrane } from "@/components/ui/primitives";
import { PasserSeance } from "@/components/dashboard/passer-seance";
import { formatDuree } from "@/lib/engine/dates";
import type { LearningSession, Referentiel } from "@/lib/domain/types";

/**
 * Carte de reprise de séance active.
 *
 * Épurée et directe : titre clair, durée, compétences et bouton de reprise.
 */
export function CarteSeanceActive({
  seance,
  totalSeancesOuvertes,
  referentiel,
  now,
}: {
  seance: LearningSession;
  totalSeancesOuvertes: number;
  referentiel: Referentiel;
  now: Date;
}) {
  const intention = seance.besoinDeclare?.intention?.trim();
  const premierExercice = seance.activites.find((a) => a.type === "exercice");
  const titre = intention || premierExercice?.libelle || "Séance d'entraînement en cours";

  const dureeMin = seance.blueprint?.dureeCibleMin ?? seance.dureeMin ?? 25;
  const minutesDepuisDebut = Math.max(
    1,
    Math.round((now.getTime() - new Date(seance.date).getTime()) / 60_000),
  );

  const codes = seance.skillCodes.length > 0
    ? seance.skillCodes
    : (seance.blueprint?.cibles.map((c) => c.code) ?? []);

  return (
    <Carte accent className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primaire" aria-hidden />
      <Filigrane className="size-40" />

      <div className="relative p-4 sm:p-5 space-y-3" data-tour="action-prioritaire">
        {/* En-tête épuré */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
              <span className="size-1.5 rounded-full bg-primaire animate-pulse" aria-hidden />
              Séance en cours
            </span>
            <span className="text-xs text-texte-attenue">
              ≈ {formatDuree(dureeMin)} · Débutée il y a {formatDuree(minutesDepuisDebut)}
            </span>
          </div>

          <PasserSeance seanceId={seance.id} />
        </div>

        {/* Titre & Compétences ciblées */}
        <div>
          <h2 className="font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight text-texte">
            {titre}
          </h2>
          {codes.length > 0 && (
            <p className="mt-1 text-xs text-texte-attenue line-clamp-2">
              {codes.map((c) => referentiel.parCode.get(c)?.intitule ?? c).join(" · ")}
            </p>
          )}
        </div>

        {/* Actions directes */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure/60 pt-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/seances?session=${encodeURIComponent(seance.id)}`}
              className={classesLienBouton("principal")}
            >
              Reprendre la séance
              <IconeFleche className="size-4" />
            </Link>
            <Link
              href="/seances"
              className={classesLienBouton("secondaire")}
            >
              Ouvrir le cahier
            </Link>
          </div>

          {totalSeancesOuvertes > 1 && (
            <Link href="/seances" className="text-xs text-texte-discret hover:text-primaire transition-colors">
              {totalSeancesOuvertes} séances ouvertes →
            </Link>
          )}
        </div>
      </div>
    </Carte>
  );
}
