"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bouton,
  Carte,
  EtatVide,
  Etiquette,
  classesLienBouton,
  cx,
} from "@/components/ui/primitives";
import {
  IconeCalendrier,
  IconeChevronDroit,
  IconeFleche,
} from "@/components/ui/icones";
import { ActionPreparerSeance } from "@/components/seances/action-preparer-seance";
import { ActionSeance } from "@/components/seances/action-seance";
import { annulerSeance, demarrerSeance } from "@/lib/store/seance-actions";
import { deplacerSeance } from "@/lib/store/plan-actions";
import { attendPreparationSeance, preparationInstantaneeSeance } from "@/lib/domain/seance";
import { formatDuree } from "@/lib/engine/dates";
import type { DisponibiliteDeclaree } from "@/lib/domain/types";
import type { EntreesCahier } from "@/components/seances/bureau";
import {
  construireVueSeancesAVenir,
  type SeanceAVenir,
} from "@/lib/engine/seances-a-venir";

const TYPE_LABELS: Record<NonNullable<SeanceAVenir["intervention"]>, string> = {
  resolve: "Résoudre",
  explain: "Expliquer",
  recall: "Rappeler",
  read: "Lire",
  synthesize: "Synthétiser",
  produce: "Produire",
  diagnose: "Diagnostiquer",
  "ask-for-help": "Demander de l’aide",
};

const EFFECT_LABELS: Record<NonNullable<SeanceAVenir["effetAttendu"]>, string> = {
  measurement: "Mesure",
  preparation: "Préparation",
  support: "Soutien",
};

function descriptionDomaine(
  domaines: string[],
  noms: ReadonlyMap<string, string>,
): string {
  if (domaines.length === 0) return "Domaine à préciser";
  return domaines.map((domaine) => noms.get(domaine) ?? domaine).join(" · ");
}

function Effet({ row }: { row: SeanceAVenir }) {
  return row.effetAttendu ? EFFECT_LABELS[row.effetAttendu] : "Effet à préciser";
}

