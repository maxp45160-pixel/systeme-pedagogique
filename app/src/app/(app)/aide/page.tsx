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
import { chargerReferentiel } from "@/lib/store/referentiel";

/**
 * Tutoriel d'entrée et documentation pédagogique : ce que chaque compte doit
 * comprendre pour travailler efficacement.
 *
 * Les liens s'adaptent dynamiquement à l'état du compte : un compte neuf est
 * guidé vers l'amorçage (`/demarrer`), tandis qu'un compte établi est orienté
 * vers son profil (`/compte`) ou son tableau de bord (`/`) sans redirection
 * forcée vers l'Atelier.
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

function construireEtapes(compteNeuf: boolean): Etape[] {
  return [
    {
      numero: 1,
      titre: "Dire ce que vous voulez travailler",
      ou: compteNeuf ? "Écran de démarrage" : "Profil d'apprentissage & Atelier",
      vois:
        "Votre sujet d'apprentissage, vos objectifs concret et votre point de départ.",
      fais:
        "Vous répondez au diagnostic express ou remplissez les champs. Sans objectif déclaré, l'importance d'une compétence ne se rapporte à rien.",
      effet:
        "Le tuteur découpe votre référentiel à partir de vos réponses : des domaines, puis des compétences codées à l'intérieur. Vous validez ce qui entre.",
      lien: compteNeuf
        ? { href: "/demarrer", libelle: "Ouvrir l'écran de démarrage" }
        : { href: "/compte", libelle: "Revoir mon profil d'apprentissage" },
    },
    {
      numero: 2,
      titre: "Vérifier votre liste de compétences",
      ou: "Atelier",
      vois:
        "Vos domaines, et dans chacun les compétences avec leur code (ex. LOG-01). La plupart n'ont pas encore de niveau : un tiret, pas un zéro. C'est normal — rien n'a encore été démontré.",
      fais:
        "Vous ouvrez deux ou trois fiches pour voir de quoi elles parlent. Vous corrigez ce qui est faux : une compétence mal formulée s'édite, une hors sujet s'archive, une manquante s'ajoute.",
      effet:
        "Le référentiel appartient à votre compte : le modifier ne casse rien. Une compétence déjà soutenue par des observations est archivée, jamais supprimée — effacer l'objet effacerait l'historique posé dessus.",
      lien: { href: "/atelier", libelle: "Ouvrir l'Atelier" },
    },
    {
      numero: 3,
      titre: "Composer votre première séance",
      ou: "Bureau",
      vois:
        "Le compositeur : les compétences que vous pouvez viser, le nombre d'exercices, le temps dont vous disposez. En dessous, la file des séances en cours ou planifiées.",
      fais:
        "Vous choisissez une ou deux compétences et vous déclarez votre temps réel. Visez court pour la première fois : mieux vaut une séance finie qu'une séance abandonnée.",
      effet:
        "Le tuteur génère les exercices, calibrés sur les compétences visées et sur la durée. Il produit du contenu — jamais de mesure, et jamais un code de compétence qu'il aurait inventé.",
      lien: { href: "/seances", libelle: "Ouvrir le Bureau" },
    },
    {
      numero: 4,
      titre: "Dérouler la séance",
      ou: "Cahier · séance en cours",
      vois:
        "Un exercice à la fois : l'énoncé, votre zone de réponse, puis la correction, puis l'évaluation.",
      fais:
        "Vous répondez sans vous aider, vous comparez à la correction, puis vous évaluez honnêtement : c'est votre autonomie réelle sur cet exercice qui donne sa valeur à l'observation. Vous surnoter fausse tout ce qui suit.",
      effet:
        "Chaque exercice évalué devient une observation rattachée à sa compétence, avec sa source. Un exercice sauté ou une séance abandonnée ne produisent aucune observation : rien ne bouge, et c'est voulu.",
    },
    {
      numero: 5,
      titre: "Lire ce que ça a changé",
      ou: "Tableau de bord",
      vois:
        "La prochaine action proposée, et l'état de ce que vous travaillez. Les niveaux ne sont pas stockés : ils sont recalculés à partir des observations à chaque affichage.",
      fais:
        "Vous suivez la prochaine action, ou vous retournez composer. En cas de doute sur un niveau, vous ouvrez la fiche : les observations qui le soutiennent sont listées.",
      effet:
        "Chaque niveau affiché porte sa justification : en ouvrant la fiche d'une compétence, vous lisez les observations exactes qui soutiennent son niveau.",
      lien: { href: "/", libelle: "Ouvrir le Tableau de bord" },
    },
  ];
}

const PREMIERE_HEURE = [
  "Renseigner votre sujet et vos objectifs lors de l'amorçage.",
  "Laisser le tuteur proposer le premier référentiel et le valider.",
  "Lancer la première séance de 20 minutes avec 2 exercices.",
  "Évaluer honnêtement votre autonomie pour chaque exercice.",
  "Regarder votre Tableau de bord : vos premiers niveaux soutenu apparaissent.",
];

const VOCABULAIRE = [
  {
    mot: "Référentiel",
    definition:
      "L'ensemble structuré de vos domaines et de vos compétences. Il est personnel à votre compte et peut évoluer à tout moment.",
  },
  {
    mot: "Compétence",
    definition:
      "Un savoir-faire observable et démontrable (ex. LOG-01). Elle ne porte pas de note brute stockée, mais un niveau dérivé de vos observations.",
  },
  {
    mot: "Observation",
    definition:
      "Une trace concrète d'activité réussie (exercice évalué, résolution autonome) rattachée à une compétence avec sa date et son degré d'autonomie.",
  },
  {
    mot: "Séance",
    definition:
      "Un épisode de travail cadré dans le temps contenant un ou plusieurs exercices. Une seule séance est active à la fois par compte.",
  },
  {
    mot: "Tuteur IA",
    definition:
      "Le moteur qui génère vos exercices et explications. Il ne produit aucune mesure sur vous et respecte strictement vos consignes déclarées.",
  },
];

const QUESTIONS = [
  {
    q: "Pourquoi certaines compétences n'affichent-elles aucun niveau ?",
    r: "Parce qu'aucune observation ne les soutient encore. Une absence d'observation n'est pas un zéro : le système préfère un tiret à un chiffre inventé. Le niveau apparaît à la première évaluation.",
  },
  {
    q: "D'où vient le niveau affiché sur une fiche de compétence ?",
    r: "Uniquement des observations enregistrées — évaluations d'exercices et résolutions. Chaque mesure garde sa source, consultable depuis la fiche.",
  },
  {
    q: "Que se passe-t-il si je m'évalue trop généreusement ?",
    r: "Le niveau monte sans que la compétence suive, et les séances suivantes vous proposeront un travail trop dur. L'évaluation honnête est ce qui rend l'apprentissage fiable.",
  },
  {
    q: "Une faiblesse peut-elle disparaître toute seule avec le temps ?",
    r: "Non. Tant qu'aucune nouvelle démonstration ne vient la contredire, elle reste. Le seul moyen de la lever est de refaire l'observation.",
  },
  {
    q: "Le tuteur peut-il modifier mes niveaux ?",
    r: "Non. Il produit du contenu — exercices, explications, propositions de compétences — jamais des mesures.",
  },
  {
    q: "Que se passe-t-il si j'abandonne une séance en cours ?",
    r: "Elle reste dans la file du Bureau et se reprend plus tard. Les exercices non évalués ne produisent aucune observation, donc aucun niveau ne bouge.",
  },
  {
    q: "Puis-je modifier ou étendre mon référentiel plus tard ?",
    r: "Oui, à tout moment depuis l'Atelier ou le bouton '+' : vous pouvez ajouter des compétences, réviser un domaine ou ajuster votre profil dans Compte.",
  },
];

export default async function PageAide() {
  /*
   * La seule décision de cette page est « le compte a-t-il des compétences ? ».
   * `chargerContexte()` calculait états, calibrages et recommandations du moteur
   * pour un booléen ; le référentiel seul suffit, et il est mémoïsé par requête.
   */
  const referentiel = await chargerReferentiel();
  const compteNeuf = referentiel.skills.length === 0;
  const etapes = construireEtapes(compteNeuf);

  return (
    <>
      <EntetePage
        titre="Prendre en main le système"
        sousTitre="Comment ça marche, écran par écran."
      />

      <div className="mx-auto max-w-3xl space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primaire/30 bg-primaire/10 p-4 shadow-xs">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-texte">Visite guidée interactive</p>
            <p className="text-xs text-texte-attenue">
              Besoin d&apos;un rappel des commandes principales ? Relancez le tour pas-à-pas sur le Tableau de bord.
            </p>
          </div>
          <BoutonRelancerTour libelle="Lancer la visite guidée" />
        </div>

        <BandeauInfo ton="primaire">
          Le principe tient en une phrase : <strong>le système ne mesure que ce que vous avez
          démontré</strong>. Tout ce qui suit découle de là — le tuteur écrit les exercices, vos
          évaluations produisent les observations, les observations produisent les niveaux.
        </BandeauInfo>

        <section>
          <TitreSection legende="Cinq étapes. Les quatre dernières se répètent ensuite à chaque séance.">
            Le fonctionnement
          </TitreSection>

          <ol className="space-y-4">
            {etapes.map((etape) => (
              <li key={etape.numero}>
                <Carte>
                  <EnTeteCarte
                    titre={`${etape.numero}. ${etape.titre}`}
                    legende={etape.ou}
                  />
                  <CorpsCarte className="space-y-3">
                    <LigneEtape libelle="Vous voyez" texte={etape.vois} />
                    <LigneEtape libelle="Vous faites" texte={etape.fais} />
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
            Votre première heure
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

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {compteNeuf ? (
                  <Link
                    href="/demarrer"
                    className={classesLienBouton("principal", "normale")}
                  >
                    Commencer mon amorçage
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/"
                      className={classesLienBouton("principal", "normale")}
                    >
                      Accéder à mon Tableau de bord
                    </Link>
                    <Link
                      href="/compte"
                      className={classesLienBouton("secondaire", "normale")}
                    >
                      Modifier mon profil
                    </Link>
                  </>
                )}
              </div>
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
          <TitreSection legende="Cliquez sur une question pour dérouler la réponse.">
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
