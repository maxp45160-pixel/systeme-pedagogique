"use client";

import type { ResumeCroissance, FenetreCroissance } from "@/lib/engine/croissance";
import type { VueDomaineAtelier, VueThemeAtelier } from "@/lib/documents/vue-atelier";
import { EnsemblesSuggeres } from "@/components/atelier/ensembles-suggeres";
import type { EnsemblePropose } from "@/lib/engine/ensembles";
import { CodeCompetence, Etiquette, cx } from "@/components/ui/primitives";
import { formatDateRelative, formatDuree } from "@/lib/engine/dates";

/**
 * Le bilan de croissance — ce que le travail récent a produit.
 *
 * Il était l'accueil de l'Atelier. C'était sa mauvaise place : on ouvre
 * l'Atelier pour retrouver une note ou une compétence, et on tombait sur un
 * bilan de la semaine qu'il fallait traverser. Un bilan répond à « où j'en
 * suis », pas à « où est ma fiche » — il appartient à `/progression`.
 *
 * Trois niveaux de lecture, dans l'ordre où on se les pose :
 *   1. **Ce que j'ai fait** — l'activité brute, deux fenêtres ;
 *   2. **Ce que ça a changé** — les niveaux avant/après, les paliers franchis ;
 *   3. **Ce que je construis** — les ensembles auxquels le travail contribue.
 *
 * Aucun calcul ici : tout arrive dérivé de `resumeCroissance` et de
 * `construireVuesAtelier`. Un composant qui recalculerait une mesure serait un
 * second endroit où la règle vit.
 */
