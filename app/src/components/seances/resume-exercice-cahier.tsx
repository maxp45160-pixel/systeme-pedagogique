import { Markdown } from "@/components/ui/markdown";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import { conclusionsExercice } from "@/lib/domain/conclusions-exercice";

const RESULTATS = {
  reussi: { libelle: "Réussi", ton: "succes" as const },
  partiel: { libelle: "Partiel", ton: "alerte" as const },
  echec: { libelle: "Non abouti", ton: "danger" as const },
};

/** Une relecture orientée conclusions, sans rejouer tout le parcours d'exercice. */
export function ResumeExerciceCahier({
  exercice,
  tentative,
}: {
  exercice: Exercise;
  tentative?: ExerciseAttempt;
}) {
  const conclusions = conclusionsExercice(exercice, tentative);
  const resultat = tentative?.statut === "terminee" ? RESULTATS[tentative.resultat] : null;

  return (
    <Carte>
      <EnTeteCarte
        titre={exercice.titre}
        legende={tentative?.dureeMin ? `${tentative.dureeMin} min observées` : undefined}
        action={resultat ? <Etiquette ton={resultat.ton}>{resultat.libelle}</Etiquette> : undefined}
      />

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {exercice.competences.map((code) => <CodeCompetence key={code} code={code} />)}
          {conclusions.notions.map((notion) => <Etiquette key={notion}>{notion}</Etiquette>)}
        </div>

        <section aria-labelledby={`enonce-${exercice.id}`}>
          <h3 id={`enonce-${exercice.id}`} className="text-xs font-semibold uppercase tracking-wide text-texte-discret">
            Énoncé
          </h3>
          <div className="prose-exo mt-1.5 text-sm"><Markdown contenu={exercice.enonce} /></div>
        </section>

        <section className="rounded-lg border border-primaire/20 bg-primaire-faible/50 p-4" aria-labelledby={`conclusions-${exercice.id}`}>
          <h3 id={`conclusions-${exercice.id}`} className="font-serif text-lg font-medium">Ce qu’il faut retenir</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Conclusion titre="Acquis" valeurs={conclusions.pointsForts} vide="Aucun acquis détaillé." />
            <Conclusion titre="À corriger" valeurs={conclusions.erreurs} vide="Aucune erreur détaillée." />
            <Conclusion titre="Prochaine action" valeurs={conclusions.actions} vide="Aucune action enregistrée." />
          </div>
        </section>

        {tentative?.reponse.trim() && (
          <details className="rounded-md border border-bordure bg-surface-2 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Ma réponse</summary>
            <div className="prose-exo mt-2 border-t border-bordure pt-2 text-sm">
              <Markdown contenu={tentative.reponse} />
            </div>
          </details>
        )}

      </div>
    </Carte>
  );
}

function Conclusion({ titre, valeurs, vide }: { titre: string; valeurs: string[]; vide: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">{titre}</p>
      {valeurs.length > 0 ? (
        <ul className="mt-1.5 space-y-1 text-sm">
          {valeurs.map((valeur) => <li key={valeur}>• {valeur}</li>)}
        </ul>
      ) : <p className="mt-1.5 text-xs text-texte-discret">{vide}</p>}
    </div>
  );
}
