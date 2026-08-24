/**
 * Proposer les prérequis et les suites d'une compétence — sans rien demander.
 *
 * Le besoin, dans les mots de Maxime : « que la déclaration de prérequis et
 * compétences soit intelligente et ne demande pas d'input ». Les deux cadres de
 * la fiche étaient vides et le restaient : `competences.prerequis` ne se
 * remplissait qu'à l'import d'un référentiel, et aucun écran ne l'écrivait.
 *
 * Ce qui part dans le prompt, et pourquoi :
 *
 * 1. **la compétence lue** — son intitulé, son palier, son domaine : c'est
 *    l'objet du raisonnement ;
 * 2. **les compétences actives du compte, avec leur domaine**, parce que la
 *    proposition doit pouvoir en DÉSIGNER une plutôt que d'en créer une
 *    deuxième fois. C'est l'`enum` de `codeExistant` ;
 * 3. **les domaines existants**, parce que chaque proposition doit dire où elle
 *    vit. Sans ça, un prérequis venu d'un autre champ atterrit dans le domaine
 *    de la fiche ouverte, et les domaines enflent sans arbitrage ;
 * 4. **les relations déjà déclarées**, pour ne pas les reproposer.
 *
 * Le tuteur n'applique rien : chaque relation se valide séparément, et
 * l'écriture passe par les commandes du référentiel comme n'importe quelle
 * autre — c'est là que se décide « rattacher un homonyme » ou « créer ».
 */

import type { Skill } from "@/lib/domain/types";
import { PHRASE_MESURABILITE } from "@/lib/domain/atomicite";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilsRelations, type PropositionRelations } from "./outils";
import { REGLE_VOUVOIEMENT } from "./prompt";

export interface ResultatRelations {
  relations: PropositionRelations | null;
  outilsActifs: boolean;
  erreur: string | null;
}

export interface EntreeRelations {
  skill: Skill;
  domaineNom: string;
  /** Les compétences actives du compte : l'ensemble que l'`enum` énumérera. */
  actifs: readonly Skill[];
  /** Les domaines vivants, dans l'ordre d'affichage. */
  domaines: readonly { id: string; nom: string }[];
  /** Ce que la compétence lue ouvre déjà, dérivé de `prerequis` des autres. */
  suivantes: readonly string[];
}

export function construirePromptRelations(entree: EntreeRelations): string {
  const { skill, domaineNom, actifs, domaines, suivantes } = entree;
  const nomsParDomaine = new Map(domaines.map((domaine) => [domaine.id, domaine.nom]));

  const lignesCompetences = actifs
    .filter((candidat) => candidat.code !== skill.code)
    .map(
      (candidat) =>
        `- ${candidat.code} — ${candidat.intitule} (palier ${candidat.palier}, domaine ${
          nomsParDomaine.get(candidat.domaine) ?? candidat.domaine
        })`,
    );

  const lignesDomaines = domaines.map((domaine) => `- ${domaine.id} — ${domaine.nom}`);

  return [
    "Tu es le tuteur du système pédagogique. Tu proposes la place d'une compétence dans une progression : ce qui la précède, ce qu'elle ouvre.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Chaque relation s'affiche seule et la personne la valide ou l'écarte. Rien n'est écrit sans son geste.",
    "",
    "LA COMPÉTENCE LUE",
    `- ${skill.code} — ${skill.intitule} (palier ${skill.palier}, domaine ${domaineNom})`,
    "",
    "DÉJÀ DÉCLARÉ — ne le repropose pas",
    ...(skill.prerequis.length > 0
      ? skill.prerequis.map((code) => `- prérequis : ${code}`)
      : ["- aucun prérequis"]),
    ...(suivantes.length > 0
      ? suivantes.map((code) => `- suite : ${code}`)
      : ["- aucune suite"]),
    "",
    "COMPÉTENCES DÉJÀ AU RÉFÉRENTIEL",
    ...(lignesCompetences.length > 0 ? lignesCompetences : ["- aucune"]),
    "",
    "DOMAINES EXISTANTS",
    ...(lignesDomaines.length > 0 ? lignesDomaines : ["- aucun"]),
    "",
    "RÈGLES",
    "- Chaque proposition porte un intitulé, un palier et un domaine. Jamais de code neuf : l'application l'attribue.",
    "- Si la relation désigne une compétence de la liste ci-dessus, mets son code dans codeExistant ET recopie son intitulé. Préfère toujours désigner plutôt que créer.",
    "- domaineId doit être l'identifiant d'un domaine de la liste. **Si aucun ne convient, omets le champ** : la proposition sera montrée à la personne comme demandant un domaine neuf, ce qu'elle décidera elle-même. N'invente pas de domaine, et ne range pas par défaut dans le domaine de la compétence lue.",
    "- Un prérequis est ce qu'il faut savoir faire AVANT. Une suite est ce que la compétence lue rend possible. Ne mets pas la même compétence des deux côtés.",
    "- Un prérequis est normalement d'un palier inférieur ou égal, une suite d'un palier supérieur ou égal.",
    `- Chaque intitulé doit être mesurable : ${PHRASE_MESURABILITE}.`,
    "- Justifie chaque relation en une phrase, en partant de la compétence lue.",
    "- Cinq propositions maximum de chaque côté. Mieux vaut trois justes que cinq approximatives.",
    "",
    REGLE_VOUVOIEMENT,
    `Appelle l'outil proposer_relations UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.`,
  ].join("\n");
}

