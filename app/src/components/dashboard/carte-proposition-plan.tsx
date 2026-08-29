"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChoixPlan } from "@/lib/domain/acceptation-plan";
import {
  libelleEffetIntervention,
  renduPourIntervention,
} from "@/lib/domain/intervention-rendus";
import { formatDateHeure, formatDuree } from "@/lib/engine/dates";
import type { PlanPropose } from "@/lib/engine/planification-temporelle";
import { accepterPlan, refuserPropositionPlan } from "@/lib/store/plan-actions";
import { BandeauInfo, Bouton, Carte, Etiquette, cx } from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";

export interface PropositionPlanDashboard {
  plan: PlanPropose;
  /** Référence éphémère conservée uniquement comme provenance si accepté. */
  propositionRef: string;
}

function debutMajuscule(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1);
}

function contrainteLisible(contrainteBrute: string): string {
  const contrainte = contrainteBrute.trim();
  if (!contrainte) return "";
  if (/candidate diagnose|diagnostic requis/i.test(contrainte)) {
    return "Aucune activité de vérification recevable n'est disponible pour le moment.";
  }
  if (/aucune disponibilité déclarée exploitable/i.test(contrainte)) {
    return "Aucun créneau déclaré n'est disponible pour placer une séance.";
  }
  if (/non planifiée.*aucun créneau compatible/i.test(contrainte)) {
    return "Certaines séances ne peuvent pas tenir dans les créneaux déclarés.";
  }
  if (/non planifiée.*instant invalide|instant de référence invalide/i.test(contrainte)) {
    return "Le moment prévu n'est pas disponible pour cette proposition.";
  }
  if (/refusée selon/i.test(contrainte)) {
    return "Cette proposition a été ignorée et ne sera pas reproposée tant que vos données de travail ne changent pas.";
  }
  if (/besoin continu non placé/i.test(contrainte)) {
    return "Le temps déclaré est déjà utilisé par des séances plus prioritaires.";
  }
  if (/candidate dupliquée|candidate.*exclue|candidateId|sourceRef|requestId|rpc|supabase/i.test(contrainte)) {
    return "Une partie de la proposition n'est pas exploitable pour le moment.";
  }
  if (/^disponibilité déclarée\s*:/i.test(contrainte)) {
    return "Les créneaux respectent les disponibilités déclarées.";
  }
  if (/document source archivé|PDF source absent|fiche de cours source absente/i.test(contrainte)) {
    return "Une ressource nécessaire n'est plus disponible.";
  }
  if (/absence de preuve/i.test(contrainte)) {
    return "Un diagnostic peut être utile, mais aucune mesure n'est fabriquée.";
  }
  if (/préparation non estimable/i.test(contrainte)) {
    return "La préparation ne peut pas être estimée avec les informations disponibles.";
  }
  return contrainte.includes(":")
    ? "Une réserve empêche de proposer cette séance pour le moment."
    : contrainte;
}

function contraintesLisibles(contraintes: readonly string[]): string[] {
  return [...new Set(contraintes.map(contrainteLisible).filter((contrainte) => contrainte.length > 0))];
}

export function traduireErreurProposition(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/network|fetch|timeout|timed out|connexion|offline/i.test(message)) {
    return "La connexion a été interrompue. Votre sélection est conservée ; réessayez.";
  }
  if (/40001|conflit|plus planifiée|a changé/i.test(message)) {
    return "La proposition a changé depuis son affichage. Actualisez la page puis réessayez.";
  }
  if (/42501|permission|introuvable|not found/i.test(message)) {
    return "Cette proposition n'est plus disponible. Actualisez la page puis réessayez.";
  }
  if (/42703|proposition_ref|column/i.test(message)) {
    return "Cette action sera disponible après la mise à jour du service. Réessayez plus tard.";
  }
  return "La proposition n'a pas pu être enregistrée. Votre sélection est conservée ; réessayez.";
}

