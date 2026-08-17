"use client";

/**
 * Choisir un travail depuis le tableau de bord — deux portes, rien d'autre.
 *
 * ## Ce qui a été retiré, et pourquoi
 *
 * La carte demandait successivement : quelle priorité viser, un sujet libre,
 * un type de travail, puis — pour un sujet libre — la création d'un **thème
 * enregistré** via la résolution du tuteur avant de pouvoir composer quoi que
 * ce soit. Trois conséquences, toutes observées :
 *
 *  - une séance ponctuelle laissait derrière elle un objet permanent que
 *    personne n'avait demandé, intitulé « thème transversal » même quand toutes
 *    les compétences venaient d'un seul domaine ;
 *  - la résolution passe par le tuteur : quand il ne rend rien d'exploitable,
 *    la carte n'ouvrait plus rien du tout — le geste le plus courant du produit
 *    dépendait d'un appel de modèle ;
 *  - les deux priorités recommandées doublaient la carte « Prochaine meilleure
 *    action », juste au-dessus, qui dit déjà quoi travailler et pourquoi.
 *
 * Il reste ce que la carte promettait : **ouvrir un travail**. Une séance se
 * compose (le compositeur choisit le sujet et laisse tout modifier), un projet
 * s'ouvre par son parcours. Aucun des deux ne passe par le tuteur pour
 * s'ouvrir.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import { IconeExercices, IconeFleche, IconeProjet } from "@/components/ui/icones";
import { Carte } from "@/components/ui/primitives";

/** Entrée dédiée au travail : les notes support restent dans `CaptureNotes`. */
export function ChoixTravail({ compteId }: { compteId: string }) {
  const router = useRouter();
  const [projetOuvert, setProjetOuvert] = useState(false);

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-texte">Choisir un travail</h3>
              <p className="text-xs text-texte-attenue mt-0.5">Un exercice rapide, ou un vrai projet ?</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/seances?composer=1")}
              className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface-2 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-primaire-faible/25"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-texte group-hover:text-primaire">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primaire-faible text-primaire shrink-0">
                    <IconeExercices className="size-3.5" />
                  </span>
                  Créer une séance
                </span>
                <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire shrink-0" />
              </div>
              <p className="mt-2 text-xs text-texte-discret line-clamp-2">
                Compositeur adaptatif : sujet libre, ciblé ou transversal.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProjetOuvert(true)}
              className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface-2 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-primaire-faible/25"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-texte group-hover:text-primaire">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primaire-faible text-primaire shrink-0">
                    <IconeProjet className="size-3.5" />
                  </span>
                  Créer un projet
                </span>
                <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire shrink-0" />
              </div>
              <p className="mt-2 text-xs text-texte-discret line-clamp-2">
                Parcours de production guidé & compétences mobilisées.
              </p>
            </button>
          </div>
        </div>
      </Carte>

      {projetOuvert && (
        <ParcoursNouveauProjet
          accountId={compteId}
          onFermer={() => setProjetOuvert(false)}
        />
      )}
    </>
  );
}


