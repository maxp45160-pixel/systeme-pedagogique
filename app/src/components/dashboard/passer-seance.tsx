"use client";

/**
 * « Passer la séance » depuis le tableau de bord.
 *
 * Le bouton du cahier envoie un formulaire vers `abandonnerSeance`, qui
 * redirige vers le journal. Ici on reste sur le tableau de bord : un abandon
 * est une sortie, pas une navigation — la carte « séance en cours » laisse
 * place à la prochaine suggestion, et rien ne change d'écran.
 *
 * L'abandon étant une clôture (des tentatives encore ouvertes, de la séance
 * elle-même), il est confirmé avant d'être écrit : un clic de plus sur
 * « Passer » pour sortir d'une séance qu'on menait n'a pas le poids d'un
 * abandon pris en une fois.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { abandonnerSeanceDepuisTableauDeBord } from "@/lib/store/seance-actions";

export function PasserSeance({
  seanceId,
  libelle = "Passer la séance",
}: {
  seanceId: string;
  libelle?: string;
}) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function abandonner() {
    setErreur(null);
    demarrer(async () => {
      try {
        await abandonnerSeanceDepuisTableauDeBord(seanceId);
        setConfirmer(false);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible d'abandonner la séance.");
      }
    });
  }

  return (
    <>
      <Bouton
        type="button"
        variante="secondaire"
        onClick={() => setConfirmer(true)}
        title="Quitter cette séance et revoir les suggestions"
      >
        {libelle}
      </Bouton>
      {confirmer && (
        <Modale
          titre="Abandonner cette séance ?"
          sousTitre="La séance sera refermée sans bilan global."
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
                Annuler
              </Bouton>
              <Bouton
                type="button"
                variante="danger"
                onClick={abandonner}
                disabled={enCours}
                enChargement={enCours}
              >
                Abandonner la séance
              </Bouton>
            </>
          }
        >
          <div className="space-y-2 text-sm text-texte-attenue">
            <p>
              Ce qui a été mené reste au journal : les exercices déjà terminés
              gardent leurs preuves, et la séance reste relisible. Les tentatives
              encore ouvertes seront clôturées sans conclusion.
            </p>
            <p>
              Tu restes sur le tableau de bord, qui te proposera une autre action.
            </p>
          </div>
          {erreur && <p className="mt-3 text-xs text-alerte">{erreur}</p>}
        </Modale>
      )}
    </>
  );
}