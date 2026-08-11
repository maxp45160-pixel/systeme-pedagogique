import Link from "next/link";
import { Bouton, Carte, CodeCompetence, EnTeteCarte, EtatVide, Etiquette } from "@/components/ui/primitives";
import { formatDateCourte, formatDuree, cleJour } from "@/lib/engine/dates";
import { statutSeance, tentativeDeSeance } from "@/lib/domain/seance";
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
 */
export function CahierSeances({
  seances,
  donnees,
  recherche,
}: {
  seances: LearningSession[];
  donnees: DonneesSeance;
  recherche?: string;
}) {
  const terme = recherche?.trim().toLocaleLowerCase("fr") ?? "";
  const exercicesParId = new Map(donnees.exercices.map((exercice) => [exercice.id, exercice]));
  const realisees = seances
    .filter((s) => statutSeance(s) === "terminee")
    .filter((s) => correspondRecherche(s, terme, exercicesParId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const parJour = new Map<string, LearningSession[]>();
  for (const seance of realisees) {
    const cle = cleJour(seance.date);
    const liste = parJour.get(cle);
    if (liste) liste.push(seance);
    else parJour.set(cle, [seance]);
  }

  return (
    <div className="space-y-6">
      {realisees.length === 0 && (
        <Carte>
          <EtatVide
            titre={terme ? "Aucun résultat" : "Aucune séance réalisée"}
            message={terme
              ? `Aucune séance ne correspond à « ${recherche?.trim()} ».`
              : "Compose ta première séance : une fois terminée, elle rejoint ce cahier."}
          />
        </Carte>
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

function LigneCahier({ seance, donnees }: { seance: LearningSession; donnees: DonneesSeance }) {
  const preset = presetDepuisSeance(seance, donnees.exercices);
  const exercicesParId = new Map(donnees.exercices.map((exercice) => [exercice.id, exercice]));
  const activites = seance.activites.filter((activite) => activite.type === "exercice");

  return (
    <Carte>
      <EnTeteCarte
        titre={`${seance.activites.length} activité${seance.activites.length > 1 ? "s" : ""}`}
        legende={seance.dureeMin !== undefined ? formatDuree(seance.dureeMin) : "durée non notée"}
      />
      <div className="px-5 py-4">
        {seance.skillCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {seance.skillCodes.map((code) => <CodeCompetence key={code} code={code} />)}
          </div>
        )}

        {seance.besoinDeclare?.intention && (
          <p className="mt-2 text-xs italic text-texte-attenue">« {seance.besoinDeclare.intention} »</p>
        )}

        {seance.resultat && <p className="mt-1 text-xs text-texte-discret">{seance.resultat}</p>}

        {activites.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium">Ce qui a été travaillé</p>
            {activites.map((activite) => (
              <TraceExercice
                key={activite.ref}
                exercice={exercicesParId.get(activite.ref)}
                libelle={activite.libelle}
                tentative={tentativeDeSeance(seance, activite.ref, donnees.tentatives)}
              />
            ))}
          </div>
        )}

        <form action={ajouterNoteSession.bind(null, seance.id)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`note-${seance.id}`}>Note personnelle</label>
          <input
            id={`note-${seance.id}`}
            name="note"
            type="text"
            defaultValue={seance.notePersonnelle ?? ""}
            placeholder="Ce que je retiens, ce que je veux revoir…"
            className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-3 py-2 text-xs placeholder:text-texte-discret"
          />
          <Bouton type="submit" variante="secondaire" taille="petite">Annoter</Bouton>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={detailSeanceUrl(seance.id)}
            className="text-xs font-medium text-primaire hover:underline"
          >
            Voir le détail de la séance
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
  const resultat = tentative ? libelleResultat(tentative) : "Trace non retrouvée";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure-controle bg-surface-2 px-3 py-2">
      <span className="min-w-0 text-xs font-medium">{exercice?.titre ?? libelle}</span>
      <Etiquette ton={tentative?.statut === "terminee" ? "succes" : tentative?.statut === "abandonnee" ? "danger" : "info"}>
        {resultat}
      </Etiquette>
    </div>
  );
}

function libelleResultat(tentative: ExerciseAttempt): string {
  if (tentative.statut === "abandonnee") return "Abandonné";
  if (tentative.statut === "en-cours") return "En cours";
  return tentative.resultat === "reussi" ? "Réussi" : tentative.resultat === "partiel" ? "Partiel" : "Non abouti";
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
