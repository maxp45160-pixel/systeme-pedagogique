import Link from "next/link";
import { Bouton, Carte, CodeCompetence, EnTeteCarte, EtatVide, Etiquette, classesLienBouton } from "@/components/ui/primitives";
import { RappelNouveauBesoin } from "@/components/intention/bouton-intention";
import { formatDateCourte, formatDuree, cleJour } from "@/lib/engine/dates";
import {
  avancementSeance,
  peutReprendreSeance,
  statutSeance,
  tentativeDeSeance,
} from "@/lib/domain/seance";
import type { Exercise, ExerciseAttempt, LearningSession } from "@/lib/domain/types";
import {
  ConcepteurSeance,
  type DonneesSeance,
  type PresetSeance,
} from "@/components/seances/concepteur-seance";
import { ajouterNoteSession } from "@/lib/store/actions";

/**
 * Cahier chronologique léger (ADR-061) — le remplaçant d'Historique + Journal.
 * Les traces détaillées restent repliées par exercice : le carnet se relit
 * comme un cahier, sans faire disparaître la réponse, le bilan ou le tuteur.
 *
 * ## Deux registres, et c'est le point (16/08/2026)
 *
 * Toutes les lignes de `sessions` ne sont pas des séances. `terminerExercice`
 * en écrit une par exercice clos hors séance : au 16/08/2026, **45 des 51
 * lignes** sont de celles-là. Le cahier les rendait exactement comme les autres
 * — carte pleine, champ d'annotation, « Refaire la séance » — et les six vraies
 * séances se noyaient dans quarante-cinq cartes identiques.
 *
 * Ce sont deux choses différentes, et `genereAutomatiquement` le dit déjà :
 *
 *  - une **séance** composée est une page du cahier : ce qu'on a voulu, ce qu'on
 *    en a tiré, ce qu'on en note ;
 *  - un **exercice fait hors séance** est une trace en marge : ce qui a été
 *    travaillé, et rien de plus.
 *
 * Le regroupement par jour ne change pas : une journée garde sa séance et ce
 * qu'on a fait à côté, dans deux densités différentes. Rien n'est masqué, rien
 * n'est agrégé — la distinction est lue, pas fabriquée (P1).
 */
import type { DocumentOperationnelDate } from "@/lib/domain/pages-cahier";

