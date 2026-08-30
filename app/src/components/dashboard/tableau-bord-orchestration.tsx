"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Carte,
  Bouton,
  Etiquette,
  classesLienBouton,
  cx,
} from "@/components/ui/primitives";
import {
  IconeCalendrier,
  IconeChevronDroit,
  IconeChevronGauche,
  IconeCours,
  IconeFleche,
  IconeValide,
} from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";
import {
  CartePropositionPlan,
  type PropositionPlanDashboard,
} from "@/components/dashboard/carte-proposition-plan";
import { ModaleRevuePlan } from "@/components/dashboard/modale-revue-plan";
import { appliquerDiffPlan } from "@/lib/store/plan-actions";
import type { PlanDiff } from "@/lib/engine/revision-plan";
import type {
  DashboardDayEntry,
  DashboardDeadline,
  DashboardOrchestrationView,
} from "@/lib/engine/dashboard-orchestration";
import type { Recommandation } from "@/lib/engine/recommend";

const TYPE_LABELS: Record<DashboardDayEntry["type"], string> = {
  resolve: "Résoudre",
  explain: "Expliquer",
  recall: "Rappeler",
  read: "Lire",
  synthesize: "Synthétiser",
  produce: "Produire",
  diagnose: "Diagnostiquer",
  "ask-for-help": "Demander de l'aide",
};

const EFFECT_LABELS: Record<DashboardDayEntry["effect"], string> = {
  measurement: "Mesure",
  preparation: "Préparation",
  support: "Soutien",
};

const PREPARATION_LABELS: Record<DashboardDeadline["state"], string> = {
  "non-estimable": "Non estimable",
  "a-eclaircir": "À éclaircir",
  "a-renforcer": "À renforcer",
  "en-bonne-voie": "En bonne voie",
  "pret-d-apres-les-preuves-disponibles": "Prêt d'après les preuves disponibles",
};

function monter<T>(items: readonly T[], index: number): T[] {
  if (index <= 0) return [...items];
  const result = [...items];
  [result[index - 1], result[index]] = [result[index], result[index - 1]];
  return result;
}

function descendre<T>(items: readonly T[], index: number): T[] {
  if (index >= items.length - 1) return [...items];
  const result = [...items];
  [result[index], result[index + 1]] = [result[index + 1], result[index]];
  return result;
}

/** Réordonnancement explicite, clavier et bouton uniquement — aucun glisser-déposer. */
export function reordonnerEntrees(
  entries: readonly DashboardDayEntry[],
  id: string,
  direction: "up" | "down",
): DashboardDayEntry[] {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return [...entries];
  return direction === "up" ? monter(entries, index) : descendre(entries, index);
}

function texteDate(jour: string): string {
  return jour.charAt(0).toUpperCase() + jour.slice(1);
}

function hrefComposition(recommendation?: Recommandation): string {
  const code = recommendation?.etat.skill.code;
  const duree = recommendation?.dureeEstimeeMin ?? 25;
  return code
    ? `/seances?composer=1&code=${encodeURIComponent(code)}&temps=${encodeURIComponent(String(duree))}`
    : "/seances?composer=1&sans-theme=1";
}

