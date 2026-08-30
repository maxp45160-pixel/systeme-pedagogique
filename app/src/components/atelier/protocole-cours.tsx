"use client";

/**
 * Le protocole de traitement d'un cours (ADR-130, ADR-131).
 *
 * Deux pièces, et une frontière nette entre elles :
 *
 * - **Le panneau** est la vue dérivée : les séances nées du protocole (lues
 *   dans `sessions` via `blueprint.origine`, jamais recopiées) et le journal
 *   des intentions datées. Il n'affiche que ce qui existe déjà ailleurs.
 * - **La modale** est le geste : concevoir le plan (intention déclarée +
 *   PDF + référentiel → tuteur), le relire case par case, puis — et seulement
 *   alors — planifier les séances retenues. L'écriture est INSTANTANÉE
 *   (ADR-131) : composer avec le stock existant suffit, aucun appel tuteur.
 *   Les exercices manquants restent une commande portée par la séance ; le
 *   tuteur les écrit au démarrage de chacune, quand la personne décide d'en
 *   faire quelque chose. La relecture fine des exercices reste possible sur
 *   chaque fiche, et la barrière qualité demeure la validation humaine des
 *   corrections.
 *
 * Le tuteur produit ici du contenu, jamais une mesure : le plan ne pré-note
 * rien, et les dimensions sont des intentifs de séance, pas des états.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BandeauInfo, Bouton, Etiquette } from "@/components/ui/primitives";
import { ApercuFormulesTexte, PaletteFormulesTexte } from "@/components/ui/palette-formules";
import { Modale } from "@/components/ui/modale";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";
import { useIntention } from "@/components/intention/contexte-intention";
import {
  IconeAmpoule,
  IconeExercices,
  IconeFleche,
  IconeNote,
} from "@/components/ui/icones";
import { consommerFluxSse } from "@/lib/tutor/flux-sse";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import {
  DESCRIPTIONS_DIMENSION_SEANCE,
  LIBELLES_DIMENSION_SEANCE,
  LIBELLES_INTENTION_COURS,
  type IntentionCours,
  type ProtocoleCours,
} from "@/lib/domain/protocole-cours";
import type { ActionCandidate } from "@/lib/engine/action-candidate";
import { identifiantCandidateProtocole } from "@/lib/engine/protocole-candidats";
import { formatDateCourte } from "@/lib/engine/dates";
import { libelleCompte } from "@/lib/domain/engagement";
import type { LectureOrchestrationModule } from "@/lib/engine/module-orchestration";
import type { DocumentAssocieCours } from "@/lib/documents/contexte-cours";
import {
  enregistrerProtocoleAction,
  planifierSeanceProtocoleAction,
  type TraceProtocole,
} from "@/lib/store/protocole-actions";

const STATUTS_LIBELLES: Record<string, string> = {
  planifiee: "Planifiée",
  "en-cours": "En cours",
  terminee: "Terminée",
  abandonnee: "Abandonnée",
  historique: "Faite",
};

/**
 * Les suggestions d'amorçage de la capture d'intention (ADR-130) — le même
 * style que le point d'entrée assisté (`CaptureIntention`) : cliquer une
 * suggestion lance la conception avec cette intention.
 */
const SUGGESTIONS_INTENTION_COURS: readonly {
  valeur: IntentionCours;
  libelle: string;
  Icone: typeof IconeNote;
}[] = [
  { valeur: "memoriser", libelle: "Mémoriser le cours", Icone: IconeNote },
  { valeur: "maitriser", libelle: "Maîtriser les notions", Icone: IconeExercices },
  { valeur: "comprendre", libelle: "Comprendre le contenu", Icone: IconeAmpoule },
];

/* ------------------------------------------------------------------ */
/* Le panneau — vue dérivée                                             */
/* ------------------------------------------------------------------ */

export interface ContexteCours {
  /** Domaine déclaré par le cours, lu sans modifier sa fiche. */
  domaineId?: string;
  domaineNom?: string;
  /** Présent uniquement si le domaine porte l'usage module. */
  moduleDomaineId?: string;
  documents: DocumentAssocieCours[];
  deadlines: LectureOrchestrationModule["deadlines"];
  modules: { id: string; nom: string }[];
  competences: { code: string; intitule: string }[];
}