function libelleCreneau(debut: string, fin: string): string {
  const debutDate = new Date(debut);
  const finDate = new Date(fin);
  if (!Number.isFinite(debutDate.getTime()) || !Number.isFinite(finDate.getTime())) return "Créneau à préciser";
  return `${debutDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${debutDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} à ${finDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function traduireErreurDeplacement(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/conflit|40001/i.test(message)) return "Ce créneau est déjà occupé. Choisissez-en un autre.";
  if (/disponibil|hors des|créneau/i.test(message)) return "Ce créneau ne correspond plus à vos disponibilités déclarées.";
  if (/plus planifiée|a changé|obsolète/i.test(message)) return "La séance a changé depuis son affichage. Actualisez la page puis réessayez.";
  return "Le déplacement n'a pas pu être enregistré. Votre séance n'a pas été modifiée ; réessayez.";
}

function ActionDeplacement({
  row,
  disponibilites,
}: {
  row: SeanceAVenir;
  disponibilites: readonly DisponibiliteDeclaree[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const commandeLancee = useRef(false);
  const options = useMemo(() => {
    if (row.dureeMinutes === undefined) return [];
    const duree = row.dureeMinutes * 60_000;
    return disponibilites
      .filter((creneau) => {
        const debut = Date.parse(creneau.startsAt);
        const fin = Date.parse(creneau.endsAt);
        return Number.isFinite(debut) && Number.isFinite(fin) && fin - debut >= duree;
      })
      .map((creneau) => ({
        value: new Date(creneau.startsAt).toISOString(),
        label: libelleCreneau(creneau.startsAt, creneau.endsAt),
      }));
  }, [disponibilites, row.dureeMinutes]);
  const [selection, setSelection] = useState("");

  const selectionEffective = options.some((option) => option.value === selection)
    ? selection
    : options[0]?.value ?? "";

  if (row.statut !== "planifiee") return null;

  function deplacer() {
    if (commandeLancee.current || enCours || !row.plannedFor || !selectionEffective) return;
    if (selectionEffective === row.plannedFor) {
      setErreur("Choisissez un créneau différent de celui qui est déjà prévu.");
      return;
    }
    setErreur(null);
    setConfirmation(null);
    requestId.current ??= crypto.randomUUID();
    commandeLancee.current = true;
    demarrer(async () => {
      try {
        await deplacerSeance(row.sessionId, row.plannedFor!, selectionEffective, requestId.current!);
        setConfirmation(`Séance déplacée au ${libelleCreneau(selectionEffective, new Date(Date.parse(selectionEffective) + (row.dureeMinutes ?? 0) * 60_000).toISOString())}.`);
        requestId.current = null;
        router.refresh();
      } catch (cause) {
        setErreur(traduireErreurDeplacement(cause));
      } finally {
        commandeLancee.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Bouton
        variante="discret"
        taille="petite"
        type="button"
        aria-expanded={ouvert}
        aria-controls={`deplacement-${row.sessionId}`}
        className="min-h-11"
        onClick={() => setOuvert((actuel) => !actuel)}
      >
        Déplacer
      </Bouton>
      {ouvert && (
        <div
          id={`deplacement-${row.sessionId}`}
          className="w-full max-w-sm rounded-md border border-bordure bg-surface-2/50 p-3"
        >
          <label htmlFor={`nouveau-creneau-${row.sessionId}`} className="text-xs font-medium text-texte">
            Nouveau créneau
          </label>
          {options.length > 0 ? (
            <select
              id={`nouveau-creneau-${row.sessionId}`}
              value={selectionEffective}
              onChange={(event) => setSelection(event.target.value)}
              disabled={enCours}
              className="mt-2 min-h-11 w-full rounded-md border border-bordure-forte bg-surface px-3 text-sm text-texte focus-visible:outline-none"
            >
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
              Aucun créneau déclaré ne peut contenir cette séance. Ajoutez ou modifiez une disponibilité depuis le tableau de bord.
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-texte-discret">
            La séance garde son contenu et son origine. Seule sa date est modifiée, sans observation ni pénalité.
          </p>
          <Bouton
            variante="secondaire"
            taille="petite"
            type="button"
            className="mt-2 min-h-11"
            disabled={!selectionEffective || enCours}
            enChargement={enCours}
            onClick={deplacer}
          >
            Confirmer le déplacement
          </Bouton>
          {confirmation && <p role="status" className="mt-2 text-xs text-primaire">{confirmation}</p>}
          {erreur && <p role="alert" className="mt-2 text-xs text-alerte">{erreur}</p>}
        </div>
      )}
    </div>
  );
}

function LigneSeance({ row, session, compteId, nomsDomaines, disponibilites }: {
  row: SeanceAVenir;
  session: EntreesCahier["seances"][number];
  compteId: string;
  nomsDomaines: ReadonlyMap<string, string>;
  disponibilites: readonly DisponibiliteDeclaree[];
}) {
  const duree = row.dureeMinutes === undefined ? null : formatDuree(row.dureeMinutes);
  const principale = row.intervention ? TYPE_LABELS[row.intervention] : "Intervention à préciser";
  const estActive = row.statut === "en-cours";

  return (
    <li className="relative pl-6 sm:pl-8">
      <span
        aria-hidden
        className={cx(
          "absolute left-[-0.3rem] top-5 z-10 size-2.5 rounded-full border-2 border-surface",
          estActive ? "bg-primaire" : "bg-surface-3",
        )}
      />
      <Carte accent={estActive} className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-attenue">
              <span className="font-medium text-texte">{row.heure ?? "Heure à préciser"}</span>
              {duree && <><span aria-hidden>·</span><span>{duree}</span></>}
            </div>
            <h3 className="mt-1.5 font-serif text-xl font-medium leading-snug tracking-tight text-texte">
              {row.libelleIntervention}
            </h3>
          </div>
          <Etiquette ton={estActive ? "primaire" : "info"}>{row.statutLabel}</Etiquette>
        </div>

        <dl className="grid gap-x-5 gap-y-2 px-4 pb-4 text-xs sm:grid-cols-3 sm:px-5">
          <div>
            <dt className="text-texte-discret">Intervention</dt>
            <dd className="mt-0.5 text-texte-attenue">{principale}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Domaine</dt>
            <dd className="mt-0.5 text-texte-attenue">{descriptionDomaine(row.domaines, nomsDomaines)}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Effet attendu</dt>
            <dd className="mt-0.5 text-texte-attenue"><Effet row={row} /></dd>
          </div>
        </dl>

        {row.reservations.length > 0 && (
          <p className="border-t border-bordure/60 px-4 py-2.5 text-xs leading-relaxed text-texte-discret sm:px-5">
            À préciser : {row.reservations[0]}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-bordure/60 px-4 py-3 sm:px-5">
          {row.statut === "planifiee" && (
            attendPreparationSeance(session) ? (
              <ActionPreparerSeance
                seanceId={session.id}
                compteId={compteId}
                taille="normale"
                instantanee={preparationInstantaneeSeance(session)}
                className="min-h-11"
              />
            ) : (
              <ActionSeance
                action={demarrerSeance}
                seanceId={session.id}
                libelle="Commencer"
                taille="normale"
                className="min-h-11"
              />
            )
          )}
          {row.statut === "en-cours" && (
            <Link href={row.href} className={classesLienBouton("principal") + " min-h-11"}>
              Continuer <IconeFleche className="size-4" />
            </Link>
          )}
          {row.statut === "planifiee" && (
            <ActionSeance
              action={annulerSeance}
              seanceId={session.id}
              libelle="Annuler"
              variante="secondaire"
              taille="normale"
              className="min-h-11"
            />
          )}
          <ActionDeplacement row={row} disponibilites={disponibilites} />
          <Link
            href={row.href}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-texte-discret transition-colors hover:text-texte"
          >
            Détails <IconeChevronDroit className="size-3.5" />
          </Link>
        </div>
      </Carte>
    </li>
  );
}

export function SeancesAVenir({
  entrees,
  compteId,
  onOuvrirHistorique,
}: {
  entrees: EntreesCahier;
  compteId: string;
  onOuvrirHistorique: () => void;
}) {
  const vue = useMemo(() => construireVueSeancesAVenir(entrees.seances), [entrees.seances]);
  const sessions = useMemo(
    () => new Map(entrees.seances.map((session) => [session.id, session])),
    [entrees.seances],
  );
  const nomsDomaines = useMemo(
    () => new Map(entrees.donnees.domaines.map((domaine) => [domaine.id, domaine.nom])),
    [entrees.donnees.domaines],
  );

  return (
    <div className="space-y-6" data-testid="seances-a-venir">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-texte-discret">Séances</p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-texte sm:text-4xl">À venir</h1>
          <p className="mt-1 text-sm text-texte-attenue">
            {vue.seances.length > 0
              ? `${vue.seances.length} séance${vue.seances.length > 1 ? "s" : ""} acceptée${vue.seances.length > 1 ? "s" : ""}`
              : "Les séances acceptées apparaîtront ici."}
          </p>
        </div>
        <nav aria-label="Vues des séances" className="flex flex-wrap items-center gap-2">
          <Bouton variante="principal" aria-current="page" disabled className="min-h-11">
            À venir
          </Bouton>
          <Bouton variante="secondaire" type="button" onClick={onOuvrirHistorique} className="min-h-11">
            Historique
          </Bouton>
          <Link href="/seances?composer=1" className={classesLienBouton("secondaire") + " min-h-11"}>
            Préparer autre chose
          </Link>
        </nav>
      </header>

      {vue.groupes.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<IconeCalendrier className="size-5" />}
            titre="Aucune séance acceptée à venir"
            message="Acceptez une proposition pour voir sa chronologie ici. Le Cahier conserve les séances déjà menées."
            action={<Link href="/" className={classesLienBouton("secondaire", "petite")}>Voir le tableau de bord</Link>}
          />
        </Carte>
      ) : (
        <div className="space-y-7">
          {vue.groupes.map((groupe) => (
            <section key={groupe.jour ?? "date-a-preciser"} aria-labelledby={`jour-${groupe.jour ?? "a-preciser"}`}>
              <h2 id={`jour-${groupe.jour ?? "a-preciser"}`} className="mb-3 flex items-center gap-2 font-serif text-xl font-medium capitalize tracking-tight text-texte">
                <IconeCalendrier className="size-4 text-primaire" aria-hidden />
                {groupe.libelle}
              </h2>
              <ol className="relative space-y-3 border-l border-primaire/45 pl-0">
                {groupe.seances.map((row) => {
                  const session = sessions.get(row.sessionId);
                  return session ? (
                    <LigneSeance
                      key={row.sessionId}
                      row={row}
                      session={session}
                      compteId={compteId}
                      nomsDomaines={nomsDomaines}
                      disponibilites={entrees.disponibilitesDeclarees ?? []}
                    />
                  ) : null;
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