function FocusDuJour({
  recommendation,
  proposition,
}: {
  recommendation?: Recommandation;
  proposition?: PropositionPlanDashboard;
}) {
  const competence = recommendation?.etat.skill.intitule;
  const exercice = recommendation?.exercice;
  const sansExercice = Boolean(recommendation && !exercice);
  const manqueDisponibilite = Boolean(
    proposition
    && proposition.plan.slots.length === 0
    && proposition.plan.availability?.length === 0,
  );

  return (
    <Carte accent data-testid="focus-creation-seance">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <Etiquette ton="primaire">Prochaine action</Etiquette>
          <h2 className="mt-3 font-serif text-[1.55rem] font-medium leading-tight tracking-tight text-texte">
            {exercice?.titre ?? (competence ? `Créer un exercice sur ${competence}` : "Préparer une séance")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texte-attenue">
            {sansExercice
              ? "Aucun exercice n'est encore disponible sur cette compétence. Vous le générerez et le relirez avant de démarrer."
              : recommendation
                ? recommendation.raison
                : "Choisissez un sujet et un temps ; la séance sera composée avant son enregistrement."}
          </p>
          {manqueDisponibilite && (
            <p className="mt-2 text-xs text-texte-discret">
              Aucun créneau déclaré : vous pouvez commencer maintenant ou en ajouter un dans « Organiser ma semaine ».
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <Link href={hrefComposition(recommendation)} className={classesLienBouton("principal")}>
            {sansExercice ? "Générer puis commencer" : "Préparer une séance"}
            <IconeFleche className="size-4" />
          </Link>
          <Link href="/seances?composer=1&sans-theme=1" className={classesLienBouton("secondaire", "petite")}>
            Préparer autre chose
          </Link>
        </div>
      </div>
    </Carte>
  );
}

function Journee({ view }: { view: DashboardOrchestrationView }) {
  const [ordre, setOrdre] = useState(view.entries);
  const [modeOrdre, setModeOrdre] = useState(false);
  const entries = useMemo(() => ordre, [ordre]);
  const peutReordonner = entries.filter((entry) => entry.sessionId).length > 1;

  return (
    <Carte className="overflow-hidden" id="journee">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-5 sm:flex-nowrap sm:gap-4 sm:px-7 sm:pt-6">
        <h2 className="font-serif text-[1.7rem] font-medium tracking-tight text-texte">Votre journée</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/seances" className={classesLienBouton("secondaire", "petite")}>Voir les séances</Link>
          {peutReordonner && (
            <Bouton
              variante="discret"
              taille="normale"
              type="button"
              aria-pressed={modeOrdre}
              aria-label={modeOrdre ? "Terminer le changement d'ordre" : "Changer l'ordre des interventions"}
              onClick={() => setModeOrdre((ouvert) => !ouvert)}
              className="min-h-11 shrink-0 gap-2 text-xs sm:text-sm"
            >
              <span aria-hidden className="flex items-center gap-px">
                <IconeChevronGauche className="size-3.5 -rotate-90" />
                <IconeChevronDroit className="size-3.5 rotate-90" />
              </span>
              {modeOrdre ? "Terminer" : "Changer l'ordre"}
            </Bouton>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 sm:px-7 sm:pb-6" data-testid="chronologie-journee">
        {modeOrdre && (
          <p className="mb-3 rounded-md bg-primaire-faible px-3 py-2 text-xs text-texte-attenue" role="status">
            Utilisez les boutons Monter et Descendre pour réordonner les interventions.
          </p>
        )}

        <div className="relative pt-3 sm:pt-6">
          <div className="absolute bottom-7 left-[0.66rem] top-3 border-l border-primaire/70" aria-hidden />
          <ol className="relative">
            {entries.map((entry, index) => {
              const rendu = {
                ...entry,
                state: entry.sessionId
                  ? index === 0 ? ("current" as const) : ("next" as const)
                  : entry.state,
              };

              return (
              <li key={rendu.id} className={cx("relative grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4 sm:py-6", index > 0 && "border-t border-bordure/60")}>
                <div className="relative pl-5 pt-0.5 text-sm font-medium text-texte-attenue sm:pl-6">
                  <span className={cx("absolute left-[0.36rem] top-1.5 z-10 size-[0.65rem] rounded-full border-2 border-surface", rendu.state === "current" ? "bg-primaire" : "bg-surface") } aria-hidden />
                  <span className={rendu.state === "current" ? "text-primaire" : undefined}>{rendu.timeLabel ?? (rendu.state === "available" ? "Aujourd'hui" : "À venir")}</span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Etiquette ton={rendu.state === "current" ? "primaire" : rendu.state === "available" ? "info" : "neutre"}>
                      {rendu.state === "available" ? "À préparer" : TYPE_LABELS[rendu.type]}
                    </Etiquette>
                    {rendu.state !== "available" && <span className="text-xs text-texte-attenue">{EFFECT_LABELS[rendu.effect]}</span>}
                  </div>
                  <h3 className="mt-2 font-serif text-[1.3rem] font-medium leading-snug tracking-tight text-texte sm:text-[1.4rem]">
                    {rendu.label}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texte-attenue">
                    {rendu.durationMinutes !== undefined && <span>{formatDuree(rendu.durationMinutes)}</span>}
                    {rendu.durationMinutes !== undefined && <span aria-hidden>·</span>}
                    <span>{rendu.state === "available" ? "Session à préparer" : rendu.effect === "measurement" ? "Mesure" : EFFECT_LABELS[rendu.effect]}</span>
                  </div>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-texte-attenue">{rendu.reason}</p>
                  {rendu.reservation && <p className="mt-1 text-xs text-texte-discret">Réserve : {rendu.reservation}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {rendu.state === "current" && rendu.sessionId && (
                      <Link href={rendu.href} className={classesLienBouton("principal")}>
                        Commencer
                        <IconeFleche className="size-4" />
                      </Link>
                    )}
                    {rendu.state === "available" && (
                      <Link href={rendu.href} className={classesLienBouton("principal")}>
                        Préparer une séance
                        <IconeFleche className="size-4" />
                      </Link>
                    )}
                    {modeOrdre && (
                      <div className="flex items-center gap-1" aria-label={`Ordre de ${rendu.label}`}>
                        <Bouton
                          variante="discret"
                          taille="petite"
                          aria-label={`Monter ${rendu.label}`}
                          disabled={index === 0}
                          onClick={() => setOrdre((actuel) => reordonnerEntrees(actuel, rendu.id, "up"))}
                          className="min-h-11 min-w-11 px-0"
                        >
                          <IconeChevronGauche className="size-4 rotate-90" />
                        </Bouton>
                        <Bouton
                          variante="discret"
                          taille="petite"
                          aria-label={`Descendre ${rendu.label}`}
                          disabled={index === entries.length - 1}
                          onClick={() => setOrdre((actuel) => reordonnerEntrees(actuel, rendu.id, "down"))}
                          className="min-h-11 min-w-11 px-0"
                        >
                          <IconeChevronDroit className="size-4 rotate-90" />
                        </Bouton>
                      </div>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 border-t border-dashed border-bordure-forte py-4 text-sm sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4 sm:py-6">
            <span className="text-texte-attenue">Après</span>
            <span className="text-texte-attenue">{entries.some((entry) => entry.sessionId) ? "Temps libre pour un ajustement" : "Une séance acceptée apparaîtra ici."}</span>
          </div>
        </div>
      </div>
    </Carte>
  );
}

function SuiteSemaine({ view }: { view: DashboardOrchestrationView }) {
  return (
    <details className="group rounded-carte border border-bordure bg-surface">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm text-texte marker:content-[''] focus-visible:outline-none sm:px-7">
        <span className="flex min-w-0 items-center gap-3">
          <IconeCalendrier className="size-5 shrink-0 text-primaire" aria-hidden />
          <span className="truncate font-medium">Voir la suite de la semaine</span>
          <span className="hidden text-texte-discret sm:inline" aria-hidden>·</span>
          <span className="hidden text-texte-attenue sm:inline">{view.acceptedWeekCount} séance{view.acceptedWeekCount > 1 ? "s" : ""} acceptée{view.acceptedWeekCount > 1 ? "s" : ""}</span>
        </span>
        <IconeChevronDroit className="size-4 shrink-0 text-primaire transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="border-t border-bordure/60 px-5 py-4 sm:px-7">
        {view.weekEntries.length > 0 ? (
          <ul className="divide-y divide-bordure/60">
            {view.weekEntries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-texte">{entry.label}</span>
                <span className="text-xs text-texte-attenue">{entry.timeLabel ?? "Date à préciser"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-texte-attenue">Aucune autre séance acceptée cette semaine.</p>
        )}
      </div>
    </details>
  );
}

function PreuveRecente({ proof }: { proof: DashboardDeadline["proofs"][number] }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primaire text-primaire" aria-hidden>
        <IconeValide className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-texte">{proof.label}</span>
      <span className="shrink-0 text-xs text-texte-discret">{proof.relativeDate}</span>
    </li>
  );
}

function EcheanceDetaillee({ deadline }: { deadline: DashboardDeadline }) {
  const aDesPreuves = deadline.proofs.length > 0;
  const aDesNotionsAEclaircir = deadline.unknowns.length > 0;
  return (
    <Carte data-testid="echeance-detaillee">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden>
            <IconeCours className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-[1.45rem] font-medium leading-tight tracking-tight text-texte">{deadline.label}</h2>
            <p className="mt-1.5 text-sm font-medium text-accent">{texteDate(deadline.dueLabel)}</p>
          </div>
        </div>

        <div className="mt-6">
          <Etiquette
            ton={deadline.state === "a-eclaircir" || deadline.state === "non-estimable" ? "alerte" : "info"}
            className={deadline.state === "a-renforcer" ? "border-accent/25 bg-accent/10 text-accent" : undefined}
          >
            {PREPARATION_LABELS[deadline.state]}
          </Etiquette>
          <p className="mt-3 text-sm text-texte-attenue">
            {deadline.evidenceCount} preuve{deadline.evidenceCount > 1 ? "s" : ""} récente{deadline.evidenceCount > 1 ? "s" : ""}
            {deadline.unknowns.length > 0 && <> <span aria-hidden>·</span> {deadline.unknowns.length} notion{deadline.unknowns.length > 1 ? "s" : ""} à éclaircir</>}
          </p>
        </div>

        {aDesPreuves && (
          <div className="mt-7 border-t border-bordure/60 pt-5">
            <h3 className="font-serif text-base font-medium text-texte">Vos preuves récentes</h3>
            <ul className="mt-2 divide-y divide-bordure/60">
              {deadline.proofs.map((proof) => <PreuveRecente key={proof.id} proof={proof} />)}
            </ul>
          </div>
        )}

        {aDesNotionsAEclaircir && (
          <div className="mt-5 border-t border-bordure/60 pt-5">
            <h3 className="font-serif text-base font-medium text-texte">À éclaircir</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-texte marker:text-accent">
              {deadline.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}
            </ul>
          </div>
        )}

        {!aDesPreuves && !aDesNotionsAEclaircir && (
          <p className="mt-6 border-t border-bordure/60 pt-5 text-sm text-texte-attenue">
            Les preuves disponibles ne permettent pas encore d&apos;affiner cette échéance.
          </p>
        )}
      </div>
    </Carte>
  );
}

function BandeauJours({ view }: { view: DashboardOrchestrationView }) {
  return (
    <nav aria-label="Jours de la semaine" className="overflow-hidden rounded-carte border border-bordure bg-surface">
      <div className="flex min-h-[5.5rem] items-stretch">
        <Link href={view.previousWeekHref} aria-label="Semaine précédente" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-primaire hover:bg-surface-2">
          <IconeChevronGauche className="size-5" />
        </Link>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid min-w-[42rem] grid-cols-7">
            {view.days.map((day) => (
              <Link key={day.key} href={day.href} className={cx("flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 border-l border-bordure/60 px-1 text-center text-xs", day.isToday ? "bg-primaire-faible text-primaire" : "text-texte hover:bg-surface-2")} aria-current={day.isToday ? "date" : undefined}>
                <span className="truncate font-serif text-sm font-medium capitalize">{day.weekday}</span>
                <span className="truncate text-texte-discret">{day.dateLabel}</span>
              </Link>
            ))}
          </div>
        </div>
        <Link href={view.nextWeekHref} aria-label="Semaine suivante" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center border-l border-bordure/60 text-primaire hover:bg-surface-2">
          <IconeChevronDroit className="size-5" />
        </Link>
      </div>
    </nav>
  );
}

export function TableauBordOrchestration({
  view,
  competences = [],
  modules = [],
  proposition,
  recommendation,
  revision,
}: {
  view: DashboardOrchestrationView;
  competences?: { code: string; intitule: string }[];
  modules?: { id: string; nom: string }[];
  /** Proposition éphémère ; seules les séances choisies franchissent la frontière d'écriture. */
  proposition?: PropositionPlanDashboard;
  /** Priorité dérivée utilisée pour guider la création ; elle ne devient pas une séance. */
  recommendation?: Recommandation;
  /** Optionnel : le parent applicatif fournit le diff et la frontière d'écriture. */
  revision?: {
    diff: PlanDiff;
    /** Compatibilité de rendu pour les appelants historiques ; l'action réelle est locale au composant. */
    onAppliquer?: () => void | Promise<void>;
    onModifier?: () => void;
    onGarder?: () => void;
  };
}) {
  const [revisionOuverte, setRevisionOuverte] = useState(false);
  const requestId = useRef<string | null>(null);

  const fermerRevision = () => setRevisionOuverte(false);
  const garderRevision = () => {
    fermerRevision();
  };
  const modifierRevision = () => {
    fermerRevision();
  };
  const appliquerRevision = async () => {
    if (!revision) return;
    if (revision.onAppliquer) {
      await revision.onAppliquer();
      fermerRevision();
      return;
    }
    requestId.current ??= crypto.randomUUID();
    await appliquerDiffPlan(revision.diff, requestId.current);
    requestId.current = null;
    fermerRevision();
  };

  return (
    <div className="space-y-5 sm:space-y-6" data-testid="tableau-bord-orchestration">
      {!view.entries.some((entry) => entry.sessionId) && (!proposition || proposition.plan.slots.length === 0) && (
        <FocusDuJour recommendation={recommendation} proposition={proposition} />
      )}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-7 xl:grid-cols-12 xl:gap-6">
        <div className="space-y-5 xl:col-span-7">
          <Journee view={view} />
          {view.weekEntries.length > 0 && <SuiteSemaine view={view} />}
        </div>
        <div className="xl:col-span-5">
          {view.deadline ? <EcheanceDetaillee deadline={view.deadline} /> : (
            <Carte data-testid="echeance-absente">
              <div className="p-5 sm:p-6">
                <h2 className="font-serif text-xl font-medium text-texte">Aucune échéance déclarée</h2>
                <p className="mt-2 text-sm leading-relaxed text-texte-attenue">Déclarez une échéance pour voir ici les preuves récentes et les notions à éclaircir.</p>
                <div className="mt-5 self-start">
                  <BoutonEcheance
                    competences={competences}
                    modules={modules}
                    libelle="Déclarer une échéance"
                    mode="action"
                  />
                </div>
              </div>
            </Carte>
          )}
        </div>
      </div>
      {proposition && proposition.plan.slots.length > 0 && (
        <CartePropositionPlan key={proposition.propositionRef} proposition={proposition} />
      )}
      {revision && (
        <div className="flex justify-end">
          <Bouton
            variante="secondaire"
            taille="normale"
            onClick={() => setRevisionOuverte(true)}
            aria-haspopup="dialog"
            aria-expanded={revisionOuverte}
          >
            Revoir les changements
          </Bouton>
        </div>
      )}
      {view.acceptedWeekCount > 0 && <BandeauJours view={view} />}
      {revision && (
        <ModaleRevuePlan
          diff={revision.diff}
          ouverte={revisionOuverte}
          onFermer={fermerRevision}
          onAppliquer={appliquerRevision}
          onModifier={modifierRevision}
          onGarder={garderRevision}
        />
      )}
    </div>
  );
}
