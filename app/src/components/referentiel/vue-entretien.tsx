"use client";

import { useState, useTransition } from "react";
import type { LotCandidats } from "@/lib/engine/candidats-referentiel";
import { Bouton } from "@/components/ui/primitives";
import { relierCompetencesAction } from "@/lib/store/entretien-actions";
import { RetravailCompetence } from "./retravail-competence";

/**
 * L'entretien du référentiel — ADR-086.
 *
 * Le système détecte seul et prépare le lot ; l'écriture reste un clic. Aucun
 * garde-fou n'est levé : le tuteur ne crée toujours aucun code, et rien ne
 * tombe dans un domaine faute de mieux.
 *
 * Chaque ligne porte **les faits qui la motivent**, jamais un texte rédigé
 * d'avance (P3). Un lot vide est une information, pas un écran raté : sur le
 * référentiel réel du compte, les arêtes candidates rendent zéro parce
 * qu'aucune paire co-mobilisée n'a d'ordre observable — le détecteur se tait
 * plutôt que d'orienter au hasard (ADR-056).
 */

function Section({
  titre,
  compte,
  explication,
  children,
}: {
  titre: string;
  compte: number;
  explication: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-texte">{titre}</h3>
        <span className="shrink-0 rounded-full border border-bordure bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-texte-discret">
          {compte}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-texte-attenue">{explication}</p>
      {compte === 0 ? (
        <p className="mt-4 text-xs text-texte-discret">
          Rien à proposer — et c&apos;est une information, pas un manque.
        </p>
      ) : (
        <div className="mt-4 space-y-3">{children}</div>
      )}
    </section>
  );
}

function Ligne({
  titre,
  motifs,
  action,
}: {
  titre: string;
  motifs: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-bordure bg-surface-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-texte">{titre}</p>
        {action}
      </div>
      <ul className="mt-2 space-y-1">
        {motifs.map((motif) => (
          <li key={motif} className="text-xs text-texte-attenue">
            {motif}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoutonRelier({ amont, aval }: { amont: string; aval: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <Bouton
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            try {
              await relierCompetencesAction(amont, aval);
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "Échec de l'écriture.");
            }
          })
        }
      >
        {enCours ? "Écriture…" : "Déclarer le prérequis"}
      </Bouton>
      {erreur && <p className="mt-1 max-w-xs text-xs text-danger">{erreur}</p>}
    </div>
  );
}

/** Une ligne de reformulation, avec son formulaire dépliable. */
function LigneReformulation({
  candidat,
  meta,
}: {
  candidat: LotCandidats["reformulations"][number];
  meta: { palier: string; importance: number };
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="rounded-lg border border-bordure bg-surface-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-texte">{candidat.code}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              candidat.aDesObservations
                ? "bg-alerte-faible text-alerte"
                : "bg-surface text-texte-discret border border-bordure"
            }`}
          >
            {candidat.aDesObservations ? "porte des observations" : "sans observation"}
          </span>
          <Bouton type="button" onClick={() => setOuvert((o) => !o)}>
            {ouvert ? "Fermer" : "Retravailler"}
          </Bouton>
        </div>
      </div>
      <p className="mt-1 text-xs text-texte-attenue">{candidat.intitule}</p>
      <ul className="mt-2 space-y-1">
        {candidat.motifs.map((motif) => (
          <li key={motif} className="text-xs text-texte-attenue">
            {motif}
          </li>
        ))}
      </ul>
      {ouvert && (
        <RetravailCompetence
          code={candidat.code}
          intitule={candidat.intitule}
          palier={meta.palier}
          importance={meta.importance}
          aDesObservations={candidat.aDesObservations}
          onFerme={() => setOuvert(false)}
        />
      )}
    </div>
  );
}

export function VueEntretien({
  lot,
  intitules,
  metaCompetences,
}: {
  lot: LotCandidats;
  /** Intitulé par code, pour lire les lignes sans deviner. */
  intitules: Record<string, string>;
  /** Palier et importance actuels, pour pré-remplir le retravail. */
  metaCompetences: Record<string, { palier: string; importance: number }>;
}) {
  const nom = (code: string) => `${code} — ${intitules[code] ?? code}`;

  return (
    <div className="h-full overflow-y-auto bg-surface p-4">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <p className="text-sm text-texte-attenue">
            <strong className="font-medium text-texte">
              Ce que les faits disent de votre référentiel.
            </strong>{" "}
            Le système relit vos observations, vos exercices et vos séances, et
            prépare ces propositions sans qu&apos;on les lui demande. Il
            n&apos;écrit rien : chaque ligne attend un geste.
          </p>
          <p className="mt-3 text-sm text-texte-attenue">
            Aucune proposition n&apos;est fabriquée. Une relation sans ordre
            observable dans vos données n&apos;est pas proposée du tout —
            mieux vaut un lot vide qu&apos;un lot plausible.
          </p>
        </div>

        <Section
          titre="Compétences à reformuler"
          compte={lot.reformulations.length}
          explication="Leur intitulé décrit plusieurs savoir-faire à la fois. Tant qu'il n'est pas réécrit, la compétence ne peut plus être modifiée ni recevoir de prérequis."
        >
          {lot.reformulations.map((c) => (
            <LigneReformulation
              key={c.code}
              candidat={c}
              meta={metaCompetences[c.code] ?? { palier: "fondamentaux", importance: 0.5 }}
            />
          ))}
        </Section>

        <Section
          titre="Relations manquantes"
          compte={lot.aretes.length}
          explication="Deux compétences travaillées ensemble, dont l'une a été démontrée avant que l'autre soit tentée."
        >
          {lot.aretes.map((c) => (
            <Ligne
              key={`${c.amont}->${c.aval}`}
              titre={`${nom(c.amont)}  →  ${nom(c.aval)}`}
              motifs={[
                c.source === "usage"
                  ? "Signal fort : tiré de ce qui s'est réellement passé."
                  : "Signal faible : tiré de la rédaction, pas de vos observations.",
                ...c.motifs,
              ]}
              action={<BoutonRelier amont={c.amont} aval={c.aval} />}
            />
          ))}
        </Section>

        <Section
          titre="Compétences trop larges"
          compte={lot.scissions.length}
          explication="La mesure elle-même dit qu'elles recouvrent deux savoir-faire : résultats divergents selon la situation, ou tentatives qui dépassent toutes une heure."
        >
          {lot.scissions.map((c) => (
            <Ligne key={c.code} titre={nom(c.code)} motifs={c.motifs} />
          ))}
        </Section>

        <Section
          titre="Compétences dormantes"
          compte={lot.dormances.length}
          explication="Ni observation, ni exercice, ni relation. Elles comptent dans la couverture sans que rien ne puisse les mesurer."
        >
          {lot.dormances.map((c) => (
            <Ligne key={c.code} titre={nom(c.code)} motifs={c.motifs} />
          ))}
        </Section>

        <Section
          titre="Compétences mal rangées"
          compte={lot.rangements.length}
          explication="Toutes leurs observations viennent d'exercices d'un autre domaine. Un rattachement suffit : elles comptent dans les deux couvertures sans être dupliquées."
        >
          {lot.rangements.map((c) => (
            <Ligne key={c.code} titre={nom(c.code)} motifs={c.motifs} />
          ))}
        </Section>
      </div>
    </div>
  );
}
