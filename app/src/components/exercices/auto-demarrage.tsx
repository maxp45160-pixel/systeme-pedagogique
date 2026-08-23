"use client";

/**
 * Démarrage automatique de la tentative, dans le déroulé d'une séance.
 *
 * Entrer en séance EST le geste de commencer : un bouton « Commencer
 * l'exercice » entre la séance et l'énoncé n'ajoutait aucune décision — il
 * répétait celle qu'on venait de poser en ouvrant le travail. La tentative
 * est donc créée au montage quand rien n'est encore ouvert, et l'écran se
 * recharge pour passer directement en mode résolution.
 *
 * ⚠️ Invariant intact : une tentative créée puis quittée reste une tentative
 * abandonnée, qui ne produit AUCUNE preuve (ADR-030). L'automatisme ne fabrique
 * donc pas d'observation fantôme — il avance seulement le moment où le temps
 * commence à courir.
 */

import { useEffect, useRef } from "react";
import { demarrerTentative } from "@/lib/store/actions";

export function DemarrageAuto({ exerciseId }: { exerciseId: string }) {
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    // Idempotent côté serveur (`demarrerTentative` ne crée rien si une
    // tentative est déjà en cours) : un double montage en dev ne duplique pas.
    void demarrerTentative(exerciseId);
  }, [exerciseId]);

  return null;
}
