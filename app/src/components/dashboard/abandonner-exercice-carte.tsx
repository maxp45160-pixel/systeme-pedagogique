"use client";

/**
 * « Abandonner » un exercice en cours, depuis le tableau de bord.
 *
 * Le bouton vivait dans un formulaire nu : un clic écrivait l'abandon sans
 * le moindre répit, alors que les deux autres points d'entrée — « Passer la
 * séance » (`passer-seance.tsx`) et l'abandon depuis l'exercice — confirment
 * avant d'écrire. L'incohérence coûtait cher : l'abandon est irréversible
 * (aucune observation ne sera jamais écrite pour cette tentative).
 *
 * Même forme que `PasserSeance` : confirmation, puis action serveur. L'action
 * retourne la destination ; le composant y navigue après écriture. En cas
 * d'échec, le message s'affiche dans la modale et rien n'est écrit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { abandonnerExercice } from "@/lib/store/actions";

export function AbandonnerExerciceCarte({
  attemptId,
  exerciceId,
  titreExercice,
  dureeMin,
  taille = "petite",
}: {
  attemptId: string;
  exerciceId: string;
  titreExercice: string;
  dureeMin: number;
  taille?: "normale" | "compacte" | "petite";
}) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function abandonner() {
    setErreur(null);
    demarrer(async () => {
      try {
        const destination = await abandonnerExercice(
          attemptId,
          exerciceId,
          dureeMin,
          undefined,
        );
        setConfirmer(false);
        router.push(destination);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible d'abandonner la tentative.");
      }
    });
  }

  return (
    <>
      <Bouton
        type="button"
        variante="secondaire"
        taille={taille}
        onClick={() => setConfirmer(true)}
        title="Clôturer cette tentative sans observation"
      >
        Abandonner
      </Bouton>
      {confirmer && (
        <Modale
          titre="Abandonner cet exercice ?"
          sousTitre={titreExercice}
          onFermer={() => setConfirmer(false)}
          largeur="md"
          pied={
            <>
              <Bouton
                type="button"
                variante="secondaire"
                onClick={() => setConfirmer(false)}
                disabled={enCours}
              >
                Continuer l&apos;exercice
              </Bouton>
              <Bouton
                type="button"
                variante="danger"
                onClick={abandonner}
                disabled={enCours}
                enChargement={enCours}
              >
                Abandonner
              </Bouton>
            </>
          }
        >
          <div className="space-y-2 text-sm text-texte-attenue">
            <p>
              La tentative sera clôturée sans conclusion : aucune observation ne
              sera enregistrée, et ce geste est irréversible.
            </p>
            <p>L&apos;exercice reste consultable et pourra être recommencé plus tard.</p>
          </div>
          {erreur && <p className="mt-3 text-xs text-alerte">{erreur}</p>}
        </Modale>
      )}
    </>
  );
}
