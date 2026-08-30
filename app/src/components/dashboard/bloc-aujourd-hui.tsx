"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Carte,
  EnTeteCarte,
  Etiquette,
  classesLienBouton,
} from "@/components/ui/primitives";
import { IconeChevronDroit, IconeFleche } from "@/components/ui/icones";
import { ActionPreparerSeance } from "@/components/seances/action-preparer-seance";
import { ActionSeance } from "@/components/seances/action-seance";
import {
  attendPreparationSeance,
  preparationInstantaneeSeance,
} from "@/lib/domain/seance";
import type { LearningSession } from "@/lib/domain/types";
import { cleJour, formatDuree } from "@/lib/engine/dates";
import {
  construireSeancesDuJour,
  type VueSeancesDuJour,
} from "@/lib/engine/seances-du-jour";
import { demarrerSeance } from "@/lib/store/seance-actions";

type DomaineLibelle = { id: string; nom: string };

export interface BlocAujourdHuiProps {
  sessions: readonly LearningSession[];
  initialView: VueSeancesDuJour;
  compteId: string;
  domaines: readonly DomaineLibelle[];
}

const nomsInterventions: Record<string, string> = {
  resolve: "Résoudre",
  explain: "Expliquer",
  recall: "Rappeler",
  read: "Lire",
  synthesize: "Synthétiser",
  produce: "Produire",
  diagnose: "Diagnostiquer",
  "ask-for-help": "Demander de l’aide",
};

function descriptionDomaine(
  domaines: readonly string[],
  noms: ReadonlyMap<string, string>,
): string {
  if (domaines.length === 0) return "Domaine à préciser";
  return domaines.map((domaine) => noms.get(domaine) ?? domaine).join(" · ");
}

function LigneAujourdHui({
  row,
  session,
  compteId,
  nomsDomaines,
}: {
  row: VueSeancesDuJour["enCours"][number];
  session: LearningSession | undefined;
  compteId: string;
  nomsDomaines: ReadonlyMap<string, string>;
}) {
  const active = row.statut === "en-cours";
  const intervention = row.intervention
    ? nomsInterventions[row.intervention] ?? row.intervention
    : "Intervention à préciser";

  return (
    <li
      className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
      data-testid={`seance-du-jour-${row.sessionId}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-attenue">
          <Etiquette ton={active ? "primaire" : "info"}>{row.statutLabel}</Etiquette>
          <span>{row.heure ?? "Heure à préciser"}</span>
          {row.dureeMinutes !== undefined && (
            <>
              <span aria-hidden>·</span>
              <span>{formatDuree(row.dureeMinutes)}</span>
            </>
          )}
        </div>
        <h3 className="mt-1 font-serif text-base font-medium leading-snug tracking-tight text-texte">
          {row.libelleIntervention}
        </h3>
        <p className="mt-0.5 text-xs text-texte-attenue">
          {intervention} · {descriptionDomaine(row.domaines, nomsDomaines)}
        </p>
        {row.reservations.length > 0 && (
          <p className="mt-1 text-xs text-texte-discret">À préciser : {row.reservations[0]}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {active ? (
          <Link href={row.href} className={`${classesLienBouton("principal")} min-h-11`}>
            Continuer
            <IconeFleche className="size-3.5" />
          </Link>
        ) : session && attendPreparationSeance(session) ? (
          <ActionPreparerSeance
            seanceId={session.id}
            compteId={compteId}
            libelle="Commencer"
            taille="petite"
            instantanee={preparationInstantaneeSeance(session)}
            className="min-h-11"
          />
        ) : session ? (
          <ActionSeance
            action={demarrerSeance}
            seanceId={session.id}
            libelle="Commencer"
            taille="petite"
            className="min-h-11"
          />
        ) : null}
        <Link
          href={row.href}
          className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-texte-discret transition-colors hover:text-texte"
        >
          Détails
          <IconeChevronDroit className="size-3.5" />
        </Link>
      </div>
    </li>
  );
}

/** Bloc compact des séances effectivement acceptées pour le jour local. */
export function BlocAujourdHui({
  sessions,
  initialView,
  compteId,
  domaines,
}: BlocAujourdHuiProps) {
  const [vue, setVue] = useState(initialView);
  const sessionsParId = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );
  const nomsDomaines = useMemo(
    () => new Map(domaines.map((domaine) => [domaine.id, domaine.nom])),
    [domaines],
  );

  /* Le jour civil local reprend la main après hydratation, comme le Cahier. */
  useEffect(() => {
    const jourLocal = cleJour(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec l'horloge du navigateur après hydratation
    setVue(construireSeancesDuJour(sessions, jourLocal));
    // Le même recalcul suit les actualisations du tableau de bord : une séance
    // planifiée depuis la recommandation doit rejoindre la liste sans
    // navigation supplémentaire.
  }, [sessions]);

  const lignes = [...vue.enCours, ...vue.planifiees];

  return (
    <section aria-labelledby="titre-aujourd-hui" data-testid="bloc-aujourd-hui">
      <Carte>
        <EnTeteCarte
          id="titre-aujourd-hui"
          titre="Aujourd’hui"
        />
        {lignes.length === 0 ? (
          <p className="px-5 py-4 text-sm text-texte-attenue">
            Aucune séance planifiée aujourd’hui
          </p>
        ) : (
          <ol className="divide-y divide-bordure/60" aria-label="Séances du jour">
            {lignes.map((row) => (
              <LigneAujourdHui
                key={row.sessionId}
                row={row}
                session={sessionsParId.get(row.sessionId)}
                compteId={compteId}
                nomsDomaines={nomsDomaines}
              />
            ))}
          </ol>
        )}
      </Carte>
    </section>
  );
}
