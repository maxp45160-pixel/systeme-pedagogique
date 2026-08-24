"use server";

/**
 * Arbitrer une proposition de relecture — ADR-108.
 *
 * ## Deux gestes, jamais confondus
 *
 * **Refuser** n'écrit qu'un fait : « le J, cette proposition a été refusée ».
 * Rien ne bouge au référentiel, et l'empreinte ne reviendra plus (le filtrage se
 * fait à la lecture, comme `refus_recommandations`).
 *
 * **Retenir** écrit deux fois : la commande gouvernée d'abord, l'arbitrage
 * ensuite. Cet ORDRE est le seul correct. Inscrire l'arbitrage en premier
 * laisserait, si la commande échoue, une proposition marquée « retenue » dont
 * rien n'a été écrit — un mensonge dans la mesure de rétention, précisément
 * celle dont le test de réfutation d'ADR-108 dépend.
 *
 * ## Ce que ces actions n'écrivent jamais
 *
 * Aucune observation, aucun niveau, aucun score (P5). Une proposition retenue
 * produit un domaine, un tag, une arête ou une compétence — des faits déclarés,
 * ensuite indépendants de la proposition qui les a suggérés. Elle ne produit
 * jamais une mesure.
 */

import { revalidatePath } from "next/cache";

import { chargerPropositions, inscrireArbitrage } from "./propositions-referentiel";
import {
  appliquerRevision,
  mettreDeCoteCompetence,
  relierCompetences,
  scinderDomaine,
  taguerCompetences,
} from "./referentiel-actions";
import { dorsaleCompte } from "./db";
import { lireReferentiel } from "./referentiel";
import type {
  ContenuProposition,
  PropositionReferentielRelue,
} from "@/lib/domain/propositions-referentiel";
import type { Referentiel } from "@/lib/domain/types";

export interface ResultatArbitrage {
  /** Une phrase, en français, pour l'écran. Jamais un identifiant technique. */
  message: string;
}

async function lireProposition(id: string): Promise<PropositionReferentielRelue> {
  const proposition = (await chargerPropositions()).find((p) => p.id === id);
  if (!proposition) throw new Error("Cette proposition n'existe plus.");
  if (proposition.arbitrage) throw new Error("Cette proposition a déjà été tranchée.");
  return proposition;
}

/**
 * Refuse une proposition. Rien n'est écrit au référentiel.
 *
 * C'est le geste le moins coûteux et le plus important : sans lui, le lot se
 * rallume à chaque relecture et cesse d'être lu au bout d'une semaine.
 */
export async function refuserProposition(id: string): Promise<ResultatArbitrage> {
  await lireProposition(id);
  const inscrit = await inscrireArbitrage(id, "refusee");
  revalidatePath("/", "layout");
  return {
    message: inscrit
      ? "C'est noté, cette proposition ne reviendra pas."
      : "Cette proposition avait déjà été tranchée.",
  };
}

/* ------------------------------------------------------------------ */
/* Retenir                                                             */
/* ------------------------------------------------------------------ */

/**
 * Écrit ce qu'une proposition propose, puis inscrit son arbitrage.
 *
 * Chaque genre passe par la commande gouvernée qui lui correspond — aucune
 * écriture directe, aucun chemin parallèle. Le genre `reformulation` fait
 * exception et lève : réécrire un intitulé est un geste de rédaction, il
 * appartient à la personne et l'écran l'envoie sur la fiche.
 */
