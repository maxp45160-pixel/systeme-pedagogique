import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { comparerCodes, retraitsParCode } from "@/lib/domain/referentiel-compte";
import { SqueletteContenu } from "@/components/layout/squelette";
import type { Referentiel, SkillState } from "@/lib/domain/types";
import { EntetePage } from "@/components/layout/entete-page";
import {
  BandeauInfo,
  Carte,
  CodeCompetence,
  CorpsCarte,
  cx,
  EnTeteCarte,
  Etiquette,
  JaugeNiveau,
  LigneListe,
  Statistique,
} from "@/components/ui/primitives";
import { Radar, RepartitionNiveaux } from "@/components/charts";
import { formatDateRelative } from "@/lib/engine/dates";
import { BoutonAjouterCompetence } from "@/components/referentiel/bouton-ajouter";
import { GestionReferentiel } from "@/components/referentiel/gestion";
import { PanneauPliable } from "@/components/ui/panneau-pliable";
import { PanneauProgression } from "@/components/suivi/panneau-progression";
import { PanneauJournal } from "@/components/suivi/panneau-journal";

type Vue = "grille" | "radar" | "gerer" | "progression" | "journal";

const VUES: { cle: Vue; libelle: string }[] = [
  { cle: "grille", libelle: "Grille" },
  { cle: "radar", libelle: "Radar" },
  { cle: "gerer", libelle: "Gérer" },
  { cle: "progression", libelle: "Progression" },
  { cle: "journal", libelle: "Journal" },
];

