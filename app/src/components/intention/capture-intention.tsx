"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { Bouton, cx } from "@/components/ui/primitives";
import {
  IconeAmpoule,
  IconeCompetences,
  IconeExercices,
  IconeFleche,
  IconeNote,
  IconeProjet,
} from "@/components/ui/icones";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import { enregistrerBesoinCourtTerme } from "@/lib/store/objectifs-actions";
import {
  BESOIN_MAX,
  analyserDemandeReferentiel,
  besoinValide,
  demandeSeanceSansSujet,
  urlComposition,
  type ActionIntention,
  type TraductionIntention,
} from "@/lib/domain/intention";

import type { ContexteIntentionType } from "./contexte-intention";

/**
 * Le point d'entrée unique de création.
 *
 * Il remplace treize modales qui demandaient chacune de choisir un **objet** —
 * compétence, thème, exercice, séance, note, projet — avant de pouvoir dire
 * quoi que ce soit. Ici on décrit un besoin, et le moteur choisit l'objet.
 *
 * Ce composant n'exécute jamais directement : il **oriente** vers une surface
 * qui existait déjà. Un travail part au compositeur de séance, une ressource
 * passe par la création de note, une extension de référentiel ouvre la
 * proposition de branche avec son sujet pré-rempli. Aucun nouveau chemin
 * d'écriture n'est ouvert ici, et la validation humaine reste là où elle était.
 */

const PLACEHOLDER = "Ex. j'ai un contrôle sur les stocks vendredi et je bloque sur le calcul de coût";
const PLACEHOLDER_DOMAINE =
  "Ex. La gestion financière d’entreprise, la physique quantique, l'espagnol des affaires...";

type Phase = "saisie" | "traduction" | "proposition";

const LIBELLES_ACTION: Record<ActionIntention["genre"], string> = {
  travail: "Séance d’entraînement",
  projet: "Parcours projet",
  note: "Fiche de référence",
  referentiel: "Intégration au référentiel",
  clarification: "Question de précision",
};

const CTA_ACTION: Record<ActionIntention["genre"], string> = {
  travail: "Préparer la séance",
  projet: "Construire le projet",
  note: "Créer la fiche",
  referentiel: "Préparer l’intégration",
  clarification: "Répondre à la question",
};

const RESULTAT_ACTION: Record<ActionIntention["genre"], string> = {
  travail: "Une séance sera préparée à partir des compétences repérées.",
  projet: "Le parcours de projet reprendra ton besoin et reciblera les compétences utiles.",
  note: "Une fiche sera créée dans ton Atelier avec ton besoin comme contexte.",
  referentiel: "Le sujet sera situé avant qu’une éventuelle compétence soit proposée.",
  clarification: "Rien ne sera créé avant ta réponse.",
};

const ICONE_PAR_GENRE: Record<ActionIntention["genre"], React.ComponentType<{ className?: string }>> = {
  travail: IconeExercices,
  projet: IconeProjet,
  note: IconeNote,
  referentiel: IconeCompetences,
  clarification: IconeAmpoule,
};

const SUGGESTIONS_RAPIDES = [
  {
    libelle: "Séance express 15 min",
    prompt: "Je veux faire une séance courte de 15 minutes pour m'entraîner",
    Icone: IconeExercices,
  },
  {
    libelle: "Réviser mes points faibles",
    prompt: "Je veux retravailler mes compétences les plus fragiles",
    Icone: IconeCompetences,
  },
  {
    libelle: "Créer une fiche de cours",
    prompt: "Je souhaite créer une fiche de synthèse pour résumer mon cours",
    Icone: IconeNote,
  },
  {
    libelle: "Lancer un projet",
    prompt: "J'aimerais démarrer un nouveau projet pratique",
    Icone: IconeProjet,
  },
] as const;

function domaineMentionne(
  besoin: string,
  domaines: { nom: string }[],
): string | undefined {
  const normaliser = (valeur: string) =>
    valeur
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const texte = normaliser(besoin);
  return domaines.find((domaine) => texte.includes(normaliser(domaine.nom)))?.nom;
}

