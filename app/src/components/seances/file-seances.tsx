"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BarreProgression,
  Carte,
  classesLienBouton,
  EnTeteCarte,
  Etiquette,
} from "@/components/ui/primitives";
import { ActionSeance } from "@/components/seances/action-seance";
import { IconeValide } from "@/components/ui/icones";
import { formatDateCourte } from "@/lib/engine/dates";
import { avancementSeance, peutReprendreSeance, statutSeance } from "@/lib/domain/seance";
import {
  jourDeLaSeance,
  jourDuDocument,
  type DocumentOperationnelDate,
} from "@/lib/domain/pages-cahier";
import {
  abandonnerSeance,
  annulerSeance,
  demarrerSeance,
  renoncerSeance,
  reprendreSeance,
} from "@/lib/store/seance-actions";
import type { ExerciseAttempt, LearningSession } from "@/lib/domain/types";

/**
 * Les onglets qui dépassent du cahier (16/08/2026).
 *
 * Ils affichent sur une ligne unique horizontale et fixe les séances ouvertes
 * ou projets en cours sur d'autres dates, sans jamais passer sur plusieurs
 * lignes pour garantir une hauteur constante et zéro saut d'interface (CLS = 0).
 */
export function OngletsSeancesOuvertes({
  seances,
  tentatives,
  projets = [],
  jourAffiche,
  onNaviguer,
}: {
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  projets?: DocumentOperationnelDate[];
  jourAffiche: string;
  onNaviguer: (jour: string) => void;
}) {
  const ouvertes = seances
    .filter((s) => {
      const statut = statutSeance(s);
      if (statut === "en-cours" || statut === "planifiee") return true;
      return peutReprendreSeance(s, avancementSeance(s, tentatives));
    })
    .map((s) => ({ seance: s, jour: jourDeLaSeance(s) }))
    .filter(({ jour }) => jour !== jourAffiche)
    .sort((a, b) =>
      (b.seance.planifieePour ?? b.seance.date).localeCompare(
        a.seance.planifieePour ?? a.seance.date,
      ),
    );

  const projetsOuverts = projets
    .filter((p) => !p.fige)
    .map((p) => ({ projet: p, jour: jourDuDocument(p) }))
    .filter(({ jour }) => jour !== jourAffiche)
    .sort((a, b) =>
      (b.projet.updatedAt ?? b.projet.createdAt ?? "").localeCompare(
        a.projet.updatedAt ?? a.projet.createdAt ?? "",
      ),
    );

  if (ouvertes.length === 0 && projetsOuverts.length === 0) return null;

  return (
    <nav
      aria-label="Séances et projets ouverts"
      className="flex items-center gap-2 overflow-x-auto overscroll-contain no-scrollbar py-0.5 w-full min-w-0"
    >
      {projetsOuverts.map(({ projet: p, jour }) => {
        const dateProjet = p.updatedAt ?? p.createdAt;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onNaviguer(jour)}
            title="Voir ce projet sur sa page"
            className="flex shrink-0 items-center gap-2 rounded-full border border-bordure bg-surface px-3 py-1 text-xs shadow-[var(--ombre-posee)] hover:border-primaire/40 transition-colors text-left cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primaire" aria-hidden />
            <span className="max-w-[13rem] truncate font-medium">{p.titre}</span>
            {dateProjet && (
              <span className="text-texte-discret shrink-0">
                {formatDateCourte(dateProjet)}
              </span>
            )}
          </button>
        );
      })}
      {ouvertes.map(({ seance: s, jour }) => (
        <OngletSeance key={s.id} seance={s} jour={jour} onNaviguer={onNaviguer} />
      ))}
    </nav>
  );
}

/**
 * Un onglet de séance ouverte : cliquer y mène ; une séance « en suspens »
 * porte en outre une croix qui renonce directement — sans détour par sa page.
 * L'erreur éventuelle s'affiche sous l'onglet en absolu : la barre garde sa
 * hauteur constante (CLS = 0).
 */
