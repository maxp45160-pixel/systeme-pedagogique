import "server-only";

/**
 * Persistance des propositions de relecture — ADR-108.
 *
 * Ce module lit et écrit des **faits datés** : « telle relecture, tel jour, a
 * proposé ceci », puis « telle personne, tel jour, l'a retenue ou refusée ».
 * Rien de dérivé n'y transite. La péremption, le lot ouvert et le taux de
 * rétention se calculent dans `lib/domain/propositions-referentiel.ts`, à
 * chaque lecture, et ne touchent jamais le disque.
 *
 * Volontairement HORS de `charger_tout`. Cette RPC est le chemin chaud de
 * toutes les pages ; un historique de propositions qui ne fait que grossir n'a
 * rien à y faire. Même raison que `chargerCandidatsReferentiel` et
 * `chargerMetriquesMoteur` : ce qui ne sert qu'à un écran se charge depuis cet
 * écran.
 */

import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import {
  estGenreProposition,
  type Arbitrage,
  type ContenuProposition,
  type DecisionArbitrage,
  type PropositionReferentielRelue,
} from "@/lib/domain/propositions-referentiel";
import type { DomaineId } from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

interface LigneProposition {
  id: string;
  lot_id: string;
  genre: string;
  domaine_id: string | null;
  empreinte: string;
  versions_lues: unknown;
  contenu: unknown;
  motifs: unknown;
  arbitrage: string | null;
  arbitre_le: string | null;
  created_at: string;
}

/**
 * Une ligne Supabase vers une proposition, ou `null`.
 *
 * Refuse plutôt que de rabattre. Une ligne dont le genre est inconnu, ou dont
 * le contenu n'est pas un objet, n'est pas réparable : on ne sait pas ce
 * qu'elle proposait, et fabriquer une proposition plausible à sa place serait
 * exactement l'invention que P2 interdit. Elle est écartée, et les autres
 * lignes du lot restent lisibles — une proposition est indépendante des autres.
 *
 * `versions_lues` illisible retombe sur `{}`, ce qui rend la proposition
 * **jamais périmée** plutôt que toujours périmée. C'est le choix le moins
 * mauvais : une proposition qu'on montre à tort s'arbitre en un clic, une
 * proposition qu'on cache à tort ne se découvre jamais.
 */
function ligneVersProposition(ligne: LigneProposition): PropositionReferentielRelue | null {
  if (!estGenreProposition(ligne.genre)) return null;

  const contenu = ligne.contenu;
  if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) return null;

  const versions: Record<DomaineId, number> = {};
  if (ligne.versions_lues && typeof ligne.versions_lues === "object") {
    for (const [cle, valeur] of Object.entries(ligne.versions_lues)) {
      if (typeof valeur === "number" && Number.isFinite(valeur)) versions[cle] = valeur;
    }
  }

  /*
   * L'arbitrage est tout ou rien : la contrainte
   * `propositions_arbitrage_complet` l'impose en base, et on ne fabrique pas
   * de date ici si elle manquait malgré tout (invariant 2 — une affirmation
   * sans source n'en est pas une).
   */
  const arbitrage: Arbitrage | null =
    ligne.arbitrage === "retenue" || ligne.arbitrage === "refusee"
      ? ligne.arbitre_le
        ? { decision: ligne.arbitrage, date: ligne.arbitre_le }
        : null
      : null;

  return {
    id: ligne.id,
    lotId: ligne.lot_id,
    genre: ligne.genre,
    domaineId: ligne.domaine_id,
    empreinte: ligne.empreinte,
    versionsLues: versions,
    contenu: contenu as ContenuProposition,
    motifs: Array.isArray(ligne.motifs)
      ? ligne.motifs.filter((m): m is string => typeof m === "string")
      : [],
    creeLe: ligne.created_at,
    arbitrage,
  };
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/**
 * Toutes les propositions du compte, arbitrées comprises.
 *
 * L'historique complet, et non le seul lot ouvert : les refus servent à filtrer
 * (« un refus ne revient pas »), et les arbitrages passés portent le taux de
 * rétention. Un filtre `arbitrage IS NULL` en SQL rendrait le lot du jour mais
 * perdrait les deux.
 */
export async function chargerPropositions(): Promise<PropositionReferentielRelue[]> {
  const dorsale = await dorsaleCompte();
  const { data, error } = await dorsale.supabase
    .from("propositions_referentiel")
    .select(
      "id, lot_id, genre, domaine_id, empreinte, versions_lues, contenu, motifs, arbitrage, arbitre_le, created_at",
    )
    .eq("user_id", dorsale.userId)
    .order("created_at", { ascending: false });
  verifier("lecture des propositions de référentiel", error);

  return ((data ?? []) as LigneProposition[])
    .map(ligneVersProposition)
    .filter((p): p is PropositionReferentielRelue => p !== null);
}

/* ------------------------------------------------------------------ */
/* Écriture                                                            */
/* ------------------------------------------------------------------ */