export function CaptureIntention({
  compteId,
  onFermer,
  besoinInitial = "",
  domainesExistants = [],
  contexte = "general",
}: {
  compteId: string;
  onFermer: () => void;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
  /**
   * Le besoin est déjà écrit ailleurs — une ligne de la marge du cahier.
   *
   * Le retaper serait redemander ce qui vient d'être dit. Même geste que
   * `sujetInitial` de `ModaleReferentiel` et `intentionInitiale` du parcours de
   * projet, que ce composant passe déjà lui-même.
   *
   * La traduction n'est PAS lancée d'office : une ligne de marge est griffonnée
   * en trois mots, et la relire — voire la compléter — avant de la soumettre au
   * moteur donne une bien meilleure traduction qu'une phrase jetée telle quelle.
   */
  besoinInitial?: string;
  contexte?: ContexteIntentionType;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("saisie");
  const [besoin, setBesoin] = useState(besoinInitial);
  const [traduction, setTraduction] = useState<TraductionIntention | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enExecution, setEnExecution] = useState(false);
  const [competenceDemande, setCompetenceDemande] = useState<{
    sujet: string;
    intitules: string[];
    domaine?: string;
  } | null>(null);

  /*
   * L'extension du référentiel passe la main à la proposition de référentiel
   * complet, pas à la branche unique : « le stoïcisme » se découpe en thèmes,
   * et le même chemin traite aussi bien un sujet étroit — c'est le prompt qui
   * décide du découpage. Un seul chemin d'extension, donc, là où le tableau de
   * bord en offrait un second par sa carte de pilotage.
   */
  const [sujetBranche, setSujetBranche] = useState<string | null>(null);

  /** Le parcours de projet, qui recible lui-même les compétences depuis la phrase. */
  const [projetDemande, setProjetDemande] = useState<string | null>(null);

  const abandonRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  const traduire = useCallback(async (besoinA = besoin) => {
    const demande = besoinA.trim();
    if (!besoinValide(demande)) return;
    setPhase("traduction");
    setProgression(null);
    setErreur(null);

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/intention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          besoin: demande,
          contexte,
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La traduction n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
        );
        setPhase("saisie");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const evenements = tampon.split("\n\n");
        tampon = evenements.pop() ?? "";

        for (const bloc of evenements) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();

          if (type === "proposition" && donnees) {
            const parsed = JSON.parse(donnees) as { traduction: TraductionIntention };
            setTraduction(parsed.traduction);
            setPhase("proposition");
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            setErreur(parsed.message);
            setPhase("saisie");
          } else if (type === "proposition-rejetee" && donnees) {
            /*
             * Le tuteur a bien appelé l'outil, mais sa sortie a été refusée —
             * un travail sans compétence désignée, un projet sans sujet. Le
             * message du moteur dit ce qui a été écarté ; l'écran l'affichait
             * jusqu'ici comme une absence de réponse, ce qui n'est pas la même
             * panne et ne se corrige pas de la même façon.
             */
            const parsed = JSON.parse(donnees) as { message?: string };
            if (parsed.message?.trim()) setErreur(parsed.message.trim());
          } else if (type === "proposition-en-cours") {
            setProgression("Le moteur choisit l'action qui répond à ton besoin…");
          }
        }
      }
    } catch (cause) {
      const estAbandon =
        abandon.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError");
      if (!estAbandon) {
        setErreur("Le tuteur n’a pas répondu. Vérifie sa configuration puis relance la traduction.");
        setPhase("saisie");
      }
    }
  }, [besoin, compteId]);

  useEffect(() => {
    if (besoinInitial && besoinValide(besoinInitial.trim())) {
      const minuterie = window.setTimeout(() => {
        void traduire(besoinInitial.trim());
      }, 0);
      return () => window.clearTimeout(minuterie);
    }
  }, [besoinInitial, traduire]);

  /**
   * Exécute l'action retenue.
   *
   * Chaque genre rejoint une surface existante. La note est le seul cas écrit
   * ici, parce qu'elle n'a pas d'écran intermédiaire : la fiche est créée puis
   * ouverte dans l'Atelier, exactement comme le faisait la carte du tableau de
   * bord qu'on retire.
   */
  const executer = useCallback(
    async (action: ActionIntention) => {
      setErreur(null);

      if (contexte === "domaine") {
        setSujetBranche(action.sujet || action.titre || besoin.trim());
        return;
      }

      const demandeReferentiel = analyserDemandeReferentiel(besoin, contexte);
      if (demandeReferentiel.explicite && demandeReferentiel.type === "competence") {
        setCompetenceDemande({
          sujet: besoin.trim(),
          intitules: demandeReferentiel.intitules,
          domaine: domaineMentionne(besoin, domainesExistants),
        });
        return;
      }

      if (demandeReferentiel.type === "domaine" && demandeReferentiel.portee === "large") {
        setSujetBranche(besoin.trim());
        return;
      }

      if (action.genre === "clarification") return;

      if (action.genre === "travail") {
        const seanceSansSujet = demandeSeanceSansSujet(besoin);
        const codes = seanceSansSujet ? [] : action.codes;
        setEnExecution(true);
        try {
          await enregistrerBesoinCourtTerme(besoin, codes);
          onFermer();
          router.push(
            urlComposition(codes, besoin, { sansTheme: seanceSansSujet }),
          );
        } catch (cause) {
          setErreur(cause instanceof Error ? cause.message : "Le besoin n'a pas pu être pris en compte.");
        } finally {
          setEnExecution(false);
        }
        return;
      }

      if (action.genre === "projet") {
        setProjetDemande(action.sujet || action.titre);
        return;
      }

      if (action.genre === "referentiel") {
        // La proposition de branches doit recevoir la formulation originale :
        // elle contient parfois un nombre de domaines, une granularité ou un
        // nombre de compétences que le titre de l’action résumée perdrait.
        setSujetBranche(besoin.trim());
        return;
      }

      setEnExecution(true);
      try {
        const fiche = await creerNoteAction(
          "support",
          FORMATS_PAR_ROLE.support[0].valeur,
          action.titre,
          // Le besoin exprimé EST le contexte de la fiche : le retaper serait
          // redemander ce qui vient d'être dit.
          { contexte: besoin.trim(), domaine: "transversal" },
        );
        onFermer();
        router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      } finally {
        setEnExecution(false);
      }
    },
    [besoin, contexte, domainesExistants, onFermer, router],
  );

  function repondreAQuestion(reponse: string) {
    const precision = reponse.trim();
    if (!besoinValide(precision)) return;
    const demande = `${besoin}\nPrécision : ${precision}`.slice(0, BESOIN_MAX);
    setBesoin(demande);
    setTraduction(null);
    void traduire(demande);
  }

  if (projetDemande !== null) {
    return (
      <ParcoursNouveauProjet
        accountId={compteId}
        intentionInitiale={projetDemande}
        onFermer={onFermer}
      />
    );
  }

  if (competenceDemande !== null) {
    return (
      <ModaleCompetence
        compteId={compteId}
        domainesExistants={domainesExistants}
        modeCible="competence"
        domaineInitial={competenceDemande.domaine}
        sujetInitial={competenceDemande.intitules.length === 0 ? competenceDemande.sujet : ""}
        brancheInitiale={
          competenceDemande.intitules.length > 0
            ? {
                domaine: competenceDemande.domaine ?? "",
                prefixe: "",
                description: "",
                justification: "Intitulé repris de ta demande.",
                competences: competenceDemande.intitules.map((intitule) => ({
                  intitule,
                  palier: "fondamentaux",
                  importance: "0.5",
                })),
              }
            : undefined
        }
        onFermer={onFermer}
      />
    );
  }

  if (sujetBranche !== null) {
    return (
      <ModaleReferentiel
        compteId={compteId}
        sujetInitial={sujetBranche}
        demarrageAutomatique
        onFermer={onFermer}
      />
    );
  }

  const estContexteDomaine = contexte === "domaine";

  return (
    <Modale
      titre={estContexteDomaine ? "Quel domaine souhaites-tu ajouter ?" : "De quoi as-tu besoin ?"}
      sousTitre={
        estContexteDomaine
          ? "Décris le domaine ou la discipline. Le système structurera une proposition de compétences pour ton Atelier."
          : "Décris ton objectif ou clique sur une suggestion. Le système choisit l’action appropriée."
      }
      largeur="xl"
      onFermer={onFermer}
      pied={
        phase === "saisie" ? (
          <>
            <Bouton variante="secondaire" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton
              variante="principal"
              onClick={() => void traduire()}
              disabled={!besoinValide(besoin)}
            >
              {estContexteDomaine ? "Structurer le domaine" : "Analyser mon besoin"}
              <IconeFleche className="size-4" />
            </Bouton>
          </>
        ) : phase === "proposition" ? (
          <Bouton
            variante="secondaire"
            onClick={() => {
              setTraduction(null);
              setPhase("saisie");
            }}
          >
            Reformuler
          </Bouton>
        ) : undefined
      }
    >
      {phase === "traduction" && (
        <div className="py-8">
          <ChargementGeneration
            progressionServeur={progression}
            etapes={[
              "Lecture et qualification de ton intention…",
              "Rapprochement avec tes compétences et notes…",
              "Sélection de l'action la plus pertinente…",
              "Finalisation de la proposition…",
            ]}
            dureeAsymptoteSec={5}
            onArreter={() => {
              abandonRef.current?.abort();
              setPhase("saisie");
            }}
          />
        </div>
      )}

      {phase === "saisie" && (
        <div className="space-y-4">
          <div>
            <textarea
              value={besoin}
              onChange={(event) => setBesoin(event.target.value.slice(0, BESOIN_MAX))}
              onKeyDown={(event) => {
                // Entrée valide, Maj+Entrée passe à la ligne : la saisie courante
                // est une phrase, pas un paragraphe.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void traduire();
                }
              }}
              rows={3}
              placeholder={estContexteDomaine ? PLACEHOLDER_DOMAINE : PLACEHOLDER}
              autoFocus
              className="w-full resize-none rounded-xl border border-bordure-controle bg-surface px-3.5 py-3 text-sm outline-none transition-all placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            />
            <div className="mt-1 flex items-center justify-between text-[0.6875rem] text-texte-discret">
              <span>
                {estContexteDomaine
                  ? "Un domaine ou sujet libre, le moteur structurera les branches de compétences"
                  : "Un besoin libre, le moteur choisira le format adapté"}
              </span>
              <span>Entrée pour analyser · Maj+Entrée nouvelle ligne</span>
            </div>
          </div>

          {!estContexteDomaine && (
            <div>
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-attenue">
                Suggestions d’amorçage rapide :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS_RAPIDES.map(({ libelle, prompt, Icone }) => (
                  <button
                    key={libelle}
                    type="button"
                    onClick={() => {
                      setBesoin(prompt);
                      void traduire(prompt);
                    }}
                    className="group flex items-center gap-2.5 rounded-lg border border-bordure bg-surface-2/60 px-3 py-2 text-left text-xs transition-colors hover:border-primaire/40 hover:bg-primaire-faible/30"
                  >
                    <Icone className="size-4 text-primaire shrink-0 transition-transform group-hover:scale-110" />
                    <span className="font-medium text-texte group-hover:text-primaire">{libelle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {erreur && (
            <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>
          )}
        </div>
      )}

      {phase === "proposition" && traduction && (
        <div className="space-y-4">
          <p className="text-sm text-texte-attenue">
            Voici la traduction de ton besoin. Vérifie le résultat et l’action proposée avant de
            lancer quoi que ce soit.
          </p>
          {traduction.action.genre === "clarification" ? (
            <QuestionClarification
              action={traduction.action}
              enExecution={enExecution}
              onRepondre={repondreAQuestion}
            />
          ) : (
            <PropositionPrincipale
              action={traduction.action}
              enExecution={enExecution}
              onExecuter={() => void executer(traduction.action)}
            />
          )}

          {traduction.alternatives.length > 0 && (
            <div className="pt-1">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-2">
                Autres pistes possibles
              </p>
              <div className="grid gap-2">
                {traduction.alternatives.map((alternative, index) => {
                  const IconeAlt = ICONE_PAR_GENRE[alternative.genre] ?? IconeAmpoule;
                  return (
                    <button
                      key={`${alternative.genre}-${index}`}
                      type="button"
                      disabled={enExecution}
                      onClick={() => void executer(alternative)}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35 disabled:opacity-50"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-surface text-texte-discret group-hover:text-primaire">
                          <IconeAlt className="size-3" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-texte group-hover:text-primaire">{alternative.titre}</span>
                          <span className="mt-0.5 block text-xs text-texte-discret">
                            {LIBELLES_ACTION[alternative.genre]} · {alternative.pourquoi}
                          </span>
                        </div>
                      </div>
                      <IconeFleche className="mt-1 size-3.5 shrink-0 text-texte-discret group-hover:text-primaire group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {erreur && (
            <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>
          )}
        </div>
      )}

    </Modale>
  );
}

function PropositionPrincipale({
  action,
  enExecution,
  onExecuter,
}: {
  action: ActionIntention;
  enExecution: boolean;
  onExecuter: () => void;
}) {
  const IconeGenre = ICONE_PAR_GENRE[action.genre] ?? IconeAmpoule;

  return (
    <div className="rounded-xl border border-primaire/40 bg-primaire-faible/25 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primaire/15 text-primaire">
          <IconeGenre className="size-3.5" />
        </span>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
          {LIBELLES_ACTION[action.genre]}
        </span>
      </div>

      <h3 className="mt-2.5 font-serif text-lg sm:text-xl font-medium tracking-tight text-texte">
        {action.titre}
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-texte-attenue leading-relaxed">{action.pourquoi}</p>

      {action.codes.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-primaire font-medium">
          <IconeCompetences className="size-3.5 shrink-0" />
          <span>
            {action.codes.length} compétence{action.codes.length > 1 ? "s" : ""} de ton Atelier mobilisée{action.codes.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="mt-3.5 rounded-lg border border-primaire/20 bg-surface/60 p-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
          Ce qui va se passer
        </p>
        <p className="mt-1 text-xs sm:text-sm text-texte-attenue">{RESULTAT_ACTION[action.genre]}</p>
      </div>

      <Bouton
        variante="principal"
        onClick={onExecuter}
        enChargement={enExecution}
        className={cx("mt-4 w-full sm:w-auto", enExecution && "pointer-events-none")}
      >
        {CTA_ACTION[action.genre]}
        <IconeFleche className="size-4" />
      </Bouton>
    </div>
  );
}

function QuestionClarification({
  action,
  enExecution,
  onRepondre,
}: {
  action: ActionIntention;
  enExecution: boolean;
  onRepondre: (reponse: string) => void;
}) {
  const [reponse, setReponse] = useState("");

  return (
    <div className="rounded-xl border border-primaire/40 bg-primaire-faible/25 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primaire/15 text-primaire">
          <IconeAmpoule className="size-3.5" />
        </span>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
          Question de précision
        </span>
      </div>
      <p className="mt-2.5 font-serif text-lg font-medium text-texte">{action.sujet || action.titre}</p>
      <p className="mt-1 text-xs sm:text-sm text-texte-attenue leading-relaxed">{action.pourquoi}</p>
      <textarea
        value={reponse}
        onChange={(event) => setReponse(event.target.value.slice(0, 300))}
        rows={2}
        placeholder="Réponds en quelques mots…"
        className="mt-3.5 w-full resize-none rounded-xl border border-bordure-controle bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primaire"
      />
      <Bouton
        variante="principal"
        onClick={() => onRepondre(reponse)}
        disabled={!besoinValide(reponse) || enExecution}
        enChargement={enExecution}
        className="mt-3"
      >
        Répondre
        <IconeFleche className="size-4" />
      </Bouton>
    </div>
  );
}
