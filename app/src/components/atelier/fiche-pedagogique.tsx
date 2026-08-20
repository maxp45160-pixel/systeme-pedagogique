"use client";

import type { VuePedagogiqueAtelier } from "@/lib/documents/vue-atelier";
import type { ElementAtelier } from "./types-atelier";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import { urlComposerAutonome } from "@/lib/domain/navigation-exercice";
import Link from "next/link";
import { IconeFleche } from "@/components/ui/icones";
import { VueCompetence } from "./vues/vue-competence";
import { VueDomaine } from "./vues/vue-domaine";
import { VueExercice } from "./vues/vue-exercice";

export { VueDomaine };

export function FichePedagogiqueAtelier({
  vue,
  titre,
  ouvrirElement,
  elements,
  compteId,
  modeInitial,
  generation,
  donneesSeance,
  onRestaurerDomaine,
}: {
  vue: VuePedagogiqueAtelier;
  titre: string;
  ouvrirElement: (id: string) => void;
  elements?: ElementAtelier[];
  compteId: string;
  modeInitial?: "referentiel";
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  donneesSeance?: DonneesSeance;
  onRestaurerDomaine?: (domaineId: string) => void;
}) {
  if (vue.kind === "competence") {
    return (
      <VueCompetence
        key={vue.code}
        vue={vue}
        titre={titre}
        ouvrirElement={ouvrirElement}
        elements={elements}
        compteId={compteId}
        generation={generation}
        donneesSeance={donneesSeance}
      />
    );
  }

  if (vue.kind === "domaine") {
    return (
      <VueDomaine
        vue={vue}
        ouvrirElement={ouvrirElement}
        compteId={compteId}
        modeInitial={modeInitial}
        onRestaurerDomaine={onRestaurerDomaine}
      />
    );
  }

  return (
    <VueExercice
      key={vue.id}
      vue={vue}
      ouvrirElement={ouvrirElement}
    />
  );
}

/**
 * Le volet de contexte a-t-il quelque chose à dire sur cet objet ?
 */
export function panneauPedagogiqueUtile(vue: VuePedagogiqueAtelier): boolean {
  return vue.kind !== "competence";
}

export function PanneauPedagogiqueAtelier({
  vue,
  ouvrirElement,
  donneesSeance,
}: {
  vue: VuePedagogiqueAtelier;
  ouvrirElement: (id: string) => void;
  donneesSeance?: DonneesSeance;
}) {
  if (vue.kind === "competence") return null;

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
          href={urlComposerAutonome(vue.competences[0]?.code, vue.dureeEstimeeMin)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
        >
          <span>S’exercer dans le cahier</span>
          <IconeFleche className="size-3.5" />
        </Link>
      </div>
    );
  }

  if (vue.kind === "domaine") {
    const paliersCompteurs = {
      fondamentaux: vue.competences.filter((c) => c.palier === "fondamentaux").length,
      intermediaire: vue.competences.filter((c) => c.palier === "intermediaire").length,
      avance: vue.competences.filter((c) => c.palier === "avance").length,
    };

    return (
      <div className="space-y-5 p-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-texte-discret">Structure du domaine</p>
          <h3 className="mt-1 font-serif text-lg font-medium">{vue.nom}</h3>
        </div>

        {donneesSeance && !vue.domaine.archive && (
          <div className="rounded-xl border border-primaire/25 bg-primaire-faible/30 p-4">
            <p className="text-xs font-semibold text-texte">Entraînement sur le domaine</p>
            <p className="mt-1 text-xs text-texte-attenue leading-relaxed">
              Composer une séance regroupant les compétences de ce domaine.
            </p>
            <div className="mt-3">
              <ConcepteurSeance
                {...donneesSeance}
                preset={{
                  libelle: `Domaine : ${vue.nom}`,
                  codesVises: vue.competences.map((c) => c.code),
                  dureeCibleMin: 45,
                  nombreExercices: Math.max(3, Math.min(vue.competences.length, 6)),
                  domaine: vue.domaine.id,
                }}
                libelle="Lancer une séance domaine"
                pleineLargeur
                variante="principal"
                icone={<IconeFleche className="size-3.5" />}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primaire px-3 py-2 text-xs font-semibold text-texte-inverse shadow-xs hover:bg-primaire-survol transition-colors cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-bordure bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Niveaux</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Fondam.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.fondamentaux}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Interm.</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.intermediaire}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <span className="block text-[0.625rem] text-texte-discret">Avancé</span>
              <span className="chiffres font-semibold text-texte">{paliersCompteurs.avance}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
          <p className="text-xs font-semibold">Organisation réelle</p>
          <p className="mt-2 text-xs leading-relaxed text-texte-discret">
            Cette fiche mère regroupe les compétences du domaine. Les paliers les ordonnent ; ils ne créent pas de nouvelle entité.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