export function CahierSeances({
  seances,
  donnees,
  recherche,
  projets = [],
}: {
  seances: LearningSession[];
  donnees: DonneesSeance;
  recherche?: string;
  projets?: DocumentOperationnelDate[];
}) {
  const terme = recherche?.trim().toLocaleLowerCase("fr") ?? "";
  const exercicesParId = new Map(donnees.exercices.map((exercice) => [exercice.id, exercice]));
  /*
   * Le cahier tient les séances refermées : terminées, et abandonnées dont il
   * ne reste rien à reprendre. Celles qui gardent des activités jamais ouvertes
   * restent dans la file « en suspens » — les ranger ici les enterrerait dans
   * l'historique alors qu'elles demandent encore un geste.
   */
  const realisees = seances
    .filter((s) => {
      const statut = statutSeance(s);
      if (statut === "terminee") return true;
      return (
        statut === "abandonnee" &&
        !peutReprendreSeance(s, avancementSeance(s, donnees.tentatives))
      );
    })
    .filter((s) => correspondRecherche(s, terme, exercicesParId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const projetsFiltres = (projets ?? []).filter((p) => {
    if (!terme) return false;
    const texte = [p.titre, p.contexte, ...p.competences].filter(Boolean).join(" ").toLocaleLowerCase("fr");
    return texte.includes(terme);
  });

  const parJour = new Map<string, LearningSession[]>();
  for (const seance of realisees) {
    const cle = cleJour(seance.date);
    const liste = parJour.get(cle);
    if (liste) liste.push(seance);
    else parJour.set(cle, [seance]);
  }

  return (
    <div className="space-y-6">
      {realisees.length === 0 && projetsFiltres.length === 0 && (
        <Carte>
          <EtatVide
            titre={terme ? "Aucun résultat" : "Aucune séance réalisée"}
            message={terme
              ? `Aucun élément ne correspond à « ${recherche?.trim()} ».`
              : "Compose ta première séance : une fois terminée, elle rejoint ce cahier."}
          />
          {!terme && (
            /*
              État vide actif (chantier audit UX) : le geste d'entrée du funnel
              est nommé ET déclenchable sur place — pas seulement décrit.
            */
            <div className="pb-2">
              <RappelNouveauBesoin />
            </div>
          )}
        </Carte>
      )}

      {projetsFiltres.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-base font-medium tracking-tight">
            Projet{projetsFiltres.length > 1 ? "s" : ""} retrouvé{projetsFiltres.length > 1 ? "s" : ""}
          </h3>
          <div className="space-y-3">
            {projetsFiltres.map((p) => (
              <Carte key={p.id}>
                <EnTeteCarte
                  titre={p.titre}
                  legende={p.dureeMin ? formatDuree(p.dureeMin) : "Projet"}
                  action={<Etiquette ton="primaire">Projet</Etiquette>}
                />
                <div className="px-5 py-4 space-y-3">
                  {p.competences.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.competences.map((code) => <CodeCompetence key={code} code={code} />)}
                    </div>
                  )}
                  {p.contexte && <p className="text-xs text-texte-attenue line-clamp-2">{p.contexte}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-bordure/40">
                    <span className="text-xs text-texte-discret">Espace de travail</span>
                    <Link
                      href={`/atelier?note=${encodeURIComponent(p.id)}&retour=${encodeURIComponent(recherche ? `/seances?q=${encodeURIComponent(recherche)}` : "/seances")}`}
                      className={classesLienBouton("principal", "petite")}
                    >
                      Ouvrir le projet →
                    </Link>
                  </div>
                </div>
              </Carte>
            ))}
          </div>
        </div>
      )}

      {[...parJour.entries()].map(([cle, liste]) => (
        <div key={cle}>
          <h3 className="mb-2 font-serif text-base font-medium tracking-tight">
            {formatDateCourte(liste[0].date)}
          </h3>
          <div className="space-y-3">
            {liste.map((seance) => (
              <LigneCahier key={seance.id} seance={seance} donnees={donnees} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RechercheCahier({ recherche }: { recherche?: string }) {
  const terme = recherche?.trim() ?? "";
  return (
    <form action="/seances" method="get" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="recherche-cahier" className="sr-only">Rechercher dans le cahier</label>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-texte-discret" aria-hidden>⌕</span>
        <input
          id="recherche-cahier"
          name="q"
          type="search"
          defaultValue={recherche ?? ""}
          placeholder="Rechercher une notion, une compétence, une conclusion…"
          className="w-full rounded-md border border-bordure-controle bg-surface py-2.5 pl-9 pr-3 text-sm placeholder:text-texte-discret"
        />
      </div>
      <Bouton type="submit" variante="secondaire">Rechercher</Bouton>
      {terme && (
        <Link href="/seances" className="self-center text-xs font-medium text-primaire hover:underline">
          Effacer
        </Link>
      )}
    </form>
  );
}

/**
 * Une séance refermée, relue : ce qu'elle visait, ce qu'elle a traversé, ce
 * qu'on en note. Exportée pour la page du cahier, qui la pose sur le jour où la
 * séance a eu lieu.
 */
export function LigneCahier({ seance, donnees }: { seance: LearningSession; donnees: DonneesSeance }) {
  const preset = presetDepuisSeance(seance, donnees.exercices);
  const exercicesParId = new Map(donnees.exercices.map((exercice) => [exercice.id, exercice]));
  const activites = seance.activites.filter((activite) => activite.type === "exercice");
  const abandonnee = statutSeance(seance) === "abandonnee";

  const titre =
    seance.besoinDeclare?.intention?.trim() ||
    (activites.length === 1 ? (exercicesParId.get(activites[0]?.ref)?.titre ?? activites[0]?.libelle) : null) ||
    "Séance d'exercices";

  const nbExercices = `${activites.length} exercice${activites.length > 1 ? "s" : ""}`;
  const duree = seance.dureeMin !== undefined ? formatDuree(seance.dureeMin) : "durée non notée";
  const metaLigne = `${nbExercices} · ${duree}`;

  return (
    <Carte>
      <EnTeteCarte
        titre={titre}
        legende={metaLigne}
        action={
          abandonnee ? (
            <Etiquette ton="danger">Abandonnée</Etiquette>
          ) : (
            <Etiquette ton="succes">Terminée</Etiquette>
          )
        }
      />
      <div className="space-y-4 px-5 py-4">
        {seance.resultat && (
          <p className="text-xs text-texte-attenue">
            {seance.resultat}
          </p>
        )}

        {activites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Exercices
            </p>
            <div className="space-y-1.5">
              {activites.map((activite) => (
                <TraceExercice
                  key={activite.ref}
                  exercice={exercicesParId.get(activite.ref)}
                  libelle={activite.libelle}
                  tentative={tentativeDeSeance(seance, activite.ref, donnees.tentatives)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5 border-t border-bordure/50 pt-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-texte-discret" htmlFor={`note-${seance.id}`}>
            Note de séance
          </label>
          <form action={ajouterNoteSession.bind(null, seance.id)} className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`note-${seance.id}`}
              name="note"
              type="text"
              defaultValue={seance.notePersonnelle ?? ""}
              placeholder="Ce que je retiens, ce que je veux revoir…"
              className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-3 py-2 text-xs placeholder:text-texte-discret"
            />
            <Bouton type="submit" variante="secondaire" taille="petite">
              Enregistrer
            </Bouton>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure/50 pt-3">
          <Link
            href={detailSeanceUrl(seance.id)}
            className="text-xs font-medium text-primaire hover:underline"
          >
            Voir le détail de la séance →
          </Link>
          {preset && <ConcepteurSeance {...donnees} preset={preset} libelle="Refaire la séance" />}
        </div>
      </div>
    </Carte>
  );
}

function TraceExercice({
  exercice,
  libelle,
  tentative,
}: {
  exercice?: Exercise;
  libelle: string;
  tentative?: ExerciseAttempt;
}) {
  const resultat = tentative
    ? libelleResultat(tentative)
    : { texte: "Non réalisé", ton: "neutre" as const };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure-controle/40 bg-surface-2/50 px-3 py-2">
      <span className="min-w-0 text-xs font-medium">{exercice?.titre ?? libelle}</span>
      <Etiquette ton={resultat.ton}>
        {resultat.texte}
      </Etiquette>
    </div>
  );
}

function libelleResultat(tentative: ExerciseAttempt): {
  texte: string;
  ton: "succes" | "alerte" | "danger" | "primaire" | "neutre";
} {
  if (tentative.statut === "abandonnee") return { texte: "Abandonné", ton: "danger" };
  if (tentative.statut === "en-cours") return { texte: "En cours", ton: "primaire" };
  if (tentative.resultat === "reussi") return { texte: "Réussi", ton: "succes" };
  if (tentative.resultat === "partiel") return { texte: "Partiel", ton: "alerte" };
  return { texte: "Non abouti", ton: "danger" };
}

function detailSeanceUrl(seanceId: string): string {
  const params = new URLSearchParams({ session: seanceId });
  return `/seances?${params.toString()}`;
}

/** Reconstruction d'une demande de composition à partir du blueprint conservé. */
export function presetDepuisSeance(
  seance: LearningSession,
  exercices: Exercise[] = [],
): PresetSeance | undefined {
  const blueprint = seance.blueprint;
  if (blueprint) {
    return {
      codesVises: blueprint.cibles.map((cible) => cible.code),
      nombreExercices: blueprint.nombreExercices,
      dureeCibleMin: blueprint.dureeCibleMin,
      domaine: blueprint.portee.type === "mono" ? blueprint.portee.domaine : undefined,
    };
  }

  const ids = seance.activites.filter((activite) => activite.type === "exercice").map((activite) => activite.ref);
  const retenus = ids.flatMap((id) => {
    const exercice = exercices.find((item) => item.id === id);
    return exercice ? [exercice] : [];
  });
  const codesVises = [...new Set(seance.skillCodes.length > 0
    ? seance.skillCodes
    : retenus.flatMap((exercice) => exercice.competences))];
  if (codesVises.length === 0 || retenus.length === 0) return undefined;

  const domaines = [...new Set(retenus.map((exercice) => exercice.domaine))];
  return {
    codesVises,
    nombreExercices: retenus.length,
    dureeCibleMin: retenus.reduce((total, exercice) => total + exercice.dureeEstimeeMin, 0),
    domaine: domaines.length === 1 ? domaines[0] : undefined,
  };
}

function correspondRecherche(
  seance: LearningSession,
  terme: string,
  exercicesParId: Map<string, Exercise>,
): boolean {
  if (!terme) return true;
  const texte = [
    seance.resultat,
    seance.apprentissagePrincipal,
    seance.prochaineAction,
    seance.notePersonnelle,
    seance.besoinDeclare?.intention,
    ...seance.skillCodes,
    ...seance.activites.map((activite) => activite.libelle),
    ...seance.activites.flatMap((activite) => {
      const exercice = exercicesParId.get(activite.ref);
      return exercice ? [exercice.titre, exercice.enonce, ...exercice.competences] : [];
    }),
  ]
    .filter((valeur): valeur is string => Boolean(valeur))
    .join(" ")
    .toLocaleLowerCase("fr");
  return texte.includes(terme);
}
