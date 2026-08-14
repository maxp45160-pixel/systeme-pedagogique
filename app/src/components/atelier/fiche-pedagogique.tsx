"use client";

import { useState } from "react";
import Link from "next/link";
import { NIVEAUX } from "@/lib/domain/types";
import type {
  VueCompetenceAtelier,
  VueDomaineAtelier,
  VueThemeAtelier,
  VueExerciceProjectionAtelier,
  VuePedagogiqueAtelier,
} from "@/lib/documents/vue-atelier";
import { cx } from "@/components/ui/primitives";
import {
  IconeCompetences,
  IconeDocuments,
  IconeExercices,
  IconeFleche,
  IconeTheme,
} from "@/components/ui/icones";
import { Radar } from "@/components/charts";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { GestionDomaine } from "@/components/referentiel/gestion-domaine";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { Markdown } from "@/components/ui/markdown";
import { RectificationPreuve } from "./rectification-preuve";

type Onglet = "synthese" | "progression" | "relations" | "notes";

const LIBELLES_PALIERS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

const LIBELLES_CONFIANCE: Record<string, string> = {
  nulle: "Aucune",
  faible: "Faible",
  moyenne: "Moyenne",
  forte: "Forte",
};

function dateCourte(date: string | null): string {
  if (!date) return "Aucune activité";
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function pourcentage(valeur: number | null): string {
  return valeur === null ? "—" : `${Math.round(valeur * 100)} %`;
}

function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)_3.25rem] items-center gap-4 text-sm">
      <span className="truncate text-texte-attenue">{libelle}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
        <span className="block h-full rounded-full bg-primaire" style={{ width: `${Math.round(valeur * 100)}%` }} />
      </span>
      <span className="chiffres text-right font-medium">{Math.round(valeur * 100)}%</span>
    </div>
  );
}