async function ecrireProposition(
  contenu: ContenuProposition,
  referentiel: Referentiel,
): Promise<string> {
  switch (contenu.genre) {
    case "scission": {
      const resultat = await scinderDomaine(
        contenu.parentId,
        contenu.nom,
        contenu.description,
        contenu.codes,
      );
      const total = resultat.transferees.length + resultat.ajoutees.length;
      return `« ${resultat.nom} » est créé, avec ${total} compétence${total > 1 ? "s" : ""}.`;
    }

    case "rangement": {
      await taguerCompetences(contenu.domaineObserve, [contenu.code], true);
      const domaine = referentiel.domainesParId.get(contenu.domaineObserve);
      return `Cette compétence apparaît maintenant dans « ${domaine?.nom ?? contenu.domaineObserve} ».`;
    }

    /*
     * Même écriture que `rangement`, et c'est voulu : les deux posent un tag,
     * par la commande gouvernée d'ADR-107. Seule leur origine diffère — un
     * calcul d'observations là, une lecture d'intitulés ici.
     */
    case "rattachement": {
      await taguerCompetences(contenu.domaineId, [contenu.code], true);
      const domaine = referentiel.domainesParId.get(contenu.domaineId);
      return `Cette compétence apparaît maintenant dans « ${domaine?.nom ?? contenu.domaineId} ».`;
    }

    case "arete": {
      await relierCompetences(contenu.amont, contenu.aval);
      return "Le lien est enregistré.";
    }

    case "relation": {
      /*
       * Au moins un côté porte un code : `validerRelecture` écarte les
       * relations dont aucun côté n'existe, faute d'un domaine où placer la
       * compétence à créer.
       */
      const amont = contenu.amont.code;
      const aval = contenu.aval.code;
      if (amont && aval) {
        await relierCompetences(amont, aval);
        return "Le lien est enregistré.";
      }
      const ancre = (amont ?? aval)!;
      const skillAncre = referentiel.parCode.get(ancre);
      if (!skillAncre) throw new Error("La compétence citée n'est plus au référentiel.");
      const manquante = amont ? contenu.aval : contenu.amont;

      const revision = await appliquerRevision({
        domaineId: skillAncre.domaine,
        ajouts: [
          {
            intitule: manquante.intitule,
            palier: manquante.palier,
            /*
             * Importance au milieu de l'échelle : le tuteur ne la propose pas,
             * et la déduire du voisinage serait fabriquer une mesure. Même
             * choix que `appliquerRelationProposee`.
             */
            importance: "0.5",
          },
        ],
        modifications: [],
        retraits: [],
      });
      const code = revision.ajoutes[0] ?? revision.dejaAuReferentiel[0]?.code;
      if (!code) throw new Error(`La création de « ${manquante.intitule} » n'a rendu aucun code.`);

      if (amont) await relierCompetences(amont, code);
      else await relierCompetences(code, aval!);
      return `« ${manquante.intitule} » est ajoutée, et le lien est enregistré.`;
    }

    case "dormance": {
      const skill = referentiel.parCode.get(contenu.code);
      if (!skill) throw new Error("Cette compétence n'est plus au référentiel.");
      /*
       * `mettreDeCoteCompetence`, et surtout PAS `appliquerRevision`.
       *
       * Le commentaire qui vivait ici disait « retirée, donc ARCHIVÉE : une
       * compétence ne se supprime pas ». Il décrivait une intention, pas le
       * code : un retrait de révision laisse le SQL arbitrer, et il SUPPRIME
       * quand rien ne dépend de la compétence — soit exactement le cas d'une
       * dormance. La mise de côté détruisait donc ce qu'elle promettait de
       * conserver (constaté le 24/08/2026, ADR-118).
       */
      await mettreDeCoteCompetence(contenu.code);
      return `« ${skill.intitule} » est mise de côté. Vous pouvez la reprendre depuis son domaine.`;
    }

    case "manque": {
      const revision = await appliquerRevision({
        domaineId: contenu.domaineId,
        ajouts: [{ intitule: contenu.intitule, palier: contenu.palier, importance: "0.5" }],
        modifications: [],
        retraits: [],
      });
      const domaine = referentiel.domainesParId.get(contenu.domaineId);
      return revision.ajoutes.length > 0
        ? `« ${contenu.intitule} » rejoint « ${domaine?.nom ?? contenu.domaineId} ».`
        : `« ${contenu.intitule} » était déjà au référentiel : elle y apparaît désormais.`;
    }

    case "reformulation":
      throw new Error(
        "Récrire un intitulé vous appartient : ouvrez la fiche de la compétence pour le faire.",
      );
  }
}

export async function retenirProposition(id: string): Promise<ResultatArbitrage> {
  const proposition = await lireProposition(id);
  const referentiel = await lireReferentiel(await dorsaleCompte());

  /*
   * La commande D'ABORD, l'arbitrage ENSUITE.
   *
   * Si la commande lève — écran périmé (`40001`), collision de préfixe,
   * compétence disparue —, rien n'est inscrit : la proposition reste ouverte et
   * la personne peut réessayer après rafraîchissement. L'inverse marquerait
   * « retenue » une proposition dont rien n'a été écrit, et fausserait la seule
   * mesure dont dépend le test de réfutation d'ADR-108.
   */
  const message = await ecrireProposition(proposition.contenu, referentiel);
  await inscrireArbitrage(id, "retenue");
  revalidatePath("/", "layout");
  return { message };
}
