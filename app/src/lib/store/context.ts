/**
 * Assemble le contexte complet d'une page : données brutes + état dérivé.
 *
 * Point d'entrée unique côté serveur. Chaque page appelle `chargerContexte()`
 * et n'a jamais à savoir d'où viennent les données ni comment les indicateurs
 * sont calculés.
 *
 * Depuis ADR-026 le référentiel fait partie des données lues, et non plus d'un
 * module compilé : c'est ici qu'il entre dans le moteur, exactement comme les
 * preuves. Le moteur, lui, ne connaît toujours aucun référentiel — il reçoit
 * les compétences en paramètre.
 */

import { cache } from "react";
import type { Collections } from "./db";
import { lireTout, dorsaleCompte, chargerToutRPC } from "./db";
import { chargerReferentiel } from "./referentiel";
import { EXERCICES_DIAGNOSTIC } from "@/lib/seed/exercises";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal, type EtatGlobal } from "@/lib/engine/progression";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import { calibrerToutes, type Calibration } from "@/lib/engine/calibration";
import { evaluerMaitrises, type Maitrise } from "@/lib/engine/maitrise";
import { mesurer, mesurerSync } from "@/lib/profiling/server";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Referentiel, SkillState } from "@/lib/domain/types";

export interface Contexte {
  donnees: Collections;
  /**
   * Exercices que le moteur a le droit de proposer : `donnees.exercises` moins
   * les archivés (calque ADR-027).
   *
   * Les archivés restent dans `donnees.exercises` — la liste doit pouvoir les
   * montrer sous un repli, leur fiche doit rester ouvrable pour les désarchiver,
   * et le journal cite leurs titres. Ils sortent du **flux**, pas des données.
   */
  exercicesActifs: Collections["exercises"];
  referentiel: Referentiel;
  etats: SkillState[];
  etatsParCode: Map<string, SkillState>;
  global: EtatGlobal;
  recommandations: Recommandation[];
  /**
   * 3ᵉ maillon de la boucle (ADR-028) : ce que les tentatives passées disent du
   * calibrage du prochain exercice. Dérivé à chaque lecture, jamais stocké.
   */
  calibrations: Map<string, Calibration>;
  /**
   * « Cette compétence est-elle sue ? » — dérivé de `etats`, jamais stocké (P1,
   * ADR-042). Aucun seuil propre : niveau ≥ 4 et confiance ≥ moyenne, deux
   * valeurs que `computeSkillState` a déjà produites.
   */
  maitrises: Map<string, Maitrise>;
  now: Date;
}

export const chargerContexte = cache(async (): Promise<Contexte> => {
  const now = new Date();
  await mesurer("dorsaleCompte", () => dorsaleCompte());

  // ── Chemin rapide : une seule RPC pour tout ──
  //
  // `chargerToutRPC` ramène les 7 tables en un seul aller-retour réseau.
  // Si la fonction SQL n'existe pas encore, elle renvoie `null` et le
  // chemin lent prend le relais — aucune casse.
  const rpc = await chargerToutRPC();

  let donneesBrutes: Collections;
  let referentiel: Referentiel;

  if (rpc) {
    donneesBrutes = rpc.collections;
    referentiel = assemblerReferentiel(rpc.domaines, rpc.competences);
  } else {
    // ── Chemin lent : requêtes parallèles séparées ──
    // `chargerReferentiel` et non `lireReferentiel` : mémoïsé par requête, il ne
    // relit pas domaines et compétences si un autre appelant les a déjà demandés
    // dans le même rendu (voir `store/referentiel.ts`).
    const [d, r] = await Promise.all([
      mesurer("lireTout", () => lireTout()),
      mesurer("lireReferentiel", () => chargerReferentiel()),
    ]);
    donneesBrutes = d;
    referentiel = r;
  }

  // Les exercices de diagnostic font partie du logiciel, pas du journal :
  // ils sont toujours disponibles, sans étape d'initialisation.
  //
  // Filtrés sur le périmètre du compte : proposer un exercice sur une
  // compétence qui n'est ni calculée ni affichée produirait une preuve que rien
  // ne lirait. Un compte dont le référentiel est étranger au lot livré — une
  // arborescence de philosophie, par exemple — n'en reçoit aucun, et son
  // amorçage passe entièrement par le tuteur (ADR-004). C'est ce qui rend le
  // dispositif transférable à n'importe quel sujet.
  const idsStockes = new Set(donneesBrutes.exercises.map((e) => e.id));
  const dansLePerimetre = (e: { competences: string[] }) =>
    e.competences.some((c) => referentiel.codesActifs.has(c));
  const donnees: Collections = {
    ...donneesBrutes,
    exercises: [
      ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id) && dansLePerimetre(e)),
      ...donneesBrutes.exercises.filter(dansLePerimetre),
    ],
  };

  const etats = mesurerSync("computeAllSkillStates", () =>
    computeAllSkillStates(referentiel.actifs, donnees.evidence, now),
    { competences: referentiel.actifs.length, preuves: donnees.evidence.length },
  );
  const global = mesurerSync("calculerEtatGlobal", () =>
    calculerEtatGlobal(etats, now, referentiel.domaines),
  );

  // Un exercice archivé ne calibre plus rien et ne se recommande plus. Il reste
  // dans `donnees.exercises` pour la liste, la fiche et le journal.
  const exercicesActifs = donnees.exercises.filter((e) => !e.archive);

  // Calculées AVANT la recommandation : c'est la calibration qui fixe la
  // difficulté visée, donc l'exercice retenu (ADR-028).
  const calibrations = mesurerSync("calibrerToutes", () =>
    calibrerToutes(etats, exercicesActifs, donnees.attempts),
    { exercices: exercicesActifs.length, tentatives: donnees.attempts.length },
  );

  // Refus de recommandation (R1) : ce que l'utilisateur a passé est écarté de
  // la file pour 7 jours. L'expiration est gérée ici, à la lecture.
  //
  // Deux portées, distinguées par la présence de `exerciceId` : l'exercice
  // seul (cas normal, la compétence reste recommandable autrement) ou la
  // compétence entière (refus antérieurs au 07/08/2026, et refus posés quand
  // aucun exercice n'était proposé).
  const maintenant = now.getTime();
  const EXPIRATION_REFUS_MS = 7 * 24 * 60 * 60 * 1000;
  const refusFrais = (donneesBrutes.refusRecommandations ?? []).filter(
    (r) => maintenant - new Date(r.date).getTime() < EXPIRATION_REFUS_MS,
  );
  const refus = {
    codes: new Set(refusFrais.filter((r) => !r.exerciceId).map((r) => r.code)),
    exercices: new Set(
      refusFrais.map((r) => r.exerciceId).filter((id): id is string => Boolean(id)),
    ),
  };

  const recommandations = mesurerSync("recommander", () =>
    recommander(etats, exercicesActifs, donnees.attempts, 6, calibrations, now, refus),
    { exercices: exercicesActifs.length, tentatives: donnees.attempts.length },
  );

  /*
   * La maîtrise est dérivée des états, donc calculée après eux et jamais
   * stockée (P1). Placée APRÈS `recommander` volontairement : elle n'entre pas
   * dans la file, et ne doit pas donner l'impression de l'influencer. C'est
   * l'arbitrage de l'utilisateur — successeur, élargissement, retrait — qui
   * sort une compétence maîtrisée du cycle, pas un facteur de score (ADR-042).
   */
  const maitrises = evaluerMaitrises(etats);

  return {
    donnees,
    exercicesActifs,
    referentiel,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    calibrations,
    maitrises,
    now,
  };
});