function Indicateur({ libelle, valeur, precision }: { libelle: string; valeur: string; precision: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-bordure bg-surface px-5 py-4 shadow-[var(--ombre-posee)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">{libelle}</p>
      <p className="chiffres mt-2 truncate text-2xl font-semibold tracking-tight text-texte">{valeur}</p>
      <p className="mt-1 truncate text-xs text-texte-discret">{precision}</p>
    </div>
  );
}

function CarteAssociee({
  titre,
  compteur,
  children,
}: {
  titre: string;
  compteur: number;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-bordure bg-surface shadow-[var(--ombre-posee)]">
      <div className="flex items-center justify-between border-b border-bordure px-4 py-3">
        <h3 className="text-sm font-semibold text-texte">{titre}</h3>
        <span className="chiffres rounded-full bg-surface-2 px-2.5 py-1 text-xs text-texte-discret">{compteur}</span>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function BoutonOuvrirExplorateur({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-primaire/40 bg-primaire-faible text-primaire transition-all duration-200 hover:bg-primaire hover:border-primaire hover:text-white cursor-pointer shadow-sm"
      title="Ouvrir l’explorateur"
      aria-label="Ouvrir l’explorateur"
    >
      <svg className="size-5 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      </svg>
    </button>
  );
}

function VueCompetence({
  vue,
  titre,
  ouvrirElement,
  revenirGraphe,
  sidebarOuverte,
  setSidebarOuverte,
  rectificationActive,
}: {
  vue: VueCompetenceAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  revenirGraphe?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
  /** Le journal de rectification n'existe que sous la boucle adaptative. */
  rectificationActive?: boolean;
}) {
  const [onglet, setOnglet] = useState<Onglet>("synthese");
  const dimensionsTriees = [...vue.dimensions].sort((a, b) => b.valeur - a.valeur);
  const pointsForts = vue.niveau === null ? [] : dimensionsTriees.slice(0, 2);
  const axes = vue.niveau === null ? [] : dimensionsTriees.slice(-2).reverse();
  const onglets: Array<{ id: Onglet; libelle: string }> = [
    { id: "synthese", libelle: "Vue d’ensemble" },
    { id: "progression", libelle: "Progression" },
    { id: "relations", libelle: "Relations" },
    { id: "notes", libelle: "Notes & ressources" },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap">
          {!sidebarOuverte && setSidebarOuverte && (
            <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
          )}
          <BoutonRetour onClick={revenirGraphe} libelle="Retour à l'Atelier" />
          {revenirGraphe && (
            <>
              <button
                type="button"
                onClick={revenirGraphe}
                className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
              >
                Atelier
              </button>
              <span className="text-texte-discret/60 shrink-0">/</span>
            </>
          )}
          <button
            type="button"
            onClick={() => ouvrirElement("domaines")}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
          >
            Domaines
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <button
            type="button"
            onClick={() => ouvrirElement(`domaine:${vue.domaineId}`)}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline truncate"
          >
            {vue.domaineNom}
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <span className="font-semibold text-texte shrink-0">{vue.code}</span>
        </nav>
      </div>
      <header className="border-b border-bordure bg-surface px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primaire/20 bg-primaire-faible text-primaire">
              <IconeCompetences className="size-7" />
            </span>
            <div className="min-w-0">
              <h2 className="font-serif text-[2rem] font-medium leading-tight tracking-tight text-texte">{titre}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-info-faible px-2.5 py-1 text-xs font-medium text-info">Compétence</span>
                <span className="rounded-md bg-alerte-faible px-2.5 py-1 text-xs font-medium text-alerte">{LIBELLES_PALIERS[vue.palier] ?? vue.palier}</span>
                <span className="rounded-md bg-primaire-faible px-2.5 py-1 text-xs font-medium text-primaire">Confiance {LIBELLES_CONFIANCE[vue.confiance]}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 pt-5 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicateur libelle="Niveau actuel" valeur={vue.niveau === null ? "Non évalué" : `${vue.niveau} / 5`} precision={vue.niveau === null ? "Aucune preuve directe" : NIVEAUX[vue.niveau].nom} />
          <Indicateur libelle="Preuves" valeur={String(vue.nombrePreuves)} precision={`${vue.nombreContextes} contexte${vue.nombreContextes > 1 ? "s" : ""} distinct${vue.nombreContextes > 1 ? "s" : ""}`} />
          <Indicateur libelle="Robustesse" valeur={pourcentage(vue.robustesse)} precision="Solidité de l’acquis" />
          <Indicateur libelle="Dernière activité" valeur={dateCourte(vue.dernierePreuve)} precision={`${vue.exercices.length} exercice${vue.exercices.length > 1 ? "s" : ""} associé${vue.exercices.length > 1 ? "s" : ""}`} />
        </div>

        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-bordure" role="tablist" aria-label="Sections de la compétence">
          {onglets.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={onglet === item.id}
              onClick={() => setOnglet(item.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer",
                onglet === item.id ? "border-primaire text-primaire" : "border-transparent text-texte-discret hover:text-texte",
              )}
            >
              {item.libelle}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-6 py-6 lg:px-8">
        {onglet === "synthese" && (
          <>
            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-bordure bg-surface p-4 shadow-[var(--ombre-posee)]">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">Points les plus démontrés</h3>
                {pointsForts.length ? (
                  <ul className="mt-3 space-y-2">
                    {pointsForts.map((dimension) => <li key={dimension.id} className="flex items-center justify-between text-sm"><span>{dimension.libelle}</span><span className="chiffres font-medium text-succes">{Math.round(dimension.valeur * 100)}%</span></li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-texte-discret">Une première preuve est nécessaire pour distinguer les points forts.</p>}
              </div>
              <div className="rounded-xl border border-bordure bg-surface p-4 shadow-[var(--ombre-posee)]">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">Dimensions à remobiliser</h3>
                {axes.length ? (
                  <ul className="mt-3 space-y-2">
                    {axes.map((dimension) => <li key={dimension.id} className="flex items-center justify-between text-sm"><span>{dimension.libelle}</span><span className="chiffres font-medium text-alerte">{Math.round(dimension.valeur * 100)}%</span></li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-texte-discret">Aucun axe n’est affirmé sans observation directe.</p>}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">Éléments associés</h3>
                <span className="text-[0.6875rem] text-texte-discret">liens réels uniquement</span>
              </div>
              <div className="grid gap-3 xl:grid-cols-3">
                <CarteAssociee titre="Exercices" compteur={vue.exercices.length}>
                  {vue.exercices.length ? (
                    <ul className="space-y-1">
                      {vue.exercices.slice(0, 4).map((exercice) => (
                        <li key={exercice.id}>
                          <button
                            type="button"
                            onClick={() => ouvrirElement(`exercice:${exercice.id}`)}
                            className="block w-full rounded-lg px-2 py-2 text-left hover:bg-surface-2 cursor-pointer"
                          >
                            <span className="block truncate text-xs font-medium text-texte">{exercice.titre}</span>
                            <span className="mt-0.5 block text-[0.625rem] text-texte-discret">
                              Difficulté {exercice.difficulte} · {exercice.dureeMin} min · {exercice.tentatives} tentative{exercice.tentatives > 1 ? "s" : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-2 py-3 text-xs text-texte-discret">Aucun exercice relié.</p>
                  )}
                </CarteAssociee>
                <CarteAssociee titre="Preuves" compteur={vue.preuves.length}>
                  {vue.preuves.length ? <ul className="space-y-1">{vue.preuves.slice(0, 4).map((preuve) => <li key={preuve.id} className="rounded-lg px-2 py-2"><span className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-medium">{preuve.contexte}</span><span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[0.625rem]", preuve.resultat === "reussi" ? "bg-succes-faible text-succes" : preuve.resultat === "partiel" ? "bg-info-faible text-info" : "bg-danger-faible text-danger")}>{preuve.resultat === "reussi" ? "Solide" : preuve.resultat === "partiel" ? "Partiel" : "À revoir"}</span></span><span className="mt-0.5 block text-[0.625rem] text-texte-discret">{dateCourte(preuve.date)} · preuve {preuve.niveauPreuve}</span></li>)}</ul> : <p className="px-2 py-3 text-xs text-texte-discret">Aucune preuve directe.</p>}
                </CarteAssociee>
                <CarteAssociee titre="Documents liés" compteur={vue.documents.length}>
                  {vue.documents.length ? <ul className="space-y-1">{vue.documents.slice(0, 5).map((document) => <li key={document.id}><button type="button" onClick={() => ouvrirElement(document.id)} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-surface-2"><span className="block truncate text-xs font-medium">{document.titre}</span><span className="mt-0.5 block text-[0.625rem] capitalize text-texte-discret">{document.type}</span></button></li>)}</ul> : <p className="px-2 py-3 text-xs text-texte-discret">Aucune note ou ressource liée.</p>}
                </CarteAssociee>
              </div>
            </section>
          </>
        )}

        {onglet === "progression" && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-lg font-medium">Performance détaillée</h3>
              <p className="mt-1 text-xs text-texte-discret">Calculée depuis les preuves observées ; aucune valeur n’est stockée.</p>
              <div className="mt-5 space-y-3">{vue.dimensions.map((dimension) => <Barre key={dimension.id} valeur={dimension.valeur} libelle={dimension.libelle} />)}</div>
            </div>
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-lg font-medium">Historique récent</h3>
              <ol className="mt-4 space-y-4 border-l border-bordure pl-4">{vue.preuves.slice(0, 6).map((preuve) => <li key={preuve.id} className="relative"><span className="absolute -left-[1.18rem] top-1 size-2 rounded-full border-2 border-surface bg-primaire" /><p className="text-xs font-medium">{preuve.contexte}</p><p className="mt-0.5 text-[0.625rem] text-texte-discret">{dateCourte(preuve.date)} · {preuve.type}</p>{rectificationActive && <RectificationPreuve preuveId={preuve.id} />}</li>)}</ol>
              {!vue.preuves.length && <p className="mt-4 text-xs text-texte-discret">Aucun historique disponible.</p>}
            </div>
          </section>
        )}

        {onglet === "relations" && (
          <section className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
            <div className="text-center">
              <span className="inline-flex rounded-xl bg-primaire px-4 py-2 text-sm font-semibold text-primaire-contraste">{titre}</span>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <Relations titre="Prérequis" ids={vue.prerequis} ouvrirElement={ouvrirElement} />
              <Relations titre="Compétences suivantes" ids={vue.suivantes} ouvrirElement={ouvrirElement} />
              <Relations titre="Documents" ids={vue.documents.map((document) => document.id)} ouvrirElement={ouvrirElement} />
            </div>
          </section>
        )}

        {onglet === "notes" && (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {vue.documents.map((document) => <button key={document.id} type="button" onClick={() => ouvrirElement(document.id)} className="rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-shadow hover:shadow-[var(--ombre-levee)]"><IconeDocuments className="size-5 text-primaire" /><h3 className="mt-3 text-sm font-semibold">{document.titre}</h3><p className="mt-1 text-xs capitalize text-texte-discret">{document.type}</p></button>)}
            {!vue.documents.length && <div className="col-span-full rounded-xl border border-dashed border-bordure-controle bg-surface p-8 text-center"><IconeDocuments className="mx-auto size-7 text-texte-discret" /><p className="mt-3 text-sm font-medium">Aucune note reliée</p><p className="mt-1 text-xs text-texte-discret">Ajoute un wikilien vers {vue.code} dans une fiche Markdown.</p></div>}
          </section>
        )}
      </div>
    </div>
  );
}

function Relations({ titre, ids, ouvrirElement }: { titre: string; ids: string[]; ouvrirElement: (id: string) => void }) {
  return <div><h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-texte-discret">{titre}</h3><div className="mt-2 space-y-1.5">{ids.map((id) => <button key={id} type="button" onClick={() => ouvrirElement(id)} className="block w-full rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-left text-xs font-medium hover:border-primaire/40">{id}</button>)}{!ids.length && <p className="py-2 text-xs text-texte-discret">Aucune relation déclarée.</p>}</div></div>;
}

function VueDomaine({
  vue,
  ouvrirElement,
  revenirGraphe,
  sidebarOuverte,
  setSidebarOuverte,
  compteId,
  modeInitial,
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  revenirGraphe?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
  compteId: string;
  modeInitial?: "referentiel";
}) {
  const [section, setSection] = useState<"structure" | "progression" | "referentiel">(
    modeInitial === "referentiel" && !vue.domaine.archive ? "referentiel" : "structure",
  );
  const groupes = ["fondamentaux", "intermediaire", "avance"].map((palier) => ({
    palier,
    items: vue.competences.filter((competence) => competence.palier === palier),
  }));
  const couverture = vue.competences.length ? vue.nombreEvaluees / vue.competences.length : 0;
  const axes = vue.competences.map((competence) => ({
    libelle: competence.code.replace(`${vue.domaine.prefixe}-`, ""),
    valeur: competence.score === null ? null : Math.round((competence.score / 5) * 100),
  }));
  const sections = [
    { id: "structure" as const, libelle: "Structure" },
    { id: "progression" as const, libelle: "Progression" },
    { id: "referentiel" as const, libelle: "Gérer le référentiel" },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap">
          {!sidebarOuverte && setSidebarOuverte && (
            <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
          )}
          <BoutonRetour onClick={revenirGraphe} libelle="Retour à l'Atelier" />
          {revenirGraphe && (
            <>
              <button
                type="button"
                onClick={revenirGraphe}
                className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
              >
                Atelier
              </button>
              <span className="text-texte-discret/60 shrink-0">/</span>
            </>
          )}
          <button
            type="button"
            onClick={() => ouvrirElement(vue.domaine.archive ? "domaines-archives" : "domaines")}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
          >
            {vue.domaine.archive ? "Domaines archivés" : "Domaines"}
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <span className="font-semibold text-texte truncate">{vue.nom}</span>
        </nav>
      </div>
      <header className="border-b border-bordure bg-surface px-6 py-5 lg:px-8">
        <div className="flex items-start gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-primaire-faible text-primaire"><IconeDocuments className="size-7" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primaire">Fiche mère</p>{vue.domaine.archive && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.6875rem] font-semibold text-texte-discret">Archivé</span>}</div><h2 className="font-serif text-[2.2rem] font-medium tracking-tight">{vue.nom}</h2>{vue.description && <p className="mt-3 max-w-3xl text-base leading-relaxed text-texte-attenue">{vue.description}</p>}{vue.domaine.archive && <p className="mt-3 max-w-3xl rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-xs leading-relaxed text-texte-discret">Ce domaine reste consultable, mais il est exclu du pilotage actif, du graphe principal et des suggestions.</p>}</div></div>
      </header>
      <div className="border-b border-bordure bg-surface px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Sections du domaine">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              onClick={() => setSection(item.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium cursor-pointer",
                section === item.id ? "border-primaire text-primaire" : "border-transparent text-texte-discret hover:text-texte",
              )}
            >
              {item.libelle}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-6 p-6 lg:p-8">
        {section !== "referentiel" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Indicateur libelle="Compétences" valeur={String(vue.competences.length)} precision={`${vue.nombreEvaluees} évaluée${vue.nombreEvaluees > 1 ? "s" : ""}`} /><Indicateur libelle="Couverture" valeur={`${Math.round(couverture * 100)} %`} precision="Compétences avec preuve" /><Indicateur libelle="Preuves" valeur={String(vue.nombrePreuves)} precision="Observations conservées" /><Indicateur libelle="Exercices" valeur={String(vue.nombreExercices)} precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`} /></div>
        )}

        {section === "structure" && groupes.map((groupe) => groupe.items.length > 0 && <section key={groupe.palier}><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">{LIBELLES_PALIERS[groupe.palier]}</h3><span className="text-[0.6875rem] text-texte-discret">{groupe.items.length} fiche{groupe.items.length > 1 ? "s" : ""}</span></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{groupe.items.map((competence) => <button key={competence.code} type="button" onClick={() => ouvrirElement(competence.code)} className="group rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all hover:-translate-y-0.5 hover:border-primaire/30 hover:shadow-[var(--ombre-levee)] cursor-pointer"><div className="flex items-start justify-between gap-3"><span className="font-mono text-[0.625rem] text-texte-discret">{competence.code}</span><span className="chiffres rounded-md bg-surface-2 px-2 py-0.5 text-[0.625rem]">{competence.niveau === null ? "Non évalué" : `Niveau ${competence.niveau}`}</span></div><h4 className="mt-2 text-sm font-semibold leading-snug group-hover:text-primaire">{competence.titre}</h4><p className="mt-3 text-[0.6875rem] text-texte-discret">{competence.nombrePreuves} preuve{competence.nombrePreuves > 1 ? "s" : ""} · confiance {LIBELLES_CONFIANCE[competence.confiance].toLowerCase()}</p></button>)}</div></section>)}

        {section === "progression" && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-xl font-medium">Radar du domaine</h3>
              <p className="mt-1 text-xs text-texte-discret">Un axe par compétence ; une absence de preuve reste une absence de mesure.</p>
              <div className="mt-4"><Radar axes={axes} taille={320} libelle={`Radar par compétence du domaine ${vue.nom}`} /></div>
            </div>
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-xl font-medium">Lecture</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Mesurées</dt><dd className="font-semibold">{vue.nombreEvaluees}/{vue.competences.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Preuves</dt><dd className="font-semibold">{vue.nombrePreuves}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texte-discret">Dernière activité</dt><dd className="text-right font-semibold">{dateCourte(vue.derniereActivite)}</dd></div>
              </dl>
              {axes.some((axe) => axe.valeur === null) && <p className="mt-5 rounded-lg bg-info-faible p-3 text-xs leading-relaxed text-info">Les axes sans preuve sont affichés pour situer la couverture ; ils ne signalent pas une faiblesse.</p>}
            </div>
          </section>
        )}

        {section === "referentiel" && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primaire/20 bg-primaire-faible/35 p-4">
              <div className="max-w-2xl">
                <h3 className="text-sm font-semibold">Révision assistée</h3>
                <p className="mt-1 text-xs leading-relaxed text-texte-attenue">Décris ce qui manque ou ce qui doit changer. Le tuteur propose un diff du domaine ; rien n’est appliqué sans ta validation.</p>
              </div>
              <BoutonReviser
                domaineId={vue.domaine.id}
                domaineNom={vue.domaine.nom}
                competences={vue.skills.filter((skill) => !skill.archive).map((skill) => ({ code: skill.code, intitule: skill.intitule, palier: skill.palier, preuves: vue.retraits[skill.code]?.preuves ?? 0, modeRetrait: vue.retraits[skill.code]?.mode ?? "suppression" }))}
                domainesExistants={vue.domainesExistants}
                compteId={compteId}
              />
            </div>
            <GestionDomaine domaine={vue.domaine} skills={vue.skills} retraits={vue.retraits} changements={vue.changements} />
          </section>
        )}
      </div>
    </div>
  );
}

function VueTheme({
  vue,
  titre,
  ouvrirElement,
  revenirGraphe,
  sidebarOuverte,
  setSidebarOuverte,
  compteId,
  generation,
}: {
  vue: VueThemeAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  revenirGraphe?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
  compteId?: string;
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
}) {
  const [onglet, setOnglet] = useState<"competences" | "radar" | "exercices">("competences");
  const [filtreDomaine, setFiltreDomaine] = useState<string>("tous");

  const competencesFiltrees = vue.competences.filter(
    (c) => filtreDomaine === "tous" || c.domaineId === filtreDomaine,
  );

  const axes = vue.competences.map((c) => ({
    libelle: c.code,
    valeur: c.score === null ? null : Math.round((c.score / 5) * 100),
  }));

  const onglets = [
    { id: "competences" as const, libelle: `Compétences (${vue.competences.length})` },
    { id: "radar" as const, libelle: "Radar & Profil" },
    { id: "exercices" as const, libelle: `Exercices (${vue.exercices.length})` },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      {/* Barre supérieure fil d'Ariane */}
      <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap">
          {!sidebarOuverte && setSidebarOuverte && (
            <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
          )}
          <BoutonRetour onClick={revenirGraphe} libelle="Retour à l'Atelier" />
          {revenirGraphe && (
            <>
              <button
                type="button"
                onClick={revenirGraphe}
                className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
              >
                Atelier
              </button>
              <span className="text-texte-discret/60 shrink-0">/</span>
            </>
          )}
          <button
            type="button"
            onClick={() => ouvrirElement("transversal")}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
          >
            Transversal
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <span className="font-medium text-texte-discret shrink-0">Thèmes</span>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <span className="font-semibold text-texte truncate">{vue.libelle}</span>
        </nav>
      </div>

      {/* Bannière d'en-tête du thème */}
      <header className="border-b border-bordure bg-surface px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-accent shadow-xs">
              <IconeTheme className="size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  Thème transversal
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  {vue.competences.length} compétence{vue.competences.length > 1 ? "s" : ""}
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  {vue.domaines.length} domaine{vue.domaines.length > 1 ? "s" : ""}
                </span>
                {vue.origine === "tuteur" && (
                  <span className="rounded-md bg-info-faible px-2 py-0.5 text-[0.6875rem] font-medium text-info">
                    Proposé par le tuteur
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-serif text-[2.2rem] font-medium leading-tight tracking-tight text-texte">
                {titre || vue.libelle}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/seances"
              className="inline-flex items-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
            >
              <span>Lancer une séance</span>
              <IconeFleche className="size-3.5" />
            </Link>
            {generation && compteId && (
              <BoutonGenerer
                competences={generation.competences}
                competenceInitiale={vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code}
                calibrages={generation.calibrages}
                compteId={compteId}
                libelle="Générer un exercice"
              />
            )}
          </div>
        </div>

        {vue.intention && (
          <div className="mt-5 max-w-4xl rounded-xl border border-bordure/80 bg-surface-2/60 p-4 shadow-xs">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent">
              Intention pédagogique
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-texte font-serif italic">
              « {vue.intention} »
            </p>
          </div>
        )}
      </header>

      {/* Cartes d'indicateurs synthétiques */}
      <div className="px-6 pt-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicateur
            libelle="Compétences"
            valeur={String(vue.competences.length)}
            precision={`${vue.domaines.length} domaine${vue.domaines.length > 1 ? "s" : ""} traversé${vue.domaines.length > 1 ? "s" : ""}`}
          />
          <Indicateur
            libelle="Couverture évaluée"
            valeur={`${Math.round(vue.tauxCouverture * 100)} %`}
            precision={`${vue.nombreEvaluees} sur ${vue.competences.length} évaluée${vue.nombreEvaluees > 1 ? "s" : ""}`}
          />
          <Indicateur
            libelle="Preuves directes"
            valeur={String(vue.nombrePreuves)}
            precision="Observations réelles accumulées"
          />
          <Indicateur
            libelle="Exercices associés"
            valeur={String(vue.nombreExercices)}
            precision={`Dernière activité : ${dateCourte(vue.derniereActivite)}`}
          />
        </div>

        {/* Onglets */}
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-bordure" role="tablist" aria-label="Sections du thème">
          {onglets.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={onglet === item.id}
              onClick={() => setOnglet(item.id)}
              className={cx(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer",
                onglet === item.id ? "border-primaire text-primaire" : "border-transparent text-texte-discret hover:text-texte",
              )}
            >
              {item.libelle}
            </button>
          ))}
        </div>
      </div>

      {/* Corps des onglets */}
      <div className="space-y-6 px-6 py-6 lg:px-8">
        {onglet === "competences" && (
          <div className="space-y-6">
            {/* Filtre par domaine si multi-domaines */}
            {vue.domaines.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-texte-discret font-medium">Filtrer par domaine :</span>
                <button
                  type="button"
                  onClick={() => setFiltreDomaine("tous")}
                  className={cx(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer",
                    filtreDomaine === "tous"
                      ? "bg-primaire text-texte-inverse font-semibold"
                      : "bg-surface border border-bordure text-texte hover:bg-surface-2",
                  )}
                >
                  Tous ({vue.competences.length})
                </button>
                {vue.domaines.map((dom) => (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => setFiltreDomaine(dom.id)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer",
                      filtreDomaine === dom.id
                        ? "bg-primaire text-texte-inverse font-semibold"
                        : "bg-surface border border-bordure text-texte hover:bg-surface-2",
                    )}
                  >
                    {dom.nom} ({dom.nombreCompetences})
                  </button>
                ))}
              </div>
            )}

            {/* Grille des cartes de compétences */}
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {competencesFiltrees.map((comp) => (
                <button
                  key={comp.code}
                  type="button"
                  onClick={() => ouvrirElement(comp.code)}
                  className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface p-4 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primaire">
                        {comp.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                          {LIBELLES_PALIERS[comp.palier] ?? comp.palier}
                        </span>
                        <span
                          className={cx(
                            "rounded px-1.5 py-0.5 text-[0.625rem] font-semibold",
                            comp.niveau === null
                              ? "bg-surface-3 text-texte-discret"
                              : comp.niveau >= 3
                              ? "bg-succes-faible text-succes"
                              : "bg-info-faible text-info",
                          )}
                        >
                          {comp.niveau === null ? "Non évalué" : `Niveau ${comp.niveau} / 5`}
                        </span>
                      </div>
                    </div>

                    <h4 className="mt-2.5 text-sm font-semibold leading-snug text-texte transition-colors group-hover:text-primaire">
                      {comp.titre}
                    </h4>

                    <p className="mt-1.5 text-xs text-texte-discret truncate">
                      {comp.domaineNom}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-2.5 text-[0.6875rem] text-texte-discret">
                    <span>
                      {comp.nombrePreuves} preuve{comp.nombrePreuves > 1 ? "s" : ""} · {LIBELLES_CONFIANCE[comp.confiance]?.toLowerCase() ?? "aucune"}
                    </span>
                    <span className="font-medium text-primaire opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      Consulter →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Section Exercices associés au thème */}
            {vue.exercices.length > 0 && (
              <section className="mt-8 rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
                <div className="flex items-center justify-between border-b border-bordure pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-texte">
                      Exercices associés à ce thème
                    </h3>
                    <p className="mt-0.5 text-xs text-texte-discret">
                      Exercices qui mobilisent les compétences de « {vue.libelle} »
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-texte-discret">
                    {vue.exercices.length} disponible{vue.exercices.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {vue.exercices.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex flex-col justify-between rounded-lg border border-bordure/80 bg-surface-2/40 p-4 transition-colors hover:border-primaire/40"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-texte-discret">
                          <span className="capitalize">{ex.type}</span>
                          <span>Diff. {ex.difficulte}/5 · {ex.dureeMin} min</span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-texte leading-snug">
                          {ex.titre}
                        </h4>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-bordure/40">
                        <span className="text-[0.625rem] text-texte-discret">
                          {ex.tentatives} tentative{ex.tentatives > 1 ? "s" : ""}
                        </span>
                        <Link
                          href={`/exercices/${ex.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-primaire-faible px-2.5 py-1 text-xs font-semibold text-primaire hover:bg-primaire hover:text-white transition-colors"
                        >
                          <span>S’exercer</span>
                          <span aria-hidden>→</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {onglet === "radar" && (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-xl font-medium text-texte">Radar du Thème</h3>
              <p className="mt-1 text-xs text-texte-discret">
                Vue globale du niveau atteint sur chaque compétence du thème.
              </p>
              <div className="mt-6 flex justify-center">
                <Radar axes={axes} taille={340} libelle={`Radar thématique de ${vue.libelle}`} />
              </div>
            </div>

            <div className="rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)]">
              <h3 className="font-serif text-lg font-medium text-texte">Synthèse des Acquis</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-texte-discret">Compétences totales</dt>
                  <dd className="font-semibold">{vue.competences.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texte-discret">Évaluées avec preuve</dt>
                  <dd className="font-semibold">{vue.nombreEvaluees} ({Math.round(vue.tauxCouverture * 100)}%)</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texte-discret">Preuves directes</dt>
                  <dd className="font-semibold">{vue.nombrePreuves}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texte-discret">Exercices prêts</dt>
                  <dd className="font-semibold">{vue.nombreExercices}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texte-discret">Dernière activité</dt>
                  <dd className="text-right font-semibold">{dateCourte(vue.derniereActivite)}</dd>
                </div>
              </dl>

              {vue.prochaineActionRecommandee && (
                <div className="mt-6 rounded-lg bg-alerte-faible p-3.5 text-xs">
                  <p className="font-semibold text-alerte">Prochaine étape conseillée</p>
                  <p className="mt-1 font-medium text-texte">{vue.prochaineActionRecommandee.titre}</p>
                  <p className="mt-0.5 text-texte-discret">{vue.prochaineActionRecommandee.motif}</p>
                  <button
                    type="button"
                    onClick={() => ouvrirElement(vue.prochaineActionRecommandee!.code)}
                    className="mt-2.5 inline-flex items-center gap-1 font-semibold text-primaire hover:underline cursor-pointer"
                  >
                    <span>Voir la compétence</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {onglet === "exercices" && (
          <section className="space-y-4">
            {vue.exercices.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {vue.exercices.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-col justify-between rounded-xl border border-bordure bg-surface p-5 shadow-[var(--ombre-posee)] transition-all hover:border-primaire/40"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="rounded bg-surface-2 px-2 py-0.5 font-medium text-texte-discret capitalize">
                          {ex.type}
                        </span>
                        <span className="text-texte-discret">
                          Diff. {ex.difficulte}/5 · {ex.dureeMin} min
                        </span>
                      </div>
                      <h4 className="mt-3 font-serif text-base font-semibold text-texte leading-snug">
                        {ex.titre}
                      </h4>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-bordure pt-3">
                      <span className="text-xs text-texte-discret">
                        {ex.tentatives} tentative{ex.tentatives > 1 ? "s" : ""}
                      </span>
                      <Link
                        href={`/exercices/${ex.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primaire px-3.5 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm hover:bg-primaire-survol transition-colors"
                      >
                        <span>S’exercer</span>
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-bordure bg-surface p-8 text-center">
                <IconeExercices className="mx-auto size-8 text-texte-discret" />
                <p className="mt-3 text-sm font-semibold text-texte">Aucun exercice disponible pour l’instant</p>
                <p className="mt-1 text-xs text-texte-discret">Génère un premier exercice avec le tuteur pour démarrer l’entraînement sur ce thème.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function VueExercice({
  vue,
  ouvrirElement,
  revenirGraphe,
  sidebarOuverte,
  setSidebarOuverte,
}: {
  vue: VueExerciceProjectionAtelier;
  ouvrirElement: (id: string) => void;
  revenirGraphe?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40">
      <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap">
          {!sidebarOuverte && setSidebarOuverte && (
            <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
          )}
          <BoutonRetour onClick={revenirGraphe} libelle="Retour à l'Atelier" />
          {revenirGraphe && (
            <>
              <button
                type="button"
                onClick={revenirGraphe}
                className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
              >
                Atelier
              </button>
              <span className="text-texte-discret/60 shrink-0">/</span>
            </>
          )}
          <button
            type="button"
            onClick={() => ouvrirElement(`domaine:${vue.domaineId}`)}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline truncate"
          >
            {vue.domaineNom}
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
          <span className="font-semibold text-texte truncate">{vue.titre}</span>
        </nav>
      </div>

      <header className="border-b border-bordure bg-surface px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primaire/20 bg-primaire-faible text-primaire shadow-xs">
              <IconeExercices className="size-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-info-faible px-2.5 py-0.5 text-xs font-semibold text-info">
                  Exercice
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  Difficulté {vue.difficulte}/5
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret">
                  ~{vue.dureeEstimeeMin} min
                </span>
                <span className="rounded-md bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-texte-discret capitalize">
                  {vue.typeExercice}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-[2.2rem] font-medium leading-tight tracking-tight text-texte">
                {vue.titre}
              </h2>
            </div>
          </div>

          <Link
            href={`/exercices/${vue.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primaire px-5 py-3 text-sm font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
          >
            <span>S’exercer dans le cahier</span>
            <IconeFleche className="size-4" />
          </Link>
        </div>
      </header>

      <div className="space-y-6 p-6 lg:p-8">
        {/* Énoncé de l'exercice */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
            Énoncé de l’exercice
          </h3>
          <div className="prose-exo mt-4 text-sm leading-relaxed text-texte">
            <Markdown contenu={vue.enonce || "Aucun énoncé fourni pour cet exercice."} />
          </div>
        </section>

        {/* Compétences visées */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Compétences cibles
            </h3>
            <span className="text-xs text-texte-discret">{vue.competences.length} compétence(s)</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vue.competences.map((comp) => (
              <button
                key={comp.code}
                type="button"
                onClick={() => ouvrirElement(comp.code)}
                className="group flex items-center justify-between rounded-xl border border-bordure bg-surface-2/40 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-surface-2 cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primaire">{comp.code}</span>
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                      {LIBELLES_PALIERS[comp.palier] ?? comp.palier}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-texte truncate group-hover:text-primaire">
                    {comp.titre}
                  </p>
                </div>
                <span className="text-texte-discret transition-transform group-hover:translate-x-1 group-hover:text-primaire">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* Historique des tentatives */}
        <section className="rounded-xl border border-bordure bg-surface p-6 shadow-[var(--ombre-posee)]">
          <div className="flex items-center justify-between border-b border-bordure pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-texte-discret">
              Historique des tentatives
            </h3>
            <span className="text-xs text-texte-discret">{vue.nombreTentatives} tentative(s)</span>
          </div>
          {vue.tentatives.length > 0 ? (
            <div className="mt-4 space-y-2">
              {vue.tentatives.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2/30 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "rounded px-2 py-0.5 font-semibold text-xs",
                        t.resultat === "reussi"
                          ? "bg-succes-faible text-succes"
                          : t.resultat === "partiel"
                          ? "bg-info-faible text-info"
                          : "bg-danger-faible text-danger",
                      )}
                    >
                      {t.resultat === "reussi" ? "Réussi" : t.resultat === "partiel" ? "Partiel" : "Échec"}
                    </span>
                    <span className="text-texte-discret">
                      {new Date(t.fin ?? t.debut).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-texte-discret">
                    {t.dureeMin !== undefined && <span>{t.dureeMin} min</span>}
                    <span>{t.indicesUtilises} indice{t.indicesUtilises > 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-texte-discret">
              Aucune tentative enregistrée sur cet exercice. Lance une session pour enregistrer ta première preuve.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function FichePedagogiqueAtelier({
  vue,
  titre,
  ouvrirElement,
  revenirGraphe,
  sidebarOuverte,
  setSidebarOuverte,
  compteId,
  modeInitial,
  rectificationActive,
  generation,
}: {
  vue: VuePedagogiqueAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  revenirGraphe?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
  compteId: string;
  modeInitial?: "referentiel";
  rectificationActive?: boolean;
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
}) {
  if (vue.kind === "competence") {
    return (
      <VueCompetence
        key={vue.code}
        vue={vue}
        titre={titre}
        ouvrirElement={ouvrirElement}
        revenirGraphe={revenirGraphe}
        sidebarOuverte={sidebarOuverte}
        setSidebarOuverte={setSidebarOuverte}
        rectificationActive={rectificationActive}
      />
    );
  }

  if (vue.kind === "domaine") {
    return (
      <VueDomaine
        vue={vue}
        ouvrirElement={ouvrirElement}
        revenirGraphe={revenirGraphe}
        sidebarOuverte={sidebarOuverte}
        setSidebarOuverte={setSidebarOuverte}
        compteId={compteId}
        modeInitial={modeInitial}
      />
    );
  }

  if (vue.kind === "theme") {
    return (
      <VueTheme
        key={vue.id}
        vue={vue}
        titre={titre}
        ouvrirElement={ouvrirElement}
        revenirGraphe={revenirGraphe}
        sidebarOuverte={sidebarOuverte}
        setSidebarOuverte={setSidebarOuverte}
        compteId={compteId}
        generation={generation}
      />
    );
  }

  return (
    <VueExercice
      key={vue.id}
      vue={vue}
      ouvrirElement={ouvrirElement}
      revenirGraphe={revenirGraphe}
      sidebarOuverte={sidebarOuverte}
      setSidebarOuverte={setSidebarOuverte}
    />
  );
}

export function PanneauPedagogiqueAtelier({
  vue,
  ouvrirElement,
  compteId,
  generation,
}: {
  vue: VuePedagogiqueAtelier;
  ouvrirElement: (id: string) => void;
  compteId: string;
  generation: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
}) {
  if (vue.kind === "theme") {
    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-accent">Thème transversal</p>
          <h3 className="mt-1 font-serif text-lg font-medium text-texte">{vue.libelle}</h3>
        </div>

        {/* Répartition par domaine */}
        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold text-texte uppercase tracking-wider">Couverture par domaine</p>
          <div className="mt-3 space-y-3">
            {vue.domaines.map((d) => {
              const ratio = d.nombreCompetences > 0 ? Math.round((d.nombreEvaluees / d.nombreCompetences) * 100) : 0;
              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-texte truncate">{d.nom}</span>
                    <span className="text-texte-discret">{d.nombreEvaluees}/{d.nombreCompetences} ({ratio}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-primaire transition-all" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prochaine action recommandée */}
        {vue.prochaineActionRecommandee && (
          <section className="rounded-xl border border-alerte/30 bg-alerte-faible p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-alerte">Prochaine action recommandée</p>
            <p className="mt-2 text-sm font-semibold leading-snug text-texte">{vue.prochaineActionRecommandee.titre}</p>
            <p className="mt-1 text-xs text-texte-attenue">{vue.prochaineActionRecommandee.motif}</p>
            <button
              type="button"
              onClick={() => ouvrirElement(vue.prochaineActionRecommandee!.code)}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-primaire shadow-xs hover:bg-surface-2 cursor-pointer"
            >
              <span>Travailler cette compétence</span>
              <IconeFleche className="size-3.5" />
            </button>
          </section>
        )}

        {/* Entraînement & Génération */}
        <div className="rounded-xl border border-bordure bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold text-texte">Entraînement ciblé</p>
          <BoutonGenerer
            competences={generation.competences}
            competenceInitiale={vue.prochaineActionRecommandee?.code ?? vue.competences[0]?.code}
            calibrages={generation.calibrages}
            compteId={compteId}
            libelle="Générer un exercice"
          />
          <Link
            href="/seances"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-bordure bg-surface-2 px-3 py-2 text-xs font-medium text-texte hover:bg-surface-3 transition-colors"
          >
            <span>Ouvrir dans les séances</span>
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Accès rapide aux compétences */}
        <div>
          <p className="text-xs font-semibold text-texte-attenue">Compétences du thème ({vue.competences.length})</p>
          <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {vue.competences.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => ouvrirElement(c.code)}
                className="group flex w-full items-center justify-between rounded-lg border border-bordure/60 bg-surface px-2.5 py-2 text-left text-xs transition-colors hover:border-primaire hover:bg-surface-2 cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="block truncate font-medium text-texte group-hover:text-primaire">{c.titre}</span>
                  <span className="font-mono text-[0.625rem] text-texte-discret">{c.code} · {c.domaineNom}</span>
                </div>
                <span className="shrink-0 text-texte-discret group-hover:text-primaire">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (vue.kind === "exercice") {
    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Exercice</p>
          <h3 className="mt-1 font-serif text-lg font-medium text-texte">{vue.titre}</h3>
        </div>
        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Informations</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Domaine</dt>
              <dd className="font-medium text-texte">{vue.domaineNom}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Difficulté</dt>
              <dd className="font-medium text-texte">{vue.difficulte} / 5</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Durée estimée</dt>
              <dd className="font-medium text-texte">~{vue.dureeEstimeeMin} min</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-texte-discret">Tentatives</dt>
              <dd className="font-medium text-texte">{vue.nombreTentatives}</dd>
            </div>
          </dl>
        </div>
        <Link
          href={`/exercices/${vue.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
        >
          <span>S’exercer dans le cahier</span>
          <IconeFleche className="size-3.5" />
        </Link>
      </div>
    );
  }

  if (vue.kind === "domaine") {
    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Structure</p>
          <h3 className="mt-1 font-serif text-lg font-medium">{vue.nom}</h3>
        </div>
        <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
          <p className="text-xs font-semibold">Organisation réelle</p>
          <p className="mt-2 text-xs leading-relaxed text-texte-discret">
            Cette fiche mère regroupe les compétences du domaine. Les paliers les ordonnent ; ils ne créent pas de nouvelle entité.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-texte-attenue">Accès rapide</p>
          <div className="mt-2 space-y-1.5">
            {vue.competences.slice(0, 8).map((competence) => (
              <button
                key={competence.code}
                type="button"
                onClick={() => ouvrirElement(competence.code)}
                className="group flex w-full items-center justify-between rounded-xl border border-bordure/60 bg-surface-2/40 px-3 py-2.5 text-left text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primaire/40 hover:bg-primaire-faible/30 hover:shadow-sm cursor-pointer"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="block truncate font-medium text-texte transition-colors group-hover:text-primaire">{competence.titre}</span>
                  <span className="font-mono text-[0.625rem] text-texte-discret">{competence.code}</span>
                </div>
                <span className="shrink-0 text-texte-discret transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primaire">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const prochainExercice = vue.exercices[0];
  return (
    <div className="space-y-5 p-4">
      <div><p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Informations</p><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-texte-discret">Code</dt><dd className="font-mono font-medium">{vue.code}</dd></div><div className="flex justify-between gap-3"><dt className="text-texte-discret">Domaine</dt><dd className="text-right font-medium">{vue.domaineNom}</dd></div><div className="flex justify-between gap-3"><dt className="text-texte-discret">Palier</dt><dd className="font-medium">{LIBELLES_PALIERS[vue.palier]}</dd></div><div className="flex justify-between gap-3"><dt className="text-texte-discret">Dernière preuve</dt><dd className="font-medium">{dateCourte(vue.dernierePreuve)}</dd></div></dl></div>
      <div className="border-t border-bordure pt-4"><p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Performances détaillées</p><div className="mt-3 space-y-3">{vue.dimensions.map((dimension) => <Barre key={dimension.id} valeur={dimension.valeur} libelle={dimension.libelle} />)}</div></div>
      <section className="rounded-xl border border-alerte/30 bg-alerte-faible p-4"><p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-alerte">Prochaine action</p><p className="mt-2 text-sm font-medium leading-snug">{vue.prochaineEtape}</p>{prochainExercice ? <button type="button" onClick={() => ouvrirElement(`exercice:${prochainExercice.id}`)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-xs font-semibold text-primaire shadow-[var(--ombre-posee)] hover:bg-surface-2 cursor-pointer"><span>Aperçu de l’exercice</span> <IconeFleche className="size-3.5" /></button> : <div className="mt-3"><BoutonGenerer competences={generation.competences} competenceInitiale={vue.code} calibrages={generation.calibrages} compteId={compteId} libelle="Générer un exercice" /></div>}</section>
      <div className="border-t border-bordure pt-4"><p className="text-xs font-semibold text-texte-attenue">Actions utiles</p><div className="mt-2 grid grid-cols-2 gap-2">{prochainExercice ? <button type="button" onClick={() => ouvrirElement(`exercice:${prochainExercice.id}`)} className="rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-center text-[0.6875rem] font-medium hover:bg-surface-2 cursor-pointer"><IconeExercices className="mx-auto mb-1 size-4" />Aperçu</button> : <span className="rounded-lg border border-dashed border-bordure bg-surface-2 px-3 py-2 text-center text-[0.6875rem] text-texte-discret"><IconeExercices className="mx-auto mb-1 size-4" />À générer ci-dessus</span>}{vue.documents[0] ? <button type="button" onClick={() => ouvrirElement(vue.documents[0].id)} className="rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-center text-[0.6875rem] font-medium hover:bg-surface-2 cursor-pointer"><IconeDocuments className="mx-auto mb-1 size-4" />Ressource</button> : <span className="rounded-lg border border-dashed border-bordure bg-surface-2 px-3 py-2 text-center text-[0.6875rem] text-texte-discret"><IconeDocuments className="mx-auto mb-1 size-4" />Aucun lien</span>}</div></div>
    </div>
  );
}
