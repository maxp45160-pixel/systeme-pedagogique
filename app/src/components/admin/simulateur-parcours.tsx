"use client";

/**
 * La simulation, en une page et un bouton.
 *
 * ## Le défaut que cet écran corrige
 *
 * Il y avait six jeux de données à choisir, cinq onglets, un éditeur JSON, et
 * les mêmes métriques dupliquées dans l'onglet Moteur. Autant de gestes avant
 * la première information, et aucune réponse à la seule question qui compte :
 * **au bout de dix-huit mois, ce produit mène-t-il quelque part ?**
 *
 * Un bouton, un parcours, un tableau de bord qui se lit de haut en bas :
 * verdicts d'abord (ce qui va, ce qui ne va pas), puis le résultat (objectifs,
 * graphe), puis la justesse, puis la sélection, puis la matière brute pour
 * ceux qui veulent ouvrir un chiffre ligne à ligne.
 *
 * Rien n'est lu, rien n'est écrit : le parcours est calculé dans le navigateur
 * à partir des fonctions du moteur, et disparaît au rechargement.
 */

import { useState } from "react";
import { Bouton, cx } from "@/components/ui/primitives";
import {
  agregerCampagne,
  executerRun,
  planRapide,
  type LigneRun,
  type RapportCampagne,
} from "@/lib/simulation/campagne";
import {
  construireExportAnalyse,
  ecrireExportAnalyse,
  ecrireRapportCampagne,
  redigerConclusion,
  type Conclusion,
  type GraviteConstat,
} from "@/lib/simulation/export";
import { deroulerParcoursLong, type ResultatParcoursLong } from "@/lib/simulation/parcours-long";
import {
  construireTableauDeBord,
  type StatutVerdict,
  type TableauDeBord,
} from "@/lib/simulation/tableau-de-bord";
import type { GraviteAnomalie } from "@/lib/simulation/types";
import { Barres, Courbe, GrapheCompetences, LegendeGraphe, Vignette } from "./simulation/graphiques";
import { Chiffre, Section } from "./simulation/briques";
import { Campagne } from "./simulation/campagne";

const TON_VERDICT: Record<StatutVerdict, string> = {
  ok: "border-succes/40 bg-succes-faible",
  alerte: "border-alerte/40 bg-alerte-faible",
  echec: "border-danger/40 bg-danger-faible",
  inconnu: "border-bordure bg-surface-2",
};

const TEXTE_VERDICT: Record<StatutVerdict, string> = {
  ok: "text-succes",
  alerte: "text-alerte",
  echec: "text-danger",
  inconnu: "text-texte-discret",
};

const MOT_VERDICT: Record<StatutVerdict, string> = {
  ok: "conforme",
  alerte: "à surveiller",
  echec: "non tenu",
  inconnu: "non mesuré",
};

const COULEUR_GRAVITE: Record<GraviteAnomalie, string> = {
  invariant: "text-danger",
  avertissement: "text-alerte",
  info: "text-texte-discret",
};

function pourcent(valeur: number | null, decimales = 0): string {
  return valeur === null ? "—" : `${(valeur * 100).toFixed(decimales)} %`;
}

function nombre(valeur: number | null, decimales = 2): string {
  return valeur === null ? "—" : valeur.toFixed(decimales);
}

/* ------------------------------------------------------------------ */
/* Le tableau de bord                                                  */
/* ------------------------------------------------------------------ */

const TON_CONSTAT: Record<GraviteConstat, string> = {
  bloquant: "border-danger/40 bg-danger-faible",
  important: "border-alerte/40 bg-alerte-faible",
  "a-surveiller": "border-bordure bg-surface-2",
};

const MOT_CONSTAT: Record<GraviteConstat, string> = {
  bloquant: "à corriger",
  important: "important",
  "a-surveiller": "à surveiller",
};

