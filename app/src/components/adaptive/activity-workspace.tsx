import { notFound } from "next/navigation";
import { loadAdaptiveWorkspace } from "@/lib/store/adaptive-learning";
import {
  abandonActivity,
  completeExploration,
  pauseActivity,
  recordMilestone,
  saveActivityArtifact,
  startOrResumeActivity,
} from "@/lib/store/adaptive-actions";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { BandeauInfo, Bouton, Carte, CorpsCarte, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
import { WorkModePanel } from "./work-mode-panel";
import type { WorkModeSettings } from "@/lib/domain/adaptive-learning";
import { ProjectAssessment } from "./project-assessment";

function requestId(prefix: string, runId: string): string {
  return `${prefix}:${runId}:${crypto.randomUUID()}`;
}

export async function ActivityWorkspace({ runId, recommendedMode }: { runId: string; recommendedMode?: WorkModeSettings }) {
  const state = await loadAdaptiveWorkspace(runId);
  if (!state) notFound();
  const { activity, run, artifact, events } = state;
  const content = activity.workspaceContent;
  if (!content) {
    return <BandeauInfo ton="alerte">Le contenu de cette activité est absent ou incompatible.</BandeauInfo>;
  }
  const initialMode = recommendedMode ?? (activity.family === "produire"
    ? { focus: "riche" as const, guidance: "autonome" as const, toolPower: "avances" as const }
    : { focus: "equilibre" as const, guidance: "equilibre" as const, toolPower: "standards" as const });

  if (run.status === "planifiee" || run.status === "en-pause") {
    return (
      <Carte accent data-testid="adaptive-workspace-launch" data-run-id={run.id} data-family={activity.family} data-status={run.status}>
        <EnTeteCarte titre={activity.title} legende={run.status === "en-pause" ? "Travail en pause, prêt à être repris." : "Activité prête à démarrer."} />
        <CorpsCarte>
          <p className="max-w-3xl text-sm text-texte-attenue">{activity.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={startOrResumeActivity.bind(null, run.id, requestId("start", run.id), initialMode)}>
              <Bouton type="submit" data-testid={run.status === "en-pause" ? "activity-resume" : "activity-start"}>{run.status === "en-pause" ? "Reprendre" : "Démarrer"}</Bouton>
            </form>
            <form action={abandonActivity.bind(null, run.id, requestId("abandon", run.id))}>
              <input type="hidden" name="reason" value="Abandon avant démarrage ou reprise." />
              <Bouton type="submit" variante="secondaire" data-testid="activity-abandon">Abandonner</Bouton>
            </form>
          </div>
        </CorpsCarte>
      </Carte>
    );
  }
  if (run.status === "terminee" || run.status === "abandonnee") {
    return <BandeauInfo ton={run.status === "terminee" ? "succes" : "alerte"}>Cette activité est {run.status}.</BandeauInfo>;
  }

  const body = typeof artifact?.content.body === "string" ? artifact.content.body : "";
  const completedMilestones = new Set(events.flatMap((event) =>
    event.type === "jalon" ? [event.milestoneId] : [],
  ));
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] [&[data-focus=epure]]:lg:grid-cols-1 [&[data-focus=epure]_[data-focus-secondary]]:hidden [&[data-guidance=autonome]_[data-guidance-support]]:hidden [&[data-tools=essentiels]_[data-tool-tier=standard]]:hidden [&[data-tools=essentiels]_[data-tool-tier=advanced]]:hidden [&[data-tools=standards]_[data-tool-tier=advanced]]:hidden"
      data-testid="adaptive-workspace"
      data-run-id={run.id}
      data-family={activity.family}
      data-activity-version={activity.version}
      data-focus={initialMode.focus}
      data-guidance={initialMode.guidance}
      data-tools={initialMode.toolPower}
    >
      <main className="min-w-0 space-y-5">
        <header>
          <div className="flex flex-wrap gap-2">
            <Etiquette ton="primaire">{activity.family === "explorer" ? "Explorer" : "Produire"}</Etiquette>
            <Etiquette>{activity.estimatedDurationMinutes} min</Etiquette>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-medium">{activity.title}</h1>
          <p className="mt-2 text-sm text-texte-attenue">{content.brief}</p>
        </header>

        {content.family === "explorer" ? (
          <>
            <BandeauInfo>{content.introduction}</BandeauInfo>
            {content.path.map((step, index) => (
              <Carte key={`${step.title}-${index}`}>
                <EnTeteCarte titre={`${index + 1}. ${step.title}`} />
                <CorpsCarte>
                  <div className="prose-exo whitespace-pre-wrap text-sm">{step.content}</div>
                  <p data-guidance-support className="mt-4 border-l-2 border-primaire pl-3 text-xs text-texte-attenue">{step.annotationPrompt}</p>
                </CorpsCarte>
              </Carte>
            ))}
            {content.milestones.length > 0 && (
              <Carte data-guidance-support>
                <EnTeteCarte titre="Jalons d'exploration" legende="Ils restent des observations et ne produisent aucune preuve." />
                <CorpsCarte>
                  <ul className="space-y-3">
                    {content.milestones.map((milestone) => (
                      <li key={milestone.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium">{milestone.title}</p>
                          <p className="text-xs text-texte-attenue">{milestone.instruction}</p>
                        </div>
                        {completedMilestones.has(milestone.id) ? (
                          <Etiquette ton="succes">Observé</Etiquette>
                        ) : (
                          <form action={recordMilestone.bind(null, run.id, milestone.id, requestId("milestone", `${run.id}:${milestone.id}`))}>
                            <Bouton type="submit" variante="discret">Marquer réalisé</Bouton>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </CorpsCarte>
              </Carte>
            )}
            <Carte>
              <EnTeteCarte titre="Annotations et synthèse facultative" />
              <CorpsCarte>
                <form action={saveActivityArtifact.bind(null, run.id, requestId("artifact", run.id))} className="space-y-3">
                  <input type="hidden" name="artifactVersion" value={artifact?.version ?? 0} />
                  <input type="hidden" name="artifactKind" value="structure" />
                  <Champ label="Tes notes" name="artifactBody" multiligne rows={8} defaultValue={body} aide={content.optionalSynthesis} data-testid="exploration-notes" />
                  <Bouton type="submit" variante="secondaire" data-testid="exploration-save">Enregistrer les notes</Bouton>
                </form>
              </CorpsCarte>
            </Carte>
            <div className="flex flex-wrap gap-2">
              <form action={completeExploration.bind(null, run.id, requestId("complete", run.id))}>
                <Bouton type="submit" data-testid="activity-complete">Terminer sans produire de preuve</Bouton>
              </form>
              <form action={pauseActivity.bind(null, run.id, requestId("pause", run.id))}>
                <Bouton type="submit" variante="secondaire" data-testid="activity-pause">Mettre en pause</Bouton>
              </form>
            </div>
          </>
        ) : (
          <>
            <BandeauInfo>{content.start}</BandeauInfo>
            {(content.milestones.length > 0 || content.advice.length > 0) && (
              <Carte data-guidance-support>
                <EnTeteCarte titre="Parcours conseillé" legende="Ce guidage disparaît en mode autonome." />
                <CorpsCarte>
                  {content.milestones.length > 0 && (
                    <ol className="space-y-3 text-sm text-texte-attenue">
                      {content.milestones.map((milestone, index) => (
                        <li key={milestone.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-texte">{index + 1}. {milestone.title}</span>
                            {completedMilestones.has(milestone.id) ? (
                              <Etiquette ton="succes">Observé</Etiquette>
                            ) : (
                              <form action={recordMilestone.bind(null, run.id, milestone.id, requestId("milestone", `${run.id}:${milestone.id}`))}>
                                <Bouton type="submit" variante="discret">Marquer réalisé</Bouton>
                              </form>
                            )}
                          </div>
                          <p>{milestone.instruction}</p>
                          <p className="text-xs text-texte-discret">Attendu : {milestone.expectedResult}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {content.advice.length > 0 && (
                    <ul className="mt-4 space-y-1 text-xs text-texte-attenue">
                      {content.advice.map((advice) => <li key={advice}>• {advice}</li>)}
                    </ul>
                  )}
                </CorpsCarte>
              </Carte>
            )}
            <Carte>
              <EnTeteCarte titre="Artefact" legende="Sauvegarde optimiste : un conflit de version refuse l'écrasement." />
              <CorpsCarte>
                <form action={saveActivityArtifact.bind(null, run.id, requestId("artifact", run.id))} className="space-y-3">
                  <input type="hidden" name="artifactVersion" value={artifact?.version ?? 0} />
                  <div data-tool-tier="advanced" className="space-y-3">
                    <ChampSelect
                      label="Source de l'artefact"
                      name="artifactKind"
                      defaultValue={run.currentArtifact?.kind === "lien-externe" ? "lien-externe" : "structure"}
                      disabled={initialMode.toolPower !== "avances"}
                      data-requires-advanced
                      data-testid="artifact-source-kind"
                      options={[
                        { valeur: "structure", libelle: "Contenu copié dans le workspace — gelable" },
                        { valeur: "lien-externe", libelle: "Lien externe modifiable — support uniquement" },
                      ]}
                    />
                    <Champ
                      label="Lien externe"
                      name="externalArtifactUrl"
                      type="url"
                      defaultValue={typeof artifact?.content.externalUrl === "string" ? artifact.content.externalUrl : ""}
                      aide="Un simple lien modifiable peut être conservé comme support, jamais comme preuve forte."
                      data-testid="external-artifact-url"
                    />
                  </div>
                  <Champ
                    label="Production structurée"
                    name="artifactBody"
                    multiligne
                    rows={16}
                    defaultValue={body || content.artifactSections.map((section) => `## ${section.section}\n\n${section.instruction}\n`).join("\n")}
                    data-testid="project-artifact-editor"
                  />
                  <Bouton type="submit" variante="secondaire" data-testid="project-save-milestone">Enregistrer</Bouton>
                </form>
              </CorpsCarte>
            </Carte>
            <Carte>
              <EnTeteCarte titre="Soumission et validation humaine" legende={content.submissionInstruction} />
              <CorpsCarte>
                <ProjectAssessment
                  accountId={activity.accountId}
                  runId={run.id}
                  requestId={requestId("submit", run.id)}
                  criteria={activity.evaluationContract.criteria}
                  submissionInstruction={content.submissionInstruction}
                  blockedReason={run.currentArtifact?.kind === "lien-externe" && !run.currentArtifact.immutable
                    ? "Ce lien modifiable est conservé comme support. Copie son contenu, importe un fichier, exporte-le ou utilise un commit immuable pour permettre une preuve."
                    : undefined}
                />
              </CorpsCarte>
            </Carte>
            <form action={pauseActivity.bind(null, run.id, requestId("pause", run.id))}>
              <Bouton type="submit" variante="secondaire" data-testid="activity-pause">Mettre en pause</Bouton>
            </form>
          </>
        )}
        <form action={abandonActivity.bind(null, run.id, requestId("abandon", run.id))}>
          <input type="hidden" name="reason" value="Abandon demandé dans le workspace." />
          <Bouton type="submit" variante="secondaire" data-testid="activity-abandon">Abandonner sans preuve</Bouton>
        </form>
      </main>
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <WorkModePanel initial={initialMode} runId={run.id} />
        <Carte data-focus-secondary>
          <EnTeteCarte titre="Critères connus avant le travail" />
          <CorpsCarte>
            {activity.evaluationContract.criteria.length === 0
              ? <p className="text-xs text-texte-discret">Aucun critère : cette activité est un support.</p>
              : <ul className="space-y-2 text-xs text-texte-attenue">{activity.evaluationContract.criteria.map((criterion) => <li key={criterion.id}>• {criterion.label}</li>)}</ul>}
          </CorpsCarte>
        </Carte>
        {activity.authorizedResources.length > 0 && (
          <Carte data-focus-secondary data-tool-tier="standard">
            <EnTeteCarte titre="Ressources autorisées" />
            <CorpsCarte>
              <ul className="space-y-2 text-xs text-texte-attenue">
                {activity.authorizedResources.map((resource) => (
                  <li key={resource.id}>
                    <span className="font-medium text-texte">{resource.label}</span>
                    <span> — {resource.usage === "normale" ? "usage normal" : "comptée comme aide"}</span>
                    {resource.ref && <p className="break-all text-texte-discret">{resource.ref}</p>}
                  </li>
                ))}
              </ul>
            </CorpsCarte>
          </Carte>
        )}
      </div>
    </div>
  );
}
