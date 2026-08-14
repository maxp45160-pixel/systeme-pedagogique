"use client";

import { useState } from "react";
import type { PropositionContenuActivite } from "@/lib/tutor/outils";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { acceptGeneratedActivity } from "@/lib/store/adaptive-actions";
import { Champ } from "@/components/ui/champ";
import { BandeauInfo, Bouton, Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";
import type { WorkModeSettings } from "@/lib/domain/adaptive-learning";

export function GenerationReview({
  accountId,
  generationRequestId,
  initialMode,
  instant,
}: {
  accountId: string;
  generationRequestId: string;
  initialMode?: WorkModeSettings;
  /** Le contexte qui a produit cette proposition — il en fixe durée et segment. */
  instant: { tempsMin: number; capacite: string };
}) {
  const [proposal, setProposal] = useState<PropositionContenuActivite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(() => `accept:${crypto.randomUUID()}`);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationRequestId,
          temps: String(instant.tempsMin),
          capacite: instant.capacite,
          config: lireConfigTuteur(accountId) ?? undefined,
        }),
      });
      const body = await response.json() as { proposition?: PropositionContenuActivite; message?: string };
      if (!response.ok || !body.proposition) {
        throw new Error(body.message ?? "Le tuteur n'a pas rendu de contenu valide.");
      }
      setProposal(body.proposition);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Génération impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (!proposal) {
    return (
      <Carte accent>
        <EnTeteCarte
          titre="Préparer le contenu"
          legende="Le système a déjà fixé famille, cible, durée, ressources et contrat. Le tuteur remplit seulement le contenu."
        />
        <CorpsCarte>
          {error && <BandeauInfo ton="danger" className="mb-4">{error}</BandeauInfo>}
          <Bouton type="button" onClick={generate} disabled={loading}>
            {loading ? "Génération en cours…" : "Générer une proposition non enregistrée"}
          </Bouton>
        </CorpsCarte>
      </Carte>
    );
  }

  return (
    <Carte accent>
      <EnTeteCarte
        titre="Relire avant d’accepter"
        legende="Rien n’est enregistré tant que tu n’acceptes pas cette version."
      />
      <CorpsCarte>
        <div className="space-y-4">
          <Champ
            label="Titre"
            value={proposal.titre}
            onChange={(event) => setProposal({ ...proposal, titre: event.target.value })}
          />
          <Champ
            label="Description"
            multiligne
            rows={2}
            value={proposal.description}
            onChange={(event) => setProposal({ ...proposal, description: event.target.value })}
          />
          <Champ
            label="Brief"
            multiligne
            rows={6}
            value={proposal.brief}
            onChange={(event) => setProposal({ ...proposal, brief: event.target.value })}
          />
          <section>
            <h3 className="text-sm font-medium">Jalons proposés</h3>
            <ol className="mt-2 space-y-2 text-sm text-texte-attenue">
              {proposal.jalons.map((milestone, index) => (
                <li key={`${milestone.titre}-${index}`} className="rounded-md border border-bordure p-3">
                  <strong className="text-texte">{milestone.titre}</strong>
                  <p className="mt-1">{milestone.consigne}</p>
                  <p className="mt-1 text-xs text-texte-discret">Attendu : {milestone.resultatAttendu}</p>
                </li>
              ))}
            </ol>
          </section>
          <form action={acceptGeneratedActivity} className="flex flex-wrap gap-2">
            <input type="hidden" name="generationRequestId" value={generationRequestId} />
            <input type="hidden" name="temps" value={String(instant.tempsMin)} />
            <input type="hidden" name="capacite" value={instant.capacite} />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="initialMode" value={initialMode ? JSON.stringify(initialMode) : ""} />
            <input type="hidden" name="proposal" value={JSON.stringify(proposal)} />
            <Bouton type="submit">Accepter et ouvrir le workspace</Bouton>
            <Bouton type="button" variante="secondaire" onClick={generate} disabled={loading}>
              Régénérer
            </Bouton>
          </form>
        </div>
      </CorpsCarte>
    </Carte>
  );
}
