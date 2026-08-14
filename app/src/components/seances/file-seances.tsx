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
import { statutSeance } from "@/lib/domain/seance";
import { annulerSeance, demarrerSeance } from "@/lib/store/seance-actions";
import type { LearningSession } from "@/lib/domain/types";

/**
 * File épinglée des séances en cours et planifiées (ADR-061).
 *
 * Les deux états qui demandent un geste : reprendre (en cours) ou démarrer /
 * annuler (planifiée). Une séance planifiée ouverte dans le workspace affiche
 * son résumé puis « Démarrer » ; la file ne contient aucune séance terminée —
 * celles-ci vivent dans le cahier.
 */
export function FileSeances({ seances }: { seances: LearningSession[] }) {
  const actives = seances
    .filter((s) => statutSeance(s) !== "terminee")
    .sort((a, b) =>
      (b.planifieePour ?? b.date).localeCompare(a.planifieePour ?? a.date),
    );

  if (actives.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">En cours et planifiées</h2>
      {actives.map((s) => {
        const enCours = statutSeance(s) === "en-cours";
        const titreSeance =
          s.activites.length === 1 && s.activites[0]?.libelle
            ? s.activites[0].libelle
            : s.besoinDeclare?.intention ||
              (enCours
                ? `Séance en cours (${s.activites.length} activité${s.activites.length > 1 ? "s" : ""})`
                : `Séance prévue le ${formatDateCourte(s.planifieePour ?? s.date)}`);

        const duree = s.besoinDeclare?.tempsDisponibleMin
          ? `${s.besoinDeclare.tempsDisponibleMin} min estimées`
          : s.dureeMin
          ? `${s.dureeMin} min`
          : null;

        const legende = [
          duree,
          s.domaines.length > 0 ? s.domaines.join(", ") : null,
          `${s.activites.length} activité${s.activites.length > 1 ? "s" : ""}`,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <Carte key={s.id} accent={enCours}>
            <EnTeteCarte
              titre={titreSeance}
              legende={legende}
              action={
                <Etiquette ton={enCours ? "primaire" : "info"}>
                  {enCours ? "En cours" : "Planifiée"}
                </Etiquette>
              }
            />

            <div className="space-y-3 px-5 py-4 border-t border-bordure/40">
              {/* Compétences ciblées */}
              {s.skillCodes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                    Compétence{s.skillCodes.length > 1 ? "s" : ""} visée{s.skillCodes.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.skillCodes.map((code) => (
                      <CodeCompetence key={code} code={code} />
                    ))}
                  </div>
                </div>
              )}

              {/* Intention déclarée si différente du titre */}
              {s.besoinDeclare?.intention && s.besoinDeclare.intention !== titreSeance && (
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                    Intention
                  </p>
                  <p className="mt-0.5 text-xs italic text-texte-attenue">
                    « {s.besoinDeclare.intention} »
                  </p>
                </div>
              )}

              {/* Liste du programme si plus d'une activité */}
              {s.activites.length > 1 && (
                <div>
                  <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                    Programme ({s.activites.length} activités)
                  </p>
                  <ul className="space-y-1 text-xs">
                    {s.activites.map((act, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-texte-attenue">
                        <span className="font-mono text-[0.6875rem] text-texte-discret">{idx + 1}.</span>
                        <span className="font-medium text-texte">{act.libelle}</span>
                        <span className="text-[0.6875rem] text-texte-discret capitalize">({act.type})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure bg-surface-2/30 px-5 py-3">
              <span className="text-xs text-texte-discret">
                {enCours
                  ? "Séance active dans le workspace"
                  : `Planifiée pour le ${formatDateCourte(s.planifieePour ?? s.date)}`}
              </span>
              <div className="flex items-center gap-2">
                {enCours ? (
                  <>
                    <form action={annulerSeance.bind(null, s.id)}>
                      <Bouton type="submit" variante="secondaire" taille="petite">
                        Abandonner
                      </Bouton>
                    </form>
                    <Link
                      href={`/seances?session=${s.id}`}
                      className={classesLienBouton("principal")}
                    >
                      Reprendre la séance →
                    </Link>
                  </>
                ) : (
                  <>
                    <form action={annulerSeance.bind(null, s.id)}>
                      <Bouton type="submit" variante="danger" taille="petite">
                        Annuler
                      </Bouton>
                    </form>
                    <form action={demarrerSeance.bind(null, s.id)}>
                      <Bouton type="submit" variante="principal">
                        Démarrer la séance →
                      </Bouton>
                    </form>
                  </>
                )}
              </div>
            </div>
          </Carte>
        );
      })}
    </section>
  );
}