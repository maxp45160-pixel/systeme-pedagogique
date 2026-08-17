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
import { EXERCICES_DIAGNOSTIC, tableDureesEstimees } from "@/lib/seed/exercises";
import { computeAllSkillStates } from "@/lib/engine/skill-state";
import { calculerEtatGlobal, type EtatGlobal } from "@/lib/engine/progression";
import { recommander, type Recommandation } from "@/lib/engine/recommend";
import {
  construireContexteDocumentaire,
  type ContexteDocumentaire,
} from "@/lib/engine/document-context";
import { calibrerToutes, type Calibration } from "@/lib/engine/calibration";
import { evaluerMaitrises, type Maitrise } from "@/lib/engine/maitrise";
import { mesurer, mesurerSync } from "@/lib/profiling/server";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Referentiel, SkillState } from "@/lib/domain/types";
import type { Theme } from "@/lib/domain/theme";
import { lireThemes } from "./themes";
import { adaptLegacyActivities } from "@/lib/domain/legacy-activity-adapter";

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
  /**
   * `dureeEstimeeMin` par exercice, **sans aucun filtre** (ADR-071).
   *
   * `donnees.exercises` ne convient pas pour cet usage : elle est filtrée par
   * périmètre, et n'accueille un diagnostic hors périmètre que s'il porte une
   * tentative **en cours**. Une tentative abandonnée sur un diagnostic dont la
   * compétence a quitté le référentiel n'y trouve donc pas son exercice — et le
   * plafond de `dureeRetenue` retombait sur les 240 min du garde-fou au lieu des
   * 15 min réellement estimées.
   *
   * Cette table répond à une autre question que la liste d'exercices : « combien
   * de temps cet exercice était-il censé prendre ? » se pose pour tout ce qui a
   * été tenté un jour, y compris ce qui n'est plus proposable. Elle ne porte que
   * l'estimation, pas l'entité : rien ici ne peut réintroduire dans un écran un
   * exercice qui en est sorti.
   */
  dureesEstimees: Map<string, number>;
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
  /** Provenance documentaire dérivée des preuves, sans lecture supplémentaire. */
  contexteDocumentaire: ContexteDocumentaire;
  /**
   * Les preuves qui comptent pour le moteur.
   *
   * Elles étaient filtrées par un journal de rectifications, retiré le
   * 15/08/2026 avec la boucle qui le portait (ADR-071) : la table
   * `evidence_status_events` n'a jamais existé en production. Le champ reste
   * distinct de `donnees.evidence` parce qu'il nomme une intention — ce qui
   * entre dans le calcul — et qu'un futur mécanisme d'invalidation reprendrait
   * exactement cette place, sans avoir à retoucher ses consommateurs.
   */
  preuvesEffectives: Collections["evidence"];
  now: Date;
  /**
   * Refus de recommandation (R1) encore frais, expiration déjà appliquée.
   *
   * Exposé parce que le classement n'est plus le seul à devoir les respecter :
   * l'arbitrage à l'instant T voit tout le corpus, pas seulement la file, et
   * ferait réapparaître un exercice écarté s'il ne recevait pas le même
   * ensemble. Une seule implémentation de la règle, deux lecteurs.
   */
  refus: { codes: Set<string>; exercices: Set<string> };
  /** Thèmes enregistrés du compte (chantier « thèmes », ADR-053). */
  themes: Theme[];
  /** Adaptation en lecture seule : aucune copie ni double écriture du legacy. */
  adaptiveLegacy: ReturnType<typeof adaptLegacyActivities>;
}