function Conclusions({ conclusion }: { conclusion: Conclusion }) {
  return (
    <Section
      titre="Conclusion"
      legende="Dérivée des mesures ci-dessous, jamais rédigée à la main : chaque phrase sort d'un chiffre du parcours. Une conclusion n'est pas une décision."
    >
      <p className="max-w-4xl text-sm text-texte">{conclusion.resume}</p>

      {conclusion.tenu.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-texte">Ce qui tient</h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-texte-attenue">
            {conclusion.tenu.map((phrase) => (
              <li key={phrase}>— {phrase}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {conclusion.constats.map((constat, rang) => (
          <li
            key={constat.cle}
            className={cx("rounded-lg border p-4", TON_CONSTAT[constat.gravite])}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-texte">
                {rang + 1}. {constat.fait}
              </span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-texte-attenue">
                {MOT_CONSTAT[constat.gravite]}
              </span>
            </div>
            <p className="mt-2 text-sm text-texte-attenue">{constat.lecture}</p>
            <p className="mt-1 text-sm text-texte-attenue">{constat.piste}</p>
            {constat.ou.length > 0 && (
              <p className="mt-2 font-mono text-xs text-texte-discret">{constat.ou.join(" · ")}</p>
            )}
          </li>
        ))}
      </ol>

      <p className="max-w-4xl text-xs text-texte-discret">{conclusion.reserve}</p>
    </Section>
  );
}

function Bord({ t, conclusion }: { t: TableauDeBord; conclusion: Conclusion }) {
  const jours = t.croissance.map((c) => c.jour);
  const marqueurs = [
    ...t.deroule
      .filter((r) => r.genre === "extension")
      .map((r) => ({ jour: r.jour, libelle: r.evenement })),
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* ---------------------------------------------------------- */}
      <Section
        titre="Ce que le parcours a produit"
        legende={`${t.entete.mois} mois simulés jour par jour, ${t.entete.competences} compétences sur ${t.entete.domaines} chapitres, ${t.entete.exercices} exercices au catalogue. Calculé en ${(t.entete.dureeCalculMs / 1000).toFixed(1)} s.`}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 xl:grid-cols-6">
          <Chiffre
            libelle="Propositions servies"
            valeur={`${t.entete.propositions}`}
            note={`${t.entete.suivies} suivies · ${t.entete.ignorees} ignorées`}
          />
          <Chiffre
            libelle="Exercices menés"
            valeur={`${t.entete.tentativesMenees}`}
            note={`${t.entete.abandons} abandon(s), sans preuve`}
          />
          <Chiffre
            libelle="Observations"
            valeur={`${t.entete.observations}`}
            note={`${t.entete.joursActifs} jours actifs`}
          />
          <Chiffre
            libelle="Temps de travail"
            valeur={`${Math.round(t.entete.minutes / 60)} h`}
            note={`${t.activite.minutesParSemaineActive ?? "—"} min / semaine active`}
          />
          <Chiffre
            libelle="Affirmations du moteur"
            valeur={`${t.entete.predictions}`}
            note={`${t.entete.decisions} décisions journalisées`}
          />
          <Chiffre
            libelle="Anomalies relevées"
            valeur={`${t.entete.anomalies}`}
            note={`dont ${t.entete.invariants} rupture(s) d'invariant`}
          />
          <Chiffre
            libelle="Gain d'aptitude réelle"
            valeur={`+${t.resultatReel.gainAptitudeTotal.toFixed(2)}`}
            note={`${t.resultatReel.gainParHeure ?? "—"} par heure travaillée`}
          />
          <Chiffre
            libelle="Aptitude réelle moyenne"
            valeur={`${t.resultatReel.aptitudeMoyenneInitiale.toFixed(2)} → ${t.resultatReel.aptitudeMoyenneFinale.toFixed(2)}`}
            note="ce que le moteur ne voit jamais"
          />
          <Chiffre
            libelle="Exercices fabriqués"
            valeur={`${t.entete.exercicesGeneres}`}
            note="faute de disponible, comme le ferait le tuteur"
          />
        </div>
      </Section>

      <Conclusions conclusion={conclusion} />

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Verdicts"
        legende="Une question, un chiffre, un seuil écrit d'avance. Ce qui n'est pas au vert porte la piste à regarder."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {t.verdicts.map((verdict) => (
            <div
              key={verdict.cle}
              className={cx("rounded-lg border p-4", TON_VERDICT[verdict.statut])}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-texte">{verdict.question}</span>
                <span
                  className={cx(
                    "shrink-0 text-xs font-semibold uppercase tracking-wide",
                    TEXTE_VERDICT[verdict.statut],
                  )}
                >
                  {MOT_VERDICT[verdict.statut]}
                </span>
              </div>
              <p className="mt-2 text-base font-medium tabular-nums text-texte">{verdict.valeur}</p>
              <p className="mt-1 text-xs text-texte-discret">Attendu : {verdict.attendu}</p>
              {verdict.statut !== "ok" && (
                <p className="mt-2 text-xs text-texte-attenue">{verdict.piste}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Objectifs"
        legende="Chaque objectif vise des compétences à un niveau donné. La barre va du jour où il est déclaré au jour où il est atteint."
      >
        <ul className="flex flex-col gap-3">
          {t.objectifs.map((objectif) => {
            const fin = objectif.jourAtteint ?? t.entete.jours;
            const debutPart = (objectif.jourDeclare / t.entete.jours) * 100;
            const largeur = Math.max(1.5, ((fin - objectif.jourDeclare) / t.entete.jours) * 100);
            return (
              <li key={objectif.id} className="rounded-lg border border-bordure bg-surface p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-texte">{objectif.intitule}</span>
                  <span
                    className={cx(
                      "text-xs font-medium",
                      objectif.jourAtteint === null ? "text-alerte" : "text-succes",
                    )}
                  >
                    {objectif.jourAtteint === null
                      ? `non atteint — ${pourcent(objectif.partFinale)} des compétences au niveau ${objectif.niveauRequis}`
                      : `atteint au jour ${objectif.jourAtteint}, soit ${objectif.joursPourResoudre} jours après la déclaration`}
                  </span>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-surface-2">
                  <div
                    className={cx(
                      "h-2 rounded-full",
                      objectif.jourAtteint === null ? "bg-alerte" : "bg-succes",
                    )}
                    style={{ marginLeft: `${debutPart}%`, width: `${largeur}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {objectif.detail.map((detail) => (
                    <span
                      key={detail.code}
                      className={detail.atteint ? "text-texte-attenue" : "text-alerte"}
                      title={detail.intitule}
                    >
                      <span className="font-mono">{detail.code}</span> niveau{" "}
                      {detail.niveau ?? "—"} / {objectif.niveauRequis}
                      <span className="text-texte-discret">
                        {" "}
                        (réel {detail.aptitude === null ? "—" : detail.aptitude.toFixed(1)},{" "}
                        {detail.tentatives} exercice(s))
                      </span>
                    </span>
                  ))}
                </div>
                {objectif.jourPerdu !== null && (
                  <p className="mt-2 text-xs text-alerte">
                    Objectif perdu au jour {objectif.jourPerdu} : une compétence est repassée sous
                    le niveau requis.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Ce que le temps a construit"
        legende="Traits verticaux : les jours où un chapitre s'ouvre. Un référentiel qui grandit plus vite qu'il ne se couvre est une dette, pas un progrès."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Courbe
            titre="Compétences au référentiel"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.competencesConnues }))}
            marqueurs={marqueurs}
            legende="Le graphe s'étend par chapitres successifs."
          />
          <Courbe
            titre="Compétences observées"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.competencesObservees }))}
            max={t.entete.competences}
            marqueurs={marqueurs}
            legende="Une compétence sans observation reste muette : le moteur ne s'y prononce pas."
          />
          <Courbe
            titre="Compétences au niveau 3 ou plus"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.competencesMaitrisees }))}
            max={t.entete.competences}
            marqueurs={marqueurs}
          />
          <Courbe
            titre="Objectifs résolus"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.objectifsResolus }))}
            max={t.objectifs.length}
            marqueurs={marqueurs}
          />
          <Courbe
            titre="Score global"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.scoreGlobal }))}
            max={100}
            suffixe=" %"
            marqueurs={marqueurs}
          />
          <Courbe
            titre="Écart moyen au réel"
            points={t.croissance.map((c) => ({ jour: c.jour, valeur: c.ecartMoyen }))}
            max={2}
            marqueurs={marqueurs}
            legende="Distance entre le niveau estimé et l'aptitude réelle, que le moteur ne voit pas."
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Le graphe au dernier jour"
        legende={`${t.graphe.noeuds.length} compétences, ${t.graphe.liens.length} prérequis, profondeur maximale ${t.graphe.profondeurMax}. ${t.graphe.jamaisObservees} jamais observée(s), ${t.graphe.isolees} isolée(s).`}
      >
        <div className="rounded-lg border border-bordure bg-surface p-3">
          <GrapheCompetences noeuds={t.graphe.noeuds} liens={t.graphe.liens} />
        </div>
        <LegendeGraphe />
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Le moteur voit-il juste ?"
        legende="Le seul endroit où la question a une réponse : la simulation connaît l'aptitude réelle, le moteur ne la voit jamais."
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
          <Chiffre
            libelle="Écart moyen"
            valeur={nombre(t.justesse.ecartMoyen)}
            note={`sur ${t.justesse.comparables} compétences comparables`}
          />
          <Chiffre
            libelle="Biais"
            valeur={
              t.justesse.biais === null
                ? "—"
                : `${t.justesse.biais > 0 ? "+" : ""}${t.justesse.biais.toFixed(2)}`
            }
            note={
              t.justesse.biais === null
                ? "non mesuré"
                : t.justesse.biais > 0
                  ? "le moteur surestime"
                  : "le moteur sous-estime"
            }
          />
          <Chiffre libelle="À ±0,5 niveau" valeur={pourcent(t.justesse.dansDemiNiveau)} />
          <Chiffre libelle="À ±1 niveau" valeur={pourcent(t.justesse.dansUnNiveau)} />
          <Chiffre
            libelle="Corrélation de rangs"
            valeur={nombre(t.justesse.correlationRangs)}
            note="classe-t-il dans le bon ordre ?"
          />
          <Chiffre
            libelle="Baisses de niveau"
            valeur={`${t.revisions.baissesDeNiveau}`}
            note={`${t.revisions.competencesRetombees} compétence(s) repassée(s) sous 3`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-texte">Les plus gros écarts</h3>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-texte-discret">
                <tr className="border-b border-bordure">
                  <th className="py-1 pr-3 font-medium">Compétence</th>
                  <th className="py-1 pr-3 font-medium">Estimé</th>
                  <th className="py-1 pr-3 font-medium">Réel</th>
                  <th className="py-1 font-medium">Écart</th>
                </tr>
              </thead>
              <tbody>
                {t.justesse.pires.map((pire) => (
                  <tr key={pire.code} className="border-b border-bordure last:border-0">
                    <td className="py-1 pr-3">
                      <span className="font-mono text-[0.7rem] text-texte-discret">{pire.code}</span>{" "}
                      {pire.intitule}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{pire.niveau}</td>
                    <td className="py-1 pr-3 tabular-nums">{pire.aptitude.toFixed(2)}</td>
                    <td className="py-1 tabular-nums text-alerte">
                      {pire.ecart > 0 ? "+" : ""}
                      {pire.ecart.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-medium text-texte">
              Quand le moteur annonce une réussite, arrive-t-elle ?
            </h3>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-texte-discret">
                <tr className="border-b border-bordure">
                  <th className="py-1 pr-3 font-medium">Chance annoncée</th>
                  <th className="py-1 pr-3 font-medium">Prédit</th>
                  <th className="py-1 pr-3 font-medium">Observé</th>
                  <th className="py-1 font-medium">Cas</th>
                </tr>
              </thead>
              <tbody>
                {t.fiabilite.map((bucket) => (
                  <tr key={bucket.borne} className="border-b border-bordure last:border-0">
                    <td className="py-1 pr-3">{bucket.borne}</td>
                    <td className="py-1 pr-3 tabular-nums">{(bucket.predit * 100).toFixed(0)} %</td>
                    <td
                      className={cx(
                        "py-1 pr-3 tabular-nums",
                        Math.abs(bucket.predit - bucket.observe) > 0.15 && "text-alerte",
                      )}
                    >
                      {(bucket.observe * 100).toFixed(0)} %
                    </td>
                    <td className="py-1 tabular-nums text-texte-discret">{bucket.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-texte-discret">
              Une ligne où l&apos;observé est loin du prédit dit exactement de combien le moteur se
              trompe, et dans quel sens.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Ce que le moteur a servi"
        legende="La sélection se juge à part du résultat : bien faire progresser en servant toujours la même chose n'est pas reproductible."
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 xl:grid-cols-6">
          <Chiffre
            libelle="Réussite des exercices menés"
            valeur={pourcent(t.selection.tauxReussite)}
            note={t.selection.repartitionResultats
              .map((r) => `${r.resultat} ${r.n}`)
              .join(" · ")}
          />
          <Chiffre
            libelle="À la bonne difficulté"
            valeur={pourcent(t.selection.partDansZone)}
            note="à ±1 niveau de l'aptitude réelle"
          />
          <Chiffre
            libelle="Propositions suivies"
            valeur={pourcent(t.selection.tauxSuivi)}
            note={`${pourcent(t.selection.partHorsTete)} prises hors tête de liste`}
          />
          <Chiffre
            libelle="Compétences servies"
            valeur={`${t.selection.distinctesServies} / ${t.entete.competences}`}
            note={`${t.selection.diversiteMensuelle ?? "—"} distinctes par mois`}
          />
          <Chiffre
            libelle="Concentration"
            valeur={pourcent(t.selection.partMax)}
            note={`${t.selection.repetitionMax} jours d'affilée en tête au maximum`}
          />
          <Chiffre
            libelle="Catalogue consommé"
            valeur={pourcent(t.selection.partCatalogueUtilise)}
            note={`${t.selection.joursSansExercice} jour(s) sans exercice proposable`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium text-texte">Pourquoi il a proposé ça</h3>
            <Barres
              lignes={t.selection.facteurs.map((f) => ({
                libelle: f.libelle,
                valeur: f.n,
                note: `(${(f.part * 100).toFixed(0)} %)`,
              }))}
            />
            <p className="mt-2 text-xs text-texte-discret">
              Facteur dominant de la recommandation retenue, jour par jour.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-texte">Difficulté servie − aptitude réelle</h3>
            <Barres
              ton="info"
              lignes={t.selection.ecartDifficulte.map((e) => ({
                libelle:
                  e.ecart === 0
                    ? "pile à l'aptitude"
                    : e.ecart > 0
                      ? `+${e.ecart} au-dessus`
                      : `${e.ecart} en dessous`,
                valeur: e.n,
              }))}
            />
            <p className="mt-2 text-xs text-texte-discret">
              Trop en dessous : l&apos;exercice n&apos;apprend rien. Trop au-dessus : il ne mesure
              rien non plus.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-texte">Compétences les plus servies</h3>
            <Barres
              ton="alerte"
              lignes={t.selection.servies.slice(0, 8).map((s) => ({
                libelle: `${s.code} ${s.intitule}`,
                valeur: s.servies,
              }))}
            />
            {t.selection.jamaisServies.length > 0 && (
              <p className="mt-2 text-xs text-alerte">
                Jamais servies : {t.selection.jamaisServies.join(", ")}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Révision et oubli"
        legende="L'apprenant simulé oublie ce qu'il n'a pas pratiqué. Trois pauses ont été insérées exprès."
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 xl:grid-cols-6">
          <Chiffre
            libelle="Propositions de révision"
            valeur={`${t.revisions.actionsRevision}`}
            note={pourcent(t.revisions.partRevision)}
          />
          <Chiffre
            libelle="Délai médian de retour"
            valeur={t.revisions.delaiMedianRetour === null ? "—" : `${t.revisions.delaiMedianRetour} j`}
            note={t.revisions.delaiMaxRetour === null ? undefined : `au pire ${t.revisions.delaiMaxRetour} j`}
          />
          {t.revisions.reprisesApresPause.map((reprise) => (
            <Chiffre
              key={reprise.jour}
              libelle={`Reprise après « ${reprise.motif} »`}
              valeur={
                reprise.joursAvantReprise === null ? "jamais" : `${reprise.joursAvantReprise} j`
              }
              note={`pause finie au jour ${reprise.jour}`}
            />
          ))}
          <Chiffre
            libelle="Durée réelle / estimée"
            valeur={nombre(t.activite.rapportDuree)}
            note="jamais une mesure de performance"
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Compétence par compétence"
        legende="Trait plein : le niveau dérivé au fil des mois. Tirets : l'aptitude réelle, invisible du moteur."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-texte-discret">
              <tr className="border-b border-bordure">
                <th className="py-1.5 pr-3 font-medium">Compétence</th>
                <th className="py-1.5 pr-3 font-medium">Évolution</th>
                <th className="py-1.5 pr-3 font-medium">Estimé</th>
                <th className="py-1.5 pr-3 font-medium">Réel</th>
                <th className="py-1.5 pr-3 font-medium">Écart</th>
                <th className="py-1.5 pr-3 font-medium">Confiance</th>
                <th className="py-1.5 pr-3 font-medium">Obs.</th>
                <th className="py-1.5 pr-3 font-medium">Contextes</th>
                <th className="py-1.5 pr-3 font-medium">Servie</th>
                <th className="py-1.5 pr-3 font-medium">Menés</th>
                <th className="py-1.5 font-medium">Niveau 3 au jour</th>
              </tr>
            </thead>
            <tbody>
              {t.competences.map((ligne) => (
                <tr key={ligne.code} className="border-b border-bordure last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="font-mono text-[0.7rem] text-texte-discret">{ligne.code}</span>{" "}
                    {ligne.intitule}
                  </td>
                  <td className="w-40 py-1.5 pr-3">
                    <Vignette serie={ligne.serie} aptitude={ligne.aptitude} jours={jours} />
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {ligne.niveau ?? <span className="text-texte-discret">non établi</span>}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {ligne.aptitude === null ? "—" : ligne.aptitude.toFixed(1)}
                  </td>
                  <td
                    className={cx(
                      "py-1.5 pr-3 tabular-nums",
                      ligne.ecart !== null && Math.abs(ligne.ecart) >= 1 && "text-alerte",
                    )}
                  >
                    {ligne.ecart === null
                      ? "—"
                      : `${ligne.ecart > 0 ? "+" : ""}${ligne.ecart.toFixed(2)}`}
                  </td>
                  <td className="py-1.5 pr-3">{ligne.confiance}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{ligne.observations}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{ligne.contextes}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{ligne.servies}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {ligne.tentatives}
                    <span className="text-texte-discret"> ({ligne.reussites} réussis)</span>
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {ligne.jourMaitrise === null ? (
                      <span className="text-texte-discret">jamais</span>
                    ) : (
                      `j${ligne.jourMaitrise}`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        titre="Auto-évaluation du moteur"
        legende="Les quatre mesures d'ADR-085, calculées sur ce parcours et avec les mêmes seuils qu'en production."
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
          {t.metriques.map((metrique) => (
            <Chiffre
              key={metrique.nom}
              libelle={metrique.libelle}
              valeur={
                metrique.valeur === null
                  ? "sous le seuil"
                  : metrique.unite === "part"
                    ? `${(metrique.valeur * 100).toFixed(0)} %`
                    : metrique.unite === "minutes"
                      ? `${metrique.valeur.toFixed(0)} min`
                      : metrique.valeur.toFixed(3)
              }
              note={`${metrique.n} tranchée(s) · ${metrique.enAttente} en attente · seuil ${metrique.seuil}`}
            />
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section titre="La matière brute">
        <details className="rounded-lg border border-bordure bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-texte">
            Anomalies relevées ({t.anomalies.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {[...new Map(t.anomalies.map((a) => [a.regle, a])).values()].map((anomalie) => {
              const occurrences = t.anomalies.filter((a) => a.regle === anomalie.regle).length;
              return (
                <li key={anomalie.regle} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className={cx("font-mono text-xs", COULEUR_GRAVITE[anomalie.gravite])}>
                      {anomalie.regle}
                    </span>
                    <span className="text-xs text-texte-discret">×{occurrences}</span>
                  </div>
                  <p className="text-texte-attenue">{anomalie.message}</p>
                </li>
              );
            })}
          </ul>
        </details>

        <details className="rounded-lg border border-bordure bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-texte">
            Déroulé ({t.deroule.length} jours retenus sur {t.entete.jours})
          </summary>
          <div className="mt-3 max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-texte-discret">
                <tr className="border-b border-bordure">
                  <th className="py-1 pr-3 font-medium">Jour</th>
                  <th className="py-1 pr-3 font-medium">Ce qui s&apos;est passé</th>
                  <th className="py-1 pr-3 font-medium">Proposition de tête</th>
                  <th className="py-1 pr-3 font-medium">Difficulté</th>
                  <th className="py-1 pr-3 font-medium">Score</th>
                  <th className="py-1 font-medium">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {t.deroule.map((pas) => (
                  <tr key={pas.jour} className="border-b border-bordure align-top last:border-0">
                    <td className="py-1 pr-3 tabular-nums text-texte-attenue">j{pas.jour}</td>
                    <td className="py-1 pr-3">{pas.evenement}</td>
                    <td className="py-1 pr-3">
                      {pas.tete ? (
                        <>
                          <span className="font-mono text-[0.7rem]">{pas.tete.code}</span>{" "}
                          {pas.tete.exercice ?? (
                            <span className="text-alerte">aucun exercice disponible</span>
                          )}
                          <span className="text-texte-discret"> — {pas.tete.facteur}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{pas.tete?.difficulteCible ?? "—"}</td>
                    <td className="py-1 pr-3 tabular-nums">
                      {pas.scoreGlobal === null ? "—" : `${pas.scoreGlobal} %`}
                    </td>
                    <td className="py-1 tabular-nums">
                      {pas.anomalies === 0 ? (
                        <span className="text-texte-discret">—</span>
                      ) : (
                        <span className="text-alerte">{pas.anomalies}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="rounded-lg border border-bordure bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-texte">
            Registre des prédictions ({t.registre.length})
          </summary>
          <p className="mt-2 text-xs text-texte-attenue">
            Chaque ligne est une affirmation du moteur et le fait qui l&apos;a tranchée. Rien
            n&apos;est agrégé plus haut qui ne figure pas ici.
          </p>
          <div className="mt-3 max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-texte-discret">
                <tr className="border-b border-bordure">
                  <th className="py-1 pr-3 font-medium">Émise</th>
                  <th className="py-1 pr-3 font-medium">Type</th>
                  <th className="py-1 pr-3 font-medium">Cible</th>
                  <th className="py-1 pr-3 font-medium">Prédit</th>
                  <th className="py-1 pr-3 font-medium">Observé</th>
                  <th className="py-1 font-medium">Écart</th>
                </tr>
              </thead>
              <tbody>
                {t.registre.map((ligne) => (
                  <tr key={ligne.prediction.id} className="border-b border-bordure last:border-0">
                    <td className="py-1 pr-3 tabular-nums text-texte-attenue">
                      {ligne.prediction.emiseLe.slice(0, 10)}
                    </td>
                    <td className="py-1 pr-3">{ligne.type}</td>
                    <td className="py-1 pr-3 font-mono text-[0.7rem]">
                      {ligne.prediction.cibleCode}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{nombre(ligne.prediction.valeur)}</td>
                    <td className="py-1 pr-3 tabular-nums">
                      {ligne.observe === null ? (
                        <span className="text-texte-discret">en attente</span>
                      ) : (
                        nombre(ligne.observe)
                      )}
                    </td>
                    <td className="py-1 tabular-nums">{nombre(ligne.ecart)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* La page                                                             */
/* ------------------------------------------------------------------ */

export function SimulateurParcours() {
  const [resultat, setResultat] = useState<{
    parcours: ResultatParcoursLong;
    tableau: TableauDeBord;
  } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);
  const [campagne, setCampagne] = useState<RapportCampagne | null>(null);
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null);

  /**
   * La campagne déroule des dizaines de parcours : la lancer d'un bloc figerait
   * l'onglet une demi-minute sans rien dire. Chaque parcours est donc rendu à la
   * boucle d'événements avant le suivant — le compteur avance, la page reste
   * vivante, et le résultat est identique puisque rien n'est concurrent.
   */
  const lancerCampagne = () => {
    const plan = planRapide();
    const lignes: LigneRun[] = [];
    const debut = Date.now();
    setCampagne(null);
    setAvancement({ fait: 0, total: plan.runs.length });

    const suivant = (index: number) => {
      if (index >= plan.runs.length) {
        setCampagne(agregerCampagne(plan, lignes, Date.now() - debut));
        setAvancement(null);
        return;
      }
      lignes.push(executerRun(plan.runs[index]));
      setAvancement({ fait: index + 1, total: plan.runs.length });
      window.setTimeout(() => suivant(index + 1), 0);
    };

    window.setTimeout(() => suivant(0), 40);
  };

  const telechargerCampagne = () => {
    if (campagne === null) return;
    const blob = new Blob([ecrireRapportCampagne(campagne)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `simulation-campagne-${campagne.runs}-parcours.json`;
    lien.click();
    URL.revokeObjectURL(url);
  };

  const lancer = () => {
    setEnCours(true);
    setCopie(false);
    // Le parcours bloque le fil principal une seconde ou deux : on laisse le
    // bouton se repeindre avant de partir, sinon l'écran reste figé sans dire
    // qu'il travaille.
    window.setTimeout(() => {
      const parcours = deroulerParcoursLong();
      setResultat({ parcours, tableau: construireTableauDeBord(parcours) });
      setEnCours(false);
    }, 40);
  };

  const analyse = () =>
    resultat === null
      ? null
      : construireExportAnalyse(resultat.tableau, resultat.parcours.monde, resultat.parcours.actions);

  const telecharger = () => {
    const contenu = analyse();
    if (contenu === null) return;
    const blob = new Blob([ecrireExportAnalyse(contenu)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `simulation-parcours-${contenu.monde.graine}.json`;
    lien.click();
    URL.revokeObjectURL(url);
  };

  const copier = async () => {
    const contenu = analyse();
    if (contenu === null) return;
    await navigator.clipboard.writeText(ecrireExportAnalyse(contenu));
    setCopie(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-bordure bg-surface p-4">
        <Bouton variante="principal" onClick={lancer} enChargement={enCours}>
          {resultat === null ? "Simuler un parcours fictif" : "Relancer la simulation"}
        </Bouton>
        {resultat !== null && (
          <>
            <Bouton onClick={telecharger}>Exporter pour analyse (JSON)</Bouton>
            <Bouton variante="discret" onClick={copier}>
              {copie ? "Copié" : "Copier dans le presse-papiers"}
            </Bouton>
          </>
        )}
        <Bouton onClick={lancerCampagne} enChargement={avancement !== null}>
          {avancement === null
            ? "Lancer une campagne (45 parcours)"
            : `Parcours ${avancement.fait} / ${avancement.total}`}
        </Bouton>
        {campagne !== null && (
          <Bouton variante="discret" onClick={telechargerCampagne}>
            Exporter la campagne (JSON)
          </Bouton>
        )}
        <p className="max-w-3xl text-sm text-texte-attenue">
          Un apprenant fictif part de zéro sur un référentiel de physique qui n&apos;existe nulle
          part ailleurs — mécanique, puis énergie, ondes et thermodynamique, chapitre après
          chapitre. Dix-huit mois sont déroulés jour par jour contre le moteur réel : mêmes
          fonctions de calcul, mêmes seuils, mêmes règles. Rien n&apos;est lu ni écrit en base. La
          campagne rejoue ce parcours sur trois profils, trois graines et cinq bras — un parcours
          seul ne dit rien de la dispersion, et rien de ce qu&apos;aurait fait une politique naïve.
        </p>
      </div>

      {campagne !== null && <Campagne rapport={campagne} />}

      {resultat === null ? (
        <p className="text-sm text-texte-discret">
          Aucun parcours détaillé calculé. Le résultat est déterministe : même graine, même
          parcours, à la virgule près. L&apos;export JSON porte ses propres unités, ses seuils et ce
          qu&apos;il ne prouve pas — il se lit sans avoir le code sous les yeux.
        </p>
      ) : (
        <Bord t={resultat.tableau} conclusion={redigerConclusion(resultat.tableau)} />
      )}
    </div>
  );
}
