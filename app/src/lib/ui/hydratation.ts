"use client";

import { useSyncExternalStore } from "react";

/** Aucun abonnement : la valeur ne change qu'une fois, au passage côté client. */
const sansAbonnement = () => () => {};

/**
 * Faux au rendu serveur et au premier rendu client, vrai ensuite.
 *
 * Sert aux composants dont l'état initial vient du navigateur —
 * `sessionStorage` pour une conversation en cours, un brouillon de formulaire.
 * Le serveur ne peut pas les lire ; les seeder après coup dans un `useEffect`
 * marcherait, mais provoque exactement la cascade de rendus que React déconseille
 * (`react-hooks/set-state-in-effect`).
 *
 * En attendant ce drapeau, on ne rend rien qui dépende du stockage. Une fois
 * vrai, le composant qui en dépend est monté pour la première fois et peut lire
 * le stockage dans un initialiseur paresseux de `useState` — une seule fois,
 * sans effet, sans divergence d'hydratation.
 */
export function useEstHydrate(): boolean {
  return useSyncExternalStore(
    sansAbonnement,
    () => true,
    () => false,
  );
}
