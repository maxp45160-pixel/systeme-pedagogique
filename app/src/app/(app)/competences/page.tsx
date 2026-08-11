import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { chargerThemes } from "@/lib/store/themes";
import { comparerCodes } from "@/lib/domain/referentiel-compte";
import { SqueletteContenu } from "@/components/layout/squelette";
import type { Referentiel, SkillState } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  BandeauInfo,
  Carte,
  Etiquette,
  SelecteurSegmente,
  Statistique,
} from "@/components/ui/primitives";
import { RepartitionNiveaux } from "@/components/charts";
import { formatDateRelative } from "@/lib/engine/dates";
import { BoutonCreerReferentiel } from "@/components/referentiel/modale-referentiel";
import { construireGraphe } from "@/lib/domain/graphe";
import { GrapheCompetences } from "@/components/competences/graphe/graphe-competences";

/**
 * Page Compétences — version épurée (R5) + vue Graphe (style Obsidian).
 *
 * Deux vues accessibles via un sélecteur segmenté :
 *   - **Liste** (défaut) : les grands champs (domaines) avec stats agrégées.
 *   - **Graphe** : graphe plat façon Obsidian — tous les nœuds à l'écran,
 *     panneau de réglages pour filtrer/classer/ajuster les forces (ADR-056).
 */

type Vue = "liste" | "graphe";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "liste", libelle: "Liste" },
  { cle: "graphe", libelle: "Graphe" },
];

export default async function PageCompetences(props: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue: vueBrute } = await props.searchParams;
  const vue: Vue = vueBrute === "graphe" ? "graphe" : "liste";

  return (
    <>
      <EntetePage
        titre="Compétences"
        sousTitre="Tes grands domaines de travail. Clique sur un domaine pour voir ses compétences et les gérer."
        actions={
          <SelecteurSegmente
            options={VUES}
            actif={vue}
            rendreItem={(o, classesItem, estActifItem) => (
              <Link
                href={`/competences${o.cle === "liste" ? "" : `?vue=${o.cle}`}`}
                aria-current={estActifItem ? "page" : undefined}
                className={classesItem}
              >
                {o.libelle}
              </Link>
            )}
          />
        }
      />

      <Suspense key={vue} fallback={<SqueletteContenu />}>
        {vue === "graphe" ? <ContenuGraphe /> : <ContenuCompetences />}
      </Suspense>
    </>
  );
}

/**
 * Deux vides distincts, et les confondre serait trompeur : un compte **sans
 * référentiel** doit aller le construire avec le tuteur, un compte **sans
 * preuve** doit aller se faire mesurer.
 */
function BandeauPerimetre({ referentiel }: { referentiel: Referentiel }) {
  const total = referentiel.skills.length;
  const actifs = referentiel.actifs.length;

  if (total === 0) {
    return (
      <BandeauInfo>
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
        <p className="text-texte-attenue">
          <strong className="font-medium text-info">Aucun référentiel.</strong> Ce compte n{"'"}a
          pas encore de compétences à suivre.{" "}
          <Link href="/demarrer" className="font-medium text-info underline underline-offset-2">
            Déclare ton thème de travail
          </Link>{" "}
          — le tuteur proposera une première branche, que tu valideras.
        </p>
      </BandeauInfo>
    );
  }

  if (actifs === total) return null;

  return (
    <BandeauInfo>
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
      <p className="text-texte-attenue">
        <strong className="font-medium text-info">Périmètre de travail.</strong> Ton référentiel
        compte {total} compétences sur {referentiel.domaines.length} domaine(s) ; {actifs} sont
        dans ton périmètre actuel. Les autres ne sont ni calculées ni affichées — elles gardent
        leurs preuves et reviennent dès que tu les réactives.
      </p>
    </BandeauInfo>
  );
}

async function ContenuCompetences() {
  const ctx = await chargerContexte();

  return (
    <div className="space-y-6">
      <BandeauPerimetre referentiel={ctx.referentiel} />
      <VueDomaines
        etats={ctx.etats}
        referentiel={ctx.referentiel}
        compteId={ctx.donnees.user.id}
      />
    </div>
  );
}

/**
 * Charge les données du graphe et les sérialise en props pour le composant
 * client `GrapheCompetences`. Aucun état de progression n'est inventé : tout
 * est dérivé des faits existants (P1).
 */
