"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { consommerFluxSse } from "@/lib/tutor/flux-sse";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import { IconeCalendrier } from "@/components/ui/icones";
import { ModaleEngagement } from "@/components/dashboard/modale-engagement";
import { extraireEcheanceBesoin } from "@/lib/domain/echeance-besoin";
import {
  BESOIN_MAX,
  analyserDemandeReferentiel,
  besoinValide,
  demandeSeanceSansSujet,
  domainePourCodes,
  dureeDeclaree,
  urlComposition,
  type ActionIntention,
  type TraductionIntention,
} from "@/lib/domain/intention";

import type { ContexteIntentionType } from "./contexte-intention";

/**
 * Le point d'entrée unique de création.
 *
 * Il remplace treize modales qui demandaient chacune de choisir un **objet** —
 * compétence, exercice, séance, note, projet — avant de pouvoir dire
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
    libelle: "Créer une fiche de synthèse",
    prompt: "Je souhaite créer une fiche de synthèse pour résumer ce que j'étudie",
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
  /**
   * Ce que le moteur a déjà écrit, avant d'avoir fini.
   *
   * Un appel d'outil n'émet aucun texte : jusqu'ici l'écran restait sur une
   * animation d'attente pendant tout l'appel, quelle qu'en soit la durée. Le
   * genre et le titre arrivent pourtant bien avant la fin. Affichés seuls, ils
   * ne déclenchent rien — aucun bouton d'action n'apparaît tant que la
   * proposition n'a pas passé la validation terminale.
   */
  const [apercu, setApercu] = useState<{ genre?: string; titre?: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /**
   * Raison d'un cadrage serveur (`forcer*`) qui a orienté la traduction.
   * Non bloquant : la proposition reste affichée, mais la personne sait
   * pourquoi elle ne ressemble pas mot pour mot à sa demande.
   */
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [enExecution, setEnExecution] = useState(false);
  const [competenceDemande, setCompetenceDemande] = useState<{
    sujet: string;
    intitules: string[];
    domaine?: string;
  } | null>(null);

  /*
   * L'extension du référentiel passe la main à la proposition de référentiel
   * complet, pas à la branche unique : « le stoïcisme » se découpe en domaines,
   * et le même chemin traite aussi bien un sujet étroit — c'est le prompt qui
   * décide du découpage. Un seul chemin d'extension, donc, là où le tableau de
   * bord en offrait un second par sa carte de pilotage.
   *
   * Le message optionnel est la micro-copie du résultat : quand le tuteur a
   * choisi `referentiel`, la modale s'ouvre sur « Voici une première
   * organisation — tu pourras tout ajuster », qui replace la proposition comme
   * un point de départ relisible.
   */
  const [sujetBranche, setSujetBranche] = useState<{
    sujet: string;
    message?: string;
  } | null>(null);

  /** Le parcours de projet, qui recible lui-même les compétences depuis la phrase. */
  const [projetDemande, setProjetDemande] = useState<string | null>(null);

  /*
   * Date détectée dans le besoin (chantier « fait daté ») : une PROPOSITION,
   * jamais une écriture. Ignorer ne laisse aucune trace — le comportement
   * actuel reste le défaut, et seul un clic explicite ouvre le formulaire
   * d'engagement pré-rempli.
   */
  const [echeanceDemandee, setEcheanceDemandee] = useState<{
    libelle: string;
    echeanceLe: string;
  } | null>(null);
  const echeanceDetectee =
    phase === "proposition" ? extraireEcheanceBesoin(besoin) : undefined;

  /**
   * Rattachement proposé de la fiche (D1) : quand la traduction vise des codes,
   * leur domaine commun est PROPOSÉ comme rattachement — jamais dérivé en
   * silence. Décoché par défaut : sans confirmation explicite, la fiche reste
   * transversale.
   */
  const [rattacherDomaine, setRattacherDomaine] = useState(false);
  const rattachementPropose = useMemo(() => {
    if (traduction?.action.genre !== "note") return null;
    return domainePourCodes(traduction.action.codes, domainesExistants);
  }, [traduction, domainesExistants]);

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
    setApercu(null);
    setRattacherDomaine(false);
    setErreur(null);
    setAvertissement(null);

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

      await consommerFluxSse(reponse, (type, donnees) => {
        if (type === "proposition") {
          const parsed = JSON.parse(donnees) as { traduction: TraductionIntention };
          setTraduction(parsed.traduction);
          setPhase("proposition");
        } else if (type === "erreur") {
          const parsed = JSON.parse(donnees) as { message: string };
          setErreur(parsed.message);
          setPhase("saisie");
        } else if (type === "avertissement") {
          /*
           * Un cadrage serveur a orienté la traduction. Il est annoncé avant
           * la proposition et reste visible à côté d'elle — la contradiction
           * silencieuse se vivait comme une incompréhension du tuteur.
           */
          try {
            const parsed = JSON.parse(donnees) as { message?: string };
            if (parsed.message?.trim()) setAvertissement(parsed.message.trim());
          } catch {
            /* ignorer erreur json */
          }
        } else if (type === "proposition-rejetee") {
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
        } else if (type === "proposition-partielle") {
          /*
           * Aperçu d'affichage uniquement : il ne remplit jamais `traduction`
           * et ne change pas de phase. La proposition exécutable reste celle
           * qui a passé `validerTraductionIntention` côté serveur.
           */
          try {
            const parsed = JSON.parse(donnees) as { genre?: string; titre?: string };
            if (parsed.genre || parsed.titre) setApercu(parsed);
          } catch {
            /* ignorer erreur json */
          }
        }
      });
    } catch (cause) {
      const estAbandon =
        abandon.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError");
      if (!estAbandon) {
        setErreur("Le tuteur n’a pas répondu. Vérifie sa configuration puis relance la traduction.");
        setPhase("saisie");
      }
    }
  }, [besoin, compteId, contexte]);

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
        setSujetBranche({ sujet: action.sujet || action.titre || besoin.trim() });
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
        setSujetBranche({ sujet: besoin.trim() });
        return;
      }

      if (action.genre === "clarification") return;

      if (action.genre === "travail") {
        const seanceSansSujet = demandeSeanceSansSujet(besoin);
        const codes = seanceSansSujet ? [] : action.codes;
        // Le besoin reste une intention déclarée : il ouvre la composition et
        // n'est converti en aucun fait persistant (invariant intention). La
        // durée explicite de la phrase voyage avec elle — « 15 minutes » doit
        // ouvrir le compositeur sur 15, pas sur son défaut.
        setEnExecution(true);
        try {
          onFermer();
          router.push(
            urlComposition(codes, besoin, {
              sansTheme: seanceSansSujet,
              temps: dureeDeclaree(besoin),
            }),
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
        setSujetBranche({
          sujet: besoin.trim(),
          message: "Voici une première organisation — tu pourras tout ajuster.",
        });
        return;
      }

      setEnExecution(true);
      try {
        /*
         * Le rattachement au domaine des compétences visées est PROPOSÉ dans la
         * carte et CONFIRMÉ par la case cochée — jamais dérivé en silence.
         * Sans confirmation, la fiche reste transversale : le comportement par
         * défaut ne bouge pas (D1). Une alternative exécutée d'un clic reste
         * transversale : sa case n'a jamais été montrée.
         */
        const propose =
          action.genre === "note" && action === traduction?.action
            ? rattachementPropose
            : null;
        const domaineFiche =
          rattacherDomaine && propose ? propose.id : "transversal";
        const fiche = await creerNoteAction(
          "support",
          FORMATS_PAR_ROLE.support[0].valeur,
          action.titre,
          // Le besoin exprimé EST le contexte de la fiche : le retaper serait
          // redemander ce qui vient d'être dit.
          { contexte: besoin.trim(), domaine: domaineFiche },
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
    [
      besoin,
      contexte,
      rattachementPropose,
      domainesExistants,
      onFermer,
      rattacherDomaine,
      router,
      traduction,
    ],
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

  /*
   * La personne a cliqué « Créer un engagement » : le formulaire pré-rempli
   * remplace la capture, même motif que le parcours projet ci-dessus. Le
   * ciblage de compétences n'est pas proposé ici — ce chemin assisté ne porte
   * que le fait daté ; la déclaration détaillée reste l'entrée du tableau
   * de bord.
   */
  if (echeanceDemandee !== null) {
    return (
      <ModaleEngagement
        competences={[]}
        initial={{
          type: "examen",
          libelle: echeanceDemandee.libelle,
          echeanceLe: echeanceDemandee.echeanceLe,
        }}
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
        sujetInitial={sujetBranche.sujet}
        demarrageAutomatique
        guideEtape={sujetBranche.message}
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
            /*
             * 25 s, comme le budget serveur (`DELAI_TRADUCTION_MS`). L'ancien
             * 5 s décrivait un appel qui en prenait couramment beaucoup plus :
             * une barre qui ment use plus vite qu'une barre lente.
             */
            dureeAsymptoteSec={25}
            onArreter={() => {
              abandonRef.current?.abort();
              setPhase("saisie");
            }}
          />
          {apercu && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-bordure bg-surface-2/60 p-3 text-center">
              {apercu.genre && LIBELLES_ACTION[apercu.genre as ActionIntention["genre"]] && (
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
                  {LIBELLES_ACTION[apercu.genre as ActionIntention["genre"]]}
                </p>
              )}
              {apercu.titre && (
                <p className="mt-1 font-serif text-sm text-texte">{apercu.titre}</p>
              )}
              <p className="mt-1.5 text-[0.6875rem] text-texte-discret">
                Lecture en cours — rien n’est encore validé.
              </p>
            </div>
          )}
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
          {avertissement && (
            <div className="rounded-lg border border-alerte/40 bg-alerte-faible/40 px-3 py-2 text-xs text-texte">
              <p className="font-semibold text-alerte">Ta demande a été recadrée</p>
              <p className="mt-0.5 leading-relaxed text-texte-attenue">{avertissement}</p>
            </div>
          )}
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
              rattachementPropose={
                traduction.action.genre === "note" ? rattachementPropose : null
              }
              rattacherDomaine={rattacherDomaine}
              surRattachementChange={setRattacherDomaine}
              onExecuter={() => void executer(traduction.action)}
            />
          )}

          {echeanceDetectee && traduction.action.genre !== "clarification" && (
            /*
             * Une date a été lue dans le besoin. Bandeau discret, aucune
             * écriture automatique : le tuteur propose, la personne valide.
             * Ignorer ne laisse aucune trace.
             */
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bordure bg-surface-2/60 px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-texte-attenue">
                <IconeCalendrier className="size-3.5 shrink-0 text-texte-discret" />
                <span>
                  Une échéance a été repérée dans ton besoin (le{" "}
                  {echeanceDetectee.split("-").reverse().join("/")}).
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEcheanceDemandee({
                    libelle: besoin.trim().slice(0, 80),
                    echeanceLe: echeanceDetectee,
                  })
                }
                className="shrink-0 rounded-md border border-bordure bg-surface px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/40 hover:text-primaire cursor-pointer"
              >
                Garder cette date ? Créer un engagement
              </button>
            </div>
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
  rattachementPropose,
  rattacherDomaine,
  surRattachementChange,
  onExecuter,
}: {
  action: ActionIntention;
  enExecution: boolean;
  /** Domaine proposé pour la fiche, lu dans les codes visés. `null` : rien à proposer. */
  rattachementPropose?: { id: string; nom: string; prefixe: string } | null;
  rattacherDomaine: boolean;
  surRattachementChange: (valeur: boolean) => void;
  onExecuter: () => void;
}) {
  const IconeGenre = ICONE_PAR_GENRE[action.genre] ?? IconeAmpoule;
  const montrerRattachement =
    action.genre === "note" && Boolean(rattachementPropose) && !enExecution;

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

      {montrerRattachement && (
        /*
         * Rattachement PROPOSÉ, jamais dérivé : la case part décochée et la
         * fiche ne quitte le transversal que sur une confirmation explicite.
         */
        <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-bordure bg-surface/60 p-3">
          <input
            type="checkbox"
            checked={rattacherDomaine}
            onChange={(e) => surRattachementChange(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span className="text-xs text-texte-attenue">
            Rattacher cette fiche au domaine{" "}
            <span className="font-medium text-texte">« {rattachementPropose?.nom} »</span> — sinon
            elle restera transversale.
          </span>
        </label>
      )}

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
