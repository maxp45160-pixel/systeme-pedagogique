"use server";

import { chargerContexte } from "@/lib/store/context";
import { construireContexte, contexteEnTexte } from "./contexte";
import { construireEtatInitialTuteur } from "./etat-initial";
import {
  calibragesPourModale,
  competencesPourModale,
  type CalibrageModale,
  type CompetenceModale,
} from "@/lib/domain/proprietes-generation";
import type { EtatContexteTuteur } from "./etat-contexte";

/**
 * Prépare le prompt complet à coller dans Claude.
 *
 * Mode de repli lorsqu'aucune clé API n'est configurée : le système construit
 * exactement le même contexte que la route serveur, mais le rend à l'utilisateur
 * plutôt que de l'envoyer. Rien n'est simulé.
 */
export async function preparerPromptComplet(question: string): Promise<string> {
  const ctx = await chargerContexte();
  const pedagogique = await construireContexte(ctx);
  return contexteEnTexte(pedagogique, question.trim() || "(indique ici ta demande)");
}

export interface DonneesTuteurGlobal {
  etatInitial: EtatContexteTuteur;
  codesCompetences: string[];
  compteId: string;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  competencesModale: CompetenceModale[];
  calibragesModale: Record<string, CalibrageModale>;
}

/**
 * Charge le contexte du tuteur global à la demande.
 *
 * Permet au layout racine d'éviter d'assembler et de sérialiser tout le
 * contexte pédagogique lors de chaque chargement de page.
 */
export async function chargerDonneesTuteurGlobal(): Promise<DonneesTuteurGlobal> {
  const ctx = await chargerContexte();
  const etatInitial = await construireEtatInitialTuteur(ctx);

  return {
    etatInitial,
    codesCompetences: ctx.etats.map((e) => e.skill.code),
    compteId: ctx.donnees.user.id,
    domainesExistants: ctx.referentiel.domaines.map((d) => ({
      id: d.id,
      nom: d.nom,
      prefixe: d.prefixe,
    })),
    competencesModale: competencesPourModale(ctx.referentiel.actifs),
    calibragesModale: calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations),
  };
}
