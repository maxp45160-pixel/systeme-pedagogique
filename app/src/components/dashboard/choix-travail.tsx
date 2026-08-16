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
import { IconeFleche } from "@/components/ui/icones";
import { Carte } from "@/components/ui/primitives";

/** Entrée dédiée au travail : les notes support restent dans `CaptureNotes`. */
export function ChoixTravail({ compteId }: { compteId: string }) {
  const router = useRouter();
  const [projetOuvert, setProjetOuvert] = useState(false);

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Choisir un travail</p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Une séance pour t&apos;entraîner, un projet pour produire.
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => router.push("/seances?composer=1")}
              className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Créer une séance</span>
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
              </span>
              <span className="mt-1 block text-xs text-texte-discret">
                Le compositeur propose un sujet et un nombre d&apos;exercices — tout reste
                modifiable.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setProjetOuvert(true)}
              className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Créer un projet</span>
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
              </span>
              <span className="mt-1 block text-xs text-texte-discret">
                Décris ce que tu veux produire : le parcours désigne les compétences
                mobilisées, tu confirmes.
              </span>
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