export const chargerContexte = cache(async (): Promise<Contexte> => {
  const now = new Date();
  await mesurer("dorsaleCompte", () => dorsaleCompte());

  // ── Chemin rapide : une seule RPC pour tout ──
  //
  // `chargerToutRPC` ramène les 8 tables en un seul aller-retour réseau.
  // Si la fonction SQL n'existe pas encore, elle renvoie `null` et le
  // chemin lent prend le relais — aucune casse.
  const rpc = await chargerToutRPC();

  let donneesBrutes: Collections;
  let referentiel: Referentiel;
  let themes: Theme[];

  if (rpc) {
    donneesBrutes = rpc.collections;
    referentiel = assemblerReferentiel(rpc.domaines, rpc.competences);
    themes = rpc.themes;
  } else {
    // ── Chemin lent : requêtes parallèles séparées ──
    // `chargerReferentiel` et non `lireReferentiel` : mémoïsé par requête, il ne
    // relit pas domaines et compétences si un autre appelant les a déjà demandés
    // dans le même rendu (voir `store/referentiel.ts`).
    const [d, r, t] = await Promise.all([
      mesurer("lireTout", () => lireTout()),
      mesurer("lireReferentiel", () => chargerReferentiel()),
      mesurer("lireThemes", () => lireThemes()),
    ]);
    donneesBrutes = d;
    referentiel = r;
    themes = t;
  }

  const preuvesEffectives = donneesBrutes.evidence;

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

  /*
   * Un exercice sorti du périmètre emporte sa tentative ouverte avec lui
   * (audit §2.2) : il faut qu'il reste atteignable pour la clore — et le clore,
   * c'est le seul geste autorisé sur lui. On le garde donc dans les données,
   * mais on le marque pour qu'il ne revienne NI dans le flux du moteur.
   *
   * ⚠️ Les diagnostics comptent, et ce n'est pas un détail : ils ne vivent pas
   * en base mais dans `EXERCICES_DIAGNOSTIC`, et ce sont eux qui portent les
   * deux plus vieilles tentatives ouvertes du produit. Ne rattraper que les
   * exercices stockés aurait laissé exactement la moitié du défaut en place —
   * la moitié invisible, puisqu'elle ne se lit dans aucune table.
   */
  const tentativesOuvertes = new Set(
    donneesBrutes.attempts.filter((t) => t.statut === "en-cours").map((t) => t.exerciseId),
  );
  const ouvertHorsPerimetre = (e: { id: string; competences: string[] }) =>
    !dansLePerimetre(e) && tentativesOuvertes.has(e.id);

  const horsPerimetreOuverts = [
    ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id) && ouvertHorsPerimetre(e)),
    ...donneesBrutes.exercises.filter(ouvertHorsPerimetre),
  ];
  const idsHorsPerimetreOuverts = new Set(horsPerimetreOuverts.map((e) => e.id));

  const donnees: Collections = {
    ...donneesBrutes,
    exercises: [
      ...EXERCICES_DIAGNOSTIC.filter((e) => !idsStockes.has(e.id) && dansLePerimetre(e)),
      ...donneesBrutes.exercises.filter(dansLePerimetre),
      ...horsPerimetreOuverts,
    ],
  };

  // Sur les données BRUTES, pas sur `donnees.exercises` : c'est tout le point
  // (ADR-071, `tableDureesEstimees`). La liste filtrée laisserait sans
  // estimation les diagnostics et les exercices sortis du périmètre.
  const dureesEstimees = tableDureesEstimees(donneesBrutes.exercises);

  const etats = mesurerSync("computeAllSkillStates", () =>
    computeAllSkillStates(referentiel.actifs, preuvesEffectives, now),
    { competences: referentiel.actifs.length, preuves: preuvesEffectives.length },
  );
  const global = mesurerSync("calculerEtatGlobal", () =>
    calculerEtatGlobal(etats, now, referentiel.domaines),
  );

  // Un exercice archivé ne calibre plus rien et ne se recommande plus. Il reste
  // dans `donnees.exercises` pour la liste, la fiche et le journal. Pareil pour
  // un exercice hors périmètre encore ouvert : il reste atteignable pour être
  // clos, mais ne revient pas dans le flux (audit §2.2).
  const exercicesActifs = donnees.exercises.filter(
    (e) => !e.archive && !idsHorsPerimetreOuverts.has(e.id),
  );

  // Calculées AVANT la recommandation : c'est la calibration qui fixe la
  // difficulté visée, donc l'exercice retenu (ADR-028).
  const calibrations = mesurerSync("calibrerToutes", () =>
    calibrerToutes(etats, exercicesActifs, donnees.attempts),
    { exercices: exercicesActifs.length, tentatives: donnees.attempts.length },
  );

  // Les documents ne sont pas relus sur le chemin chaud : la preuve porte déjà
  // le lien vers son document et son snapshot. On ne dérive ici que le résumé
  // nécessaire au classement pédagogique.
  const contexteDocumentaire = construireContexteDocumentaire(preuvesEffectives);

  // Refus de recommandation (R1) : ce que l'utilisateur a passé est écarté de
  // la file pour 7 jours. L'expiration est gérée ici, à la lecture.
  //
  // Deux portées, distinguées par la présence de `exerciceId` : l'activité
  // seule (cas normal, la compétence reste recommandable autrement) ou la
  // compétence entière (refus antérieurs au 07/08/2026, et refus posés quand
  // aucune activité n'était proposée). Une activité sans code de compétence
  // tombe dans le premier cas : `code` absent, `exerciceId` porteur.
  const maintenant = now.getTime();
  const EXPIRATION_REFUS_MS = 7 * 24 * 60 * 60 * 1000;
  const refusFrais = (donneesBrutes.refusRecommandations ?? []).filter(
    (r) => maintenant - new Date(r.date).getTime() < EXPIRATION_REFUS_MS,
  );
  const refus = {
    codes: new Set(
      refusFrais
        .filter((r) => !r.exerciceId)
        .map((r) => r.code)
        .filter((code): code is string => Boolean(code)),
    ),
    exercices: new Set(
      refusFrais.map((r) => r.exerciceId).filter((id): id is string => Boolean(id)),
    ),
  };

  const recommandations = mesurerSync("recommander", () =>
    recommander(
      etats,
      exercicesActifs,
      donnees.attempts,
      6,
      calibrations,
      now,
      refus,
      contexteDocumentaire,
    ),
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
    dureesEstimees,
    referentiel,
    etats,
    etatsParCode: new Map(etats.map((e) => [e.skill.code, e])),
    global,
    recommandations,
    calibrations,
    maitrises,
    contexteDocumentaire,
    preuvesEffectives,
    now,
    refus,
    themes,
    adaptiveLegacy: adaptLegacyActivities(
      donnees.user.id,
      exercicesActifs,
      donnees.attempts,
    ),
  };
});

