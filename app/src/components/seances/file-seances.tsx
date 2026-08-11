import Link from "next/link";
import { Bouton, Carte, classesLienBouton, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
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
        return (
          <Carte key={s.id}>
            <EnTeteCarte
              titre={enCours ? "Séance en cours" : `Prévue le ${formatDateCourte(s.planifieePour ?? s.date)}`}
              legende={`${s.activites.length} activité${s.activites.length > 1 ? "s" : ""} · ${s.skillCodes.length} compétence${s.skillCodes.length > 1 ? "s" : ""} visée${s.skillCodes.length > 1 ? "s" : ""}`}
              action={
                <Etiquette ton={enCours ? "primaire" : "info"}>
                  {enCours ? "En cours" : "Planifiée"}
                </Etiquette>
              }
            />
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5">
              {enCours ? (
                <Link
                  href={`/seances?session=${s.id}`}
                  className={classesLienBouton("principal")}
                >
                  Reprendre
                </Link>
              ) : (
                <>
                  <form action={demarrerSeance.bind(null, s.id)}>
                    <Bouton type="submit" variante="principal">Démarrer</Bouton>
                  </form>
                  <form action={annulerSeance.bind(null, s.id)}>
                    <Bouton type="submit" variante="danger">Annuler</Bouton>
                  </form>
                </>
              )}
            </div>
          </Carte>
        );
      })}
    </section>
  );
}