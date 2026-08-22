"use client";

/**
 * Le Bureau — la page du jour où l'on travaille (ADR-102).
 *
 * ## Ce qu'il remplace
 *
 * `PageCahier` rendait la journée comme un registre : quatre rubriques en
 * capitales — « Séances de ce jour », « Exercices hors séance », « Projets de
 * ce jour », « Notes du jour » — chacune dans une carte bordée, posées sur une
 * trame quadrillée, sous un héros en dégradé qui répétait le titre déjà écrit
 * par `EntetePage`. Quatre tiroirs de même poids, deux en-têtes, trois
 * registres visuels. On y classait ; on n'y travaillait pas.
 *
 * ## Ce que le Bureau tient
 *
 *  - **Une colonne** (`--colonne`, 704 px), parce que c'est l'écran où l'on
 *    lit le plus longtemps.
 *  - **Un seul objet en tête** : le prochain geste. Le reste du jour vit
 *    dessous, sans lui disputer le regard.
 *  - **Des blocs, pas des cartes.** Le contenu est la page. `Carte` ne
 *    survit que là où il y a vraiment un objet à distinguer du fond.
 *  - **Le chrome au survol.** Une page de concentration ne montre pas ses
 *    commandes en permanence.
 *
 * ## Ce qu'il ne fait pas
 *
 * Aucune écriture, aucun calcul de mesure. Il lit `construirePage` et
 * `semaineDuJour`, tous deux dérivés (couche 3). L'archive — calendrier,
 * jours passés, recherche — n'est pas ici : c'est le Cahier, l'autre mode de
 * la même route.
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  CodeCompetence,
  EtatVide,
  Etiquette,
  classesLienBouton,
  cx,
} from "@/components/ui/primitives";
import {
  IconeChevronDroit,
  IconeChevronGauche,
  IconeFeuille,
  IconeRecherche,
} from "@/components/ui/icones";
import { cleJour, formatDuree } from "@/lib/engine/dates";
import { statutSeance, tentativeDeSeance } from "@/lib/domain/seance";
import {
  construirePage,
  resumeDuJour,
  semaineDuJour,
  voisinesDeLaPage,
  type DocumentOperationnelDate,
  type ResumeJour,
} from "@/lib/domain/pages-cahier";
import type { ExerciseAttempt, LearningSession } from "@/lib/domain/types";
import type { LigneMarge } from "@/lib/documents/marge";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import { CarteSeance } from "@/components/seances/file-seances";
import { LigneCahier } from "@/components/seances/cahier-seances";
import { ChampMarge, ListeMarge } from "@/components/seances/marge-cahier";
import { CalendrierCahier } from "@/components/seances/calendrier-cahier";
import { FiletPomodoro } from "@/components/seances/pomodoro";
import { PaletteBureau, useRaccourciPalette } from "@/components/seances/palette-bureau";

/**
 * Tout ce qu'un jour peut porter, en un seul objet.
 *
 * Le regroupement vient de `master` (« regrouper les entrées du cahier en un
 * seul objet ») : cinq paramètres qui voyagent toujours ensemble, de la route
 * jusqu'au dernier composant, méritent un nom. Il vivait dans
 * `page-cahier.tsx`, retiré par ce chantier ; il vit désormais ici, avec la
 * surface qui le consomme.
 */
export interface EntreesCahier {
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
  notes: LigneMarge[];
  projets?: DocumentOperationnelDate[];
}

