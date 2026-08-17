"use client";

/**
 * Bouton « Passer cette suggestion » (R1).
 *
 * Un refus est un fait observé : l'utilisateur a écarté une suggestion.
 * Il est stocké en base via la Server Function `refuserRecommandation`,
 * et le moteur de recommandation l'exclut de la file pour 7 jours.
 *
 * Le refus est un fait observé : il ne modifie pas le moteur, il le filtre.
 * Le moteur reste pur et testé — il reçoit les ensembles de refus.
 *
 * Portée : l'action proposée. Une activité (exercice, note, ressource) est
 * écartée pour elle-même via son `exerciceId` — sa compétence reste
 * recommandable avec autre chose. Sans `exerciceId` — cas du repli « Générer
 * un exercice », où rien n'est proposé — le refus porte sur la compétence
 * entière (`code` seul). Une activité sans code de compétence reste passable :
 * le refus n'a alors que son identifiant, et c'est elle seule qui sort.
 *
 * Aucun état « déjà passé » n'est gardé ici : `router.refresh()` remplace la
 * carte par la suivante, et c'est ce remplacement qui est le retour visible.
 * Un drapeau local survivrait au rafraîchissement (React ne démonte pas le
 * composant) et masquerait le bouton de la *nouvelle* recommandation.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { refuserRecommandation } from "@/lib/store/actions";

export function BoutonRefusRecommandation({
  code,
  exerciceId,
}: {
  /** Compétence proposée, si l'action en mobilise une. Absente : le refus porte sur l'activité. */
  code?: string;
  /** Activité proposée, s'il y en a une. Absente : le refus porte sur la compétence. */
  exerciceId?: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function refuser() {
    setErreur(null);
    demarrer(async () => {
      try {
        await refuserRecommandation(code, exerciceId);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible d'enregistrer le refus.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Bouton
        onClick={refuser}
        disabled={enCours}
        variante="secondaire"
        /*
         * Taille normale, pas « petite » (audit §1.3).
         *
         * Ce bouton vit dans la même rangée flex que « Commencer » et « Voir la
         * compétence », tous deux en `h-9` : à `h-7`, il était 8 px plus court
         * et une taille de texte en dessous de ses deux voisins immédiats.
         * C'est la seule incohérence de bouton que l'usage ait remontée
         * d'elle-même — un écart dans une même rangée se voit, un écart entre
         * deux écrans non.
         */
        title={
          exerciceId
            ? "Écarte cette suggestion pendant 7 jours et propose autre chose"
            : "Écarte cette compétence pendant 7 jours"
        }
      >
        {enCours ? "Passage…" : "Passer"}
      </Bouton>
      {erreur && <span className="text-[0.6875rem] text-alerte">{erreur}</span>}
    </div>
  );
}