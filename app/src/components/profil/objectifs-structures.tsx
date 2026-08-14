import type { LearningGoal } from "@/lib/domain/adaptive-learning";
import type { Skill } from "@/lib/domain/types";
import { saveLearningGoal } from "@/lib/store/adaptive-actions";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { Bouton, CodeCompetence, Etiquette } from "@/components/ui/primitives";

/**
 * Détailler un objectif déjà déclaré.
 *
 * Ce n'est pas un second système d'objectifs : les deux champs libres du profil
 * restent la déclaration principale. Ici, on relie explicitement l'objectif à
 * des compétences, pour que le moteur puisse en tenir compte. Le lien est
 * confirmé par la personne — le moteur ne l'invente pas.
 *
 * Replié par défaut : personne n'a besoin de ce niveau de détail pour
 * commencer, et un formulaire ouvert en permanence dirait le contraire.
 */
export function ObjectifsStructures({
  objectifs,
  competences,
}: {
  objectifs: readonly LearningGoal[];
  competences: readonly Skill[];
}) {
  return (
    <div>
      {objectifs.length > 0 && (
        <ul className="mb-3 grid gap-2 md:grid-cols-2">
          {[...objectifs]
            .sort((gauche, droite) => droite.declaredPriority - gauche.declaredPriority)
            .map((objectif) => (
              <li key={objectif.id} className="rounded-md border border-bordure p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{objectif.title}</span>
                  {objectif.declaredState === "actif" && <Etiquette ton="primaire">Actif</Etiquette>}
                  <span className="text-xs text-texte-discret">priorité {objectif.declaredPriority}/5</span>
                </div>
                {objectif.confirmedSkillCodes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {objectif.confirmedSkillCodes.map((code) => (
                      <CodeCompetence key={code} code={code} />
                    ))}
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium">Détailler un objectif</summary>
        <form
          action={saveLearningGoal.bind(null, `goal:${crypto.randomUUID()}`)}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <Champ label="Intitulé" name="title" requis maxLength={160} />
          <ChampSelect
            label="Priorité"
            name="declaredPriority"
            defaultValue="3"
            options={[1, 2, 3, 4, 5].map((valeur) => ({ valeur: String(valeur), libelle: `${valeur}/5` }))}
          />
          <ChampSelect
            label="Horizon"
            name="horizon"
            defaultValue="moyen-terme"
            options={[
              { valeur: "court-terme", libelle: "Court terme" },
              { valeur: "moyen-terme", libelle: "Moyen terme" },
              { valeur: "long-terme", libelle: "Long terme" },
            ]}
          />
          <Champ label="Échéance (facultative)" name="targetDate" type="date" />
          <div className="md:col-span-2">
            <Champ label="Description" name="description" multiligne rows={2} />
          </div>
          <div className="md:col-span-2">
            <Champ
              label="À quoi sauras-tu que c'est atteint ?"
              name="successCriteria"
              multiligne
              rows={3}
              aide="Un critère par ligne. C'est toi qui déclares qu'un critère est rempli."
            />
          </div>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium">Compétences concernées</legend>
            <div className="mt-2 grid max-h-48 gap-2 overflow-auto rounded-md border border-bordure p-3 md:grid-cols-2">
              {competences.map((competence) => (
                <label key={competence.code} className="flex items-start gap-2 text-xs">
                  <input type="checkbox" name="skillCodes" value={competence.code} className="mt-0.5" />
                  <span>
                    <strong>{competence.code}</strong> — {competence.intitule}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <ChampSelect
            label="État"
            name="declaredState"
            defaultValue="actif"
            options={[
              { valeur: "actif", libelle: "Actif — le moteur peut le servir" },
              { valeur: "brouillon", libelle: "En attente — pas encore poursuivi" },
            ]}
          />
          <div className="md:col-span-2">
            <Bouton type="submit">Enregistrer l&apos;objectif</Bouton>
          </div>
        </form>
      </details>
    </div>
  );
}
