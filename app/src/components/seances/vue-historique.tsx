import Link from "next/link";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide } from "@/components/ui/primitives";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { statutSeance } from "@/lib/domain/seance";
import type { LearningSession } from "@/lib/domain/types";
import {
  ConcepteurSeance,
  type DonneesSeance,
  type PresetSeance,
} from "@/components/seances/concepteur-seance";

const LIBELLES_STATUT: Record<"planifiee" | "en-cours" | "terminee", { texte: string; ton: "info" | "primaire" | "succes" }> = {
  planifiee: { texte: "Planifiée", ton: "info" },
  "en-cours": { texte: "En cours", ton: "primaire" },
  terminee: { texte: "Terminée", ton: "succes" },
};

/**
 * Vue « Historique » du pôle Séances (lot 3.2).
 *
 * Les séances, de la plus récente à la plus ancienne. Les 45 séances
 * auto-générées y figurent comme séances à une activité — c'est la même entité,
 * écrite à chaque exercice terminé (ADR-048).
 */
export function VueHistorique({
  seances,
  donnees,
}: {
  seances: LearningSession[];
  donnees: DonneesSeance;
}) {
  const triees = [...seances].sort((a, b) => b.date.localeCompare(a.date));

  if (triees.length === 0) {
    return (
      <Carte>
        <EtatVide
          titre="Aucune séance"
          message="Compose ta première séance : dis ce que tu veux travailler, le système propose une composition, et l'historique se remplit ensuite."
        />
      </Carte>
    );
  }

  return (
    <div className="space-y-4">
      {triees.map((s) => {
        const statut = statutSeance(s);
        const preset = presetDepuisSeance(s);
        return (
          <Carte key={s.id}>
            <EnTeteCarte
              titre={`Séance du ${formatDateCourte(s.date)}`}
              legende={
                s.planifieePour
                  ? `prévue le ${formatDateCourte(s.planifieePour)}`
                  : undefined
              }
              action={<Etiquette ton={LIBELLES_STATUT[statut].ton}>{LIBELLES_STATUT[statut].texte}</Etiquette>}
            />
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-attenue">
                {s.dureeMin !== undefined && (
                  <span>{formatDuree(s.dureeMin)}</span>
                )}
                {s.skillCodes.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex flex-wrap gap-1">
                      {s.skillCodes.map((c) => (
                        <CodeCompetence key={c} code={c} />
                      ))}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{s.activites.length} activité{s.activites.length > 1 ? "s" : ""}</span>
              </div>

              {s.besoinDeclare && (
                <p className="mt-2 text-xs italic text-texte-attenue">
                  « {s.besoinDeclare.intention} »
                </p>
              )}

              {s.resultat && (
                <p className="mt-1 text-xs text-texte-discret">{s.resultat}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/seances/${s.id}`}
                  className="text-xs font-medium text-primaire hover:underline"
                >
                  Voir le déroulé
                </Link>
                <ConcepteurSeance
                  {...donnees}
                  preset={preset}
                  libelle="Refaire cette séance"
                />
              </div>
            </div>
          </Carte>
        );
      })}
    </div>
  );
}

/** Reconstruction d'une demande de composition à partir du blueprint conservé. */
export function presetDepuisSeance(seance: LearningSession): PresetSeance | undefined {
  const b = seance.blueprint;
  if (!b) return undefined;
  return {
    codesVises: b.cibles.map((c) => c.code),
    nombreExercices: b.nombreExercices,
    dureeCibleMin: b.dureeCibleMin,
    domaine: b.portee.type === "mono" ? b.portee.domaine : undefined,
  };
}
