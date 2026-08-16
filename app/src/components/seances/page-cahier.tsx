import type { ReactNode } from "react";
import Link from "next/link";
import { Etiquette, classesLienBouton } from "@/components/ui/primitives";
import { cleJour, formatDuree } from "@/lib/engine/dates";
import { statutSeance, tentativeDeSeance } from "@/lib/domain/seance";
import { construirePage, pageEstVide, voisinesDeLaPage } from "@/lib/domain/pages-cahier";
import type { ExerciseAttempt, LearningSession } from "@/lib/domain/types";
import type { LigneMarge } from "@/lib/documents/marge";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import { CarteSeance } from "@/components/seances/file-seances";
import { LigneCahier } from "@/components/seances/cahier-seances";
import { MargeCahier } from "@/components/seances/marge-cahier";
import { CalendrierCahier } from "@/components/seances/calendrier-cahier";

/**
 * Une page du cahier : un jour, et tout ce qu'il porte.
 *
 * ## Ce que la page remplace
 *
 * Le hub déroulait tout l'historique d'un coup, précédé d'un champ de
 * recherche. Il n'y avait pas de page, donc rien à tourner et rien à rouvrir là
 * où l'on s'était arrêté. Ici, on ouvre un jour, on tourne vers le précédent ou
 * le suivant, et le marque-page ramène à la dernière page consultée.
 *
 * ## Deux registres sur la même page
 *
 * Une séance composée est une page écrite : ce qu'on a voulu, ce qu'on en a
 * tiré. Un exercice clos hors séance est une trace en marge — au 16/08/2026,
 * 45 des 51 lignes de `sessions` en sont, et les rendre à l'identique noyait
 * les vraies séances. La séparation est lue (`genereAutomatiquement`), jamais
 * fabriquée.
 *
 * ## La marge du jour
 *
 * Elle ne s'écrit que sur la page du jour. Écrire sur une page passée
 * daterait la ligne du jour qu'on regarde et non de celui où on l'a écrite —
 * une date fausse sur un fait daté (P2). Les pages passées restent
 * annotables : c'est ce que fait déjà le champ de chaque séance.
 */
