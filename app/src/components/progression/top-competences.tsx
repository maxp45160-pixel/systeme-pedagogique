import type { SkillState } from "@/lib/domain/types";
import { Carte, CorpsCarte, EnTeteCarte, JaugeNiveau, CodeCompetence } from "@/components/ui/primitives";

/**
 * Les compétences les plus travaillées — le trio de tête de la pratique.
 *
 * Le classement ne porte que sur un fait compté : le nombre d'observations
 * enregistrées. C'est l'équivalent honnête d'un « temps de jeu » : il dit où
 * l'effort est allé, pas à quel niveau ça place la personne. Trois cartes,
 * comme trois portraits côte à côte — sans portrait, il reste le code, le
 * niveau et le compte.
 */
export function TopCompetences({ etats }: { etats: SkillState[] }) {
  const travaillees = etats.filter((e) => e.observations.length > 0);
  if (travaillees.length === 0) return null;

  const top = [...travaillees].sort((a, b) => b.observations.length - a.observations.length).slice(0, 3);

  return (
    <Carte>
      <EnTeteCarte titre="Les plus travaillées" legende="Où l'effort est allé, en résultats enregistrés" />
      <CorpsCarte>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {top.map((etat) => (
            <div
              key={etat.skill.code}
              className="flex flex-col justify-between rounded-xl border border-bordure bg-surface-2/50 p-3.5"
            >
              <div className="min-w-0">
                <CodeCompetence code={etat.skill.code} />
                <p className="mt-1 truncate text-xs font-medium text-texte" title={etat.skill.intitule}>
                  {etat.skill.intitule}
                </p>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="chiffres text-2xl font-semibold leading-none text-primaire">
                  {etat.observations.length}
                </span>
                <div className="w-16 shrink-0">
                  <JaugeNiveau niveau={etat.niveau} taille="compacte" />
                  <p className="mt-1 text-right text-[0.625rem] text-texte-discret">
                    {etat.niveau === null ? "—" : `niveau ${etat.niveau}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CorpsCarte>
    </Carte>
  );
}
