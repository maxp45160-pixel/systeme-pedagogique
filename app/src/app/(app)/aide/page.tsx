import Link from "next/link";
import { EntetePage } from "@/components/layout/entete-page";
import {
  BandeauInfo,
  Carte,
  CorpsCarte,
  EnTeteCarte,
  TitreSection,
  classesLienBouton,
} from "@/components/ui/primitives";
import { NIVEAUX } from "@/lib/domain/types";
import { BoutonRelancerTour } from "@/components/onboarding/bouton-relancer-tour";

/**
 * Tutoriel d'entrée : ce qu'un compte neuf doit comprendre avant de travailler.
 *
 * Statique et sans état — rien n'est lu en base. Ce que la page décrit est le
 * fonctionnement du produit, pas les données du compte : elle ne doit donc
 * jamais afficher de mesure ni d'exemple chiffré, qui passerait pour une
 * donnée réelle. L'échelle de niveaux est le seul contenu importé
 * (`NIVEAUX`) : c'est une constante du protocole, pas une mesure, et la
 * recopier ici la ferait diverger du moteur.
 *
 * Trois blocs, dans l'ordre où un débutant en a besoin :
 *  1. le parcours écran par écran — ce que tu vois / fais / ce qu'il en fait ;
 *  2. le vocabulaire, sans lequel les écrans restent opaques ;
 *  3. les questions fréquentes, en `<details>` natif — pas de composant
 *     client, pas de JavaScript, et le contenu reste trouvable par la
 *     recherche du navigateur même replié.
 */

interface Etape {
  numero: number;
  titre: string;
  ou: string;
  /** Ce qui est affiché à l'écran à ce moment-là. */
  vois: string;
  /** L'action attendue de l'utilisateur. */
  fais: string;
  /** Ce que le système enregistre ou déduit derrière. */
  effet: string;
  lien?: { href: string; libelle: string };
}

const ETAPES: Etape[] = [
  {
    numero: 1,
    titre: "Déclarer ce que tu veux travailler",
    ou: "Écran de démarrage",
    vois:
      "Trois champs : le sujet de ta formation, l'objectif que tu vises à moyen terme, celui à long terme. Rien d'autre — pas d'assistant en douze étapes.",
    fais:
      "Tu réponds aux trois. Ce sont les seules choses que le système ne peut pas déduire : sans objectif déclaré, l'importance d'une compétence ne se rapporte à rien.",
    effet:
      "Le tuteur ouvre une conversation et construit ton référentiel à partir de tes réponses : des domaines, puis des compétences codées à l'intérieur. Tu valides ce qui entre.",
    lien: { href: "/demarrer", libelle: "Ouvrir l'écran de démarrage" },
  },
  {
    numero: 2,
    titre: "Reconnaître ton référentiel",
    ou: "Atelier",
    vois:
      "Tes domaines, et dans chacun les compétences avec leur code (ex. LOG-01). La plupart n'ont pas encore de niveau : un tiret, pas un zéro. C'est normal — rien n'a encore été démontré.",
    fais:
      "Tu ouvres deux ou trois fiches pour voir de quoi elles parlent. Tu corriges ce qui est faux : une compétence mal formulée s'édite, une hors sujet s'archive, une manquante s'ajoute.",
    effet:
      "Le référentiel appartient à ton compte : le modifier ne casse rien. Une compétence déjà soutenue par des preuves est archivée, jamais supprimée — effacer l'objet effacerait l'historique posé dessus.",
    lien: { href: "/atelier", libelle: "Ouvrir l'Atelier" },
  },
  {
    numero: 3,
    titre: "Composer ta première séance",
    ou: "Cahier",
    vois:
      "Le compositeur : les compétences que tu peux viser, le nombre d'exercices, le temps dont tu disposes. En dessous, la file des séances en cours ou planifiées.",
    fais:
      "Tu choisis une ou deux compétences et tu déclares ton temps réel. Vise court pour la première fois : mieux vaut une séance finie qu'une séance abandonnée.",
    effet:
      "Le tuteur génère les exercices, calibrés sur les compétences visées et sur la durée. Il produit du contenu — jamais de mesure, et jamais un code de compétence qu'il aurait inventé.",
    lien: { href: "/seances", libelle: "Ouvrir le Cahier" },
  },
  {
    numero: 4,
    titre: "Dérouler la séance",
    ou: "Cahier · séance en cours",
    vois:
      "Un exercice à la fois : l'énoncé, ta zone de réponse, puis la correction, puis l'évaluation.",
    fais:
      "Tu réponds sans t'aider, tu compares à la correction, puis tu évalues honnêtement : c'est ton autonomie réelle sur cet exercice qui donne sa valeur à la preuve. Te surnoter fausse tout ce qui suit.",
    effet:
      "Chaque exercice évalué devient une preuve rattachée à sa compétence, avec sa source. Un exercice sauté ou une séance abandonnée ne produisent aucune preuve : rien ne bouge, et c'est voulu.",
  },
  {
    numero: 5,
    titre: "Lire ce que ça a changé",
    ou: "Tableau de bord",
    vois:
      "La prochaine action proposée, et l'état de ce que tu travailles. Les niveaux ne sont pas stockés : ils sont recalculés à partir des preuves à chaque affichage.",
    fais:
      "Tu suis la prochaine action, ou tu retournes composer. En cas de doute sur un niveau, tu ouvres la fiche : les preuves qui le soutiennent sont listées.",
    effet:
      "La boucle recommence à l'étape 3, mais mieux ciblée. Une faiblesse ne disparaît pas avec le temps : seule une nouvelle démonstration la lève.",
    lien: { href: "/", libelle: "Ouvrir le tableau de bord" },
  },
];

