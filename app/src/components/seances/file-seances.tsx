import Link from "next/link";
import {
  Bouton,
  Carte,
  classesLienBouton,
  CodeCompetence,
  EnTeteCarte,
  Etiquette,
} from "@/components/ui/primitives";
import { formatDateCourte } from "@/lib/engine/dates";
import { avancementSeance, peutReprendreSeance, statutSeance } from "@/lib/domain/seance";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";
import {
  abandonnerSeance,
  annulerSeance,
  demarrerSeance,
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
import type { DocumentOperationnelDate } from "@/lib/domain/pages-cahier";

export function OngletsSeancesOuvertes({
  seances,
  tentatives,
  projets = [],
  jourAffiche,
  onChangerJour,
}: {
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  projets?: DocumentOperationnelDate[];
  jourAffiche: string;
  onChangerJour?: (jour: string) => void;
}) {
  const ouvertes = seances
    .filter((s) => {
      const statut = statutSeance(s);
      if (statut === "en-cours" || statut === "planifiee") return true;
      return peutReprendreSeance(s, avancementSeance(s, tentatives));
    })
    .filter((s) => jourDeLaSeance(s) !== jourAffiche)
    .sort((a, b) => (b.planifieePour ?? b.date).localeCompare(a.planifieePour ?? a.date));

  const projetsOuverts = projets
    .filter((p) => !p.fige)
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));

  if (ouvertes.length === 0 && projetsOuverts.length === 0) return null;

  return (
    <nav
      aria-label="Séances et projets ouverts"
      className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
    >
      {projetsOuverts.map((p) => (
        <Link
          key={p.id}
          href={`/atelier?note=${encodeURIComponent(p.id)}`}
          className="flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 border-bordure bg-surface-2/40 px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors"
        >
          <Etiquette ton="primaire">Projet en cours</Etiquette>
          <span className="max-w-[13rem] truncate font-medium">{p.titre}</span>
          <span className="text-texte-discret">Ouvrir →</span>
        </Link>
      ))}
      {ouvertes.map((s) => {
        const statut = statutSeance(s);
        const libelle =
          statut === "en-cours" ? "En cours" : statut === "planifiee" ? "Planifiée" : "En suspens";
        const ton = statut === "en-cours" ? "primaire" : statut === "planifiee" ? "info" : "danger";
        const titre =
          s.besoinDeclare?.intention ||
          (s.activites.length === 1 ? s.activites[0]?.libelle : null) ||
          `${s.activites.length} activité${s.activites.length > 1 ? "s" : ""}`;
        const jourCible = jourDeLaSeance(s);

        if (onChangerJour) {
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangerJour(jourCible)}
              className="flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 border-bordure bg-surface-2/40 px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors text-left"
            >
              <Etiquette ton={ton}>{libelle}</Etiquette>
              <span className="max-w-[13rem] truncate font-medium">{titre}</span>
              <span className="text-texte-discret shrink-0">
                {formatDateCourte(s.planifieePour ?? s.date)}
              </span>
            </button>
          );
        }

        return (
          <Link
            key={s.id}
            href={`/seances?jour=${encodeURIComponent(jourCible)}`}
            className="flex shrink-0 items-center gap-2 rounded-t-md border border-b-0 border-bordure bg-surface-2/40 px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            <Etiquette ton={ton}>{libelle}</Etiquette>
            <span className="max-w-[13rem] truncate font-medium">{titre}</span>
            <span className="text-texte-discret shrink-0">
              {formatDateCourte(s.planifieePour ?? s.date)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Une séance qui demande un geste, avec son avancement et ses actions.
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
    `${s.activites.length} activité${s.activites.length > 1 ? "s" : ""}`;

  return (
    <Carte ton={enCours ? "primaire" : undefined}>
      <EnTeteCarte
        titre={titre}
        legende={
          planifiee
            ? `Planifiée pour le ${formatDateCourte(s.planifieePour ?? s.date)}`
            : `Séance du ${formatDateCourte(s.date)}`
        }
        action={
          <div className="flex items-center gap-2">
            <Etiquette ton={enCours ? "primaire" : planifiee ? "info" : "danger"}>
              {enCours ? "En cours" : planifiee ? "Planifiée" : "En suspens"}
            </Etiquette>
            <span className="text-xs text-texte-discret">
              {avancement.menes.length}/{s.activites.length} menée
              {avancement.menes.length > 1 ? "s" : ""}
            </span>
          </div>
        }
      />

      <div className="space-y-4 px-5 py-4">
        {s.besoinDeclare?.codesVises && s.besoinDeclare.codesVises.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {s.besoinDeclare.codesVises.map((code) => (
              <CodeCompetence key={code} code={code} />
            ))}
          </div>
        )}

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
                {faite && <span className="text-texte-discret">✓</span>}
                {courante && (
                  <span className="font-medium text-primaire">En cours</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure/60 pt-3">
          <div className="flex items-center gap-2">
            {planifiee && (
              <form action={demarrerSeance.bind(null, s.id)}>
                <Bouton type="submit" ton="principal" taille="petite">
                  Démarrer
                </Bouton>
              </form>
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
              <form action={reprendreSeance.bind(null, s.id)}>
                <Bouton type="submit" ton="principal" taille="petite">
                  Reprendre
                </Bouton>
              </form>
            )}
            {planifiee && (
              <form action={annulerSeance.bind(null, s.id)}>
                <Bouton type="submit" ton="secondaire" taille="petite">
                  Annuler
                </Bouton>
              </form>
            )}
            {enCours && (
              <form action={abandonnerSeance.bind(null, s.id)}>
                <Bouton type="submit" ton="secondaire" taille="petite">
                  Abandonner
                </Bouton>
              </form>
            )}
          </div>
          <Link
            href={`/seances?session=${encodeURIComponent(s.id)}`}
            className="text-xs text-texte-discret hover:text-texte"
          >
            Détail de la séance →
          </Link>
        </div>
      </div>
    </Carte>
  );
}