export default async function PageCompetences(props: {
  searchParams: Promise<{ vue?: string; periode?: string; recherche?: string }>;
}) {
  const { vue: vueBrute, periode, recherche } = await props.searchParams;
  const vue: Vue =
    vueBrute === "radar"
      ? "radar"
      : vueBrute === "gerer"
        ? "gerer"
        : vueBrute === "progression"
          ? "progression"
          : vueBrute === "journal"
            ? "journal"
            : "grille";

  // Le référentiel étant propre au compte depuis ADR-026, aucun compteur n'est
  // connu avant la lecture. L'en-tête reste donc rendu immédiatement mais sans
  // chiffre ; le décompte réel arrive avec le contenu, dans le Suspense.
  return (
    <>
      <EntetePage
        titre="Compétences"
        sousTitre="Pour chacune, son niveau, la confiance de l'évaluation et la solidité des acquis."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-bordure p-0.5">
              {VUES.map((v) => (
                <Link
                  key={v.cle}
                  href={`/competences?vue=${v.cle}`}
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
 * preuve** doit aller se faire mesurer. Le second écran existe depuis toujours ;
 * le premier est le cas normal d'un compte neuf depuis ADR-026.
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

  if (vue === "gerer") {
    const retraits = retraitsParCode(ctx.referentiel.skills, ctx.donnees.evidence);
    return (
      <div className="space-y-6">
        <BandeauPerimetre referentiel={ctx.referentiel} />
        <GestionReferentiel
          domaines={ctx.referentiel.domaines}
          skills={ctx.referentiel.skills}
          retraits={Object.fromEntries(retraits)}
        />
      </div>
    );
  }

  if (vue === "progression") {
    return <PanneauProgression periode={periode} />;
  }

  if (vue === "journal") {
    return <PanneauJournal recherche={recherche} />;
  }

  return (
    <div className="space-y-6">
      <BandeauPerimetre referentiel={ctx.referentiel} />
      {vue === "grille" && (
        <VueGrille
          etats={ctx.etats}
          referentiel={ctx.referentiel}
          domainesExistants={domainesExistants}
          compteId={ctx.donnees.user.id}
        />
      )}
      {vue === "radar" && <VueRadar etats={ctx.etats} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue grille — la vue par défaut                                      */
/* ------------------------------------------------------------------ */

function VueGrille({
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
  // `etats` ne porte que le périmètre — ni archivée, ni hors périmètre : la
  // grille n'a donc pas de dossier d'archives à ranger, contrairement à l'écran
  // de gestion. L'ordre, lui, est le même des deux côtés : numérique.
  const parDomaine = referentiel.domaines
    .map((d) => ({
      domaine: d,
      items: [...etats.filter((e) => e.skill.domaine === d.id)].sort((a, b) =>
        comparerCodes(a.skill.code, b.skill.code),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {parDomaine.map(({ domaine, items }) => {
        const repartition: Record<number, number> = {};
        for (const e of items) {
          if (e.niveau !== null) repartition[e.niveau] = (repartition[e.niveau] ?? 0) + 1;
        }
        const preuves = items.reduce((s, e) => s + e.preuves.length, 0);

        return (
          <PanneauPliable
            key={domaine.id}
            titre={
              <>
                <span className="font-serif text-sm font-medium">{domaine.nom}</span>
                <span className="text-xs text-texte-discret">
                  {items.length} compétences · {preuves} preuve{preuves > 1 ? "s" : ""}
                </span>
              </>
            }
            actions={
              <>
                {/*
                 * Le lien vit dans les actions, pas dans le titre : `titre` est
                 * rendu à l'intérieur du bouton de repli, et un <a> dans un
                 * <button> est du HTML invalide — le clic servirait deux
                 * intentions à la fois, plier et naviguer.
                 */}
                <Link
                  href={`/competences/domaine/${encodeURIComponent(domaine.id)}`}
                  className="shrink-0 text-xs text-primaire hover:underline"
                >
                  Vue du domaine →
                </Link>
                {Object.keys(repartition).length > 0 ? (
                  <div className="w-40">
                    <RepartitionNiveaux compte={repartition} />
                  </div>
                ) : (
                  <Etiquette>Aucune preuve</Etiquette>
                )}
                <BoutonAjouterCompetence
                  domainesExistants={domainesExistants}
                  compteId={compteId}
                  domaineInitial={domaine.nom}
                />
              </>
            }
          >
            <ul className="divide-y divide-bordure">
              {items.map((e) => (
                <LigneCompetence key={e.skill.code} etat={e} />
              ))}
            </ul>
          </PanneauPliable>
        );
      })}
    </div>
  );
}

function LigneCompetence({ etat }: { etat: SkillState }) {
  return (
    <LigneListe>
      <Link
        href={`/competences/${etat.skill.code}`}
        className="flex w-full items-center gap-4"
      >
        <div className="w-16 shrink-0">
          <CodeCompetence code={etat.skill.code} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{etat.skill.intitule}</p>
          <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
            {etat.statut === "non-evalue" && "Jamais évaluée"}
            {etat.statut === "hypothese" && "Hypothèse issue de ta formation — non vérifiée"}
            {etat.statut === "evalue" &&
              `${etat.preuves.length} preuve${etat.preuves.length > 1 ? "s" : ""} · ${
                etat.contextesTestes.length
              } contexte${etat.contextesTestes.length > 1 ? "s" : ""}${
                etat.dernierePreuve ? ` · ${formatDateRelative(etat.dernierePreuve)}` : ""
              }`}
          </p>
        </div>

        <div className="hidden w-24 shrink-0 sm:block">
          <JaugeNiveau niveau={etat.niveau} />
        </div>

        <div className="chiffres w-14 shrink-0 text-right">
          <span
            className={cx(
              "text-sm font-semibold",
              etat.niveau === null && "text-texte-discret",
            )}
          >
            {etat.niveau ?? "—"}
          </span>
          <span className="text-[0.6875rem] text-texte-discret">/5</span>
        </div>

        <div className="hidden w-20 shrink-0 text-right sm:block">
          <span className="text-[0.6875rem] text-texte-discret">
            {etat.confiance === "nulle" ? "—" : etat.confiance}
          </span>
        </div>
      </Link>
    </LigneListe>
  );
}


/* ------------------------------------------------------------------ */
/* Vue radar — secondaire par construction                             */
/* ------------------------------------------------------------------ */

/**
 * Un axe par compétence du périmètre, et non plus par domaine (ADR-018).
 *
 * À l'échelle d'un pilote mono-domaine, un radar à sept axes dont six sont
 * vides ne dit rien. Au grain de la compétence il redevient lisible : on voit
 * quelles compétences du domaine tiennent et lesquelles n'ont pas été mesurées.
 */
function VueRadar({ etats }: { etats: SkillState[] }) {
  const axes = etats.map((e) => ({
    libelle: e.skill.code,
    // `score` est sur 5 côté moteur ; le radar raisonne en pourcentage.
    valeur: e.score === null ? null : Math.round((e.score / 5) * 100),
  }));
  const sansPreuve = etats.filter((e) => e.score === null);

  return (
    <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Carte>
        <EnTeteCarte
          titre="Vue d'ensemble du périmètre"
          legende="Score sur 100, un axe par compétence travaillée"
        />
        <CorpsCarte>
          <Radar axes={axes} />
          {sansPreuve.length > 0 && (
            <p className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2 text-[0.6875rem] text-texte-attenue">
              <strong className="font-medium">Lecture prudente.</strong>{" "}
              {sansPreuve.length} compétence(s) sont tracées à zéro faute de preuve, non parce
              qu{"'"}une faiblesse a été mesurée :{" "}
              {sansPreuve.map((e) => e.skill.code).join(", ")}.
            </p>
          )}
        </CorpsCarte>
      </Carte>

      <Carte>
        <EnTeteCarte titre="Détail chiffré" legende="La même information, sans dépendre de la forme" />
        <ul className="divide-y divide-bordure">
          {etats.map((e) => (
            <LigneListe key={e.skill.code}>
              <Link
                href={`/competences/${e.skill.code}`}
                className="flex w-full items-center gap-4"
              >
                <span className="min-w-0 flex-1 truncate text-sm hover:underline">
                  <CodeCompetence code={e.skill.code} /> {e.skill.intitule}
                </span>
                <Statistique
                  libelle=""
                  valeur={e.score === null ? null : Math.round((e.score / 5) * 100)}
                  unite="/100"
                />
                <span className="w-20 shrink-0 text-right text-[0.6875rem] text-texte-discret">
                  {e.preuves.length} preuve{e.preuves.length > 1 ? "s" : ""}
                </span>
              </Link>
            </LigneListe>
          ))}
        </ul>
      </Carte>
    </div>
  );
}