export interface PropositionAEnregistrer {
  id: string;
  genre: PropositionReferentielRelue["genre"];
  domaineId: DomaineId | null;
  empreinte: string;
  versionsLues: Record<DomaineId, number>;
  contenu: ContenuProposition;
  motifs: string[];
}

/**
 * Enregistre un lot entier.
 *
 * Une seule insertion, donc une seule transaction implicite : un lot à moitié
 * écrit produirait un écran qui montre trois propositions sur cinq sans que
 * rien ne dise que deux manquent.
 *
 * Aucun drapeau `app.referentiel_command` n'est posé, et c'est délibéré :
 * ADR-108 exige que la relecture tourne **hors** du chemin d'écriture du
 * référentiel. Écrire une proposition ne mute aucun agrégat, ne consomme aucune
 * version, et ne peut faire échouer aucune commande.
 */
export async function enregistrerLot(
  lotId: string,
  propositions: readonly PropositionAEnregistrer[],
): Promise<void> {
  if (propositions.length === 0) return;
  const dorsale = await dorsaleCompte();

  const { error } = await dorsale.supabase.from("propositions_referentiel").insert(
    propositions.map((proposition) => ({
      user_id: dorsale.userId,
      id: proposition.id,
      lot_id: lotId,
      genre: proposition.genre,
      domaine_id: proposition.domaineId,
      empreinte: proposition.empreinte,
      versions_lues: proposition.versionsLues,
      contenu: proposition.contenu,
      motifs: proposition.motifs,
    })),
  );
  verifier("enregistrement du lot de propositions", error);
}

/* ------------------------------------------------------------------ */
/* Le fait qu'une relecture a eu lieu                                  */
/* ------------------------------------------------------------------ */

export interface RelectureInscrite {
  versionsLues: Readonly<Record<DomaineId, number>>;
  produites: number;
  creeLe: string;
}

/**
 * La dernière relecture, quelle qu'ait été sa récolte.
 *
 * C'est elle qui rend « un lot vide » exprimable. Déduire la péremption des
 * seules propositions enregistrées se retourne dès qu'un lot n'a rien à
 * proposer — le cas normal d'un référentiel bien rangé : aucune ligne n'est
 * écrite, « à relire » reste vrai indéfiniment, et la relecture repart à
 * chaque ouverture de l'Atelier pour rappeler le modèle et ne rien produire.
 *
 * Un lot vide est une réponse. Cette lecture est ce qui permet de la lire.
 */
export async function derniereRelecture(): Promise<RelectureInscrite | null> {
  const dorsale = await dorsaleCompte();
  const { data, error } = await dorsale.supabase
    .from("relectures_referentiel")
    .select("versions_lues, produites, created_at")
    .eq("user_id", dorsale.userId)
    .order("created_at", { ascending: false })
    .limit(1);
  verifier("lecture de la dernière relecture", error);

  const ligne = (data ?? [])[0] as
    | { versions_lues: unknown; produites: number; created_at: string }
    | undefined;
  if (!ligne) return null;

  const versions: Record<DomaineId, number> = {};
  if (ligne.versions_lues && typeof ligne.versions_lues === "object") {
    for (const [cle, valeur] of Object.entries(ligne.versions_lues)) {
      if (typeof valeur === "number" && Number.isFinite(valeur)) versions[cle] = valeur;
    }
  }
  return { versionsLues: versions, produites: ligne.produites, creeLe: ligne.created_at };
}

/** Inscrit qu'une relecture a eu lieu sur ces versions. Zéro produite est normal. */
export async function inscrireRelecture(
  lotId: string,
  versionsLues: Record<DomaineId, number>,
  produites: number,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  const { error } = await dorsale.supabase.from("relectures_referentiel").insert({
    user_id: dorsale.userId,
    id: lotId,
    versions_lues: versionsLues,
    produites,
  });
  verifier("inscription de la relecture", error);
}

/**
 * Inscrit l'arbitrage d'une proposition.
 *
 * `arbitrage IS NULL` dans la clause : c'est la course qui compte ici. Deux
 * onglets ouverts sur le même lot arbitreraient deux fois, et le trigger
 * `propositions_referentiel_arbitrage_unique` lèverait — ce filtre fait que le
 * second geste ne touche simplement aucune ligne, sans faire échouer l'écran
 * sur une erreur que la personne ne peut pas corriger.
 *
 * Rend `true` si l'arbitrage a bien été posé par CE geste.
 */
export async function inscrireArbitrage(
  propositionId: string,
  decision: DecisionArbitrage,
): Promise<boolean> {
  const dorsale = await dorsaleCompte();
  const { data, error } = await dorsale.supabase
    .from("propositions_referentiel")
    .update({ arbitrage: decision, arbitre_le: new Date().toISOString() })
    .eq("user_id", dorsale.userId)
    .eq("id", propositionId)
    .is("arbitrage", null)
    .select("id");
  verifier("arbitrage d'une proposition", error);
  return (data ?? []).length > 0;
}
