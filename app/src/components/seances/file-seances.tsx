import Link from "next/link";
import {
  Bouton,
  Carte,
  classesLienBouton,
  CodeCompetence,
  EnTeteCarte,
  Etiquette,
} from "@/components/ui/primitives";
import { formatDateCourte } from "@/lib/engine/dates";
import { avancementSeance, peutReprendreSeance, statutSeance } from "@/lib/domain/seance";
import { jourDeLaSeance } from "@/lib/domain/pages-cahier";
import {
  abandonnerSeance,
  annulerSeance,
  demarrerSeance,
  reprendreSeance,
} from "@/lib/store/seance-actions";
import type { ExerciseAttempt, LearningSession } from "@/lib/domain/types";

/**
 * Les onglets qui dépassent du cahier (16/08/2026).
 *
 * ## Ce qu'ils remplacent
 *
 * Une file épinglée listait, en pleine largeur et en cartes complètes, tout ce
 * qui demandait un geste. Depuis que le cahier a des pages, cette liste faisait
 * double emploi : une séance en cours vit sur la page de son jour, avec sa
 * carte et ses boutons. La répéter en tête donnait deux endroits pour le même
 * objet — et deux rendus qui finissent par diverger.
 *
 * Ce qui manquait, en revanche, c'est de savoir qu'il y a quelque chose
 * **ailleurs** : en feuilletant le 11 août, rien ne disait qu'une séance était
 * ouverte le 14. D'où des onglets — une ligne par séance ouverte sur une autre
 * page, qui mène à sa page. Ils disparaissent quand on y est.
 *
 * Trois états y figurent, et pas un de plus : une séance terminée n'est pas un
 * geste, elle est une relecture.
 */
import type { DocumentOperationnelDate } from "@/lib/domain/pages-cahier";