export function PageCahier({
  jour,
  jours,
  mois,
  seances,
  tentatives,
  donnees,
  notes,
  aujourdHui,
  seanceDeployee,
}: {
  jour: string;
  jours: string[];
  /** Le mois ouvert dans le calendrier — pas forcément celui de la page. */
  mois: string;
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
  notes: LigneMarge[];
  aujourdHui: Date;
  /** La séance ouverte en plein travail, rendue à sa place dans le déroulé. */
  seanceDeployee?: { id: string; contenu: ReactNode };
}) {
  const page = construirePage(jour, { seances, notes });
  const { precedente, suivante } = voisinesDeLaPage(jour, jours);
  const cleAujourdHui = cleJour(aujourdHui);
  const estAujourdHui = jour === cleAujourdHui;

  return (
    <div className="page-cahier px-4 py-5 sm:pl-14 sm:pr-6">
      <EnTetePage
        jour={jour}
        precedente={precedente}
        suivante={suivante}
        estAujourdHui={estAujourdHui}
        cleAujourdHui={cleAujourdHui}
        calendrier={
          <CalendrierCahier jour={jour} mois={mois} jours={jours} aujourdHui={aujourdHui} />
        }
      />

      <div className="space-y-6 pt-5">
      {page.seances.map((seance) =>
        seanceDeployee?.id === seance.id ? (
          <div key={seance.id}>{seanceDeployee.contenu}</div>
        ) : (
          <SeanceDeLaPage
            key={seance.id}
            seance={seance}
            tentatives={tentatives}
            donnees={donnees}
          />
        ),
      )}

      {/*
        Les traces et la marge ne sont pas encartées : ce sont des lignes
        écrites sur la page. Une carte posée sur du papier réglé donnerait une
        feuille collée sur la feuille.
      */}
      {page.traces.length > 0 && (
        <section className="space-y-1">
          <TitreDeSection>Aussi ce jour-là</TitreDeSection>
          <ul className="divide-y divide-bordure/60">
            {page.traces.map((trace) => (
              <TraceHorsSeance key={trace.id} seance={trace} donnees={donnees} />
            ))}
          </ul>
        </section>
      )}

      {/*
        La marge en bas de page, comme dans un cahier : on écrit à côté de ce
        qu'on a fait, pas avant de l'avoir fait.
      */}
      {estAujourdHui ? (
        <section className="space-y-2">
          <TitreDeSection>En marge</TitreDeSection>
          <MargeCahier lignes={notes} compacte />
        </section>
      ) : page.notes.length > 0 ? (
        <section className="space-y-1">
          <TitreDeSection>Noté ce jour-là</TitreDeSection>
          <ul className="space-y-1.5">
            {page.notes.map((note, index) => (
              <li
                key={`${index}-${note.texte}`}
                className={`text-sm ${note.faite ? "text-texte-discret line-through" : ""}`}
              >
                {note.texte}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pageEstVide(page) && (
        <p className="py-6 text-sm italic text-texte-discret">
          {estAujourdHui
            ? "Page vierge. Note ce sur quoi tu bloques, ou compose une séance."
            : "Rien n’a été écrit ce jour-là."}
        </p>
      )}
      </div>
    </div>
  );
}

function EnTetePage({
  jour,
  precedente,
  suivante,
  estAujourdHui,
  cleAujourdHui,
  calendrier,
}: {
  jour: string;
  precedente: string | null;
  suivante: string | null;
  estAujourdHui: boolean;
  cleAujourdHui: string;
  calendrier: ReactNode;
}) {
  const lien = (cible: string) => `/seances?jour=${encodeURIComponent(cible)}`;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bordure pb-3">
      <div className="min-w-0">
        {/*
          La date, écrite en tête de page et soulignée à la main : c'est le
          premier geste qu'on fait dans un cahier, et c'est ce qui dit qu'on
          regarde une page et non une liste.
        */}
        <h2 className="souligne inline-block font-serif text-2xl font-medium tracking-tight first-letter:capitalize">
          {libelleJour(jour)}
        </h2>
        {estAujourdHui && (
          <p className="mt-2 text-xs text-texte-discret">La page du jour.</p>
        )}
      </div>

      <nav aria-label="Pages du cahier" className="flex items-center gap-2">
        {precedente ? (
          <Link
            href={lien(precedente)}
            aria-label="Page précédente"
            title="Page précédente"
            className={classesLienBouton("secondaire", "petite")}
          >
            ←
          </Link>
        ) : (
          <span className="text-xs text-texte-discret">Début</span>
        )}
        {suivante && (
          <Link
            href={lien(suivante)}
            aria-label="Page suivante"
            title="Page suivante"
            className={classesLienBouton("secondaire", "petite")}
          >
            →
          </Link>
        )}
        {!estAujourdHui && (
          <Link href={lien(cleAujourdHui)} className={classesLienBouton("secondaire", "petite")}>
            Aujourd’hui
          </Link>
        )}
        {calendrier}
      </nav>
    </div>
  );
}

/**
 * Une séance sur sa page : la carte de relecture si elle est refermée, la carte
 * d'action si elle attend encore quelque chose. Le choix se lit sur le statut,
 * et les deux rendus sont ceux qui existent déjà ailleurs.
 */
function SeanceDeLaPage({
  seance,
  tentatives,
  donnees,
}: {
  seance: LearningSession;
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
}) {
  const statut = statutSeance(seance);
  if (statut === "terminee" || statut === "abandonnee") {
    return <LigneCahier seance={seance} donnees={donnees} />;
  }
  return <CarteSeance seance={seance} tentatives={tentatives} />;
}

/** L'intitulé d'une rubrique de la page — discret, il ne concurrence pas la date. */
function TitreDeSection({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
      {children}
    </h3>
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
  const exercice = activite ? donnees.exercices.find((item) => item.id === activite.ref) : undefined;
  const tentative = activite
    ? tentativeDeSeance(seance, activite.ref, donnees.tentatives)
    : undefined;

  const resultat = tentative?.statut === "abandonnee"
    ? { texte: "Abandonné", ton: "danger" as const }
    : tentative?.resultat === "reussi"
      ? { texte: "Réussi", ton: "succes" as const }
      : tentative?.resultat === "partiel"
        ? { texte: "Partiel", ton: "info" as const }
        : { texte: "Non abouti", ton: undefined };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <span className="text-sm">{exercice?.titre ?? activite?.libelle ?? "Exercice"}</span>
        {typeof seance.dureeMin === "number" && (
          <span className="ml-2 text-xs text-texte-discret">{formatDuree(seance.dureeMin)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Etiquette ton={resultat.ton}>{resultat.texte}</Etiquette>
        <Link
          href={`/seances?session=${encodeURIComponent(seance.id)}`}
          className="text-xs font-medium text-primaire hover:underline"
        >
          Détail
        </Link>
      </div>
    </li>
  );
}

function libelleJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
