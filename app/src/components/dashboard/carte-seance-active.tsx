import Link from "next/link";
import { IconeExercices, IconeFeuille, IconeFleche } from "@/components/ui/icones";
import { Bouton, Carte, CodeCompetence, Etiquette, classesLienBouton } from "@/components/ui/primitives";
import { formatDuree } from "@/lib/engine/dates";
import { abandonnerSeance } from "@/lib/store/seance-actions";
import type { LearningSession, Referentiel } from "@/lib/domain/types";

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
  const titre = intention
    || (premierExercice?.libelle ? `Séance : ${premierExercice.libelle}` : "Séance d'entraînement en cours");

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
      <IconeFeuille
        className="pointer-events-none absolute -bottom-8 -right-6 size-40 text-primaire opacity-[0.05]"
      />

      <div className="relative p-4 sm:p-5" data-tour="action-prioritaire">
        {/* En-tête de carte avec badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primaire animate-pulse" aria-hidden />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire mr-1">
              Séance en cours
            </span>
            <Etiquette ton="primaire">Entraînement</Etiquette>
            <Etiquette>≈ {formatDuree(dureeMin)}</Etiquette>
            <Etiquette className="chiffres">
              {seance.activites.length} activité{seance.activites.length > 1 ? "s" : ""}
            </Etiquette>
            <span className="text-xs text-texte-discret">
              · Débutée il y a {formatDuree(minutesDepuisDebut)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {totalSeancesOuvertes > 1 && (
              <span className="text-xs text-texte-discret">
                {totalSeancesOuvertes} séances ouvertes ·{" "}
                <Link href="/seances" className="font-medium text-primaire hover:underline">
                  Voir le cahier
                </Link>
              </span>
            )}
            <form action={abandonnerSeance.bind(null, seance.id)}>
              <Bouton
                type="submit"
                variante="secondaire"
                title="Abandonne cette séance pour revenir aux recommandations du moteur"
              >
                Passer la séance
              </Bouton>
            </form>
          </div>
        </div>

        {/* Titre de la séance */}
        <h2 className="mt-2.5 font-serif text-lg sm:text-xl font-medium leading-snug tracking-tight">
          {titre}
        </h2>

        <p className="mt-1 text-xs sm:text-sm text-texte-attenue max-w-3xl">
          Retrouve tes exercices en cours, le minuteur et l&apos;accompagnement du tuteur dans ton espace de travail.
        </p>

        {/* Compétences mobilisées */}
        {codes.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-texte-discret">
              Compétences mobilisées :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {codes.map((code) => {
                const competence = referentiel.parCode.get(code);
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-md border border-bordure bg-surface-2 px-2 py-0.5 text-xs"
                    title={competence?.intitule ?? code}
                  >
                    <CodeCompetence code={code} />
                    {competence && (
                      <span className="max-w-[12rem] truncate text-[0.6875rem] text-texte-attenue hidden sm:inline">
                        {competence.intitule}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Programme des exercices de la séance */}
        {seance.activites.length > 0 && (
          <div className="mt-3 rounded-lg border border-bordure bg-surface-2/70 p-2.5 sm:p-3">
            <div className="flex items-center justify-between text-xs text-texte-discret mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-primaire text-[0.6875rem]">
                Programme de la séance
              </span>
              <span className="text-[0.6875rem]">{seance.activites.length} exercice{seance.activites.length > 1 ? "s" : ""}</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {seance.activites.map((act, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-bordure/60 bg-surface px-2.5 py-1.5 text-xs shadow-xs"
                >
                  <IconeExercices className="size-3.5 text-primaire shrink-0" />
                  <span className="font-medium text-texte truncate">{act.libelle || `Exercice ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-bordure/60 pt-3">
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
        </div>
      </div>
    </Carte>
  );
}

