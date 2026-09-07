import type { Exercise, ExerciseAttempt } from "@/lib/domain/types";
import { Markdown } from "@/components/ui/markdown";
import { ReponseAttendue } from "./reponse-attendue";
import { BilanAssiste } from "./bilan-assiste";

/** Disponible après clôture seulement ; le corrigé de référence n'est pas un verdict. */
export function RetourSansCorrection({ exercice, tentative, compteId }: {
  exercice: Exercise;
  tentative: ExerciseAttempt;
  compteId: string;
}) {
  return (
    <section className="space-y-4 lg:col-span-2" aria-label="Bilan sans correction personnalisée">
      <div>
        <h2 className="font-serif text-lg">Votre travail est conservé</h2>
        <p className="text-sm text-texte-attenue">
          Aucune correction personnalisée n&apos;a encore été validée. Comparez votre réponse
          au corrigé disponible ; votre progression reste inchangée.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-bordure bg-surface p-4">
          <h3 className="mb-3 text-sm font-medium">Votre réponse d&apos;origine</h3>
          <Markdown contenu={tentative.reponse} />
        </div>
        <div className="space-y-3">
          {exercice.correction.trim() ? (
            <ReponseAttendue correction={exercice.correction} ouvertParDefaut legende="Corrigé de référence — à comparer à votre raisonnement." />
          ) : (
            <p className="text-sm text-texte-attenue">Cet exercice ne possède pas de corrigé de référence. Les critères restent disponibles ci-dessous.</p>
          )}
          <div className="rounded-md border border-bordure bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium">Points à vérifier</h3>
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {exercice.criteres.map((critere, index) => <li key={index}>{critere.libelle}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <BilanAssiste key={tentative.id} exercice={exercice} attemptId={tentative.id}
        dureeSuggeree={tentative.dureeMin ?? 0} indicesUtilises={tentative.indicesUtilises}
        compteId={compteId} feedbackDiffere />
    </section>
  );
}