export function BilanCroissance({
  resume,
  domaines,
  themes,
  ensemblesSuggeres,
  intitules,
  ouvrirElement,
}: {
  resume: ResumeCroissance;
  domaines: VueDomaineAtelier[];
  themes: VueThemeAtelier[];
  ensemblesSuggeres: EnsemblePropose[];
  intitules: Record<string, string>;
  /** Ouvre une fiche dans l'Atelier — c'est là que vivent les éléments cités. */
  ouvrirElement: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      <NiveauActivite resume={resume} />
      <NiveauCroissance resume={resume} ouvrirElement={ouvrirElement} />
      <NiveauConstruction
        domaines={domaines}
        themes={themes}
        ensemblesSuggeres={ensemblesSuggeres}
        intitules={intitules}
        ouvrirElement={ouvrirElement}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 1 — Ce que j'ai fait                                         */
/* ------------------------------------------------------------------ */

function NiveauActivite({ resume }: { resume: ResumeCroissance }) {
  return (
    <section>
      <TitreNiveau numero={1} titre="Ce que tu as fait" />
      {resume.vide ? (
        <p className="mt-3 rounded-xl border border-dashed border-bordure-contraste bg-surface px-4 py-6 text-center text-xs leading-relaxed text-texte-discret">
          Rien enregistré sur les sept derniers jours.
          <br />
          Cet espace se remplit tout seul dès qu&apos;un travail est terminé — tu n&apos;as rien à y ranger.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <CarteFenetre fenetre={resume.jour} accent />
          <CarteFenetre fenetre={resume.semaine} />
        </div>
      )}
    </section>
  );
}

function CarteFenetre({ fenetre, accent = false }: { fenetre: FenetreCroissance; accent?: boolean }) {
  const rien = fenetre.preuves === 0 && fenetre.exercicesMenes === 0 && fenetre.minutes === 0;

  return (
    <div
      className={cx(
        "rounded-xl border bg-surface p-5 shadow-[var(--ombre-posee)]",
        accent ? "border-primaire/35" : "border-bordure",
      )}
    >
      <p className={cx("text-xs font-semibold uppercase tracking-wider", accent ? "text-primaire" : "text-texte-discret")}>
        {fenetre.libelle}
      </p>

      {rien ? (
        <p className="mt-3 text-xs text-texte-discret">Aucun travail enregistré.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Mesure libelle="Travaillé" valeur={fenetre.minutes > 0 ? formatDuree(fenetre.minutes) : "—"} />
            <Mesure libelle="Exercices" valeur={String(fenetre.exercicesMenes)} />
            <Mesure libelle="Preuves" valeur={String(fenetre.preuves)} />
            <Mesure libelle="Compétences" valeur={String(fenetre.competencesTravaillees.length)} />
          </dl>

          {fenetre.competencesTravaillees.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {fenetre.competencesTravaillees.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Une mesure et son libellé.
 *
 * Un tiret quand il n'y a rien, jamais un zéro : ne pas avoir noté sa durée
 * n'est pas avoir travaillé zéro minute (P2).
 */
function Mesure({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-texte-discret">{libelle}</dt>
      <dd className="chiffres mt-0.5 text-lg font-medium text-texte">{valeur}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 2 — Ce que ça a changé                                       */
/* ------------------------------------------------------------------ */

/**
 * Monter d'un palier, au sens strict — même règle que `croissance.ts`.
 *
 * Elle est redéfinie ici plutôt qu'importée parce que le moteur ne l'expose
 * pas : elle n'a de sens que pour dire une chose à l'écran. Si un troisième
 * appelant en a besoin, c'est à ce moment qu'elle remontera dans le moteur.
 */
function estProgression(evenement: ResumeCroissance["evenements"][number]): boolean {
  return (
    evenement.niveauAvant !== null &&
    evenement.niveauApres !== null &&
    evenement.niveauApres > evenement.niveauAvant
  );
}

function NiveauCroissance({
  resume,
  ouvrirElement,
}: {
  resume: ResumeCroissance;
  ouvrirElement: (id: string) => void;
}) {
  const { evenements, semaine } = resume;

  return (
    <section>
      <TitreNiveau numero={2} titre="Ce que ça a changé" />

      {/*
        Les compteurs de la semaine passent avant la liste : ils répondent en
        un coup d'œil, la liste explique. L'un sans l'autre laisserait soit une
        impression sans détail, soit un détail sans impression.
      */}
      {(semaine.franchissements > 0 || semaine.premieresMesures > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {semaine.franchissements > 0 && (
            <Etiquette ton="succes">
              {semaine.franchissements} palier{semaine.franchissements > 1 ? "s" : ""} franchi
              {semaine.franchissements > 1 ? "s" : ""} cette semaine
            </Etiquette>
          )}
          {semaine.premieresMesures > 0 && (
            <Etiquette ton="info">
              {semaine.premieresMesures} compétence{semaine.premieresMesures > 1 ? "s" : ""} mesurée
              {semaine.premieresMesures > 1 ? "s" : ""} pour la première fois
            </Etiquette>
          )}
        </div>
      )}

      {evenements.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-bordure-contraste bg-surface px-4 py-6 text-center text-xs text-texte-discret">
          Aucune preuve enregistrée pour l&apos;instant. Rien ne s&apos;affiche avant qu&apos;il y en ait une.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-bordure overflow-hidden rounded-xl border border-bordure bg-surface">
          {evenements.map((evenement, index) => (
            <li key={`${evenement.date}-${evenement.skillCode}-${index}`}>
              <button
                type="button"
                onClick={() => ouvrirElement(evenement.skillCode)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 cursor-pointer"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <CodeCompetence code={evenement.skillCode} />
                    {evenement.niveauAvant === null && evenement.niveauApres !== null ? (
                      /*
                        Une première mesure n'est pas une progression.
                        Écrire « Niveau — → 0 · Palier franchi » faisait passer une
                        rencontre pour un progrès : le niveau 0 est
                        « Exposition — preuve insuffisante pour conclure ».
                      */
                      <span className="chiffres text-sm font-medium">
                        Première mesure — niveau <span className="text-info">{evenement.niveauApres}</span>
                      </span>
                    ) : estProgression(evenement) ? (
                      <span className="chiffres text-sm font-medium">
                        Niveau {evenement.niveauAvant}{" "}
                        <span aria-hidden className="text-texte-discret">→</span>{" "}
                        <span className="text-succes">{evenement.niveauApres}</span>
                      </span>
                    ) : evenement.franchissement && evenement.niveauAvant !== null && evenement.niveauApres !== null ? (
                      <span className="chiffres text-sm font-medium">
                        Niveau {evenement.niveauAvant}{" "}
                        <span aria-hidden className="text-texte-discret">→</span>{" "}
                        <span className="text-alerte">{evenement.niveauApres}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-texte-attenue">
                        {evenement.resultat === "reussi"
                          ? "Réussi, niveau confirmé"
                          : evenement.resultat === "partiel"
                            ? "Partiellement réussi"
                            : "Non abouti"}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-texte-attenue">
                    {evenement.intitule}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-texte-discret">
                    {evenement.contexte}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[0.6875rem] text-texte-discret">
                    {formatDateRelative(evenement.date)}
                  </span>
                  {estProgression(evenement) && <Etiquette ton="succes">Palier franchi</Etiquette>}
                  {evenement.niveauAvant === null && evenement.niveauApres !== null && (
                    <Etiquette ton="info">Nouvelle compétence</Etiquette>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Niveau 3 — Ce que je construis                                      */
/* ------------------------------------------------------------------ */

/**
 * Les ensembles auxquels le travail contribue.
 *
 * Thèmes d'abord, domaines ensuite : un thème traverse les domaines, c'est lui
 * qui montre qu'une compétence sert à plusieurs choses. Le domaine reste la
 * partition stricte du référentiel — utile, mais moins parlante sur ce qu'on
 * est en train de construire.
 */
function NiveauConstruction({
  domaines,
  themes,
  ensemblesSuggeres,
  intitules,
  ouvrirElement,
}: {
  domaines: VueDomaineAtelier[];
  themes: VueThemeAtelier[];
  ensemblesSuggeres: EnsemblePropose[];
  intitules: Record<string, string>;
  ouvrirElement: (id: string) => void;
}) {
  const vivants = [...domaines]
    .filter((domaine) => !domaine.domaine.archive)
    .sort((a, b) => (b.derniereActivite ?? "").localeCompare(a.derniereActivite ?? ""));

  return (
    <section>
      <TitreNiveau numero={3} titre="Ce que tu construis" />

      {/*
        Les suggestions passent avant les ensembles existants : c'est la seule
        partie de cet écran qui demande quelque chose, et elle se tâira d'
        elle-même dès qu'il n'y a rien à proposer.
      */}
      <div className="mt-3">
        <EnsemblesSuggeres propositions={ensemblesSuggeres} intitules={intitules} />
      </div>

      {themes.length > 0 && (
        <div className="mt-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Ensembles transversaux
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {themes.map((theme) => (
              <CarteEnsemble
                key={theme.id}
                titre={theme.libelle}
                etiquette="Thème"
                detail={`${theme.competences.length} compétence${theme.competences.length > 1 ? "s" : ""} · ${theme.domaines.length} domaine${theme.domaines.length > 1 ? "s" : ""}`}
                mesurees={theme.nombreEvaluees}
                total={theme.competences.length}
                derniereActivite={theme.derniereActivite}
                onOuvrir={() => ouvrirElement(`theme:${theme.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Domaines
          </p>
          {/*
            La gestion du référentiel reste accessible, mais elle n'est plus
            l'écran d'entrée : c'est un lien discret, pas une grille de cartes
            avec son bouton de création.
          */}
          <button
            type="button"
            onClick={() => ouvrirElement("domaines")}
            className="text-[0.6875rem] text-texte-attenue underline-offset-2 transition-colors hover:text-primaire hover:underline cursor-pointer"
          >
            Gérer les domaines
          </button>
        </div>

        {vivants.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-bordure-contraste bg-surface px-4 py-6 text-center text-xs text-texte-discret">
            Aucun domaine pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vivants.map((domaine) => (
              <CarteEnsemble
                key={domaine.id}
                titre={domaine.nom}
                etiquette="Domaine"
                detail={`${domaine.nombrePreuves} preuve${domaine.nombrePreuves > 1 ? "s" : ""} · ${domaine.nombreExercices} exercice${domaine.nombreExercices > 1 ? "s" : ""}`}
                mesurees={domaine.nombreEvaluees}
                total={domaine.competences.length}
                derniereActivite={domaine.derniereActivite}
                onOuvrir={() => ouvrirElement(`domaine:${domaine.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CarteEnsemble({
  titre,
  etiquette,
  detail,
  mesurees,
  total,
  derniereActivite,
  onOuvrir,
}: {
  titre: string;
  etiquette: string;
  detail: string;
  mesurees: number;
  total: number;
  derniereActivite: string | null;
  onOuvrir: () => void;
}) {
  const ratio = total > 0 ? Math.round((mesurees / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="group flex h-full w-full flex-col justify-between rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
    >
      <div>
        <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
          {etiquette}
        </span>
        <h4 className="mt-1 font-serif text-base font-medium leading-snug text-texte group-hover:text-primaire">
          {titre}
        </h4>
        <p className="mt-1 text-[0.6875rem] text-texte-attenue">{detail}</p>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-bordure pt-3">
        <div className="flex items-center justify-between text-[0.6875rem] text-texte-discret">
          <span>Mesurées</span>
          <span className="chiffres font-medium text-texte">
            {mesurees}/{total}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-primaire transition-all duration-300" style={{ width: `${ratio}%` }} />
        </div>
        <p className="text-[0.625rem] text-texte-discret">
          {derniereActivite ? `Dernière activité ${formatDateRelative(derniereActivite)}` : "Aucune activité"}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function TitreNiveau({ numero, titre }: { numero: number; titre: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="chiffres grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.6875rem] font-semibold text-texte-attenue">
        {numero}
      </span>
      <h2 className="font-serif text-xl font-medium tracking-tight">{titre}</h2>
    </div>
  );
}
