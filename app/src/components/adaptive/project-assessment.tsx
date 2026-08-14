"use client";

import { useState } from "react";
import type { EvaluationCriterion } from "@/lib/domain/adaptive-learning";
import type { PropositionEvaluationProjet } from "@/lib/tutor/outils";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { submitProject } from "@/lib/store/adaptive-actions";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";

const DEMONSTRATION = {
  "non-demontre": "non-observee",
  "partiellement-demontre": "partielle",
  demontre: "pleine",
} as const;

export function ProjectAssessment({
  accountId,
  runId,
  requestId,
  criteria,
  submissionInstruction,
  blockedReason,
}: {
  accountId: string;
  runId: string;
  requestId: string;
  criteria: readonly EvaluationCriterion[];
  submissionInstruction: string;
  blockedReason?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map((criterion) => [criterion.id, "non-observee"])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState<PropositionEvaluationProjet | null>(null);
  const [artifactVersion, setArtifactVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askTutor() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/activities/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, config: lireConfigTuteur(accountId) ?? undefined }),
      });
      const body = await response.json() as {
        proposition?: PropositionEvaluationProjet;
        artifactVersion?: number;
        message?: string;
      };
      if (!response.ok || !body.proposition || !Number.isInteger(body.artifactVersion)) {
        throw new Error(body.message ?? "Le tuteur n'a pas rendu de proposition valide.");
      }
      setProposal(body.proposition);
      setArtifactVersion(body.artifactVersion!);
      setValues(Object.fromEntries(body.proposition.criteres.map((criterion) => [
        criterion.critereId,
        DEMONSTRATION[criterion.appreciation],
      ])));
      setNotes(Object.fromEntries(body.proposition.criteres.map((criterion) => [
        criterion.critereId,
        criterion.justification,
      ])));
    } catch (cause) {
      setProposal(null);
      setArtifactVersion(null);
      setError(cause instanceof Error ? cause.message : "Relecture impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submitProject.bind(null, runId, requestId)} className="space-y-4" data-testid="activity-assessment">
      <p className="text-xs text-texte-attenue">{submissionInstruction}</p>
      <div data-tool-tier="advanced" className="flex flex-wrap items-center gap-3">
        <Bouton type="button" variante="secondaire" onClick={askTutor} enChargement={loading}>
          Proposer une relecture avec le tuteur
        </Bouton>
        <span className="text-xs text-texte-discret">Facultatif : le bilan manuel reste toujours disponible.</span>
      </div>
      {error && (
        <BandeauInfo ton="alerte" taille="compacte" data-testid="manual-assessment-fallback">
          {error} Remplis ou modifie le bilan manuellement.
        </BandeauInfo>
      )}
      {proposal && (
        <BandeauInfo taille="compacte">
          Proposition chargée depuis la version {artifactVersion} de l&apos;artefact. Chaque ligne reste modifiable avant validation humaine.
          {proposal.reserves.length > 0 && <span> Réserves : {proposal.reserves.join(" · ")}</span>}
        </BandeauInfo>
      )}
      {blockedReason && (
        <BandeauInfo ton="alerte" data-testid="unfrozen-artifact-error">{blockedReason}</BandeauInfo>
      )}
      <input type="hidden" name="proposedEvaluation" value={proposal ? JSON.stringify(proposal) : ""} />
      <input type="hidden" name="proposedArtifactVersion" value={artifactVersion ?? ""} />
      {criteria.map((criterion) => (
        <div key={criterion.id} className="grid gap-3 rounded-md border border-bordure p-3 md:grid-cols-2" data-testid="assessment-criterion">
          <ChampSelect
            label={criterion.label}
            name={`criterion:${criterion.id}`}
            value={values[criterion.id] ?? "non-observee"}
            onChange={(event) => setValues({ ...values, [criterion.id]: event.target.value })}
            options={[
              { valeur: "non-observee", libelle: "Non observé" },
              { valeur: "insuffisante", libelle: "Insuffisant" },
              { valeur: "partielle", libelle: "Partiellement démontré" },
              { valeur: "pleine", libelle: "Pleinement démontré" },
            ]}
          />
          <Champ
            label="Note facultative"
            name={`note:${criterion.id}`}
            value={notes[criterion.id] ?? ""}
            onChange={(event) => setNotes({ ...notes, [criterion.id]: event.target.value })}
          />
        </div>
      ))}
      <div className="grid gap-3 md:grid-cols-2">
        <ChampSelect
          label="Résultat validé"
          name="result"
          defaultValue="partiel"
          options={[
            { valeur: "reussi", libelle: "Réussi" },
            { valeur: "partiel", libelle: "Partiel" },
            { valeur: "echec", libelle: "Échec" },
          ]}
        />
        <ChampSelect
          label="Autonomie observée"
          name="autonomy"
          defaultValue="A2"
          options={["A0", "A1", "A2", "A3", "A4"].map((value) => ({ valeur: value, libelle: value }))}
        />
      </div>
      <Champ label="Apprentissage principal" name="mainLearning" multiligne rows={3} />
      <BandeauInfo ton="alerte" taille="compacte">
        La soumission fige l&apos;artefact. Une preuve n&apos;est créée que si les critères validés la rendent probante.
      </BandeauInfo>
      <Bouton type="submit" data-testid="assessment-human-validate" disabled={Boolean(blockedReason)}>Soumettre et valider humainement</Bouton>
    </form>
  );
}
