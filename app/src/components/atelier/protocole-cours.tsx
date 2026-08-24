"use client";

/**
 * Le protocole de traitement d'un cours (ADR-130).
 *
 * Deux pièces, et une frontière nette entre elles :
 *
 * - **Le panneau** est la vue dérivée : les séances nées du protocole (lues
 *   dans `sessions` via `blueprint.origine`, jamais recopiées) et le journal
 *   des intentions datées. Il n'affiche que ce qui existe déjà ailleurs.
 * - **La modale** est le geste : concevoir le plan (intention déclarée +
 *   PDF + référentiel → tuteur), le relire case par case, puis — et seulement
 *   alors — créer les séances, une par une, avec génération des exercices
 *   manquants (décision ADR-130 : la personne encaisse la commande au tuteur
 *   d'un coup, la relecture fine des exercices reste possible après coup sur
 *   chaque fiche, et la barrière qualité demeure la validation humaine des
 *   corrections).
 *
 * Le tuteur produit ici du contenu, jamais une mesure : le plan ne pré-note
 * rien, et les dimensions sont des intentifs de séance, pas des états.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
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
import {
  enregistrerProtocoleAction,
  preparerSeanceProtocoleAction,
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

export function ProtocoleCoursPanel({  ficheId,
  compteId,
  trace = { seances: [], journal: [] },
  pdfPresent,
}: {
  ficheId: string;
  compteId: string;
  trace?: TraceProtocole;
  pdfPresent: boolean;
}) {
  const router = useRouter();
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
          disabled={!pdfPresent}
        >
          {planDejaCompose ? "Recomposer le plan de révision" : "Composer le plan de révision"}
        </Bouton>
      </div>

      {!pdfPresent && (
        <p className="mt-3 text-[0.6875rem] text-texte-discret">
          Le protocole part du PDF attaché : déposez-le d’abord dans « Ressource attachée ».
        </p>
      )}

      {trace.seances.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
            Séances de ce cours
          </p>
          <ul className="mt-2 space-y-1.5">
            {trace.seances.map((seance) => (
              <li key={seance.seanceId}>
                <a
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
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

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
  | { phase: "relecture"; protocole: ProtocoleCours }
  | {
      phase: "ecriture";
      progression: string | null;
      crees: { seanceId: string; titre: string }[];
      avertissements: string[];
    };

export function ModaleProtocole({
  ficheId,
  compteId,
  intentionInitiale,
  demarrageAutomatique = false,
  onFermer,
  surTermine,
}: {
  ficheId: string;
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
      await consommerFluxSse(reponse, (type, donnees) => {
        if (type === "protocole") {
          const recu = JSON.parse(donnees) as ProtocoleCours;
          recue = true;
          setGarde(Object.fromEntries(recu.seances.map((_, index) => [index, true])));
          setEtat({ phase: "relecture", protocole: recu });
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
   * L'écriture est séquentielle, séance par séance : chaque préparation peut
   * générer un lot d'exercices (dizaines de secondes), et un échec au milieu
   * doit laisser un bilan lisible au lieu de prétendre que rien n'a eu lieu.
   */
  async function creer(protocole: ProtocoleCours) {
    const retenues = protocole.seances.filter((_, index) => garde[index]);
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
        const resultat = await preparerSeanceProtocoleAction(
          {
            ficheId,
            titre: seance.titre,
            dimension: seance.dimension,
            codes: seance.codes,
            consigne: seance.consigne,
            dureeCibleMin: seance.dureeCibleMin,
          },
          lireConfigTuteur(compteId) ?? undefined,
        );
        crees.push({ seanceId: resultat.seanceId, titre: seance.titre });
        if (resultat.codesSansExercice.length > 0) {
          avertissements.push(
            `« ${seance.titre} » : ${resultat.codesSansExercice.length} compétence(s) sans exercice (${resultat.codesSansExercice.join(", ")}).`,
          );
        }
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

  const retenues = etat.phase === "relecture"
    ? etat.protocole.seances.filter((_, index) => garde[index]).length
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
            <textarea
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

          {etat.protocole.seances.map((seance, index) => (
            <section key={index} className="rounded-md border border-bordure px-3 py-2.5">
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
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              variante="principal"
              onClick={() => void creer(etat.protocole)}
              disabled={retenues === 0}
            >
              Créer {retenues} séance{retenues > 1 ? "s" : ""} et ses exercices
            </Bouton>
          </div>
          <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
            Les séances sont créées planifiées dans votre bureau, avec leurs exercices.
            Chaque exercice reste relisible et modifiable sur sa fiche ; aucune mesure
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
                etapes={["Création des séances et génération des exercices manquants."]}
                dureeAsymptoteSec={25}
              />
            </div>
          )}

          {!etat.progression && (
            <>
              <BandeauInfo ton="succes" taille="compacte">
                <p>
                  {etat.crees.length} séance(s) créée(s) dans votre bureau et inscrite(s)
                  au journal du cours.
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
