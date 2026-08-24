/**
 * Relire le référentiel entier, et proposer comment il pourrait se ranger et
 * s'étendre — ADR-108.
 *
 * ## Ce que ce module ajoute à ce qui existait
 *
 * `relations-referentiel.ts` (ADR-082) et `tags-competence.ts` (ADR-107)
 * travaillent **par fiche**, sur clic. Ils sont bons, et ils restent. Le
 * problème qu'ils ne résolvent pas est celui d'ADR-108 : à soixante-quinze
 * compétences, personne n'ouvre soixante-quinze fiches. Ce module lit le
 * référentiel d'un tenant et rend un lot.
 *
 * Il ne remplace rien : les quatre détecteurs déterministes de
 * `lib/engine/candidats-referentiel.ts` gardent leur place et leur priorité. Ce
 * qu'un calcul explique en une phrase n'a pas à être demandé à un modèle. Ce
 * module ne couvre que ce qu'aucun calcul ne voit — la paraphrase, le sujet
 * implicite, le prérequis qu'aucune co-mobilisation n'a encore révélé.
 *
 * ## Les intentions entrent comme contexte, jamais comme mesure
 *
 * Les deux textes du profil sont transmis **tels quels**. Aucune extraction,
 * aucune structure, rien de stocké : le système d'objectifs structurés a été
 * retiré le 21/08 (ADR-096) et ne revient pas par cette porte. Le tuteur lit une
 * phrase écrite par une personne, comme il lirait un message.
 *
 * ## Le travail récent, et l'écart assumé avec le texte d'ADR-108
 *
 * ADR-108 adosse le genre `manque` aux seules intentions déclarées, et le livre
 * désactivé. Maxime a tranché autrement le 22/08/2026 : il est **activé**, et
 * nourri **aussi** par le travail réellement fait. La raison est dans la demande
 * d'origine — « je vois que vous vous intéressez au kanban » n'est pas une
 * lecture d'objectif, c'est une lecture d'activité. Un référentiel qui n'écoute
 * que les objectifs déclarés ne dit jamais rien à quelqu'un qui n'en a pas
 * écrit.
 *
 * Le risque que l'ADR nomme reste entier : proposer une compétence absente
 * suppose de savoir ce qu'un sujet exige, ce qui est un jugement de programme.
 * Deux garde-fous, et c'est tout ce qui sépare cette proposition d'une
 * invention : l'`ancrage` est **obligatoire** et doit citer ce qui, dans le
 * compte, appelle ce savoir-faire ; et le taux de rétention du genre `manque`
 * est mesuré dès le premier lot. S'il ne tient pas, il se retire.
 *
 * ## Ce que ce module n'écrit pas
 *
 * Rien. Il rend un lot de propositions. Chacune s'arbitre séparément, et
 * l'écriture passe par les commandes gouvernées d'ADR-065. Le tuteur produit du
 * contenu, pas des mesures (P5) : aucune proposition ne crée d'observation ni de
 * niveau.
 */

import type { MoteurTuteur } from "./moteurs";
import { lireErreurMoteur, lireOutilsActifs } from "./moteurs";
import { OUTIL_RELECTURE, outilsRelecture, type PropositionRelecture } from "./outils";
import { REGLE_VOUVOIEMENT } from "./prompt";

export interface CompetenceRelue {
  code: string;
  intitule: string;
  palier: string;
}

export interface DomaineRelu {
  id: string;
  /** Le chemin lisible, « Sciences › Physique » — un sous-domaine seul se lit mal. */
  chemin: string;
  description: string;
  /** Les compétences taguées ICI, sans les héritées : on relit ce qui est déclaré. */
  competences: readonly CompetenceRelue[];
}

export interface EntreeRelecture {
  /** L'arbre des domaines vivants, avec ce que chacun porte. */
  domaines: readonly DomaineRelu[];
  /** Les compétences sans aucun tag — la zone « À classer » d'ADR-107. */
  aClasser: readonly CompetenceRelue[];
  /** Les prérequis DÉJÀ déclarés : ne pas reproposer ce qui existe. */
  relationsDeclarees: readonly { amont: string; aval: string }[];
  /**
   * Ce sur quoi la personne a réellement travaillé, du plus fréquent au moins.
   *
   * C'est un fait observé, pas une mesure de niveau : le nombre dit combien de
   * fois la compétence a été mobilisée, jamais si elle est acquise. Le tuteur ne
   * reçoit ni score, ni maîtrise, ni date — il n'a pas à lire un parcours pour
   * proposer un rangement.
   */
  travailRecent: readonly { code: string; intitule: string; mobilisations: number }[];
  /** Les deux textes du profil, VERBATIM. Aucune extraction (ADR-096). */
  intentions: { moyenTerme: string; longTerme: string };
  /**
   * Le genre `manque` est-il ouvert ? Question ouverte n°2 d'ADR-108.
   *
   * Fermé, le tuteur reçoit la consigne de rendre une liste vide, et la seconde
   * couche de validation la vide de toute façon côté serveur. Deux barrières,
   * parce qu'une consigne de prompt n'en est pas une.
   */
  elargissementActif: boolean;
}