export async function proposerRelations(
  moteur: MoteurTuteur,
  entree: EntreeRelations,
  signal?: AbortSignal,
): Promise<ResultatRelations> {
  let relations: PropositionRelations | null = null;
  let outilsActifs = true;
  /*
   * Toutes les pannes se disent, et aucune ne se déguise en silence du tuteur.
   *
   * Un seul outil est armé, donc `tool_choice` force l'appel : le modèle ne
   * peut pas « préférer bavarder ». Quand rien n'arrive, c'est l'une de quatre
   * choses, et les moteurs les nomment toutes — **mais `repondre` ne lève pas**
   * sur une erreur HTTP : elle l'émet et rend la main (`compatible-openai.ts`,
   * chemin `!reponse.ok`). Sans ces lectures, un 400 du fournisseur, une clé
   * expirée, un JSON tronqué et un refus de garde-fou s'affichaient tous
   * « le tuteur n'a proposé aucune relation exploitable ».
   *
   * `lireErreurMoteur` est le lecteur de la maison, écrit après l'incident du
   * 16/08/2026 où une clé Mistral expirée a fait passer trois écrans pour
   * cassés. Une règle, une autorité.
   *
   * Priorité décroissante : une erreur de transport explique tout le reste.
   */
  let erreurMoteur: string | null = null;
  let refus: string | null = null;
  let rejet: string | null = null;

  const envoyer = (evenement: string, donnees: unknown) => {
    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;

    erreurMoteur = lireErreurMoteur(evenement, donnees) ?? erreurMoteur;
    const message = (donnees as { message?: string } | null)?.message ?? null;
    if (evenement === "refus" && message) refus = message;
    if ((evenement === "proposition-rejetee" || evenement === "tronque") && message) rejet = message;

    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; relations?: PropositionRelations };
      if (proposition.genre === "relations" && proposition.relations) {
        relations = proposition.relations;
      }
    }
  };

  /*
   * Les codes et les domaines de l'`enum` sont ceux relus côté serveur, sous
   * RLS : rien ne peut désigner une compétence d'un autre compte.
   */
  const codesActifs = entree.actifs
    .filter((candidat) => candidat.code !== entree.skill.code)
    .map((candidat) => candidat.code);

  await moteur.repondre({
    systemeStable: construirePromptRelations(entree),
    systemeProfil: "",
    outils: [outilsRelations(codesActifs, entree.domaines.map((domaine) => domaine.id))],
    messages: [
      {
        role: "user" as const,
        content: `Où se place ${entree.skill.code} — « ${entree.skill.intitule} » — dans une progression ?`,
      },
    ],
    signal,
    envoyer,
  });

  const erreur =
    relations !== null
      ? null
      : (erreurMoteur ??
        refus ??
        rejet ??
        (outilsActifs
          ? "Le tuteur n'a proposé aucune relation exploitable."
          : messageSansOutils("la proposition de relations")));

  return { relations, outilsActifs, erreur };
}
