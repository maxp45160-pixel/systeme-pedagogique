"use client";

/**
 * Tiroir du tuteur — le chat en panneau coulissant (lot 3).
 *
 * Le tuteur n'est plus une destination de navigation : il devient un tiroir,
 * ouvert là où poser une question a un sens — pendant une tentative (workspace
 * `/seances`), ou sur une fiche compétence (`/competences/[code]`).
 *
 * Le tiroir garde l'énoncé visible pendant la demande d'aide.
 *
 * La conversation est conservée dans `sessionStorage` par compte
 * (`cleParCompte`, ADR-029).
 *
 * Depuis le 07/08/2026 le tiroir a aussi un déclencheur **flottant**, monté
 * globalement (`tuteur-global.tsx`) : le bouton rond en bas à droite ouvre le
 * panneau sans faire perdre la page en cours. Il est
 * masqué là où une entrée contextuelle, mieux renseignée, existe déjà.
 */

import { useState } from "react";
import { ChatTuteur, type EtatContexteTuteur } from "@/components/tuteur/chat";
import { classesLienBouton, cx } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { IconeMessage } from "@/components/ui/icones";
import type {
  CalibrageModale,
  CompetenceModale,
} from "@/components/exercices/proprietes-generation";

const CLASSES_FLOTTANT = cx(
  "fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center lg:bottom-6 lg:right-6",
  "rounded-full bg-primaire text-primaire-contraste shadow-lg",
  "transition-transform hover:scale-105 active:scale-95",
  "focus:outline-none focus:ring-2 focus:ring-primaire focus:ring-offset-2",
);

export interface ActionContextuelleTuteur {
  libelle: string;
  amorce: string;
}

export function TiroirTuteur({
  etatInitial,
  competenceCiblee,
  amorce,
  exerciceCible,
  codesCompetences,
  compteId,
  domainesExistants,
  competencesModale,
  calibragesModale,
  libelle = "Demander de l'aide au tuteur",
  declencheur = "bouton",
  actionsContextuelles,
}: {
  etatInitial: EtatContexteTuteur;
  competenceCiblee?: string;
  /** Brouillon explicite à placer dans la saisie, sans envoi automatique. */
  amorce?: string;
  exerciceCible?: string;
  codesCompetences: string[];
  compteId: string;
  /** Domaines existants — le chat ouvre la modale de compétences in situ. */
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  /**
   * Compétences actives et calibrages — le chat ouvre aussi la modale
   * d'exercice in situ (audit §2.3). Obligatoires : un exercice proposé dans
   * le tiroir doit pouvoir s'enregistrer depuis le tiroir.
   */
  competencesModale: CompetenceModale[];
  calibragesModale: Record<string, CalibrageModale>;
  libelle?: string;
  /** `flottant` : bouton rond global. `bouton` : bouton en ligne. `barre-contextuelle` : actions directes. */
  declencheur?: "bouton" | "flottant" | "barre-contextuelle";
  /** Liste d'actions prédéfinies à afficher en barre contextuelle. */
  actionsContextuelles?: ActionContextuelleTuteur[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [amorceCourante, setAmorceCourante] = useState<string | undefined>(amorce);
  const flottant = declencheur === "flottant";
  const barre = declencheur === "barre-contextuelle";

  function ouvrirAvecAmorce(texteAmorce?: string) {
    setAmorceCourante(texteAmorce ?? amorce);
    setOuvert(true);
  }

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
          title={flottant ? libelle : undefined}
          data-tour={flottant ? "tuteur-flottant" : undefined}
          className={flottant ? CLASSES_FLOTTANT : classesLienBouton("secondaire", "petite")}
        >
          {flottant ? (
            <IconeMessage className="size-5" />
          ) : (
            libelle
          )}
        </button>
      )}

      {ouvert && (
        /*
         * Un tiroir reste une modale : `aria-modal` promet que ce qui est
         * derrière n'existe plus, et cette promesse n'était pas tenue — ni
         * `Échap`, ni piège de focus, ni restitution. `Modale` la tient, et
         * `className` déplace le panneau contre le bord droit plutôt que de
         * dupliquer la coquille (audit §1.4d).
         */
        <Modale
          titre="Tuteur IA"
          sousTitre="Il reçoit les protocoles du système et l'état réel de tes compétences."
          largeur="md"
          position="laterale"
          onFermer={() => setOuvert(false)}
        >
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatTuteur
                /*
                 * Remonter quand on change d'exercice.
                 *
                 * `ChatTuteur` lit son historique dans l'initialiseur de
                 * `useState` — une seule fois. Sans cette clé, passer d'un
                 * exercice à l'autre sans fermer le tiroir garderait les
                 * messages du précédent en mémoire tout en écrivant sous la
                 * nouvelle clé de session : le fil du nouvel exercice serait
                 * écrasé par celui de l'ancien.
                 */
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
              />
            </div>
          </>
        </Modale>
      )}
    </>
  );
}