export function ProtocoleCoursPanel({
  ficheId,
  compteId,
  trace = { seances: [], journal: [] },
  sourceAttachmentId,
  titreCours,
  contexteCours,
}: {
  ficheId: string;
  compteId: string;
  trace?: TraceProtocole;
  sourceAttachmentId?: string;
  titreCours: string;
  contexteCours?: ContexteCours;
}) {
  const router = useRouter();
  const { ouvrir } = useIntention();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const planDejaCompose = trace.seances.length > 0 || trace.journal.length > 0;

  return (
    <section className="rounded-xl border border-bordure bg-surface-2 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Plan de révision
          </p>
          <h2 className="mt-2 font-serif text-2xl font-medium">Travaillez ce cours par séances</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-texte-attenue">
            {trace.intention ? (
              <>
                Intention déclarée :{" "}
                <span className="font-medium text-texte">
                  {LIBELLES_INTENTION_COURS[trace.intention]}
                </span>
                . Le tuteur compose un plan de séances — compréhension, application,
                contextualisation, mémorisation — que vous relisez avant toute création.
              </>
            ) : (
              "Déclarez ce que vous voulez faire de ce cours : le tuteur compose un plan de séances que vous relisez avant toute création."
            )}
          </p>
        </div>
        <Bouton
          variante="principal"
          onClick={() => setModaleOuverte(true)}
          disabled={!sourceAttachmentId}
        >
          {planDejaCompose ? "Recomposer le plan de révision" : "Composer le plan de révision"}
        </Bouton>
      </div>

      {!sourceAttachmentId && (
        <p className="mt-3 text-[0.6875rem] text-texte-discret">
          Le protocole part du PDF attaché : déposez-le d’abord dans « Ressource attachée ».
        </p>
      )}

      {contexteCours && (
        <section className="mt-6 border-t border-bordure pt-5" aria-labelledby="contexte-cours">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                Repères du cours
              </p>
              <h3 id="contexte-cours" className="mt-1 font-serif text-lg font-medium">
                Votre contexte de travail
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
                Ces éléments relisent vos données existantes ; rien n’est ajouté tant que vous ne le demandez pas.
              </p>
            </div>
            <Bouton
              variante="secondaire"
              taille="petite"
              onClick={() => ouvrir({ besoinInitial: `Pour le cours « ${titreCours} » : ` })}
            >
              Déclarer un besoin pour ce cours
            </Bouton>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-bordure bg-surface px-3.5 py-3">
              <p className="text-xs font-semibold text-texte">Cours et documents liés</p>
              <p className="mt-1 text-xs text-texte-attenue">
                {contexteCours.domaineNom
                  ? `Domaine déclaré : ${contexteCours.domaineNom}`
                  : "Aucun domaine n’est déclaré pour ce cours."}
              </p>
              {contexteCours.documents.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {contexteCours.documents.map((document) => (
                    <li key={document.id}>
                      <Link
                        href={`/atelier?note=${encodeURIComponent(document.id)}&retour=${encodeURIComponent(`/atelier?note=${ficheId}`)}`}
                        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-primaire-faible/30"
                      >
                        <span className="min-w-0 truncate font-medium text-primaire">{document.titre}</span>
                        <span className="shrink-0 text-[0.6875rem] text-texte-discret">{document.raison}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-texte-discret">
                  Aucun autre document lié pour le moment.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-bordure bg-surface px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-texte">Échéances</p>
                  <p className="mt-1 text-xs text-texte-attenue">
                    {contexteCours.moduleDomaineId
                      ? "Elles sont relues depuis le module, pas copiées dans le cours."
                      : "Aucun module académique n’est déclaré pour ce cours."}
                  </p>
                </div>
                {contexteCours.moduleDomaineId && (
                  <BoutonEcheance
                    competences={contexteCours.competences}
                    modules={contexteCours.modules}
                    initial={{ moduleDomaineId: contexteCours.moduleDomaineId }}
                    libelle="Déclarer une échéance"
                    mode="action"
                  />
                )}
              </div>
              {contexteCours.deadlines.length > 0 ? (
                <ul className="mt-3 divide-y divide-bordure/60">
                  {contexteCours.deadlines.map((deadline) => (
                    <li key={deadline.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-texte">{deadline.label}</span>
                        <Etiquette ton={deadline.daysRemaining < 0 ? "alerte" : "neutre"}>
                          {libelleCompte(deadline.daysRemaining)}
                        </Etiquette>
                      </div>
                      <p className="mt-1 text-xs text-texte-discret">
                        {formatDateCourte(deadline.dueAt)} · {deadline.preparation === "non-estimable"
                          ? "Préparation non estimable à partir des preuves disponibles."
                          : "Préparation relue depuis les observations disponibles."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-texte-discret">
                  {contexteCours.moduleDomaineId
                    ? "Aucune échéance liée à ce module pour le moment."
                    : "Déclarez le cours dans un module pour relire ses échéances ici."}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
            Séances acceptées depuis ce cours
          </p>
          {trace.seances.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {trace.seances.map((seance) => (
                <li key={seance.seanceId}>
                  <Link
                    href={`/seances?session=${encodeURIComponent(seance.seanceId)}`}
                    className="flex flex-wrap items-baseline gap-2 rounded-md bg-surface px-2.5 py-1.5 transition-colors hover:bg-primaire-faible/30"
                  >
                    <span className="rounded border border-bordure px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-texte-discret">
                      {LIBELLES_DIMENSION_SEANCE[seance.dimension]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-texte">{seance.titre}</span>
                    <span className="text-[0.6875rem] text-texte-discret">
                      {STATUTS_LIBELLES[seance.statut] ?? seance.statut} ·{" "}
                      <span className="chiffres">{seance.date.slice(0, 10)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-texte-discret">
              Aucune séance de ce cours n’a encore été acceptée.
            </p>
          )}
        </div>

      {trace.journal.length > 0 && (
        <div className="mt-5 border-t border-bordure pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
            Journal
          </p>
          <ul className="mt-2 space-y-1">
            {trace.journal.map((ligne, index) => (
              <li key={index} className="text-xs leading-relaxed text-texte-attenue">
                {ligne}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modaleOuverte && (
        <ModaleProtocole
          ficheId={ficheId}
          sourceAttachmentId={sourceAttachmentId ?? ""}
          compteId={compteId}
          intentionInitiale={trace.intention}
          demarrageAutomatique={Boolean(trace.intention)}
          onFermer={() => setModaleOuverte(false)}
          surTermine={() => router.refresh()}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* La modale — concevoir, relire, créer                                 */
/* ------------------------------------------------------------------ */

type EtatModale =
  | { phase: "intention"; message: string | null }
  | { phase: "generation"; progression: string | null }
  | {
      phase: "relecture";
      protocole: ProtocoleCours;
      candidats: ActionCandidate[];
      reservations: string[];
    }
  | {
      phase: "ecriture";
      progression: string | null;
      crees: { seanceId: string; titre: string }[];
      avertissements: string[];
    };

export function ModaleProtocole({
  ficheId,
  sourceAttachmentId,
  compteId,
  intentionInitiale,
  demarrageAutomatique = false,
  onFermer,
  surTermine,
}: {
  ficheId: string;
  sourceAttachmentId: string;
  compteId: string;
  /**
   * L'intention déjà déclarée au dépôt du cours (ADR-130). Présente : la
   * capture ne se redit pas — la génération part directement, et la phase de
   * saisie ne sert qu'aux fiches déposées avant l'intention.
   */
  intentionInitiale?: IntentionCours;
  /** Lance la conception sans passer par la capture (intention déjà connue). */
  demarrageAutomatique?: boolean;
  onFermer: () => void;
  surTermine: () => void;
}) {
  const [etat, setEtat] = useState<EtatModale>(
    intentionInitiale
      ? { phase: "generation", progression: null }
      : { phase: "intention", message: null },
  );
  const [intention, setIntention] = useState<IntentionCours>(
    intentionInitiale ?? "maitriser",
  );
  const [intentionLibre, setIntentionLibre] = useState("");
  // L'intention est du texte pédagogique libre : palette de formules (friction 1).
  const intentionRef = useRef<HTMLTextAreaElement>(null);
  const [garde, setGarde] = useState<Record<number, boolean>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const abandonRef = useRef<AbortController | null>(null);

  /*
   * L'intention est déjà connue : la conception part au montage, différé d'un
   * tick (un setState synchrone dans un effet cascade). Le garde est verrouillé
   * à l'exécution pour que le premier nettoyage de Strict Mode puisse annuler
   * son minuteur sans empêcher le second montage de lancer la conception.
   */
  const demarrageLanceRef = useRef(false);
  useEffect(() => {
    if (!demarrageAutomatique || demarrageLanceRef.current) return;
    const minuteur = setTimeout(() => {
      if (demarrageLanceRef.current) return;
      demarrageLanceRef.current = true;
      void concevoir(intentionInitiale);
    }, 0);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le garde `demarrageLanceRef` interdit le relancement
  }, [demarrageAutomatique, intentionInitiale]);

  function fermer() {
    abandonRef.current?.abort();
    abandonRef.current = null;
    onFermer();
  }

  async function concevoir(intentionChoisie: IntentionCours = intention) {
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setIntention(intentionChoisie);
    setEtat({ phase: "generation", progression: null });
    setErreur(null);

    try {
      const reponse = await fetch("/api/protocole/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ficheId,
          sourceAttachmentId,
          intention: intentionChoisie,
          intentionLibre: intentionLibre.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "intention",
          message: donnees?.message ?? "La conception du protocole n'a pas pu démarrer.",
        });
        return;
      }

      let recue = false;
      let candidatsRecus: ActionCandidate[] = [];
      let reservationsRecues: string[] = [];
      await consommerFluxSse(reponse, (type, donnees) => {
        if (type === "protocole") {
          const recu = JSON.parse(donnees) as ProtocoleCours;
          recue = true;
          setGarde(Object.fromEntries(recu.seances.map((_, index) => [index, true])));
          setEtat({
            phase: "relecture",
            protocole: recu,
            candidats: candidatsRecus,
            reservations: reservationsRecues,
          });
        } else if (type === "candidats-plan") {
          const recu = JSON.parse(donnees) as { candidates?: ActionCandidate[] };
          candidatsRecus = Array.isArray(recu.candidates) ? recu.candidates : [];
        } else if (type === "reserve-candidats") {
          const recu = JSON.parse(donnees) as { reservations?: string[] };
          reservationsRecues = Array.isArray(recu.reservations) ? recu.reservations : [];
        } else if (type === "erreur") {
          recue = true;
          setEtat({
            phase: "intention",
            message: (JSON.parse(donnees) as { message: string }).message,
          });
        } else if (type === "proposition-en-cours") {
          setEtat({
            phase: "generation",
            progression: "Le tuteur conçoit le plan de séances…",
          });
        }
      });

      if (!recue && !abandon.signal.aborted) {
        setEtat({
          phase: "intention",
          message:
            "Le flux s'est interrompu avant que le tuteur n'ait rendu son plan. Rien n'a été créé — relancez la conception.",
        });
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "intention", message: "Conception interrompue." });
      }
    }
  }

  /*
   * L'écriture est séquentielle et INSTANTANÉE (ADR-131) : planifier une
   * séance ne passe par aucun appel tuteur. Un échec au milieu doit laisser un
   * bilan lisible au lieu de prétendre que rien n'a eu lieu — mais il n'est
   * plus question d'attendre des dizaines de secondes par séance : les
   * manquants seront générés au démarrage de chacune.
   */
  async function creer(protocole: ProtocoleCours, candidats: readonly ActionCandidate[]) {
    const candidatesRecues = new Set(candidats.map((candidat) => candidat.candidateId));
    const retenues = protocole.seances.filter((_, index) =>
      garde[index]
      && candidatesRecues.has(identifiantCandidateProtocole(ficheId, sourceAttachmentId, index)),
    );
    if (retenues.length === 0) return;
    setErreur(null);
    const crees: { seanceId: string; titre: string }[] = [];
    const avertissements: string[] = [];

    setEtat({
      phase: "ecriture",
      progression: `Séance 1 sur ${retenues.length} — ${retenues[0].titre}…`,
      crees,
      avertissements,
    });

    for (const [rang, seance] of retenues.entries()) {
      setEtat({
        phase: "ecriture",
        progression: `Séance ${rang + 1} sur ${retenues.length} — ${seance.titre}…`,
        crees,
        avertissements,
      });
      try {
        const resultat = await planifierSeanceProtocoleAction({
          ficheId,
          pieceId: sourceAttachmentId,
          titre: seance.titre,
          dimension: seance.dimension,
          codes: seance.codes,
          consigne: seance.consigne,
          dureeCibleMin: seance.dureeCibleMin,
        });
        crees.push({ seanceId: resultat.seanceId, titre: seance.titre });
      } catch (cause) {
        avertissements.push(
          `« ${seance.titre} » n'a pas pu être créée : ${cause instanceof Error ? cause.message : "échec inconnu"}.`,
        );
      }
    }

    try {
      await enregistrerProtocoleAction({
        ficheId,
        intention,
        intentionLibre: intentionLibre.trim(),
        seancesRetenues: retenues.map(({ titre, dimension }) => ({ titre, dimension })),
      });
    } catch (cause) {
      avertissements.push(
        `Le journal de la fiche n'a pas pu être écrit : ${cause instanceof Error ? cause.message : "échec inconnu"}.`,
      );
    }

    setEtat({
      phase: "ecriture",
      progression: null,
      crees: [...crees],
      avertissements: [...avertissements],
    });
    surTermine();
  }

  const seancesRecevables = etat.phase === "relecture"
    ? etat.protocole.seances.filter((_, index) =>
      etat.candidats.some((candidat) =>
        candidat.candidateId === identifiantCandidateProtocole(ficheId, sourceAttachmentId, index),
      ),
    )
    : [];
  const retenues = etat.phase === "relecture"
    ? seancesRecevables.filter((seance) => garde[etat.protocole.seances.indexOf(seance)]).length
    : 0;

  return (
    <Modale
      titre="Que voulez-vous faire de ce cours ?"
      sousTitre="Décrivez votre objectif ou cliquez sur une suggestion. Le tuteur conçoit ensuite un plan de séances que vous relisez avant toute création."
      largeur="xl"
      onFermer={fermer}
      pied={
        etat.phase === "intention" ? (
          <>
            <Bouton variante="secondaire" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton variante="principal" onClick={() => void concevoir()}>
              Concevoir le plan de séances
              <IconeFleche className="size-4" />
            </Bouton>
          </>
        ) : etat.phase === "relecture" ? (
          <Bouton
            variante="secondaire"
            onClick={() => setEtat({ phase: "intention", message: null })}
          >
            Revoir l’intention
          </Bouton>
        ) : undefined
      }
    >
      {etat.phase === "intention" && (
        <div className="space-y-4">
          {etat.message && (
            <BandeauInfo ton="danger" taille="compacte">
              <p>{etat.message}</p>
            </BandeauInfo>
          )}

          <div>
            <div className="mb-1.5 flex justify-end">
              <PaletteFormulesTexte
                champ={intentionRef}
                valeur={intentionLibre}
                onChange={(valeur) => setIntentionLibre(valeur.slice(0, 500))}
              />
            </div>
            <textarea
              ref={intentionRef}
              value={intentionLibre}
              onChange={(event) => setIntentionLibre(event.target.value.slice(0, 500))}
              onKeyDown={(event) => {
                // Entrée lance la conception, Maj+Entrée passe à la ligne :
                // la saisie courante est une phrase, pas un paragraphe.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void concevoir();
                }
              }}
              rows={3}
              autoFocus
              placeholder="Ex. : examen dans deux semaines, je dois surtout retenir les définitions"
              className="w-full resize-none rounded-xl border border-bordure-controle bg-surface px-3.5 py-3 text-sm outline-none transition-all placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            />
            <div className="mt-2">
              <ApercuFormulesTexte valeur={intentionLibre} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[0.6875rem] text-texte-discret">
              <span>Une intention libre — l’intention sélectionnée oriente le plan</span>
              <span>Entrée pour concevoir · Maj+Entrée nouvelle ligne</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-attenue">
              Suggestions d’amorçage rapide :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SUGGESTIONS_INTENTION_COURS.map(({ valeur, libelle, Icone }) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => void concevoir(valeur)}
                  className="group flex items-center gap-2.5 rounded-lg border border-bordure bg-surface-2/60 px-3 py-2 text-left text-xs transition-colors hover:border-primaire/40 hover:bg-primaire-faible/30"
                >
                  <Icone className="size-4 text-primaire shrink-0 transition-transform group-hover:scale-110" />
                  <span className="font-medium text-texte group-hover:text-primaire">{libelle}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {etat.phase === "generation" && (
        <div className="py-6">
          <ChargementGeneration
            progressionServeur={etat.progression}
            etapes={["Le tuteur lit le cours et conçoit le plan de séances."]}
            dureeAsymptoteSec={10}
            onArreter={() => {
              abandonRef.current?.abort();
              setEtat({ phase: "intention", message: null });
            }}
          />
        </div>
      )}

      {etat.phase === "relecture" && (
        <div className="space-y-4">
          <div className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-texte-attenue">
            {etat.protocole.resume}
          </div>

          {erreur && (
            <BandeauInfo ton="danger" taille="compacte">
              <p className="text-danger">{erreur}</p>
            </BandeauInfo>
          )}

          {seancesRecevables.length === 0 ? (
            <BandeauInfo ton="info" taille="compacte">
              Aucune séance de ce cours ne peut être proposée maintenant. Les séances
              déjà planifiées ou les compétences non disponibles ne sont pas recréées.
            </BandeauInfo>
          ) : etat.protocole.seances.map((seance, index) => {
            const candidateId = identifiantCandidateProtocole(ficheId, sourceAttachmentId, index);
            if (!etat.candidats.some((candidat) => candidat.candidateId === candidateId)) return null;
            return (
            <section key={candidateId} className="rounded-md border border-bordure px-3 py-2.5">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={garde[index] ?? false}
                  onChange={(event) =>
                    setGarde((g) => ({ ...g, [index]: event.target.checked }))
                  }
                  className="mt-1 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">{seance.titre}</span>
                    <span className="rounded border border-bordure px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-texte-discret">
                      {LIBELLES_DIMENSION_SEANCE[seance.dimension]}
                    </span>
                    <span className="chiffres text-[0.6875rem] text-texte-discret">
                      {seance.dureeCibleMin} min
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-texte-attenue">
                    {seance.consigne}
                  </span>
                  <span className="mt-1 block text-[0.6875rem] text-texte-discret">
                    {DESCRIPTIONS_DIMENSION_SEANCE[seance.dimension]} · Compétences :{" "}
                    {seance.codes.join(", ")}
                  </span>
                </span>
              </label>
            </section>
            );
          })}

          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              variante="principal"
              onClick={() => void creer(etat.protocole, etat.candidats)}
              disabled={retenues === 0}
            >
              Planifier {retenues} séance{retenues > 1 ? "s" : ""}
            </Bouton>
          </div>
          <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
            Les séances sont planifiées aussitôt dans votre bureau. Les exercices
            manquants sont écrits par le tuteur au démarrage de chaque séance —
            chacun reste relisible et modifiable sur sa fiche ; aucune mesure
            n’existe avant vos corrections validées.
          </p>
        </div>
      )}

      {etat.phase === "ecriture" && (
        <div className="space-y-4">
          {etat.progression && (
            <div className="py-2">
              <ChargementGeneration
                progressionServeur={etat.progression}
                etapes={["Planification des séances retenues — les exercices manquants naîtront au démarrage."]}
                dureeAsymptoteSec={4}
              />
            </div>
          )}

          {!etat.progression && (
            <>
              <BandeauInfo ton="succes" taille="compacte">
                <p>
                  {etat.crees.length} séance(s) planifiée(s) dans votre bureau et
                  inscrite(s) au journal du cours. Les exercices manquants seront
                  générés par le tuteur au démarrage de chaque séance.
                </p>
              </BandeauInfo>
              {etat.crees.length > 0 && (
                <ul className="space-y-1">
                  {etat.crees.map(({ seanceId, titre }) => (
                    <li key={seanceId}>
                      <a
                        href={`/seances?session=${encodeURIComponent(seanceId)}`}
                        className="text-sm text-primaire hover:underline"
                      >
                        {titre}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {etat.avertissements.length > 0 && (
                <div className="space-y-1">
                  {etat.avertissements.map((avertissement, index) => (
                    <p key={index} className="text-xs leading-relaxed text-alerte">
                      {avertissement}
                    </p>
                  ))}
                </div>
              )}
              <Bouton variante="principal" onClick={fermer}>
                Terminer
              </Bouton>
            </>
          )}
        </div>
      )}
    </Modale>
  );
}