async function ContenuGraphe() {
  const [ctx, themes] = await Promise.all([chargerContexte(), chargerThemes()]);

  const donneesGraphe = construireGraphe(
    ctx.referentiel,
    ctx.etats,
    ctx.donnees.exercises,
    themes,
  );

  return <GrapheCompetences donnees={donneesGraphe} compteId={ctx.donnees.user.id} />;
}

/* ------------------------------------------------------------------ */
/* Vue accueil — les grands champs                                     */
/* ------------------------------------------------------------------ */

/**
 * Une carte par domaine : titre cliquable vers la sous-page, stats agrégées,
 * répartition des niveaux, bouton « + Compétence ». Aucun détail de
 * sous-compétence — ils vivent dans `/competences/domaine/[id]`.
 */
function VueDomaines({
  etats,
  referentiel,
  compteId,
}: {
  etats: SkillState[];
  referentiel: Referentiel;
  compteId: string;
}) {
  const parDomaine = referentiel.domaines
    .map((d) => ({
      domaine: d,
      items: [...etats.filter((e) => e.skill.domaine === d.id)].sort((a, b) =>
        comparerCodes(a.skill.code, b.skill.code),
      ),
    }))
    .filter((g) => g.items.length > 0);

  if (parDomaine.length === 0) {
    return (
      <Carte>
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">Aucun domaine actif</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-texte-attenue">
            Ton référentiel est construit mais aucun domaine n{"'"}a de compétences actives.
            Ajoute un référentiel ci-dessous, ou réactive un domaine pour commencer.
          </p>
          <div className="mt-3 flex justify-center">
            <BoutonCreerReferentiel compteId={compteId} />
          </div>
        </div>
      </Carte>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        Le point d'entrée qui manquait.

        `+ Compétence` n'existait que sur une carte de domaine EXISTANT : il n'y
        avait aucun moyen d'ajouter une branche neuve depuis cette page. Et la
        suggestion ne produisait qu'une branche, là où « le stoïcisme » en
        demande plusieurs.

        Placé ici et non dans l'en-tête de page : celui-ci est rendu hors du
        `Suspense` et n'a pas de contexte chargé — l'y mettre bloquerait le
        rendu de la coquille pour un bouton.
      */}
      <div className="flex items-center justify-between gap-3 rounded-carte border border-bordure bg-surface-2 px-4 py-2.5">
        <p className="text-xs text-texte-attenue">
          Un sujet à couvrir que le référentiel n{"'"}aborde pas encore ?
        </p>
        <BoutonCreerReferentiel compteId={compteId} />
      </div>

      {parDomaine.map(({ domaine, items }) => {
        const repartition: Record<number, number> = {};
        for (const e of items) {
          if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
        }
        const evaluees = items.filter((e) => e.niveau !== null);
        const scoreMoyen =
          evaluees.length > 0
            ? evaluees.reduce((s, e) => s + (e.score ?? 0), 0) / evaluees.length
            : null;
        const totalPreuves = items.reduce((s, e) => s + e.preuves.length, 0);
        const dernierePreuve = items
          .map((e) => e.dernierePreuve)
          .filter(Boolean)
          .sort((a, b) => b!.localeCompare(a!))[0];

        return (
          <Carte key={domaine.id} interactive>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <Link
                href={`/competences/domaine/${encodeURIComponent(domaine.id)}`}
                className="min-w-0 flex-1 group"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-medium group-hover:underline">
                    {domaine.nom}
                  </h3>
                  <Etiquette mono>{domaine.prefixe}</Etiquette>
                </div>
                <p className="mt-1 text-xs text-texte-attenue">
                  {items.length} compétence{items.length > 1 ? "s" : ""} · {evaluees.length}{" "}
                  évaluée{evaluees.length > 1 ? "s" : ""} · {totalPreuves} preuve
                  {totalPreuves > 1 ? "s" : ""}
                  {dernierePreuve
                    ? ` · dernière activité ${formatDateRelative(dernierePreuve)}`
                    : ""}
                </p>
              </Link>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-6">
                  <Statistique
                    libelle="Score moyen"
                    valeur={scoreMoyen === null ? null : scoreMoyen.toFixed(1).replace(".", ",")}
                    unite="/5"
                  />
                  {Object.keys(repartition).length > 0 && (
                    <div className="w-32 self-center">
                      <RepartitionNiveaux compte={repartition} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Carte>
        );
      })}
    </div>
  );
}