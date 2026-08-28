"use client";

import { useMemo, useState } from "react";
import { Modale } from "@/components/ui/modale";
import { Depliant } from "@/components/ui/explication";
import { Bouton, Etiquette, cx } from "@/components/ui/primitives";
import type { PlanChange, PlanChangeKind, PlanDiff } from "@/lib/engine/revision-plan";

const LABELS: Record<PlanChangeKind, string> = {
  conserver: "Conserver",
  deplacer: "Déplacer",
  raccourcir: "Raccourcir",
  annuler: "Annuler",
  ajouter: "Ajouter",
  "conflit-impossible": "À résoudre",
};

const TONS: Record<PlanChangeKind, "neutre" | "primaire" | "alerte" | "info"> = {
  conserver: "neutre",
  deplacer: "info",
  raccourcir: "info",
  annuler: "alerte",
  ajouter: "primaire",
  "conflit-impossible": "alerte",
};

function formatCreneau(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date à préciser";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resumeSnapshot(change: PlanChange): string {
  const snapshot = change.after ?? change.before;
  if (!snapshot) return "Créneau non estimable";
  return `${formatCreneau(snapshot.plannedFor)} · ${snapshot.durationMinutes} min`;
}

function groupe(changes: readonly PlanChange[]): Array<[PlanChangeKind, PlanChange[]]> {
  const ordre: PlanChangeKind[] = ["deplacer", "raccourcir", "annuler", "ajouter", "conflit-impossible", "conserver"];
  return ordre
    .map((kind) => [kind, changes.filter((change) => change.kind === kind)] as [PlanChangeKind, PlanChange[]])
    .filter(([, items]) => items.length > 0);
}

function LigneChangement({ change }: { change: PlanChange }) {
  return (
    <li className="border-t border-bordure/60 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-texte">{change.after?.label ?? change.before?.label ?? change.candidateId}</p>
          <p className="mt-1 text-xs text-texte-attenue">
            {change.before && <><span className="font-medium">Avant :</span> {resumeSnapshot({ ...change, after: undefined })}</>}
            {change.before && change.after && <span aria-hidden> · </span>}
            {change.after && <><span className="font-medium">Après :</span> {resumeSnapshot(change)}</>}
          </p>
        </div>
        <Etiquette ton={TONS[change.kind]}>{LABELS[change.kind]}</Etiquette>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-texte-attenue">{change.reason}</p>
      {change.reservations.length > 0 && (
        <Depliant resume="Réserves" className="mt-2">
          <ul className="space-y-1 text-xs text-texte-attenue">
            {change.reservations.map((reservation) => <li key={reservation}>{reservation}</li>)}
          </ul>
        </Depliant>
      )}
    </li>
  );
}

export interface RevuePlanProps {
  diff: PlanDiff;
  ouverte: boolean;
  onFermer: () => void;
  /** La frontière d'application revalide puis écrit le lot de façon atomique. */
  onAppliquer: () => void | Promise<void>;
  onModifier: () => void;
  onGarder: () => void;
}

/**
 * Revue groupée d'un recalcul. La modale ne connaît ni Supabase ni le plan
 * complet : elle ne transmet que l'action explicite au parent applicatif.
 */
export function ModaleRevuePlan({
  diff,
  ouverte,
  onFermer,
  onAppliquer,
  onModifier,
  onGarder,
}: RevuePlanProps) {
  const [envoi, setEnvoi] = useState(false);
  const groupes = useMemo(() => groupe(diff.changes), [diff.changes]);
  const totalActionnable = diff.changes.filter((change) => change.kind !== "conserver").length;
  const applicationBloquee = diff.conflicts.length > 0;
  const raisonPrincipale = diff.changes.find((change) => change.reason.trim() !== "")?.reason
    ?? "Le recalcul ne demande aucune modification de séance acceptée.";

  if (!ouverte) return null;

  async function appliquer() {
    if (applicationBloquee || envoi) return;
    setEnvoi(true);
    try {
      await onAppliquer();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modale
      titre="Revoir les changements proposés"
      sousTitre="Votre plan accepté reste inchangé tant que vous n'appliquez pas ces ajustements."
      onFermer={onFermer}
      largeur="2xl"
      pied={
        <>
          <Bouton variante="discret" onClick={onGarder} disabled={envoi} className="min-h-11">Garder mon plan</Bouton>
          <Bouton variante="secondaire" onClick={onModifier} disabled={envoi} className="min-h-11">Modifier</Bouton>
          <Bouton variante="principal" onClick={appliquer} enChargement={envoi} disabled={applicationBloquee} className="min-h-11">
            Appliquer ces ajustements
          </Bouton>
        </>
      }
    >
      <div className="space-y-5">
        <div className={cx("rounded-md border px-4 py-3", applicationBloquee ? "border-alerte/30 bg-alerte-faible" : "border-primaire/25 bg-primaire-faible")} role={applicationBloquee ? "alert" : "status"}>
          <p className="text-sm font-medium text-texte">
            {applicationBloquee
              ? "Le changement ne peut pas être appliqué tel quel."
              : totalActionnable === 0
                ? "Aucun changement à appliquer."
                : `${totalActionnable} changement${totalActionnable > 1 ? "s" : ""} proposé${totalActionnable > 1 ? "s" : ""}.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Les candidates non acceptées restent hors de cette revue.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
            <span className="font-medium text-texte">Raison principale :</span> {raisonPrincipale}
          </p>
        </div>

        {groupes.map(([kind, changes]) => (
          <section key={kind} aria-labelledby={`revue-${kind}`}>
            <h3 id={`revue-${kind}`} className="font-serif text-base font-medium text-texte">
              {LABELS[kind]} <span className="font-sans text-xs font-normal text-texte-discret">({changes.length})</span>
            </h3>
            <ul className="mt-2">{changes.map((change) => <LigneChangement key={`${change.kind}:${change.sessionId ?? change.candidateId}`} change={change} />)}</ul>
          </section>
        ))}

        {diff.reservations.length > 0 && (
          <Depliant resume="Réserves générales">
            <ul className="space-y-1 text-xs leading-relaxed text-texte-attenue">
              {diff.reservations.map((reservation) => <li key={reservation}>{reservation}</li>)}
            </ul>
          </Depliant>
        )}

        {diff.constraints.length > 0 && (
          <Depliant resume="Contraintes prises en compte">
            <ul className="space-y-1 text-xs leading-relaxed text-texte-attenue">
              {diff.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
            </ul>
          </Depliant>
        )}

        {diff.conflicts.length > 0 && (
          <Depliant resume={`Conflits à résoudre (${diff.conflicts.length})`} ouvertParDefaut>
            <ul className="space-y-2 text-xs leading-relaxed text-texte-attenue">
              {diff.conflicts.map((conflict, index) => (
                <li key={`${conflict.candidateId}:${conflict.sessionId ?? index}`}>
                  <span className="font-medium text-texte">{conflict.reason}</span>
                  {conflict.reservations.length > 0 && <span> {conflict.reservations.join(" ")}</span>}
                </li>
              ))}
            </ul>
          </Depliant>
        )}
      </div>
    </Modale>
  );
}