function raisonLisible(raison: string | undefined): string | null {
  if (!raison) return null;
  const texte = contrainteLisible(raison);
  return texte === "Une réserve empêche de proposer cette séance pour le moment."
    && raison.includes(":")
    ? texte
    : texte;
}

function messageEtatVide(plan: PlanPropose, contraintes: readonly string[]): string {
  if (plan.reservations.some((item) => /refusée selon/i.test(item))) {
    return "Cette proposition a été ignorée. Elle ne reviendra pas tant que vos échéances, créneaux ou travaux disponibles ne changent pas.";
  }
  if (plan.constraints.some((item) => /aucune disponibilité déclarée exploitable/i.test(item))) {
    return "Aucun créneau déclaré n'est disponible pour placer une séance.";
  }
  if (contraintes.some((item) => /vérification recevable/i.test(item))) {
    return "Aucune séance de vérification ne peut être proposée avec les éléments disponibles pour le moment.";
  }
  return "Aucune séance n'est proposée pour le moment à partir de vos échéances, créneaux et travaux disponibles.";
}

export function CartePropositionPlan({
  proposition,
}: {
  proposition: PropositionPlanDashboard;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [propositionAcceptee, setPropositionAcceptee] = useState(false);
  const [propositionIgnoree, setPropositionIgnoree] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(proposition.plan.slots.map((slot) => slot.candidate.candidateId)),
  );
  const requestId = useRef<string | null>(null);
  const commandeLancee = useRef(false);
  const slots = proposition.plan.slots;
  const nombreSelectionne = slots.filter((slot) => selection.has(slot.candidate.candidateId)).length;

  function basculer(candidateId: string) {
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(candidateId)) suivante.delete(candidateId);
      else suivante.add(candidateId);
      return suivante;
    });
  }

  function toutSelectionner() {
    setSelection(new Set(slots.map((slot) => slot.candidate.candidateId)));
  }

  function toutDeselectionner() {
    setSelection(new Set());
  }

  function accepter() {
    if (commandeLancee.current) return;
    setErreur(null);
    const acceptedCandidateIds = slots
      .filter((slot) => selection.has(slot.candidate.candidateId))
      .map((slot) => slot.candidate.candidateId);
    const ignoredCandidateIds = slots
      .filter((slot) => !selection.has(slot.candidate.candidateId))
      .map((slot) => slot.candidate.candidateId);
    requestId.current ??= crypto.randomUUID();

    const choix: ChoixPlan = {
      requestId: requestId.current,
      propositionRef: proposition.propositionRef,
      acceptedCandidateIds,
      ignoredCandidateIds,
    };

    commandeLancee.current = true;
    demarrer(async () => {
      try {
        await accepterPlan(proposition.plan, choix);
        requestId.current = null;
        setPropositionAcceptee(true);
        router.refresh();
      } catch (cause) {
        setErreur(traduireErreurProposition(cause));
      } finally {
        commandeLancee.current = false;
      }
    });
  }

  function ignorer() {
    if (commandeLancee.current) return;
    setErreur(null);
    commandeLancee.current = true;
    demarrer(async () => {
      try {
        await refuserPropositionPlan(proposition.propositionRef);
        setPropositionIgnoree(true);
        router.refresh();
      } catch (cause) {
        setErreur(traduireErreurProposition(cause));
      } finally {
        commandeLancee.current = false;
      }
    });
  }

  const contraintes = contraintesLisibles([
    ...proposition.plan.constraints,
    ...proposition.plan.reservations,
    ...proposition.plan.readiness.flatMap((echeance) => [
      ...echeance.reasons,
      ...echeance.reservations,
    ]),
    ...slots.flatMap((slot) => [
      ...slot.constraints,
      ...slot.reservations,
    ]),
  ]);

  if (propositionAcceptee) return null;

  if (propositionIgnoree) return null;

  if (slots.length === 0) {
    return (
      <Carte accent data-testid="proposition-plan">
        <div className="border-b border-bordure/60 px-5 py-5 sm:px-7 sm:py-6">
          <h2 className="font-serif text-[1.7rem] font-medium tracking-tight text-texte">
            Aucune séance à confirmer pour le moment
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texte-attenue">
            {messageEtatVide(proposition.plan, contraintes)}
          </p>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
          {contraintes.length > 0 && (
            <Depliant resume="Pourquoi aucune séance n'est proposée ?" ouvertParDefaut>
              <ul className="space-y-1 text-xs leading-relaxed text-texte-attenue">
                {contraintes.map((contrainte, index) => <li key={`${contrainte}-${index}`}>{contrainte}</li>)}
              </ul>
            </Depliant>
          )}
          {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}
        </div>
      </Carte>
    );
  }

  return (
    <Carte accent data-testid="proposition-plan">
      <div className="border-b border-bordure/60 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-[1.7rem] font-medium tracking-tight text-texte">
                Proposition pour votre semaine
              </h2>
              <Etiquette ton="primaire">À confirmer</Etiquette>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texte-attenue">
              Ces séances tiennent compte de vos recommandations, échéances et disponibilités déclarées.
              Rien ne sera ajouté à vos séances avant votre accord.
            </p>
          </div>
          <span className="text-xs text-texte-discret">
            {slots.length} séance{slots.length > 1 ? "s" : ""} proposée{slots.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
        <fieldset className="space-y-2">
          <legend className="sr-only">Séances proposées</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-texte" aria-hidden="true">Séances proposées</span>
            {slots.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <Bouton taille="petite" variante="discret" onClick={toutSelectionner} disabled={enCours}>
                  Tout sélectionner
                </Bouton>
                <Bouton taille="petite" variante="discret" onClick={toutDeselectionner} disabled={enCours}>
                  Tout désélectionner
                </Bouton>
              </div>
            )}
          </div>
          {slots.map((slot) => {
            const candidateId = slot.candidate.candidateId;
            const type = renduPourIntervention({ type: slot.intervention });
            const estSelectionne = selection.has(candidateId);
            return (
              <label
                key={candidateId}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors sm:px-4",
                  estSelectionne
                    ? "border-primaire/40 bg-primaire-faible"
                    : "border-bordure bg-surface-2/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={estSelectionne}
                  onChange={() => basculer(candidateId)}
                  disabled={enCours}
                  className="mt-1 size-4 shrink-0 accent-primaire"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-attenue">
                    <span className="font-medium text-texte">{debutMajuscule(formatDateHeure(slot.plannedFor))}</span>
                    <span aria-hidden>·</span>
                    <Etiquette ton="neutre">{type.label}</Etiquette>
                    <span>{formatDuree(slot.durationMinutes)}</span>
                    <span aria-hidden>·</span>
                    <span>{libelleEffetIntervention(slot.expectedEffect)}</span>
                  </span>
                  <span className="mt-1 block font-serif text-lg font-medium leading-snug text-texte">
                    {slot.candidate.title}
                  </span>
                  {raisonLisible(slot.reasons[0]) && <span className="mt-1 block text-sm leading-relaxed text-texte-attenue">{raisonLisible(slot.reasons[0])}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>

        {contraintes.length > 0 && (
          <Depliant resume="Voir les contraintes et réserves prises en compte">
            <ul className="space-y-1 text-xs leading-relaxed text-texte-attenue">
              {contraintes.map((contrainte, index) => <li key={`${contrainte}-${index}`}>{contrainte}</li>)}
            </ul>
          </Depliant>
        )}

        {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}

        <div className="flex flex-wrap items-center gap-2 border-t border-bordure/60 pt-4">
          <Bouton
            variante="principal"
            onClick={accepter}
            disabled={nombreSelectionne === 0 || enCours}
            enChargement={enCours}
          >
            Accepter les séances sélectionnées
          </Bouton>
          <span className="text-xs text-texte-discret">
            {nombreSelectionne} sélectionnée{nombreSelectionne > 1 ? "s" : ""}
          </span>
          <Bouton
            variante="discret"
            onClick={ignorer}
            disabled={enCours}
            enChargement={enCours}
          >
            Ignorer cette proposition
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
