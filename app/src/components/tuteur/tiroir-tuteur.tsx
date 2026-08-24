"use client";

/**
 * Tiroir du tuteur — le chat en panneau coulissant (lot 3).
 *
 * Le tuteur n'est plus une destination de navigation : il devient un tiroir,
 * ouvert là où poser une question a un sens — pendant une tentative (workspace
 * `/seances`), ou depuis l’Atelier.
 *
 * Le tiroir garde l'énoncé visible pendant la demande d'aide.
 *
 * La conversation est conservée dans `sessionStorage` par compte
 * (`cleParCompte`, ADR-029).
 *
 * Depuis le 07/08/2026 le tiroir a aussi un déclencheur **flottant**, monté
 * globalement (`tuteur-global.tsx`) : le bouton rond en bas à droite ouvre le
 * panneau sans faire perdre la page en cours. Il est
 * contextuel reste disponible depuis le nouveau hub Atelier.
 */

import { useCallback, useState, useTransition } from "react";
import { ChatTuteur } from "@/components/tuteur/chat";
import type { EtatContexteTuteur } from "@/lib/tutor/etat-contexte";
import { classesOutilSeance, classesLienBouton, cx } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { IconeMessage } from "@/components/ui/icones";
import type {
  CalibrageModale,
  CompetenceModale,
} from "@/lib/domain/proprietes-generation";
import {
  chargerDonneesTuteurGlobal,
  type DonneesTuteurGlobal,
} from "@/lib/tutor/actions";

const CLASSES_FLOTTANT = cx(
  "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[var(--superposition-barre)] flex size-12 items-center justify-center lg:bottom-6 lg:right-6",
  "rounded-full bg-primaire text-primaire-contraste shadow-lg",
  "transition-transform hover:scale-105 active:scale-95",
  "focus:outline-none focus:ring-2 focus:ring-primaire focus:ring-offset-2",
);

export interface ActionContextuelleTuteur {
  libelle: string;
  amorce: string;
}

