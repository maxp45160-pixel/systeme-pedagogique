"use client";

import { useEffect } from "react";

/**
 * Porte le focus programmatique vers le titre du nouvel acte quand l'écran
 * d'exercice passe de Chercher à Comparer, ou de Comparer à Mesurer.
 *
 * Monté seulement dans les actes 2 et 3 — jamais dans « Chercher », qui est
 * toujours ce que la page affiche au premier rendu. Ainsi le focus ne bouge
 * qu'après une vraie transition (un clic sur « Afficher la correction » ou
 * « Passer à l'auto-évaluation »), jamais au chargement initial de la page.
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