function OngletSeance({
  seance: s,
  jour,
  onNaviguer,
}: {
  seance: LearningSession;
  jour: string;
  onNaviguer: (jour: string) => void;
}) {
  const statut = statutSeance(s);
  // Une séance abandonnée n'arrive ici que si elle est reprenable : le filtre
  // amont l'a déjà dit. La croix ne se pose donc que sur du vrai « en suspens ».
  const enSuspens = statut === "abandonnee";
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const libelle =
    statut === "en-cours" ? "En cours" : statut === "planifiee" ? "Planifiée" : "En suspens";
  const point = statut === "en-cours" ? "bg-primaire" : statut === "planifiee" ? "bg-info" : "bg-danger";
  const titre =
    s.besoinDeclare?.intention ||
    (s.activites.length === 1 ? s.activites[0]?.libelle : null) ||
    `${s.activites.length} exercice${s.activites.length > 1 ? "s" : ""}`;

  return (
    <div className="relative shrink-0">
      <div className="flex items-stretch overflow-hidden rounded-full border border-bordure bg-surface shadow-[var(--ombre-posee)] transition-colors hover:border-primaire/40 text-xs">
        <button
          type="button"
          onClick={() => onNaviguer(jour)}
          title="Aller à la page de cette séance"
          className="flex items-center gap-2 py-1 pl-3 pr-2 text-left cursor-pointer"
        >
          <span className={`size-1.5 rounded-full ${point}`} aria-hidden />
          <Etiquette ton={statut === "en-cours" ? "primaire" : statut === "planifiee" ? "info" : "danger"}>
            {libelle}
          </Etiquette>
          <span className="max-w-[11rem] truncate font-medium">{titre}</span>
          <span className="text-texte-discret shrink-0">
            {formatDateCourte(s.planifieePour ?? s.date)}
          </span>
        </button>
        {enSuspens && (
          <button
            type="button"
            disabled={enCours}
            onClick={(e) => {
              e.stopPropagation();
              setErreur(null);
              demarrer(async () => {
                try {
                  await renoncerSeance(s.id);
                } catch (err) {
                  setErreur(err instanceof Error ? err.message : "L'action a échoué.");
                }
              });
            }}
            aria-label={`Renoncer définitivement à « ${titre} »`}
            title="Renoncer définitivement : l'onglet disparaît et la séance rejoint le cahier refermée."
            className="border-l border-bordure/60 px-2 text-sm text-texte-discret transition-colors hover:bg-danger-faible hover:text-danger cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            ×
          </button>
        )}
      </div>
      {erreur && (
        <p
          role="alert"
          className="absolute inset-x-0 top-full z-10 mt-1 max-w-xs rounded-md bg-danger-faible px-2 py-1 text-[0.6875rem] text-danger shadow-[var(--ombre-surcouche)]"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}

/**
 * Une séance qui demande un geste, avec son avancement et ses actions.
 *
 * Une séance « en suspens » — abandonnée, mais avec des exercices jamais
 * ouverts — offre deux sorties : la reprendre, ou y renoncer définitivement
 * (`renoncerSeance`). Sans cette seconde porte, une séance qu'on ne mènera
 * jamais restait accrochée aux onglets indéfiniment : le cahier lui demandait
 * un geste qu'elle n'attendait plus.
 */
export function CarteSeance({
  seance: s,
  tentatives,
}: {
  seance: LearningSession;
  tentatives: ExerciseAttempt[];
}) {
  const statut = statutSeance(s);
  const avancement = avancementSeance(s, tentatives);
  const enCours = statut === "en-cours";
  const planifiee = statut === "planifiee";
  const reprenable = peutReprendreSeance(s, avancement);

  const titre =
    s.besoinDeclare?.intention ||
    (s.activites.length === 1 ? s.activites[0]?.libelle : null) ||
    "Séance d'exercices";

  const faits = avancement.menes.length;
  const fraction = avancement.total > 0 ? faits / avancement.total : 0;

  return (
    <Carte accent={enCours}>
      <EnTeteCarte
        titre={titre}
        legende={
          planifiee
            ? `Planifiée pour le ${formatDateCourte(s.planifieePour ?? s.date)} · ${s.activites.length} exercice${s.activites.length > 1 ? "s" : ""}`
            : `Séance du ${formatDateCourte(s.date)} · ${s.activites.length} exercice${s.activites.length > 1 ? "s" : ""}`
        }
        action={
          <div className="flex items-center gap-2">
            <Etiquette ton={enCours ? "primaire" : planifiee ? "info" : "danger"}>
              {enCours ? "En cours" : planifiee ? "Planifiée" : "En suspens"}
            </Etiquette>
            <span className="text-xs text-texte-discret">
              {faits}/{avancement.total} fait{faits > 1 ? "s" : ""}
            </span>
          </div>
        }
      />

      <div className="space-y-4 px-5 py-4">
        <BarreProgression
          fraction={fraction}
          ton={reprenable ? "neutre" : "primaire"}
          libelle={`Avancement de la séance : ${faits} exercices menés sur ${avancement.total}`}
        />

        <div className="space-y-1.5">
          {s.activites.map((act, index) => {
            const faite = avancement.menes.includes(act.ref);
            const courante = avancement.enCours.includes(act.ref);
            return (
              <div
                key={act.ref || index}
                className="flex items-center justify-between text-xs"
              >
                <span
                  className={
                    faite
                      ? "text-texte-discret line-through"
                      : courante
                        ? "font-medium text-primaire"
                        : "text-texte-attenue"
                  }
                >
                  {index + 1}. {act.libelle}
                </span>
                {faite && <IconeValide className="size-3.5 text-texte-discret" />}
                {courante && (
                  <span className="font-medium text-primaire">En cours</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure/60 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {planifiee && (
              <ActionSeance action={demarrerSeance} seanceId={s.id} libelle="Démarrer" taille="petite" />
            )}
            {enCours && (
              <Link
                href={`/seances?session=${encodeURIComponent(s.id)}`}
                className={classesLienBouton("principal", "petite")}
              >
                Continuer
              </Link>
            )}
            {reprenable && (
              <>
                <ActionSeance action={reprendreSeance} seanceId={s.id} libelle="Reprendre" taille="petite" />
                <ActionSeance
                  action={renoncerSeance}
                  seanceId={s.id}
                  libelle="Renoncer"
                  variante="secondaire"
                  taille="petite"
                  titre="Refermer définitivement : la séance reste au cahier, mais ne demandera plus rien."
                />
              </>
            )}
            {planifiee && (
              <ActionSeance action={annulerSeance} seanceId={s.id} libelle="Annuler" variante="secondaire" taille="petite" />
            )}
            {enCours && (
              <ActionSeance action={abandonnerSeance} seanceId={s.id} libelle="Abandonner" variante="secondaire" taille="petite" />
            )}
          </div>
          {!planifiee && (
            <Link
              href={`/seances?session=${encodeURIComponent(s.id)}`}
              className="text-xs text-texte-discret hover:text-texte"
            >
              Détail de la séance →
            </Link>
          )}
        </div>
      </div>
    </Carte>
  );
}
