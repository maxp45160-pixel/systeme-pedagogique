/**
 * Demander au tuteur où situer un domaine sur la carte des savoirs.
 *
 * Le rapprochement lexical (`lib/engine/classification-domaine.ts`) suffit
 * quand le nom du domaine porte le vocabulaire de sa discipline. Il se tait
 * quand ce n'est pas le cas — « Recherche opérationnelle », « Prise de parole »,
 * un nom propre, un intitulé maison. C'est exactement là que le tuteur sert :
 * il lit les compétences, pas seulement le nom.
 *
 * Ce que le tuteur ne peut pas faire, et qui n'est pas négociable :
 *
 * - **nommer une région neuve.** L'`enum` est fermé sur `enumNoeudsCarte()`,
 *   relu côté serveur. Même garde-fou que pour les codes de compétence : la
 *   carte est un référentiel partagé, un nœud inventé n'y a aucun sens ;
 * - **rattacher.** L'appel d'outil produit une proposition, rien d'autre.
 *   L'écriture reste le geste d'une personne (`rattacherDomaineACarte`), et
 *   c'est ce geste qui enregistre `origine: "tuteur"`.
 *
 * Aucune donnée personnelle ne part : le nom du domaine, sa description et les
 * intitulés de ses compétences. Ni observation, ni niveau, ni date — le tuteur
 * situe un sujet, il ne lit pas un parcours.
 */

import { enumNoeudsCarte, noeudCarte, noeudsRattachables } from "@/lib/domain/carte-savoirs";
import { libelleChemin } from "@/lib/engine/classification-domaine";
import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs } from "./moteurs";
import { outilsRattachementCarte, type PropositionRattachementCarte } from "./outils";

export interface EntreeRattachementCarte {
  domaineId: string;
  nom: string;
  description: string;
  /** Intitulés des compétences du domaine — ce qui le décrit vraiment. */
  intitules: readonly string[];
}

export interface ResultatRattachementCarte {
  carte: PropositionRattachementCarte | null;
  /** Le chemin lisible du nœud proposé, résolu côté serveur. */
  chemin: string | null;
  outilsActifs: boolean;
  erreur: string | null;
}

/** Au-delà, le prompt gonfle sans rien apprendre de plus sur le sujet. */
const INTITULES_MAX = 25;

export function construirePromptRattachementCarte(entree: EntreeRattachementCarte): string {
  const lignesCarte = noeudsRattachables().map(
    (noeud) => `- ${noeud.id} — ${libelleChemin(noeud.id)}`,
  );
  const intitules = entree.intitules.slice(0, INTITULES_MAX);

  return [
    "Tu es le tuteur du système pédagogique. Tu situes un domaine de travail sur une carte partagée des savoirs.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Ta proposition s'affiche seule et la personne la valide ou l'écarte. Rien n'est écrit sans son geste.",
    "",
    "LE DOMAINE À SITUER",
    `- ${entree.nom}`,
    ...(entree.description.trim() ? [`- description : ${entree.description.trim()}`] : []),
    "",
    "SES COMPÉTENCES",
    ...(intitules.length > 0 ? intitules.map((titre) => `- ${titre}`) : ["- aucune pour l'instant"]),
    ...(entree.intitules.length > intitules.length
      ? [`- (et ${entree.intitules.length - intitules.length} autres)`]
      : []),
    "",
    "LA CARTE — tu ne peux désigner que l'un de ces identifiants",
    ...lignesCarte,
    "",
    "RÈGLES",
    "- Choisis UNE région, celle qui situe le mieux ce domaine. Pas une liste.",
    "- Lis les compétences autant que le nom : c'est ce qu'on y fait qui situe un domaine, pas son titre.",
    "- La carte n'est ni exhaustive ni parfaite. Si aucune région ne convient vraiment, prends la moins fausse et dis-le franchement dans ta justification.",
    "- Si tu hésites entre deux régions, choisis-en une et nomme l'autre dans ta justification. La personne tranchera.",
    "- N'invente aucun identifiant. Recopie exactement celui de la liste.",
    "- Justifie en une à deux phrases, en partant de ce que fait ce domaine.",
    "",
    "Appelle l'outil proposer_rattachement_carte UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  ].join("\n");
}

export async function proposerRattachementCarte(
  moteur: MoteurTuteur,
  entree: EntreeRattachementCarte,
  signal?: AbortSignal,
): Promise<ResultatRattachementCarte> {
  /*
   * Un porteur plutôt qu'une variable : écrite dans une fermeture, une `let`
   * est vue comme jamais assignée par le vérificateur, qui la réduit ensuite
   * à `never` à la lecture.
   */
  const recu: { valeur: PropositionRattachementCarte | null } = { valeur: null };
  let outilsActifs = true;

  /*
   * Toutes les pannes se disent — même lecture que `relations-referentiel.ts`,
   * et pour la même raison : `repondre` ne lève pas sur une erreur HTTP, elle
   * l'émet. Sans ces lectures, une clé expirée s'affiche « le tuteur n'a rien
   * proposé », et l'écran passe pour cassé alors que c'est le fournisseur.
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
      const proposition = donnees as { genre: string; carte?: PropositionRattachementCarte };
      if (proposition.genre === "carte" && proposition.carte) recu.valeur = proposition.carte;
    }
  };

  await moteur.repondre({
    systemeStable: construirePromptRattachementCarte(entree),
    systemeProfil: "",
    outils: [outilsRattachementCarte(enumNoeudsCarte())],
    messages: [
      {
        role: "user" as const,
        content: `Où situer « ${entree.nom} » sur la carte des savoirs ?`,
      },
    ],
    signal,
    envoyer,
  });

  const proposition = recu.valeur;

  const erreur =
    proposition !== null
      ? null
      : (erreurMoteur ??
        refus ??
        rejet ??
        (outilsActifs
          ? "Le tuteur n'a proposé aucune région exploitable."
          : "Le moteur du tuteur n'a pas armé ses outils."));

  return {
    carte: proposition,
    /*
     * Le chemin est résolu ici, pas rendu par le modèle : il ne doit décrire
     * que la carte réelle. Un `noeud` validé existe forcément, mais on ne
     * fabrique rien si la carte a bougé entre-temps.
     */
    chemin:
      proposition && noeudCarte(proposition.noeud) ? libelleChemin(proposition.noeud) : null,
    outilsActifs,
    erreur,
  };
}
