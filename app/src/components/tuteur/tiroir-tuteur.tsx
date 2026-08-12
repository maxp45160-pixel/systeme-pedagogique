"use client";

/**
 * Tiroir du tuteur — le chat en panneau coulissant (lot 3).
 *
 * Le tuteur n'est plus une destination de navigation : il devient un tiroir,
 * ouvert là où poser une question a un sens — pendant une tentative
 * (`/exercices/[id]`), ou sur une fiche compétence (`/competences/[code]`).
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
import type {
  CalibrageModale,
  CompetenceModale,
} from "@/components/exercices/proprietes-generation";

/**
 * Bouton rond en bas à droite — le déclencheur global.
 *
 * ⚠️ `bottom-20` en dessous de `lg` (audit §1.5). `NavMobile` est
 * `fixed inset-x-0 bottom-0` et haute d'environ 46 px : à `bottom-6`, le bouton
 * se posait par-dessus et masquait une partie d'un des trois onglets. Le
 * composant de développement (`dev-todo.tsx`) contournait déjà ce conflit ; le
 * composant produit, non.
 *
 * `focus:outline-none` est conservé ici parce qu'un anneau de remplacement est
 * fourni juste après — c'est le seul cas du produit où la suppression est
 * compensée plutôt que subie.
 */
const CLASSES_FLOTTANT = cx(
  "fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center lg:bottom-6 lg:right-6",
  "rounded-full bg-primaire text-primaire-contraste shadow-lg",
  "transition-transform hover:scale-105 active:scale-95",
  "focus:outline-none focus:ring-2 focus:ring-primaire focus:ring-offset-2",
);

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
  /** `flottant` : bouton rond global. `bouton` : bouton en ligne, dans la page. */
  declencheur?: "bouton" | "flottant";
}) {
  const [ouvert, setOuvert] = useState(false);
  const flottant = declencheur === "flottant";

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={flottant ? libelle : undefined}
        title={flottant ? libelle : undefined}
        className={flottant ? CLASSES_FLOTTANT : classesLienBouton("secondaire", "petite")}
      >
        {flottant ? (
          <span className="text-lg font-bold" aria-hidden>
            💬
          </span>
        ) : (
          libelle
        )}
      </button>

      {ouvert && (
        /*
         * Un tiroir reste une modale : `aria-modal` promet que ce qui est
         * derrière n'existe plus, et cette promesse n'était pas tenue — ni
         * `Échap`, ni piège de focus, ni restitution. `Modale` la tient, et
         * `className` déplace le panneau contre le bord droit plutôt que de
         * dupliquer la coquille (audit §1.4d).
         */
        <Modale
          titre="IA Tutor"
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
                amorce={amorce}
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
