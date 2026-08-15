"use client";

import { useEffect } from "react";

/**
 * Porte le focus programmatique vers le titre du nouvel acte quand l'écran
 * d'exercice passe de Chercher au bilan du tuteur.
 *
 * Monté seulement dans le bilan — jamais dans « Chercher », qui est toujours
 * ce que la page affiche au premier rendu. Ainsi le focus ne bouge qu'après
 * une vraie transition, jamais au chargement initial de la page.
 *
 * `cle` doit changer entre deux actes (ex. le nom de l'acte) : c'est ce qui
 * redéclenche l'effet sans dépendre d'un remontage du composant, que Next ne
 * garantit pas entre deux rendus serveur d'une même route.
 */
export function FocusActe({ cle, cible }: { cle: string; cible: string }) {
  useEffect(() => {
    document.getElementById(cible)?.focus();
  }, [cle, cible]);

  return null;
}
