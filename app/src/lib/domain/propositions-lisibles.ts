/**
 * Une proposition de relecture, telle qu'une personne la lit — ADR-108.
 *
 * ## Pourquoi ce module existe séparément
 *
 * `propositions-referentiel.ts` porte le vocabulaire de la mécanique :
 * `arete`, `dormance`, `reformulation`, `rangement`, `scission`, `relation`,
 * `manque`. Ces sept mots servent aux données, aux tests et à la mesure de
 * rétention — et **aucun ne doit atteindre l'écran**. Ce sont des termes de
 * maintenance du système, et une personne qui vient travailler ses compétences
 * n'a pas à apprendre comment le système se range lui-même.
 *
 * Ce module est la frontière. Tout ce qui s'affiche passe par ici, et ce qui
 * en sort est du français : une phrase qui dit ce qui est proposé, une phrase
 * qui dit ce qui se passera si on accepte, et les faits qui motivent.
 *
 * ## Ce que chaque carte doit dire, et pourquoi
 *
 * L'`effet` n'est pas une redite du titre : c'est ce qui permet d'accepter sans
 * craindre. « Elles resteront visibles dans le domaine d'origine » et « rien
 * n'est perdu, elle reste consultable » sont les deux phrases qui font la
 * différence entre un écran qu'on arbitre et un écran qu'on ferme. Un refus
 * étant définitif, une personne qui n'ose pas accepter refuse — et le lot se
 * vide sans que rien ne se range.
 *
 * ## Les trois sections
 *
 * Elles ne recopient pas les genres : elles répondent à trois questions
 * différentes, et un même genre pourrait changer de section sans que rien ne
 * change au modèle.
 */

import type {
  ContenuProposition,
  PropositionReferentielRelue,
} from "./propositions-referentiel";
import type { Referentiel } from "./types";

export type SectionProposition = "ranger" | "relier" | "elargir";

export interface EnteteSection {
  cle: SectionProposition;
  titre: string;
  sous_titre: string;
}

/**
 * L'ordre est celui de l'effort croissant : ranger ce qui existe coûte le moins
 * et rend le plus, agrandir le référentiel coûte le plus. Une personne qui
 * s'arrête après la première section a quand même fait le geste utile.
 */
export const SECTIONS: EnteteSection[] = [
  {
    cle: "ranger",
    titre: "Mettre de l'ordre",
    sous_titre: "Ce qui gagnerait à être rangé autrement.",
  },
  {
    cle: "relier",
    titre: "Relier ce qui existe",
    sous_titre: "Des liens entre vos compétences, et des intitulés à clarifier.",
  },
  {
    cle: "elargir",
    titre: "Aller plus loin",
    sous_titre: "Des savoir-faire voisins de ce que vous travaillez.",
  },
];

export interface PropositionLisible {
  id: string;
  section: SectionProposition;
  /** La phrase principale. Ce qui est proposé, tel qu'on le dirait. */
  titre: string;
  /**
   * Ce qui se passera si on accepte, y compris ce qui NE se passera pas.
   * C'est la phrase qui permet d'accepter sans craindre.
   */
  effet: string;
  /** Les faits qui motivent, tels que le détecteur ou le tuteur les a cités. */
  motifs: string[];
  /** Le libellé du bouton d'acceptation. `null` quand l'écriture appartient à la personne. */
  action: string | null;
  /** Où aller quand il n'y a rien à accepter d'un clic. */
  lien: { href: string; libelle: string } | null;
}

/* ------------------------------------------------------------------ */
/* Résolution des identifiants                                         */
/* ------------------------------------------------------------------ */

/**
 * L'intitulé d'un code, ou le code à défaut.
 *
 * Le repli sur le code est volontairement visible : une proposition qui cite une
 * compétence disparue doit se lire comme telle, pas se parer d'un intitulé
 * plausible. Même règle que `intituleDe` dans le moteur.
 */
function intitule(referentiel: Referentiel, code: string): string {
  return referentiel.parCode.get(code)?.intitule ?? code;
}

function nomDomaine(referentiel: Referentiel, id: string): string {
  return referentiel.domainesParId.get(id)?.nom ?? id;
}

function pluriel(n: number, singulier: string, plurielMot = `${singulier}s`): string {
  return `${n} ${n > 1 ? plurielMot : singulier}`;
}

/* ------------------------------------------------------------------ */
/* Traduction                                                          */
/* ------------------------------------------------------------------ */