export interface ResultatRelecture {
  lot: PropositionRelecture;
  outilsActifs: boolean;
  erreur: string | null;
}

/* ------------------------------------------------------------------ */
/* Le prompt                                                           */
/* ------------------------------------------------------------------ */

function ligneCompetence(competence: CompetenceRelue): string {
  return `  - ${competence.code} — ${competence.intitule} [${competence.palier}]`;
}

export function construirePromptRelecture(entree: EntreeRelecture): string {
  const domaines = entree.domaines.flatMap((domaine) => [
    domaine.description.trim()
      ? `- ${domaine.id} — ${domaine.chemin} : ${domaine.description.trim()}`
      : `- ${domaine.id} — ${domaine.chemin}`,
    ...domaine.competences.map(ligneCompetence),
    ...(domaine.competences.length === 0 ? ["  (aucune compétence taguée ici)"] : []),
  ]);

  const relations =
    entree.relationsDeclarees.length > 0
      ? entree.relationsDeclarees.map(({ amont, aval }) => `- ${amont} prépare ${aval}`)
      : ["- aucune relation déclarée pour l'instant"];

  const travail =
    entree.travailRecent.length > 0
      ? entree.travailRecent.map(
          (t) => `- ${t.code} — ${t.intitule} (mobilisée ${t.mobilisations} fois)`,
        )
      : ["- aucun travail récent enregistré"];

  const intentions = [
    entree.intentions.moyenTerme.trim()
      ? `- à moyen terme : « ${entree.intentions.moyenTerme.trim()} »`
      : "- à moyen terme : rien d'écrit",
    entree.intentions.longTerme.trim()
      ? `- à long terme : « ${entree.intentions.longTerme.trim()} »`
      : "- à long terme : rien d'écrit",
  ];

  return [
    "Tu es le tuteur du système pédagogique. Tu relis un référentiel de compétences en entier et tu proposes comment il pourrait mieux se ranger, et où il pourrait s'étendre.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Chaque proposition s'affiche seule et la personne l'accepte ou la refuse. Rien n'est écrit sans son geste. Une proposition refusée ne revient jamais : mieux vaut n'en faire aucune que d'en faire une mal fondée.",
    "",
    "LES DOMAINES ET CE QU'ILS PORTENT",
    ...domaines,
    "",
    ...(entree.aClasser.length > 0
      ? [
          "À CLASSER — des compétences qu'aucun domaine ne montre",
          ...entree.aClasser.map(ligneCompetence),
          "",
        ]
      : []),
    "LES PRÉREQUIS DÉJÀ DÉCLARÉS — ne les propose pas une seconde fois",
    ...relations,
    "",
    "LE TRAVAIL RÉCENT — ce sur quoi cette personne travaille vraiment",
    ...travail,
    "",
    "CE QU'ELLE A ÉCRIT VOULOIR",
    ...intentions,
    "",
    "CE QUE TU PROPOSES",
    "",
    "1. DES SOUS-DOMAINES (scissions).",
    "- Quand un domaine porte visiblement PLUSIEURS SUJETS DISTINCTS, propose d'en tirer un sous-domaine et dis quelles compétences y vont.",
    /*
     * L'exhaustivité, exigée explicitement.
     *
     * La consigne s'arrêtait à « dis quelles compétences y vont », et le modèle
     * en citait un échantillon représentatif. Constaté le 24/08/2026 : après la
     * création de « Gestion des stocks », deux compétences de stock étaient
     * restées dans le parent — et plus rien ne pouvait les y rattacher, la
     * scission n'étant plus reproposable une fois le domaine créé.
     */
    "- RELIS LA LISTE ENTIÈRE du domaine et cite TOUTES les compétences qui relèvent de ce sujet, sans en omettre une seule. Un échantillon ne suffit pas : une scission incomplète laisse le parent encombré, et les oubliées devront être rattachées une par une à la main.",
    "- Le critère n'est pas le nombre. Un domaine de quarante compétences qui traitent toutes du même sujet ne se découpe pas ; un domaine de neuf qui en porte deux se découpe. Ne découpe jamais pour faire baisser un compte.",
    "- Nomme le sous-domaine comme une personne le dirait — « Gestion kanban », pas « LOG-SOUS-2 ». Tu ne donnes ni identifiant ni préfixe : l'application les attribue.",
    /*
     * Le doublon, dit au modèle avant d'être filtré par le serveur.
     *
     * Constaté le 24/08/2026 sur un lot réel : « Résilience et optimisation des
     * réseaux logistiques » proposé alors que « Résilience logistique »
     * figurait dans la liste ci-dessus, avec ses trois compétences. La liste
     * était sous ses yeux ; rien ne lui disait de la relire avant de nommer.
     *
     * La consigne ne suffit pas — `produireLot` écarte le doublon quoi qu'il
     * réponde, même raisonnement qu'ADR-031 sur les `enum`. Elle vaut quand
     * même : filtrée, la proposition est perdue ; évitée, elle laisse la place
     * à un rattachement qui, lui, sert.
     */
    "- AVANT DE NOMMER, RELIS LA LISTE DES DOMAINES CI-DESSUS. Si l'un d'eux dit déjà ce sujet, même avec d'autres mots, NE PROPOSE PAS de le créer une seconde fois : propose un RATTACHEMENT vers le domaine qui existe. Un référentiel qui porte deux fois le même sujet sous deux noms ne se range plus.",
    /*
     * Nommer, ne pas compter.
     *
     * La justification demandait « combien de compétences parlent de ce sujet,
     * et lesquelles ». Le compte annoncé par le tuteur et le compte réel
     * divergent dès que `validerRelecture` écarte un code — un code archivé,
     * hors de l'`enum`, ou répété. Constaté le 24/08/2026 sur le premier lot
     * réel : la carte affichait « 4 compétences y seront rangées » sous un
     * motif qui en nommait cinq. Une carte qui se contredit ne s'arbitre pas.
     *
     * Le compte n'est pas perdu : `effet` le calcule à partir de la liste
     * VALIDÉE, et c'est le seul chiffre de la carte — donc toujours le vrai.
     */
    "- Dans ta justification, dis ce que tu as lu : NOMME les compétences concernées, sans annoncer de total chiffré. Le décompte est calculé et affiché ailleurs.",
    "",
    "2. DES PRÉREQUIS (relations).",
    "- Ce qu'il faut savoir faire avant autre chose, à l'échelle du référentiel entier et pas d'une seule fiche.",
    "- Ne propose que ce qu'aucune ligne des prérequis déjà déclarés ne dit.",
    "- Un prérequis est indicatif : il n'empêchera jamais personne de travailler. Ne le traite pas comme une serrure.",
    "",
    ...(entree.elargissementActif
      ? [
          "3. DES SAVOIR-FAIRE QUI MANQUENT (manques).",
          "- Un savoir-faire absent du référentiel que le travail récent ou ce qu'elle a écrit vouloir suppose.",
          "- L'ANCRAGE EST OBLIGATOIRE et doit CITER ce qui l'appelle : « vous avez travaillé N fois sur X », ou « vous avez écrit vouloir Y ». Sans cet ancrage, tu ne proposes pas un manque : tu écris un programme scolaire, et ce n'est pas ce qu'on te demande.",
          "- Reste proche. Si elle travaille le kanban, la méthode voisine de gestion de production est une bonne proposition ; la thermodynamique n'en est pas une.",
          "- Un savoir-faire OBSERVABLE, pas un sujet ni un titre de cours : « Dimensionner un supermarché de pièces », pas « Le lean manufacturing ».",
          "- RELIS LES INTITULÉS DÉJÀ AU RÉFÉRENTIEL avant d'en proposer un. Un savoir-faire déjà présent sous une autre formulation n'est pas un manque : le proposer dédoublerait ses observations. Il n'y a de manque que là où rien ne le dit.",
        ]
      : [
          "3. DES SAVOIR-FAIRE QUI MANQUENT (manques).",
          "- DÉSACTIVÉ pour ce compte. Rends une liste vide.",
        ]),
    "",
    "4. DES RATTACHEMENTS.",
    "- Une compétence DÉJÀ au référentiel qui gagnerait à être visible dans un domaine existant où elle ne l'est pas encore. Tu ne crées rien : tu désignes une compétence de la liste et un domaine de la liste.",
    "- C'est ce qui rattrape un découpage incomplet. Relis chaque domaine et demande-toi si une compétence rangée ailleurs relève manifestement de son sujet.",
    "- Ne le propose que si l'intitulé le justifie sans ambiguïté. Une compétence peut servir plusieurs domaines, mais un tag mal posé encombre une vue que personne ne nettoiera.",
    "",
    "RÈGLES QUI VALENT POUR TOUT",
    "- N'invente aucun code de compétence et aucun identifiant de domaine. Recopie exactement ceux des listes ci-dessus.",
    "- Justifie chaque ligne en partant de ce que tu as lu, jamais d'une généralité sur la discipline.",
    "- Si tu n'as rien de solide à proposer sur l'un des trois points, rends une liste vide. C'est une réponse, pas un échec.",
    "- Mieux vaut deux propositions justes que six plausibles : une personne qui refuse tout un lot cesse de lire le suivant.",
    /*
     * Le registre. Ces textes s'affichent TELS QUELS sur l'écran des
     * propositions : justifications, ancrages, descriptions. Le prompt te
     * tutoie parce qu'il s'adresse à toi ; ce que tu écris s'adresse à la
     * personne, et toute l'interface la vouvoie. Sans cette règle, l'ancrage
     * sortait en « Tu as travaillé 6 fois sur… » au milieu d'une carte qui dit
     * « Vous pourrez ensuite vous exercer dessus » — constaté le 24/08/2026 sur
     * le premier lot réel.
     */
    REGLE_VOUVOIEMENT,
    "",
    `Appelle l'outil ${OUTIL_RELECTURE} UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* L'appel                                                             */
/* ------------------------------------------------------------------ */

const LOT_VIDE: PropositionRelecture = {
  scissions: [],
  relations: [],
  manques: [],
  rattachements: [],
};

export async function relireReferentiel(
  moteur: MoteurTuteur,
  entree: EntreeRelecture,
  signal?: AbortSignal,
): Promise<ResultatRelecture> {
  /*
   * Un porteur plutôt qu'une variable : écrite dans une fermeture, une `let`
   * est vue comme jamais assignée par le vérificateur, qui la réduit ensuite à
   * `never` à la lecture. Même contournement que `tags-competence.ts`.
   */
  const recu: { valeur: PropositionRelecture | null } = { valeur: null };
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
    if ((evenement === "proposition-rejetee" || evenement === "tronque") && message) {
      rejet = message;
    }

    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; relecture?: PropositionRelecture };
      if (proposition.genre === "relecture" && proposition.relecture) {
        recu.valeur = proposition.relecture;
      }
    }
  };

  const codesVivants = [
    ...entree.domaines.flatMap((d) => d.competences.map((c) => c.code)),
    ...entree.aClasser.map((c) => c.code),
  ];
  const domainesVivants = entree.domaines.map((d) => d.id);

  await moteur.repondre({
    systemeStable: construirePromptRelecture(entree),
    systemeProfil: "",
    outils: [outilsRelecture([...new Set(codesVivants)], domainesVivants)],
    messages: [
      {
        role: "user" as const,
        content:
          "Relis mon référentiel. Qu'est-ce qui gagnerait à être rangé autrement, et qu'est-ce qui lui manque ?",
      },
    ],
    signal,
    envoyer,
  });

  const lot = recu.valeur;

  /*
   * Un lot vide n'est une erreur que si le tuteur n'a rien rendu du tout.
   * « Rien à proposer » est une réponse — et sur un référentiel déjà bien rangé,
   * c'est même la bonne. L'écran doit pouvoir la dire, plutôt que d'accuser une
   * panne qui n'a pas eu lieu.
   */
  const erreur =
    lot !== null
      ? null
      : (erreurMoteur ??
        refus ??
        rejet ??
        (outilsActifs
          ? "Le tuteur n'a rien proposé d'exploitable pour cette relecture."
          : "Le moteur du tuteur n'a pas armé ses outils."));

  /*
   * Le drapeau est réappliqué ICI, après la validation de schéma.
   *
   * La consigne du prompt dit déjà « rends une liste vide », mais une consigne
   * n'est pas une barrière : c'est exactement le raisonnement d'ADR-031 sur les
   * `enum`. Un genre livré fermé doit l'être côté serveur, quoi que le modèle
   * réponde.
   */
  const manques = entree.elargissementActif ? (lot?.manques ?? []) : [];

  return {
    lot: lot ? { ...lot, manques } : LOT_VIDE,
    outilsActifs,
    erreur,
  };
}
