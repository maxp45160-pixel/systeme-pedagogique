import type { Carriere } from "@/lib/engine/carriere";
import type { EtatGlobal } from "@/lib/engine/progression";
import type { User } from "@/lib/domain/types";
import { profilDeclare } from "@/lib/domain/profil";
import { formatDuree } from "@/lib/engine/dates";
import { BarreProgression, TagConfiance, cx } from "@/components/ui/primitives";

/**
 * L'en-tête du profil : qui, depuis quand, et ce que ça totalise.
 *
 * ## Ce qu'on affiche, et ce qu'on n'affiche pas
 *
 * Pas de « niveau de carrière », pas de rang, pas de titre débloqué. Ces
 * mécaniques classent un joueur à partir du **temps passé** ; ici le seul
 * classement légitime vient des preuves, et il existe déjà : c'est le score
 * global. Ajouter un second nombre, calculé sur les minutes, donnerait deux
 * réponses concurrentes à « où j'en suis » — dont une qui monterait en laissant
 * simplement l'application ouverte.
 *
 * Les totaux ci-dessous ne classent rien. Ils comptent ce qui a eu lieu.
 */
export function CarteCarriere({
  user,
  carriere,
  global,
}: {
  user: User;
  carriere: Carriere;
  global: EtatGlobal;
}) {
  const profil = profilDeclare(user);
  const nom = user.prenom.trim() || "Mon profil";

  return (
    <section className="overflow-hidden rounded-xl border border-bordure bg-surface shadow-[var(--ombre-posee)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-bordure bg-surface-2/40 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primaire text-xl font-semibold text-primaire-contraste">
            {nom.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-2xl font-medium tracking-tight">{nom}</h2>
            {/*
              La formation et l'objectif sont affichés s'ils sont déclarés, et
              tus sinon — `profilDeclare` distingue déjà une valeur d'un libellé
              par défaut. Un profil vide ne doit pas se lire comme un profil
              rempli de tirets.
            */}
            <p className="mt-0.5 truncate text-xs text-texte-attenue">
              {profil.formation || "Formation non déclarée"}
              {profil.objectifMoyenTerme ? ` · ${profil.objectifMoyenTerme}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
              Progression globale
            </p>
            <p className="chiffres mt-0.5 flex items-baseline justify-end gap-1.5">
              <span
                className={cx(
                  "text-3xl font-semibold tracking-tight",
                  global.scoreGlobal === null ? "text-texte-discret" : "text-primaire",
                )}
              >
                {global.scoreGlobal ?? "—"}
              </span>
              <span className="text-sm text-texte-attenue">/ 100</span>
            </p>
          </div>
          <TagConfiance confiance={global.confiance} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-bordure sm:grid-cols-3 lg:grid-cols-6">
        <Compteur libelle="Temps travaillé" valeur={carriere.minutesTotal > 0 ? formatDuree(carriere.minutesTotal) : "—"} />
        <Compteur libelle="Séances" valeur={String(carriere.seancesTotal)} />
        <Compteur libelle="Exercices menés" valeur={String(carriere.exercicesMenes)} />
        <Compteur libelle="Preuves" valeur={String(carriere.preuvesTotal)} />
        <Compteur libelle="Jours actifs" valeur={String(carriere.joursActifsTotal)} />
        <Compteur
          libelle="Meilleure série"
          valeur={carriere.meilleureSerie > 0 ? `${carriere.meilleureSerie} j` : "—"}
          precision={carriere.serieEnCours > 0 ? `${carriere.serieEnCours} j en cours` : undefined}
        />
      </dl>

      {carriere.debut !== null && carriere.joursDepuisDebut !== null && (
        <p className="border-t border-bordure px-5 py-3 text-xs text-texte-discret sm:px-6">
          Première preuve il y a {carriere.joursDepuisDebut} jour
          {carriere.joursDepuisDebut > 1 ? "s" : ""} · {global.competencesEvaluees} compétence
          {global.competencesEvaluees > 1 ? "s" : ""} mesurée
          {global.competencesEvaluees > 1 ? "s" : ""} sur {global.competencesTotal}
        </p>
      )}
    </section>
  );
}

function Compteur({
  libelle,
  valeur,
  precision,
}: {
  libelle: string;
  valeur: string;
  precision?: string;
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="text-[0.625rem] uppercase tracking-wide text-texte-discret">{libelle}</dt>
      <dd className="chiffres mt-1 text-lg font-semibold tracking-tight">{valeur}</dd>
      {precision && <dd className="mt-0.5 text-[0.625rem] text-primaire">{precision}</dd>}
    </div>
  );
}

/**
 * Le classement des domaines — l'équivalent d'un « temps par héros ».
 *
 * Trié par nombre de preuves : c'est la seule mesure d'investissement qui ne
 * dépende pas d'une durée saisie à la main. Un domaine sans preuve reste
 * affiché, avec un tiret plutôt qu'un zéro — l'absence de preuve n'est pas un
 * niveau nul (P3).
 */
export function ClassementDomaines({ global }: { global: EtatGlobal }) {
  const domaines = [...global.parDomaine].sort((a, b) => {
    if (b.preuves !== a.preuves) return b.preuves - a.preuves;
    return (b.score ?? -1) - (a.score ?? -1);
  });

  if (domaines.length === 0) return null;

  return (
    <section className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)] sm:p-6">
      <h2 className="font-serif text-lg font-medium">Par domaine</h2>
      <p className="mt-1 text-xs text-texte-discret">
        Classés par nombre de preuves accumulées — pas par temps déclaré.
      </p>

      <ul className="mt-4 space-y-3">
        {domaines.map((domaine) => (
          <li key={domaine.domaine}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 truncate text-sm font-medium">{domaine.nom}</span>
              <span className="chiffres text-xs text-texte-discret">
                {domaine.preuves} preuve{domaine.preuves > 1 ? "s" : ""} ·{" "}
                {domaine.competencesEvaluees}/{domaine.competencesTotal} mesurée
                {domaine.competencesEvaluees > 1 ? "s" : ""}
                {domaine.score !== null ? ` · ${domaine.score}/100` : " · niveau non établi"}
              </span>
            </div>
            {/*
              La barre n'est tracée que si un score existe : la rendre à zéro
              pour un domaine sans preuve montrerait un niveau nul là où il n'y
              a pas de mesure (P3). Le libellé au-dessus le dit déjà en mots.
            */}
            {domaine.score !== null && (
              <div className="mt-1.5">
                <BarreProgression fraction={domaine.score / 100} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