const PREMIERE_HEURE: string[] = [
  "Renseigner sujet et objectifs sur l'écran de démarrage.",
  "Laisser le tuteur proposer un premier référentiel, et le relire.",
  "Archiver ce qui est hors sujet, ajouter une compétence oubliée.",
  "Composer une séance courte sur une seule compétence.",
  "La dérouler jusqu'au bout, en s'évaluant honnêtement.",
  "Revenir au tableau de bord et suivre la prochaine action.",
];

interface Terme {
  mot: string;
  definition: string;
}

const VOCABULAIRE: Terme[] = [
  {
    mot: "Domaine",
    definition:
      "Un regroupement de compétences, propre à ton compte. Il porte un préfixe de code (ex. « LOG ») dont héritent ses compétences.",
  },
  {
    mot: "Compétence",
    definition:
      "Un savoir-faire précis, identifié par un code (ex. LOG-01). C'est l'unité que le système mesure : tout le reste s'y rattache.",
  },
  {
    mot: "Preuve",
    definition:
      "Un fait observé qui soutient un niveau : une évaluation d'exercice, ou une démonstration saisie à la main. Une preuve garde toujours sa source.",
  },
  {
    mot: "Niveau",
    definition:
      "Le résultat du calcul fait sur les preuves d'une compétence. Il n'est pas stocké : il est recalculé, donc il change dès qu'une preuve s'ajoute.",
  },
  {
    mot: "Autonomie",
    definition:
      "Le degré d'aide dont tu as eu besoin sur un exercice, de « solution fournie » à « autonome avec initiative ». C'est le facteur qui pèse le plus sur la valeur d'une preuve.",
  },
  {
    mot: "Séance",
    definition:
      "Un ensemble d'exercices déroulé en une fois, sur un temps déclaré. C'est le seul endroit où des preuves se créent par le travail.",
  },
  {
    mot: "Référentiel",
    definition:
      "L'ensemble de tes domaines et compétences. Il t'appartient, se modifie à tout moment, et n'est jamais partagé sans ton accord explicite.",
  },
  {
    mot: "Tuteur",
    definition:
      "L'assistant qui rédige les exercices, les corrections et les propositions de compétences. Il produit du contenu, jamais des mesures.",
  },
];

