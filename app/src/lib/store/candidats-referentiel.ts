import "server-only";

/**
 * Le lot de candidats du référentiel, assemblé côté serveur — ADR-086.
 *
 * Chargé par l'Atelier, jamais par `chargerContexte` : cinq détecteurs sur tout
 * le corpus n'ont rien à faire sur le chemin chaud des pages (même raison
 * qu'ADR-064 pour le chargement documentaire, et que `chargerMetriquesMoteur`
 * pour le journal du moteur).
 *
 * Rien n'est calculé ici. Ce module lit et assemble ; `lib/engine/candidats-referentiel.ts`
 * fait le travail, sans dépendre d'aucune persistance.
 */

import { chargerContexte } from "./context";
import {
  detecterCandidats,
  type LotCandidats,
} from "@/lib/engine/candidats-referentiel";

export type { LotCandidats };

/**
 * Les candidats du compte, recalculés de bout en bout.
 *
 * Les exercices viennent de `ctx.donnees.exercises`, donc filtrés par le
 * périmètre : un exercice hors périmètre ne doit ni faire compter une
 * co-mobilisation, ni sauver une compétence de la dormance. C'est l'inverse du
 * choix fait pour la famille de situation (ADR-083), et pour une raison
 * opposée : là il s'agissait de RÉSOUDRE une preuve passée, ici de décrire
 * l'état de travail présent.
 */
export async function chargerCandidatsReferentiel(): Promise<LotCandidats> {
  const ctx = await chargerContexte();

  return detecterCandidats({
    referentiel: ctx.referentiel,
    etats: ctx.etats,
    preuves: ctx.preuvesEffectives,
    exercices: ctx.donnees.exercises,
    tentatives: ctx.donnees.attempts,
    seances: ctx.donnees.sessions.map((s) => ({
      date: s.date,
      skillCodes: s.skillCodes,
    })),
    now: ctx.now,
  });
}