function traduire(
  contenu: ContenuProposition,
  referentiel: Referentiel,
): Pick<PropositionLisible, "section" | "titre" | "effet" | "action" | "lien"> {
  switch (contenu.genre) {
    case "scission": {
      const parent = nomDomaine(referentiel, contenu.parentId);
      return {
        section: "ranger",
        titre: `Créer « ${contenu.nom} » dans « ${parent} »`,
        effet:
          `${pluriel(contenu.codes.length, "compétence")} de « ${parent} » y ${contenu.codes.length > 1 ? "seront rangées" : "sera rangée"}. ` +
          // La phrase qui permet d'accepter : la visibilité héritée d'ADR-107
          // fait qu'une scission ne retire rien nulle part.
          `Elles restent comptées dans « ${parent} », et rien ne change à vos résultats.`,
        action: "Créer ce sous-domaine",
        lien: null,
      };
    }

    case "rangement": {
      const ou = nomDomaine(referentiel, contenu.domaineObserve);
      return {
        section: "ranger",
        titre: `« ${intitule(referentiel, contenu.code)} » sert aussi « ${ou} »`,
        effet: `Elle apparaîtra dans « ${ou} » en plus de là où elle est déjà. Elle n'est pas déplacée, et elle n'est pas dupliquée.`,
        action: "L'ajouter à ce domaine",
        lien: null,
      };
    }

    /*
     * Volontairement rédigé comme `rangement` : pour la personne, les deux
     * disent la même chose — « celle-ci a sa place là-bas aussi ». Ce qui les
     * sépare est leur origine (un calcul d'observations d'un côté, une lecture
     * d'intitulés de l'autre), et cette origine est du vocabulaire de
     * maintenance. Elle reste dans les données, pas à l'écran.
     */
    case "rattachement": {
      const ou = nomDomaine(referentiel, contenu.domaineId);
      return {
        section: "ranger",
        titre: `« ${intitule(referentiel, contenu.code)} » a sa place dans « ${ou} »`,
        effet: `Elle apparaîtra dans « ${ou} » en plus de là où elle est déjà. Elle n'est ni déplacée ni dupliquée, et rien ne change à vos résultats.`,
        action: "L'ajouter à ce domaine",
        lien: null,
      };
    }

    case "dormance":
      return {
        section: "ranger",
        titre: `« ${intitule(referentiel, contenu.code)} » n'a jamais servi`,
        effet:
          "Elle sera mise de côté et cessera de compter dans votre couverture. " +
          // P4 / ADR-027 : rien ne se supprime. Le dire, sinon personne n'ose.
          "Rien n'est perdu : elle reste consultable, et vous pouvez la reprendre quand vous voulez.",
        action: "La mettre de côté",
        lien: null,
      };

    case "arete":
      return {
        section: "relier",
        titre: `« ${intitule(referentiel, contenu.amont)} » prépare « ${intitule(referentiel, contenu.aval)} »`,
        effet:
          "Le lien apparaîtra sur les deux fiches et guidera l'ordre des propositions. " +
          // `Skill.prerequis` est indicatif, jamais bloquant : le dire évite de
          // faire craindre une serrure.
          "Il ne vous empêchera jamais de travailler l'une avant l'autre.",
        action: "Enregistrer ce lien",
        lien: null,
      };

    case "relation": {
      const nomAmont = contenu.amont.code
        ? intitule(referentiel, contenu.amont.code)
        : contenu.amont.intitule;
      const nomAval = contenu.aval.code
        ? intitule(referentiel, contenu.aval.code)
        : contenu.aval.intitule;
      const neuve = !contenu.amont.code ? contenu.amont : !contenu.aval.code ? contenu.aval : null;
      return {
        section: "relier",
        titre: `« ${nomAmont} » prépare « ${nomAval} »`,
        effet: neuve
          ? `« ${neuve.intitule} » n'est pas encore à votre référentiel : elle y sera ajoutée, puis reliée. Le lien ne vous empêchera jamais de travailler dans l'ordre que vous voulez.`
          : "Le lien apparaîtra sur les deux fiches. Il ne vous empêchera jamais de travailler l'une avant l'autre.",
        action: "Enregistrer ce lien",
        lien: null,
      };
    }

    case "reformulation":
      return {
        section: "relier",
        titre: `« ${contenu.intitule} » dit plusieurs choses à la fois`,
        effet:
          "Tant qu'elle n'est pas récrite, vous ne pouvez plus lui régler son importance ni lui déclarer de lien. " +
          (contenu.aDesObservations
            ? "Vos traces de travail resteront attachées à cette compétence."
            : "Aucune trace n'y est attachée : l'intitulé se récrit sans rien perdre."),
        /*
         * Aucun bouton d'acceptation, et c'est le point.
         *
         * Récrire un intitulé est un geste de rédaction : personne d'autre que
         * la personne ne sait ce qu'elle voulait dire. Un bouton « accepter »
         * ici demanderait au système de choisir les mots à sa place, ce que P5
         * lui interdit — il produit du contenu, pas des décisions.
         */
        action: null,
        lien: { href: `/atelier?document=${contenu.code}`, libelle: "Ouvrir la fiche" },
      };

    case "manque":
      return {
        section: "elargir",
        titre: `« ${contenu.intitule} »`,
        effet: `Elle rejoindra « ${nomDomaine(referentiel, contenu.domaineId)} ». Vous pourrez ensuite vous exercer dessus comme sur les autres.`,
        action: "L'ajouter à mon référentiel",
        lien: null,
      };
  }
}

/**
 * Rend une proposition lisible.
 *
 * Pour le genre `manque`, l'ancrage passe en tête des motifs : c'est lui qui
 * répond à la seule question qui compte devant une compétence qu'on ne
 * connaît pas — « pourquoi celle-là, et pourquoi moi ? ». Sans elle en
 * premier, la carte se lit comme une suggestion générique.
 */
export function lire(
  proposition: PropositionReferentielRelue,
  referentiel: Referentiel,
): PropositionLisible {
  return {
    id: proposition.id,
    ...traduire(proposition.contenu, referentiel),
    motifs: proposition.motifs.filter((motif) => motif.trim().length > 0),
  };
}

export interface SectionLisible extends EnteteSection {
  propositions: PropositionLisible[];
}

/** Le lot rangé en sections, les vides retirées. */
export function lireEnSections(
  propositions: readonly PropositionReferentielRelue[],
  referentiel: Referentiel,
): SectionLisible[] {
  const lues = propositions.map((proposition) => lire(proposition, referentiel));
  return SECTIONS.map((section) => ({
    ...section,
    propositions: lues.filter((lue) => lue.section === section.cle),
  })).filter((section) => section.propositions.length > 0);
}
