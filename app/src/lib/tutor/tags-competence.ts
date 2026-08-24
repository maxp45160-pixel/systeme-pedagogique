/**
 * Demander au tuteur où une compétence sert (ADR-107).
 *
 * ADR-106 avait tenté de déduire les regroupements des seuls intitulés. C'est
 * réfuté : le partage de termes rate la paraphrase, confond la polysémie, et
 * ne dit rien du domaine où une compétence sert réellement. ADR-107 tranche
 * autrement — les domaines sont des tags, et **une personne les pose**.
 *
 * Ce module est ce qui rend ce geste court sans le rendre automatique : le
 * tuteur lit l'intitulé de la compétence et les domaines du compte, et propose
 * une liste courte, motivée, à cocher. Le classement lexical n'écrit rien ici
 * non plus.
 *
 * Deux interdits, exactement ceux de `rattachement-carte.ts` :
 *
 * - **nommer un domaine neuf.** L'`enum` est fermé sur les domaines vivants du
 *   compte, relu côté serveur (`outilsTagsCompetence`). Créer un domaine est
 *   une commande gouvernée (ADR-065), pas la retombée d'une suggestion ;
 * - **taguer.** L'appel produit une proposition. L'écriture reste
 *   `taguerCompetences`, déclenchée par un clic.
 *
 * Aucune donnée personnelle ne part : l'intitulé de la compétence, son palier,
 * et le nom des domaines du compte. Ni observation, ni niveau, ni date — le
 * tuteur situe un savoir-faire, il ne lit pas un parcours.
 */

import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs } from "./moteurs";
import { outilsTagsCompetence, type PropositionTagsCompetence } from "./outils";
import { REGLE_VOUVOIEMENT } from "./prompt";

export interface DomaineProposable {
  id: string;
  nom: string;
  /** Le chemin lisible, « Sciences › Physique » — un sous-domaine seul se lit mal. */
  chemin: string;
  description: string;
}

export interface EntreeTagsCompetence {
  code: string;
  intitule: string;
  palier: string;
  /** Les domaines vivants du compte — le seul vocabulaire admis. */
  domaines: readonly DomaineProposable[];
}

export interface ResultatTagsCompetence {
  /** Les tags proposés, déjà filtrés sur les domaines connus. Jamais écrits. */
  tags: PropositionTagsCompetence["tags"];
  /** Les tags déjà posés, retirés de la proposition : il n'y a rien à y faire. */
  dejaPoses: string[];
  outilsActifs: boolean;
  erreur: string | null;
}

export function construirePromptTagsCompetence(entree: EntreeTagsCompetence): string {
  const lignesDomaines = entree.domaines.map((domaine) =>
    domaine.description.trim()
      ? `- ${domaine.id} — ${domaine.chemin} : ${domaine.description.trim()}`
      : `- ${domaine.id} — ${domaine.chemin}`,
  );

  return [
    "Tu es le tuteur du système pédagogique. Tu proposes dans quels domaines une compétence sert.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Ta proposition s'affiche seule et la personne coche ce qu'elle garde. Rien n'est écrit sans son geste.",
    "",
    "LA COMPÉTENCE",
    `- ${entree.intitule}`,
    `- palier : ${entree.palier}`,
    "",
    "LES DOMAINES DU COMPTE — tu ne peux désigner que l'un de ces identifiants",
    ...(lignesDomaines.length > 0 ? lignesDomaines : ["- aucun domaine pour l'instant"]),
    "",
    "RÈGLES",
    "- Un domaine par ligne, et seulement ceux que l'intitulé justifie vraiment.",
    "- Une compétence peut servir plusieurs domaines : « lire un tableau de données » sert les statistiques ET la logistique. Ne t'en tiens pas à un seul par principe.",
    "- Mais ne remplis pas la liste : trois tags mal fondés coûtent plus qu'un seul juste.",
    "- Un domaine et l'un de ses sous-domaines ne se proposent pas ensemble. Le sous-domaine suffit — la compétence remonte toute seule vers ses parents.",
    "- Si aucun domaine existant ne convient, rends une liste vide. C'est une réponse, pas un échec : la personne créera le domaine qui manque.",
    "- N'invente aucun identifiant. Recopie exactement celui de la liste.",
    "- Justifie chaque tag en une phrase, en partant de ce que la compétence fait faire.",
    "",
    REGLE_VOUVOIEMENT,
    "Appelle l'outil proposer_tags_competence UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

export async function proposerTagsCompetence(
  moteur: MoteurTuteur,
  entree: EntreeTagsCompetence,
  /** Les tags déjà posés : proposés à nouveau, ils feraient cocher du vide. */
  dejaPoses: readonly string[] = [],
  signal?: AbortSignal,
): Promise<ResultatTagsCompetence> {
  /*
   * Un porteur plutôt qu'une variable : écrite dans une fermeture, une `let`
   * est vue comme jamais assignée par le vérificateur, qui la réduit ensuite
   * à `never` à la lecture.
   */
  const recu: { valeur: PropositionTagsCompetence | null } = { valeur: null };
  let outilsActifs = true;

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
      const proposition = donnees as { genre: string; tags?: PropositionTagsCompetence };
      if (proposition.genre === "tags" && proposition.tags) recu.valeur = proposition.tags;
    }
  };

  await moteur.repondre({
    systemeStable: construirePromptTagsCompetence(entree),
    systemeProfil: "",
    outils: [outilsTagsCompetence(entree.domaines.map((domaine) => domaine.id))],
    messages: [
      {
        role: "user" as const,
        content: `Dans quels domaines « ${entree.intitule} » (${entree.code}) sert-elle ?`,
      },
    ],
    signal,
    envoyer,
  });

  const proposition = recu.valeur;
  const poses = new Set(dejaPoses);
  const retenus = (proposition?.tags ?? []).filter((tag) => !poses.has(tag.domaineId));

  /*
   * Une liste vide n'est une erreur que si le tuteur n'a rien rendu du tout.
   * « Aucun domaine existant ne convient » est une réponse : l'écran doit
   * pouvoir la dire, plutôt que d'accuser une panne qui n'a pas eu lieu.
   */
  const erreur =
    proposition !== null
      ? null
      : (erreurMoteur ??
        refus ??
        rejet ??
        (outilsActifs
          ? "Le tuteur n'a proposé aucun domaine exploitable."
          : "Le moteur du tuteur n'a pas armé ses outils."));

  return {
    tags: retenus,
    dejaPoses: (proposition?.tags ?? [])
      .filter((tag) => poses.has(tag.domaineId))
      .map((tag) => tag.domaineId),
    outilsActifs,
    erreur,
  };
}