interface Question {
  q: string;
  r: string;
}

const QUESTIONS: Question[] = [
  {
    q: "Pourquoi certaines compétences n'affichent-elles aucun niveau ?",
    r: "Parce qu'aucune preuve ne les soutient encore. Une absence de preuve n'est pas un zéro : le système préfère un tiret à un chiffre inventé. Le niveau apparaît à la première évaluation.",
  },
  {
    q: "D'où vient le niveau affiché sur une fiche de compétence ?",
    r: "Uniquement des preuves enregistrées — évaluations d'exercices et preuves saisies à la main. Chaque mesure garde sa source, consultable depuis la fiche.",
  },
  {
    q: "Que se passe-t-il si je m'évalue trop généreusement ?",
    r: "Le niveau monte sans que la compétence suive, et les séances suivantes te proposeront un travail trop dur, calé sur un niveau que tu n'as pas. L'évaluation honnête n'est pas une politesse : c'est ce qui rend le reste utilisable.",
  },
  {
    q: "Une faiblesse peut-elle disparaître toute seule avec le temps ?",
    r: "Non. Tant qu'aucune nouvelle démonstration ne vient la contredire, elle reste. Le seul moyen de la lever est de refaire la preuve.",
  },
  {
    q: "Le tuteur peut-il modifier mes niveaux ?",
    r: "Non. Il produit du contenu — exercices, explications, propositions de compétences — jamais des mesures. Il ne crée pas non plus de code de compétence : il choisit dans la liste que le serveur lui fournit.",
  },
  {
    q: "Que se passe-t-il si j'abandonne une séance en cours ?",
    r: "Elle reste dans la file du Cahier et se reprend plus tard. Les exercices non évalués ne produisent aucune preuve, donc aucun niveau ne bouge.",
  },
  {
    q: "Puis-je supprimer une compétence ou un exercice ?",
    r: "Tant qu'il n'y a ni preuve ni tentative, oui. Dès qu'il en existe une, l'élément est archivé et non supprimé : effacer l'objet effacerait aussi l'historique qui s'appuie dessus.",
  },
  {
    q: "Le temps estimé d'un exercice mesure-t-il ma performance ?",
    r: "Non. Il sert à calibrer une séance sur le temps disponible, rien d'autre, et n'entre dans aucun calcul de niveau.",
  },
  {
    q: "Mon référentiel est-il partagé avec d'autres comptes ?",
    r: "Non. Il appartient à ton compte, et les données personnelles ne sont jamais partagées sans un accord explicite de ta part.",
  },
  {
    q: "Par où recommencer quand je ne sais pas quoi faire ?",
    r: "Par le tableau de bord : il propose la prochaine action à partir de l'état réel du référentiel. S'il ne propose rien, c'est qu'il manque des preuves — compose une séance depuis le Cahier.",
  },
];

