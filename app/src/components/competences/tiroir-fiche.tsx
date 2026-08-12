"use client";

/**
 * La coquille du tiroir de fiche — rien d'autre.
 *
 * Ouvert par la route d'interception `@fiche/(.)competences/[code]` : cliquer
 * un nœud du graphe montre la fiche sans démonter le graphe, donc sans perdre
 * le zoom, la position de caméra ni les filtres du panneau de réglages. Ces
 * trois états sont locaux à `GrapheCompetences` et ne survivent à aucune
 * navigation ; les reconstruire après un aller-retour n'était pas possible,
 * ils ne sont écrits nulle part.
 *
 * La fermeture est un `router.back()` et non un `push` : l'interception a
 * empilé une entrée d'historique, et y revenir est ce qui rétablit l'URL du
 * graphe. Un `push` vers `/competences?vue=graphe` remonterait la page, ce
 * qu'on cherche précisément à éviter.
 *
 * Le contenu, lui, est `FicheCompetence` — le composant de la page pleine,
 * rendu côté serveur et passé en `children`.
 */

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Modale } from "@/components/ui/modale";

export function TiroirFiche({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Modale
      titre="Fiche compétence"
      sousTitre="Le graphe reste ouvert derrière — sa position et ses filtres sont conservés."
      position="laterale"
      largeur="2xl"
      onFermer={() => router.back()}
    >
      {children}
    </Modale>
  );
}