export function OngletsSeancesOuvertes({
  seances,
  tentatives,
  projets = [],
  jourAffiche,
}: {
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  projets?: DocumentOperationnelDate[];
  jourAffiche: string;
}) {
  const ouvertes = seances
    .filter((s) => {
      const statut = statutSeance(s);
      if (statut === "en-cours" || statut === "planifiee") return true;
      return peutReprendreSeance(s, avancementSeance(s, tentatives));
    })
    .filter((s) => jourDeLaSeance(s) !== jourAffiche)
    .sort((a, b) => (b.planifieePour ?? b.date).localeCompare(a.planifieePour ?? a.date));

  const projetsOuverts = projets
    .filter((p) => !p.fige)
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));

  if (ouvertes.length === 0 && projetsOuverts.length === 0) return null;

  return (
    <nav aria-label="Séances et projets ouverts" className="flex flex-wrap gap-2">
      {projetsOuverts.map((p) => (
        <Link
          key={p.id}
          href={`/atelier?note=${encodeURIComponent(p.id)}`}
          className="flex items-center gap-2 rounded-t-md border border-b-0 border-bordure bg-surface-2/40 px-3 py-1.5 text-xs hover:bg-surface-2"
        >
          <Etiquette ton="primaire">Projet en cours</Etiquette>
          <span className="max-w-[16rem] truncate font-medium">{p.titre}</span>
          <span className="text-texte-discret">Ouvrir →</span>
        </Link>
      ))}
      {ouvertes.map((s) => {
        const statut = statutSeance(s);
        const libelle =
          statut === "en-cours" ? "En cours" : statut === "planifiee" ? "Planifiée" : "En suspens";
        const ton = statut === "en-cours" ? "primaire" : statut === "planifiee" ? "info" : "danger";
        const titre =
          s.besoinDeclare?.intention ||
          (s.activites.length === 1 ? s.activites[0]?.libelle : null) ||
          `${s.activites.length} activité${s.activites.length > 1 ? "s" : ""}`;

        return (
          <Link
            key={s.id}
            href={`/seances?jour=${encodeURIComponent(jourDeLaSeance(s))}`}
            className="flex items-center gap-2 rounded-t-md border border-b-0 border-bordure bg-surface-2/40 px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            <Etiquette ton={ton}>{libelle}</Etiquette>
            <span className="max-w-[16rem] truncate font-medium">{titre}</span>
            <span className="text-texte-discret">
              {formatDateCourte(s.planifieePour ?? s.date)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Une séance qui demande un geste, avec son avancement et ses actions.
 *
 * Exportée pour la page du cahier : une séance en cours vit sur la page de son
 * jour, et elle doit s'y présenter exactement comme dans la file — même carte,
 * mêmes boutons. Deux rendus pour un même objet finiraient par diverger.
 */
export function CarteSeance({
  seance: s,
  tentatives,
}: {
  seance: LearningSession;
  tentatives: ExerciseAttempt[];
}) {
  const statut = statutSeance(s);
  const enCours = statut === "en-cours";
  const suspendue = statut === "abandonnee";
  const avancement = avancementSeance(s, tentatives);
  const traites = avancement.menes.length + avancement.abandonnes.length;

  const titreSeance =
    s.activites.length === 1 && s.activites[0]?.libelle
      ? s.activites[0].libelle
      : s.besoinDeclare?.intention ||
        (enCours
          ? `Séance en cours (${s.activites.length} activité${s.activites.length > 1 ? "s" : ""})`
          : suspendue
            ? `Séance interrompue le ${formatDateCourte(s.date)}`
            : `Séance prévue le ${formatDateCourte(s.planifieePour ?? s.date)}`);

  const duree = s.besoinDeclare?.tempsDisponibleMin
    ? `${s.besoinDeclare.tempsDisponibleMin} min estimées`
    : s.dureeMin
      ? `${s.dureeMin} min`
      : null;

  const legende = [
    duree,
    s.domaines.length > 0 ? s.domaines.join(", ") : null,
    `${traites}/${avancement.total} activité${avancement.total > 1 ? "s" : ""} traitée${traites > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Carte accent={enCours}>
      <EnTeteCarte
        titre={titreSeance}
        legende={legende}
        action={
          <Etiquette ton={enCours ? "primaire" : suspendue ? "danger" : "info"}>
            {enCours ? "En cours" : suspendue ? "En suspens" : "Planifiée"}
          </Etiquette>
        }
      />

      <div className="space-y-3 px-5 py-4 border-t border-bordure/40">
        {s.skillCodes.length > 0 && (
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Compétence{s.skillCodes.length > 1 ? "s" : ""} visée{s.skillCodes.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {s.skillCodes.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          </div>
        )}

        {s.besoinDeclare?.intention && s.besoinDeclare.intention !== titreSeance && (
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Intention
            </p>
            <p className="mt-0.5 text-xs italic text-texte-attenue">
              « {s.besoinDeclare.intention} »
            </p>
          </div>
        )}

        {s.activites.length > 1 && (
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Programme ({s.activites.length} activités)
            </p>
            <ul className="space-y-1 text-xs">
              {s.activites.map((act, idx) => {
                const etat = avancement.menes.includes(act.ref)
                  ? "mené"
                  : avancement.enCours.includes(act.ref)
                    ? "en cours"
                    : avancement.abandonnes.includes(act.ref)
                      ? "abandonné"
                      : "à faire";
                return (
                  <li key={idx} className="flex items-center gap-2 text-texte-attenue">
                    <span className="font-mono text-[0.6875rem] text-texte-discret">{idx + 1}.</span>
                    <span className="font-medium text-texte">{act.libelle}</span>
                    <span className="text-[0.6875rem] text-texte-discret">({etat})</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure bg-surface-2/30 px-5 py-3">
        <span className="text-xs text-texte-discret">
          {enCours
            ? "Séance active dans le workspace"
            : suspendue
              ? `${avancement.restants.length} activité(s) jamais ouverte(s)`
              : `Planifiée pour le ${formatDateCourte(s.planifieePour ?? s.date)}`}
        </span>
        <div className="flex items-center gap-2">
          {enCours && (
            <>
              {/*
                Abandonner est un geste de sortie, pas une destruction : ce qui
                a été mené garde ses preuves. Il est proposé ici parce qu'une
                séance ouverte qu'on ne veut pas mener n'avait, avant le
                16/08/2026, aucune porte de sortie.
              */}
              <form action={abandonnerSeance.bind(null, s.id)}>
                <Bouton type="submit" variante="secondaire" taille="petite">
                  Abandonner
                </Bouton>
              </form>
              <Link href={`/seances?session=${s.id}`} className={classesLienBouton("principal")}>
                Reprendre la séance →
              </Link>
            </>
          )}
          {suspendue && (
            <form action={reprendreSeance.bind(null, s.id)}>
              <Bouton type="submit" variante="principal">
                Reprendre là où j’en étais →
              </Bouton>
            </form>
          )}
          {!enCours && !suspendue && (
            <>
              <form action={annulerSeance.bind(null, s.id)}>
                <Bouton type="submit" variante="danger" taille="petite">
                  Annuler
                </Bouton>
              </form>
              <form action={demarrerSeance.bind(null, s.id)}>
                <Bouton type="submit" variante="principal">
                  Démarrer la séance →
                </Bouton>
              </form>
            </>
          )}
        </div>
      </div>
    </Carte>
  );
}