export default function PageAide() {
  return (
    <>
      <EntetePage
        titre="Prendre en main le système"
        sousTitre="Ce que tu vois, ce que tu fais, et ce que le système en fait — écran par écran."
      />

      <div className="mx-auto max-w-3xl space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primaire/30 bg-primaire/10 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-texte">Visite guidée interactive</p>
            <p className="text-xs text-texte-attenue">
              Besoin d&apos;un rappel des commandes principales ? Relance le tour pas-à-pas sur le Tableau de bord.
            </p>
          </div>
          <BoutonRelancerTour libelle="Lancer la visite guidée" />
        </div>

        <BandeauInfo ton="primaire">
          Le principe tient en une phrase : <strong>le système ne mesure que ce que tu as
          démontré</strong>. Tout ce qui suit découle de là — le tuteur écrit les exercices, tes
          évaluations produisent les preuves, les preuves produisent les niveaux.
        </BandeauInfo>

        <section>
          <TitreSection legende="Cinq étapes. Les quatre dernières se répètent ensuite à chaque séance.">
            Le parcours
          </TitreSection>

          <ol className="space-y-4">
            {ETAPES.map((etape) => (
              <li key={etape.numero}>
                <Carte>
                  <EnTeteCarte
                    titre={`${etape.numero}. ${etape.titre}`}
                    legende={etape.ou}
                  />
                  <CorpsCarte className="space-y-3">
                    <LigneEtape libelle="Tu vois" texte={etape.vois} />
                    <LigneEtape libelle="Tu fais" texte={etape.fais} />
                    <LigneEtape libelle="Le système" texte={etape.effet} />
                    {etape.lien && (
                      <Link
                        href={etape.lien.href}
                        className={`${classesLienBouton("secondaire", "petite")} mt-1`}
                      >
                        {etape.lien.libelle}
                      </Link>
                    )}
                  </CorpsCarte>
                </Carte>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <TitreSection legende="À faire dans l'ordre, une seule fois.">
            Ta première heure
          </TitreSection>

          <Carte>
            <CorpsCarte>
              <ol className="space-y-2">
                {PREMIERE_HEURE.map((ligne, index) => (
                  <li key={ligne} className="flex gap-3 text-sm">
                    <span
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.6875rem] font-medium text-texte-attenue"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="text-texte-attenue">{ligne}</span>
                  </li>
                ))}
              </ol>
              <Link
                href="/demarrer"
                className={`${classesLienBouton("principal", "normale")} mt-4`}
              >
                Commencer maintenant
              </Link>
            </CorpsCarte>
          </Carte>
        </section>

        <section>
          <TitreSection legende="Les mots qui reviennent partout dans l'interface.">
            Vocabulaire
          </TitreSection>

          <Carte>
            <CorpsCarte>
              <dl className="space-y-3">
                {VOCABULAIRE.map((terme) => (
                  <div key={terme.mot} className="text-sm">
                    <dt className="font-medium">{terme.mot}</dt>
                    <dd className="mt-0.5 leading-relaxed text-texte-attenue">
                      {terme.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </CorpsCarte>
          </Carte>
        </section>

        <section>
          <TitreSection legende="L'échelle utilisée partout où un niveau s'affiche. On ne saute pas d'échelon : on le démontre.">
            Les six niveaux
          </TitreSection>

          <Carte>
            <ul>
              {Object.entries(NIVEAUX).map(([valeur, niveau]) => (
                <li
                  key={valeur}
                  className="flex gap-3 border-b border-bordure px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="w-4 shrink-0 font-medium tabular-nums text-texte-attenue">
                    {valeur}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{niveau.nom}</span>
                    <span className="mt-0.5 block leading-relaxed text-texte-attenue">
                      {niveau.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </section>

        <section>
          <TitreSection legende="Clique sur une question pour dérouler la réponse.">
            Questions fréquentes
          </TitreSection>

          <Carte>
            <ul>
              {QUESTIONS.map((question) => (
                <li key={question.q} className="border-b border-bordure last:border-b-0">
                  <details className="group">
                    <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium marker:hidden hover:bg-surface-2">
                      {question.q}
                    </summary>
                    <p className="px-5 pb-4 text-sm leading-relaxed text-texte-attenue">
                      {question.r}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </Carte>
        </section>
      </div>
    </>
  );
}

/** Une des trois lignes d'une étape : le rôle en tête, le texte à côté. */
function LigneEtape({ libelle, texte }: { libelle: string; texte: string }) {
  return (
    <p className="text-sm leading-relaxed text-texte-attenue">
      <span className="mr-2 inline-block min-w-[4.5rem] font-medium text-texte">{libelle}</span>
      {texte}
    </p>
  );
}