export function Bureau({
  jour,
  jours,
  mois,
  entrees,
  aujourdHui,
  compteId,
  seanceDeployee,
  onChangerJour,
  onChangerMois,
  onOuvrirCahier,
}: {
  jour: string;
  /** Les jours qui portent une page — la liste de navigation. */
  jours: string[];
  /** Le mois ouvert dans le calendrier — pas forcément celui de la page. */
  mois: string;
  entrees: EntreesCahier;
  aujourdHui: Date;
  compteId: string;
  /** La séance ouverte en plein travail, rendue à sa place dans le déroulé. */
  seanceDeployee?: { id: string; contenu: ReactNode };
  onChangerJour: (jour: string) => void;
  onChangerMois: (mois: string) => void;
  onOuvrirCahier: () => void;
}) {
  const { seances, tentatives, donnees, notes, projets = [] } = entrees;
  const page = construirePage(jour, { seances, notes, projets });
  const { precedente, suivante } = voisinesDeLaPage(jour, jours);

  const cleAujourdHui = cleJour(aujourdHui);
  const estAujourdHui = jour === cleAujourdHui;

  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const ouvrirPalette = useCallback(() => setPaletteOuverte(true), []);
  const fermerPalette = useCallback(() => setPaletteOuverte(false), []);
  useRaccourciPalette(ouvrirPalette);

  /*
   * Deux registres parmi les séances du jour, et c'est le seul tri de cette
   * page : celles qui attendent encore un geste, et celles qui sont
   * refermées. La distinction est LUE dans le statut, jamais fabriquée.
   */
  const enAttente = page.seances.filter((seance) => {
    const statut = statutSeance(seance);
    return statut !== "terminee" && statut !== "abandonnee";
  });
  const refermees = page.seances.filter((seance) => {
    const statut = statutSeance(seance);
    return statut === "terminee" || statut === "abandonnee";
  });

  const vide =
    page.seances.length === 0 &&
    page.traces.length === 0 &&
    page.projets.length === 0 &&
    page.notes.length === 0 &&
    !seanceDeployee;

  const resume = resumeDuJour(jour, { seances, notes, projets, tentatives });

  /*
   * La largeur du Bureau n'est PAS `--colonne`.
   *
   * 704 px est la mesure d'une colonne de lecture — elle vaut pour l'énoncé
   * d'un exercice, qui est de la prose et qu'on lit vingt minutes. Le Bureau,
   * lui, ne montre pas de prose : des cartes, des listes courtes, des lignes
   * dont l'action vit à droite. Lui imposer la même contrainte laissait deux
   * bandes vides de 400 px de chaque côté sur un écran ordinaire, et écrasait
   * les lignes qui ont un contenu à gauche et un contrôle à droite.
   *
   * `--colonne` reste ce qu'elle est, et sert là où elle a un sens : le plein
   * écran d'une séance.
   */
  const largeur = "max-w-5xl";

  return (
    <div className="relative isolate">
      {/*
        La lampe. `-z-10` reste local grâce à `isolate` sur le conteneur :
        le calque passe derrière le contenu du Bureau et devant la trame du
        `body`, qu'il couvre.
      */}
      <div aria-hidden className="bureau-lampe pointer-events-none fixed inset-0 -z-10" />

      <FiletPomodoro compteId={compteId} />

      {/*
        Le rail n'est plus réduit d'office (22/08/2026).

        `RailEnSeance` le repliait dès qu'une séance était en cours — écrit
        quand le déroulé vivait DANS la page du jour. Depuis que travailler
        ouvre le plein écran, le Bureau n'est plus la surface de travail : on y
        replie donc la navigation d'une page où l'on ne travaille pas, et la
        seule sortie vers le reste de l'application disparaissait avec elle.
        Le plein écran, lui, recouvre déjà le rail — le replier dessous
        n'apporte rien.
      */}

      <BarreBureau
        jour={jour}
        mois={mois}
        jours={jours}
        aujourdHui={aujourdHui}
        precedente={precedente}
        suivante={suivante}
        onChangerJour={onChangerJour}
        onChangerMois={onChangerMois}
        onOuvrirCahier={onOuvrirCahier}
        onOuvrirPalette={ouvrirPalette}
      />

      <div className={cx("mx-auto w-full pb-28", largeur)}>
        <BandeauDuJour
          jour={jour}
          jours={jours}
          resume={resume}
          estAujourdHui={estAujourdHui}
          cleAujourdHui={cleAujourdHui}
          onChangerJour={onChangerJour}
        />

        {/*
          ── Le prochain geste, seul en tête ──

          Une séance qui attend un geste est une CARTE, jamais l'espace de
          travail déplié. Le déroulé complet — intercalaires, énoncé, champ de
          réponse, tuteur — encastré dans la colonne du jour donnait deux
          en-têtes empilés, deux barres d'avancement et deux jeux de boutons de
          sortie : on ne savait plus si l'on quittait l'exercice, la séance ou
          la page. Travailler ouvre le plein écran ; la page du jour dit ce
          qu'il y a à faire et où en est le travail.
        */}
        {enAttente.length > 0 && (
          <Bloc titre="Maintenant">
            <div className="space-y-4">
              {enAttente.map((seance) => (
                <CarteSeance key={seance.id} seance={seance} tentatives={tentatives} />
              ))}
            </div>
          </Bloc>
        )}

        {/*
          Une séance REFERMÉE ouverte par un lien se relit à sa place, dépliée.
          Relire n'est pas travailler : rien ne demande de geste, donc rien ne
          justifie de quitter la page.
        */}
        {seanceDeployee && !page.seances.some((s) => s.id === seanceDeployee.id) && (
          <Bloc titre="Séance ouverte">{seanceDeployee.contenu}</Bloc>
        )}

        {/* ── Le reste du jour ── */}
        {page.projets.length > 0 && (
          <Bloc titre={page.projets.length > 1 ? "Projets ouverts" : "Projet ouvert"}>
            <div className="space-y-1">
              {page.projets.map((projet) => (
                <ProjetDuJour key={projet.id} projet={projet} jour={page.jour} />
              ))}
            </div>
          </Bloc>
        )}

        {(estAujourdHui || page.notes.length > 0) && (
          <Bloc titre="En marge">
            {estAujourdHui ? (
              /*
                Toutes les lignes ouvertes, pas seulement celles notées
                aujourd'hui : la marge est une liste de choses à traiter, pas
                un journal daté. Ce qu'on a écrit lundi et jamais traité doit
                rester sous les yeux vendredi.
              */
              <ListeMarge lignes={notes} nu />
            ) : (
              <ul className="divide-y divide-bordure/40 text-sm">
                {page.notes.map((note, index) => (
                  <li
                    key={`${index}-${note.texte}`}
                    className={cx("py-2", note.faite && "text-texte-discret line-through")}
                  >
                    {note.texte}
                  </li>
                ))}
              </ul>
            )}
          </Bloc>
        )}

        {page.traces.length > 0 && (
          <Bloc titre="Hors séance">
            <ul className="divide-y divide-bordure/40">
              {page.traces.map((trace) => (
                <li key={trace.id}>
                  <TraceHorsSeance seance={trace} donnees={donnees} />
                </li>
              ))}
            </ul>
          </Bloc>
        )}

        {refermees.length > 0 && (
          <Bloc titre={refermees.length > 1 ? "Séances refermées" : "Séance refermée"}>
            <div className="space-y-3">
              {refermees.map((seance) =>
                seanceDeployee?.id === seance.id ? (
                  <div key={seance.id}>{seanceDeployee.contenu}</div>
                ) : (
                  <LigneCahier key={seance.id} seance={seance} donnees={donnees} />
                ),
              )}
            </div>
          </Bloc>
        )}

        {vide && (
          <div className="pt-6">
            {estAujourdHui ? (
              <EtatVide
                icone={<IconeFeuille className="size-5" />}
                titre="La page du jour est vierge."
                message="Composez une séance, ou notez une intention dans la barre du bas : la page garde ce qui s'y écrit."
              />
            ) : (
              <EtatVide
                icone={<IconeFeuille className="size-5" />}
                titre="Rien n’a été écrit ce jour-là."
                message="Utilisez les flèches, le calendrier, ou ⌘K pour rejoindre un jour écrit."
              />
            )}
          </div>
        )}
      </div>

      {/*
        La barre de capture. Fixe, parce que noter est le geste le plus
        fréquent du Bureau et qu'il ne doit jamais demander de faire défiler.
        `bottom-16` sur mobile : la barre de navigation basse occupe déjà le
        bas de l'écran (`NavMobile`), et se superposer à elle rendrait les
        deux inutilisables.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center bg-gradient-to-t from-fond via-fond/85 to-transparent px-4 pb-3 pt-6 lg:bottom-0 lg:pl-64">
        <div className={cx("pointer-events-auto w-full", largeur)}>
          <ChampMarge variante="barre" />
        </div>
      </div>

      <PaletteBureau
        aujourdHui={cleAujourdHui}
        onChangerJour={onChangerJour}
        onOuvrirCahier={onOuvrirCahier}
        ouverte={paletteOuverte}
        onFermer={fermerPalette}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* La barre d'outils                                                    */
/* ------------------------------------------------------------------ */

/**
 * Collante, 40 px, sans libellé écrit.
 *
 * Elle remplace la rangée de boutons du héros. Le filet du bas n'apparaît
 * qu'au défilement — posé en permanence, il dessinait une frontière là où il
 * n'y en a pas quand la page est en haut.
 */
function BarreBureau({
  jour,
  mois,
  jours,
  aujourdHui,
  precedente,
  suivante,
  onChangerJour,
  onChangerMois,
  onOuvrirCahier,
  onOuvrirPalette,
}: {
  jour: string;
  mois: string;
  jours: string[];
  aujourdHui: Date;
  precedente: string | null;
  suivante: string | null;
  onChangerJour: (jour: string) => void;
  onChangerMois: (mois: string) => void;
  onOuvrirCahier: () => void;
  onOuvrirPalette: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 flex h-11 items-center justify-between gap-3 border-b border-transparent bg-fond/80 px-4 backdrop-blur transition-colors sm:-mx-6 sm:px-6">
      {/*
        Pas de lien « Tableau de bord » ici.

        Il y en a eu un, ajouté parce que le rail semblait absent de l'écran.
        Il ne l'était pas : `.bureau-lampe` est un calque `fixed inset-0` et le
        repeignait intégralement — deux éléments positionnés à z-index
        automatique se peignent dans l'ordre du document, et le rail vient
        avant. La cause corrigée (`z-40` sur le rail), le lien ne faisait plus
        que doubler une navigation déjà présente à deux mètres à gauche.
      */}
      <div className="flex min-w-0 items-center gap-2 text-xs text-texte-discret">
        <span className="font-medium text-texte-attenue">Bureau</span>
        <span aria-hidden>·</span>
        <span className="truncate">{dateCourte(jour)}</span>
      </div>

      <nav aria-label="Navigation du Bureau" className="flex shrink-0 items-center gap-0.5">
        <FlecheJour
          cible={precedente}
          libelle="Jour précédent"
          bord="Début du cahier"
          onChangerJour={onChangerJour}
        >
          <IconeChevronGauche className="size-4" />
        </FlecheJour>
        <FlecheJour
          cible={suivante}
          libelle="Jour suivant"
          bord="Dernier jour écrit"
          onChangerJour={onChangerJour}
        >
          <IconeChevronDroit className="size-4" />
        </FlecheJour>

        <CalendrierCahier
          variante="discret"
          jour={jour}
          mois={mois}
          jours={jours}
          aujourdHui={aujourdHui}
          onChangerJour={onChangerJour}
          onChangerMois={onChangerMois}
        />

        {/*
          Le bouton porte UN mot, et c'est son usage dominant.

          Sa première version n'était qu'une loupe suivie de « ⌘K » : deux
          signes, aucun verbe. Rien ne disait ce qu'il ouvrait, et comme la
          palette fait quatre choses (chercher, aller à un jour, composer,
          ouvrir le Cahier), l'icône seule les promettait toutes sans en
          annoncer aucune — un fourre-tout. Le libellé nomme donc l'entrée la
          plus fréquente ; le reste se découvre une fois la palette ouverte,
          où son champ l'écrit noir sur blanc.
        */}
        <button
          type="button"
          onClick={onOuvrirPalette}
          title="Chercher dans tout le Cahier"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
        >
          <IconeRecherche className="size-4" />
          <span>Chercher</span>
          <kbd className="hidden rounded border border-bordure px-1 text-[0.625rem] sm:block">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOuvrirCahier}
          title="Relire les jours passés"
          className="cursor-pointer rounded-md px-2 py-1.5 text-xs text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
        >
          Cahier
        </button>
      </nav>
    </div>
  );
}

/** Une flèche de jour, inerte au bord du cahier. */
function FlecheJour({
  cible,
  libelle,
  bord,
  onChangerJour,
  children,
}: {
  cible: string | null;
  libelle: string;
  bord: string;
  onChangerJour: (jour: string) => void;
  children: ReactNode;
}) {
  if (!cible) {
    return (
      <span
        aria-disabled
        title={bord}
        className="pointer-events-none flex rounded-md px-2 py-1.5 text-texte-discret opacity-30"
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChangerJour(cible)}
      aria-label={libelle}
      title={libelle}
      className="flex cursor-pointer rounded-md px-2 py-1.5 text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* L'ouverture de la page                                               */
/* ------------------------------------------------------------------ */

/**
 * Le bandeau du jour — qui, quand, et ce que la journée porte.
 *
 * ## Ce qu'il remplace
 *
 * Une couverture vide de 144 px, puis la date, puis la bande de semaine :
 * trois blocs empilés dont le premier ne portait rien du tout. Un dégradé sans
 * contenu occupait le tiers supérieur de l'écran d'accueil du pôle.
 *
 * Il reprend la grammaire du héros de la Progression (`CarteCarriere`) —
 * bannière en dégradé, anneaux décoratifs de la teinte de marque, identité à
 * gauche, chiffres à droite — parce que c'est le même geste : ouvrir un pôle
 * en disant où l'on est.
 *
 * ## La ligne qu'il ne franchit pas
 *
 * Les anneaux ne portent JAMAIS d'information : ce sont des cercles, ils ne
 * mesurent rien. Et tout ce qui est chiffré vient de `resumeDuJour`, donc de
 * faits comptés à la lecture (couche 3) : aucun score du jour, aucune série,
 * aucun encouragement fabriqué. Une journée sans rien affiche qu'elle est
 * vierge — elle n'affiche pas zéro.
 */
function BandeauDuJour({
  jour,
  jours,
  resume,
  estAujourdHui,
  cleAujourdHui,
  onChangerJour,
}: {
  jour: string;
  jours: string[];
  resume: ResumeJour;
  estAujourdHui: boolean;
  cleAujourdHui: string;
  onChangerJour: (jour: string) => void;
}) {
  const date = new Date(`${jour}T12:00:00`);
  const semaine = date.toLocaleDateString("fr-FR", { weekday: "long" });
  const reste = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const grain = grainDuJour(jour);
  const exercices = resume.reussis + resume.partiels + resume.nonAboutis;

  return (
    <section className="overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-carte)]">
      <div
        className="bureau-couverture relative px-5 py-6 sm:px-7"
        style={{ "--tour": grain.tour, "--foyer": grain.foyer } as CSSProperties}
      >
        {/* Anneaux décoratifs — la teinte de marque, jamais une mesure. */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 select-none">
          <div className="size-80 rounded-full border-[26px] border-primaire/5" />
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-10 bottom-[-5rem] select-none">
          <div className="size-44 rounded-full border-[18px] border-primaire/5" />
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret first-letter:capitalize">
              {semaine}
            </p>
            <h1 className="mt-1.5 font-serif text-[1.9rem] font-medium leading-tight tracking-tight sm:text-[2.35rem]">
              {/*
                Le trait tracé à la main n'apparaît que sur aujourd'hui.
                Souligner chaque jour en ferait un ornement ; ne souligner que
                le jour courant en fait un repère — on sait d'un coup d'œil si
                l'on est chez soi ou en visite dans le passé.
              */}
              {estAujourdHui ? <span className="souligne">{reste}</span> : reste}
            </h1>
            {!estAujourdHui && (
              <button
                type="button"
                onClick={() => onChangerJour(cleAujourdHui)}
                className="mt-3 cursor-pointer text-xs font-medium text-primaire hover:underline"
              >
                Revenir à aujourd’hui
              </button>
            )}
          </div>

          <FaitsDuJour resume={resume} exercices={exercices} />
        </div>
      </div>

      <div className="border-t border-bordure bg-surface px-5 py-3 sm:px-7">
        <BandeSemaine
          jour={jour}
          jours={jours}
          cleAujourdHui={cleAujourdHui}
          onChangerJour={onChangerJour}
        />
      </div>
    </section>
  );
}

/**
 * Ce que la journée porte, à droite du bandeau.
 *
 * Chaque ligne n'apparaît que si elle a quelque chose à dire. Un jour vierge
 * n'affiche donc pas « 0 séance · 0 exercice · 0 min » — l'absence de trace
 * n'est pas une trace nulle (invariant 3), et une colonne de zéros donnerait à
 * un jour de repos l'air d'un échec.
 */
function FaitsDuJour({ resume, exercices }: { resume: ResumeJour; exercices: number }) {
  const lignes = [
    resume.seances > 0
      ? `${resume.seances} séance${resume.seances > 1 ? "s" : ""}`
      : null,
    exercices > 0 ? `${exercices} exercice${exercices > 1 ? "s" : ""}` : null,
    resume.traces > 0 ? `${resume.traces} hors séance` : null,
    resume.projets > 0
      ? `${resume.projets} projet${resume.projets > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  if (lignes.length === 0 && exercices === 0) {
    return (
      <p className="max-w-[16rem] text-xs leading-relaxed text-texte-discret">
        Page vierge. Ce qui s’y écrira restera daté d’aujourd’hui.
      </p>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
      {exercices > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {resume.reussis > 0 && (
            <Etiquette ton="succes">
              {resume.reussis} réussi{resume.reussis > 1 ? "s" : ""}
            </Etiquette>
          )}
          {resume.partiels > 0 && (
            <Etiquette ton="alerte">
              {resume.partiels} partiel{resume.partiels > 1 ? "s" : ""}
            </Etiquette>
          )}
          {resume.nonAboutis > 0 && (
            <Etiquette ton="danger">
              {resume.nonAboutis} non abouti{resume.nonAboutis > 1 ? "s" : ""}
            </Etiquette>
          )}
        </div>
      )}

      <p className="chiffres text-xs text-texte-attenue">{lignes.join(" · ")}</p>

      {/*
        La durée n'est écrite que si une séance l'a notée. Zéro dirait « ce
        jour-là, le travail a duré zéro minute » — ce qui est faux (P2).
      */}
      {resume.dureeMin !== undefined && (
        <p className="chiffres text-xs text-texte-discret">
          {formatDuree(resume.dureeMin)} notée{resume.seances > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

const INITIALES_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * La bande de semaine — les sept dates autour du jour ouvert.
 *
 * ⚠️ **Le numéro du jour est écrit.** La première version ne posait qu'un
 * point sous chaque initiale : on lisait « L M M J V S D » sans savoir de
 * quelle semaine il s'agissait, et cliquer revenait à naviguer à l'aveugle.
 * Une pastille de navigation temporelle qui ne porte pas sa date ne navigue
 * pas — elle décore.
 *
 * Elle vit SOUS la bannière, dans son propre bandeau. Elle remontait dessus
 * (`-mt-5`), et `.bureau-couverture` porte un `::after` en `position:
 * absolute` — un élément positionné, donc peint au-dessus du contenu non
 * positionné qui le suit : la ligne des initiales tombait derrière ce calque,
 * les numéros restaient visibles, les lettres disparaissaient. La poser à
 * plat supprime la cause, pas seulement le symptôme.
 *
 * Trois états, tous LUS et jamais mesurés : plein = le jour affiché ; teinté =
 * ce jour porte une page ; cerclé = aujourd'hui. Aucun ne repose sur la seule
 * couleur — le numéro reste là, et `aria-label` dit le reste.
 */
function BandeSemaine({
  jour,
  jours,
  cleAujourdHui,
  onChangerJour,
}: {
  jour: string;
  jours: string[];
  cleAujourdHui: string;
  onChangerJour: (jour: string) => void;
}) {
  const semaine = semaineDuJour(jour);
  const avecPage = new Set(jours);

  return (
    <nav aria-label="Semaine du jour affiché" className="flex items-center gap-0.5">
      {semaine.map((cle, index) => {
        const ouvert = cle === jour;
        const porte = avecPage.has(cle);
        const estAujourdHui = cle === cleAujourdHui;
        return (
          <button
            key={cle}
            type="button"
            onClick={() => onChangerJour(cle)}
            aria-current={ouvert ? "date" : undefined}
            aria-label={[
              libelleJourComplet(cle),
              estAujourdHui ? "aujourd’hui" : null,
              porte ? "page écrite" : "page vierge",
            ]
              .filter(Boolean)
              .join(" — ")}
            className="group flex w-9 cursor-pointer flex-col items-center gap-1 rounded-md py-0.5"
          >
            <span
              aria-hidden
              className={cx(
                "text-[0.5625rem] font-semibold uppercase tracking-widest transition-colors",
                ouvert ? "text-primaire" : "text-texte-discret",
              )}
            >
              {INITIALES_SEMAINE[index]}
            </span>
            <span
              aria-hidden
              className={cx(
                "chiffres flex size-7 items-center justify-center rounded-full text-xs transition-colors",
                ouvert
                  ? "bg-primaire font-semibold text-primaire-contraste"
                  : porte
                    ? "bg-primaire-faible font-medium text-primaire group-hover:bg-surface-3"
                    : "text-texte-discret group-hover:bg-surface-2",
                estAujourdHui && !ouvert && "ring-1 ring-primaire",
              )}
            >
              {Number(cle.slice(8, 10))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function grainDuJour(jour: string): { tour: string; foyer: string } {
  let empreinte = 0;
  for (let index = 0; index < jour.length; index += 1) {
    empreinte = (empreinte * 31 + jour.charCodeAt(index)) % 997;
  }
  return { tour: `${120 + (empreinte % 60)}deg`, foyer: `${60 + (empreinte % 35)}%` };
}

/* ------------------------------------------------------------------ */
/* Les blocs                                                            */
/* ------------------------------------------------------------------ */

/**
 * Un bloc de la page : un intitulé discret, et du contenu posé dessous.
 *
 * Pas de carte, pas de bordure, pas de capitales. Les quatre
 * `TitreDeSection` en `uppercase tracking-wider` de l'ancienne page
 * ressemblaient à quatre étiquettes de classeur, et donnaient le même poids à
 * « la séance en cours » et à « un exercice fait hier ». Ici l'intitulé est en
 * serif bas-de-casse : il nomme sans réclamer.
 */
function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-t border-transparent py-6 first-of-type:pt-7 [&+&]:border-bordure/40">
      <h2 className="mb-3 font-serif text-[0.9375rem] font-medium text-texte-attenue">{titre}</h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Les objets du jour                                                   */
/* ------------------------------------------------------------------ */

function ProjetDuJour({ projet, jour }: { projet: DocumentOperationnelDate; jour: string }) {
  const retourUrl = `/seances?jour=${encodeURIComponent(jour)}`;
  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primaire/60" />
      <span className="min-w-0 flex-1 text-sm font-medium">{projet.titre}</span>

      {projet.competences.length > 0 && (
        <span className="flex shrink-0 items-center gap-1.5">
          {projet.competences.slice(0, 3).map((code) => (
            <CodeCompetence key={code} code={code} />
          ))}
        </span>
      )}

      {projet.dureeMin !== undefined && (
        <span className="shrink-0 text-xs text-texte-discret">{formatDuree(projet.dureeMin)}</span>
      )}

      <Etiquette ton={projet.fige ? "succes" : "primaire"}>
        {projet.fige ? "Version figée" : "En cours"}
      </Etiquette>

      <Link
        href={`/atelier?note=${encodeURIComponent(projet.id)}&retour=${encodeURIComponent(retourUrl)}`}
        className={cx(
          classesLienBouton("secondaire", "petite"),
          "shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
        )}
      >
        Ouvrir
      </Link>
    </div>
  );
}

/** Un exercice clos hors séance : une ligne, pas une carte. */
function TraceHorsSeance({
  seance,
  donnees,
}: {
  seance: LearningSession;
  donnees: DonneesSeance;
}) {
  const activite = seance.activites.find((item) => item.type === "exercice");
  const exercice = activite
    ? donnees.exercices.find((item) => item.id === activite.ref)
    : undefined;
  const tentative = activite
    ? tentativeDeSeance(seance, activite.ref, donnees.tentatives)
    : undefined;

  const resultat =
    tentative?.statut === "abandonnee"
      ? { texte: "Abandonné", ton: "danger" as const }
      : tentative?.resultat === "reussi"
        ? { texte: "Réussi", ton: "succes" as const }
        : tentative?.resultat === "partiel"
          ? { texte: "Partiel", ton: "alerte" as const }
          : { texte: "Non abouti", ton: "danger" as const };

  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-texte-discret/40" />
      <span className="min-w-0 flex-1 text-sm">
        {exercice?.titre ?? activite?.libelle ?? "Exercice"}
      </span>
      {typeof seance.dureeMin === "number" && (
        <span className="shrink-0 text-xs text-texte-discret">{formatDuree(seance.dureeMin)}</span>
      )}
      <Etiquette ton={resultat.ton}>{resultat.texte}</Etiquette>
      <Link
        href={`/seances?session=${encodeURIComponent(seance.id)}`}
        className="shrink-0 text-xs font-medium text-primaire opacity-0 transition-opacity hover:underline focus-visible:opacity-100 group-hover:opacity-100"
      >
        Détail
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formats                                                              */
/* ------------------------------------------------------------------ */

function dateCourte(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function libelleJourComplet(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