export function TiroirTuteur({
  etatInitial: etatInitialProp,
  competenceCiblee,
  amorce,
  exerciceCible,
  codesCompetences: codesCompetencesProp,
  compteId: compteIdProp,
  domainesExistants: domainesExistantsProp,
  competencesModale: competencesModaleProp,
  calibragesModale: calibragesModaleProp,
  libelle = "Demander de l'aide au tuteur",
  declencheur = "bouton",
  actionsContextuelles,
  indicesMasques,
}: {
  etatInitial?: EtatContexteTuteur;
  competenceCiblee?: string;
  /** Brouillon explicite à placer dans la saisie, sans envoi automatique. */
  amorce?: string;
  exerciceCible?: string;
  codesCompetences?: string[];
  compteId?: string;
  /** Domaines existants — le chat ouvre la modale de compétences in situ. */
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
  /**
   * Compétences actives et calibrages — le chat ouvre aussi la modale
   * d'exercice in situ (audit §2.3).
   */
  competencesModale?: CompetenceModale[];
  calibragesModale?: Record<string, CalibrageModale>;
  libelle?: string;
  /**
   * `flottant` : bouton rond global. `bouton` : bouton en ligne.
   * `barre-contextuelle` : actions directes. `intercalaire` : la languette du
   * cahier, pour la rangée d'outils d'une séance en cours.
   */
  declencheur?: "bouton" | "flottant" | "barre-contextuelle" | "outil";
  /** Liste d'actions prédéfinies à afficher en barre contextuelle. */
  actionsContextuelles?: ActionContextuelleTuteur[];
  /**
   * Mode épreuve : masque l'entrée « Donne-moi un indice » du chat. L'option
   * ne traverse pas les protocoles du tuteur (elle n'est pas serveur) — c'est
   * le geste d'interface dédié qui disparaît, pendant que la correction au
   * bilan reste inchangée.
   */
  indicesMasques?: boolean;
}) {
  /*
   * Fermer le tiroir n'interrompt plus la génération : la modale reste montée
   * mais masquée (`masquee`), le flux SSE poursuit en arrière-plan, et la
   * conversation se retrouve telle quelle à la réouverture. Le bouton porte un
   * point pulsant tant que le tuteur écrit, pour qu'une fenêtre fermée ne
   * devienne pas une réponse perdue de vue.
   */
  const [ouvert, setOuvert] = useState(false);
  const [dejaOuvert, setDejaOuvert] = useState(false);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [amorceCourante, setAmorceCourante] = useState<string | undefined>(amorce);
  const [donneesLazy, setDonneesLazy] = useState<DonneesTuteurGlobal | null>(null);
  const [enChargement, startTransition] = useTransition();
  const surEnCoursChange = useCallback((enCours: boolean) => {
    setGenerationEnCours(enCours);
  }, []);

  const flottant = declencheur === "flottant";
  const barre = declencheur === "barre-contextuelle";
  const besoinLazy = !etatInitialProp;

  function ouvrirAvecAmorce(texteAmorce?: string) {
    setAmorceCourante(texteAmorce ?? amorce);
    setOuvert(true);
    setDejaOuvert(true);
    if (besoinLazy && !donneesLazy) {
      startTransition(async () => {
        try {
          const res = await chargerDonneesTuteurGlobal();
          setDonneesLazy(res);
        } catch (e) {
          console.error("Erreur chargement tuteur global:", e);
        }
      });
    }
  }

  const etatInitial = etatInitialProp ?? donneesLazy?.etatInitial;
  const codesCompetences = codesCompetencesProp ?? donneesLazy?.codesCompetences ?? [];
  const compteId = compteIdProp ?? donneesLazy?.compteId ?? "";
  const domainesExistants = domainesExistantsProp ?? donneesLazy?.domainesExistants ?? [];
  const competencesModale = competencesModaleProp ?? donneesLazy?.competencesModale ?? [];
  const calibragesModale = calibragesModaleProp ?? donneesLazy?.calibragesModale ?? {};

  return (
    <>
      {barre ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-bordure/60">
          <span className="text-[0.6875rem] font-medium text-texte-attenue mr-0.5">
            Aide du Tuteur :
          </span>
          {actionsContextuelles && actionsContextuelles.length > 0 ? (
            actionsContextuelles.map((act, i) => (
              <button
                key={i}
                type="button"
                onClick={() => ouvrirAvecAmorce(act.amorce)}
                className="inline-flex items-center gap-1 rounded-md border border-bordure bg-surface px-2 py-1 text-[0.6875rem] text-texte-attenue transition-colors hover:border-primaire/40 hover:bg-primaire-faible hover:text-primaire"
              >
                <span>{act.libelle}</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={() => ouvrirAvecAmorce(amorce)}
              className={classesLienBouton("secondaire", "petite")}
            >
              {libelle}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ouvrirAvecAmorce(amorce)}
          aria-label={flottant ? libelle : undefined}
          title={
            flottant
              ? !ouvert && generationEnCours
                ? "Le tuteur rédige sa réponse…"
                : libelle
              : undefined
          }
          data-tour={flottant ? "tuteur-flottant" : undefined}
          className={
            flottant
              ? CLASSES_FLOTTANT
              : declencheur === "outil"
                ? classesOutilSeance(ouvert)
                : classesLienBouton("secondaire", "petite")
          }
        >
          {flottant ? (
            <>
              <IconeMessage className="size-5" />
              {!ouvert && generationEnCours && (
                <span
                  className="absolute right-0 top-0 size-3 animate-pulse rounded-full bg-succes ring-2 ring-surface"
                  aria-hidden
                />
              )}
              <span className="sr-only">
                {!ouvert && generationEnCours ? " (le tuteur rédige une réponse)" : ""}
              </span>
            </>
          ) : (
            libelle
          )}
        </button>
      )}

      {dejaOuvert && (
        <Modale
          titre="Tuteur IA"
          sousTitre="Il reçoit les protocoles du système et l'état réel de vos compétences."
          largeur="md"
          position="laterale"
          masquee={!ouvert}
          onFermer={() => setOuvert(false)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {etatInitial ? (
              <ChatTuteur
                key={exerciceCible ?? "general"}
                etatInitial={etatInitial}
                competenceCiblee={competenceCiblee}
                amorce={amorceCourante ?? amorce}
                exerciceCible={exerciceCible}
                codesCompetences={codesCompetences}
                compteId={compteId}
                domainesExistants={domainesExistants}
                competencesModale={competencesModale}
                calibragesModale={calibragesModale}
                surEnCoursChange={surEnCoursChange}
                indicesMasques={indicesMasques}
              />
            ) : enChargement ? (
              <div className="flex h-64 items-center justify-center p-6 text-center text-xs text-texte-discret">
                <div className="space-y-2">
                  <div className="size-5 animate-spin rounded-full border-2 border-primaire border-t-transparent mx-auto" />
                  <p>Préparation du contexte pédagogique…</p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-danger">
                Impossible de charger le contexte du tuteur.
              </div>
            )}
          </div>
        </Modale>
      )}
    </>
  );
}
