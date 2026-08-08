import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { comparerCodes } from "@/lib/domain/referentiel-compte";
import { SqueletteContenu } from "@/components/layout/squelette";
import type { Referentiel, SkillState } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  BandeauInfo,
  Carte,
  cx,
  Etiquette,
  Statistique,
} from "@/components/ui/primitives";
import { RepartitionNiveaux } from "@/components/charts";
import { formatDateRelative } from "@/lib/engine/dates";
import { BoutonAjouterCompetence } from "@/components/referentiel/bouton-ajouter";
import { BoutonCreerReferentiel } from "@/components/referentiel/modale-referentiel";
import { PanneauProgression } from "@/components/suivi/panneau-progression";
import { PanneauJournal } from "@/components/suivi/panneau-journal";

/**
 * Page Compétences — version épurée (R5).
 *
 * On voit les grands champs (domaines) avec leurs stats agrégées, sans les
 * détails des sous-compétences. Les détails — liste des compétences, niveaux,
 * gestion — vivent dans la sous-page `/competences/domaine/[id]`.
 */

type Vue = "accueil" | "progression" | "journal";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "accueil", libelle: "Compétences" },
  { cle: "progression", libelle: "Progression" },
  { cle: "journal", libelle: "Journal" },
];

export default async function PageCompetences(props: {
  searchParams: Promise<{ vue?: string; periode?: string; recherche?: string }>;
}) {
  const { vue: vueBrute, periode, recherche } = await props.searchParams;
  const vue: Vue =
    vueBrute === "progression"
      ? "progression"
      : vueBrute === "journal"
        ? "journal"
        : "accueil";

  return (
    <>
      <EntetePage
        titre="Compétences"
        sousTitre="Tes grands domaines de travail. Clique sur un domaine pour voir ses compétences et les gérer."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-bordure p-0.5">
              {VUES.map((v) => (
                <Link
                  key={v.cle}
                  href={`/competences${v.cle === "accueil" ? "" : `?vue=${v.cle}`}`}
                  className={cx(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    vue === v.cle
                      ? "bg-primaire-faible text-primaire"
                      : "text-texte-attenue hover:text-texte",
                  )}
                >
                  {v.libelle}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <Suspense key={`${vue}-${periode ?? ""}-${recherche ?? ""}`} fallback={<SqueletteContenu />}>
        <ContenuCompetences vue={vue} periode={periode ?? "mois"} recherche={recherche} />
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

async function ContenuCompetences({
  vue,
  periode,
  recherche,
}: {
  vue: Vue;
  periode: string;
  recherche?: string;
}) {
  const ctx = await chargerContexte();
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  if (vue === "progression") {
    return <PanneauProgression periode={periode} />;
  }

  if (vue === "journal") {
    return <PanneauJournal recherche={recherche} />;
  }

  return (
    <div className="space-y-6">
      <BandeauPerimetre referentiel={ctx.referentiel} />
      <VueDomaines
        etats={ctx.etats}
        referentiel={ctx.referentiel}
        domainesExistants={domainesExistants}
        compteId={ctx.donnees.user.id}
      />
    </div>
  );
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
  domainesExistants,
  compteId,
}: {
  etats: SkillState[];
  referentiel: Referentiel;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
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
                <BoutonAjouterCompetence
                  domainesExistants={domainesExistants}
                  compteId={compteId}
                  domaineInitial={domaine.nom}
                  libelle="+ Compétence"
                />
              </div>
            </div>
          </Carte>
        );
      })}
    </div>
  );
}