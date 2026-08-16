"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "./modale-confirmation-suppression";
import { archiverDomaine } from "@/lib/store/referentiel-actions";
import { formatDateRelative } from "@/lib/engine/dates";
import {
  filtrerEtTrierDomaines,
  LIBELLES_TRIS_DOMAINES,
  type TriDomaine,
} from "@/lib/documents/tri-domaines";

export function CarteCreationPointillee({
  titre,
  description,
  onClick,
  className,
}: {
  titre: string;
  description?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex min-h-[170px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bordure/80 bg-surface/20 p-6 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primaire/60 hover:bg-surface hover:shadow-[var(--ombre-posee)] cursor-pointer",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-texte-discret transition-colors group-hover:bg-primaire-faible group-hover:text-primaire">
        +
      </span>
      <div className="min-w-0">
        <span className="block font-serif text-sm font-semibold text-texte transition-colors group-hover:text-primaire">
          {titre}
        </span>
        {description && (
          <span className="mt-1 block text-xs text-texte-discret leading-relaxed max-w-[220px] mx-auto">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Les quatre entrées de l'Atelier.
 *
 * « Transversal » a disparu : c'était un second classement des mêmes objets,
 * où chaque compétence apparaissait une deuxième fois. Restent quatre lieux qui
 * ne se recouvrent pas — le référentiel, les sélections, les ressources, et la
 * même matière vue en graphe.
 */
export type VueAtelier = "domaines" | "themes" | "ressources" | "graphe";

export function BarreVuesAtelier({
  vue,
  onChanger,
}: {
  vue: VueAtelier;
  onChanger: (v: VueAtelier) => void;
}) {
  const options = [
    { cle: "domaines" as const, libelle: "Domaines" },
    { cle: "themes" as const, libelle: "Thèmes" },
    { cle: "ressources" as const, libelle: "Ressources" },
    { cle: "graphe" as const, libelle: "Graphe" },
  ];
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-bordure bg-surface-2 p-1 text-xs"
      role="tablist"
      aria-label="Modes de vue de l'Atelier"
    >
      {options.map((opt) => (
        <button
          key={opt.cle}
          type="button"
          role="tab"
          aria-selected={vue === opt.cle}
          onClick={() => onChanger(opt.cle)}
          className={cx(
            "rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer",
            vue === opt.cle
              ? "bg-surface text-primaire shadow-xs font-semibold"
              : "text-texte-discret hover:text-texte hover:bg-surface/50",
          )}
        >
          {opt.libelle}
        </button>
      ))}
    </div>
  );
}

export function EnteteVueAtelier({
  surtitre = "Atelier",
  titre,
  description,
  vue,
  onChangerVue,
}: {
  surtitre?: string;
  titre: string;
  description?: string;
  vue: VueAtelier;
  onChangerVue: (v: VueAtelier) => void;
}) {
  return (
    <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-texte-discret leading-none">
            {surtitre}
          </p>
          <h2 className="mt-0.5 font-serif text-2xl font-medium tracking-tight leading-tight text-texte truncate">
            {titre}
          </h2>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {description && (
          <span className="text-xs text-texte-discret hidden sm:inline max-w-sm lg:max-w-md xl:max-w-xl truncate">
            {description}
          </span>
        )}
        <BarreVuesAtelier vue={vue} onChanger={onChangerVue} />
      </div>
    </div>
  );
}

export function VueTousLesDomaines({
  domaines,
  ouvrirElement,
  changerVue,
  selection,
  compteId,
  domainesExistants = [],
}: {
  domaines: VueDomaineAtelier[];
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
  selection?: string | null;
  compteId?: string;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
}) {
  const router = useRouter();
  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [domaineASupprimer, setDomaineASupprimer] = useState<VueDomaineAtelier | null>(null);
  const [tri, setTri] = useState<TriDomaine>("recent");

  const estArchives = selection === "domaines-archives";

  const domainesAffiches = useMemo(() => {
    return filtrerEtTrierDomaines(domaines, { tri });
  }, [domaines, tri]);

  const titrePrincipal = estArchives ? "Domaines archivés" : "Domaines";

  const sousTitrePrincipal = estArchives
    ? `${domaines.length} domaine${domaines.length > 1 ? "s" : ""} archivé${domaines.length > 1 ? "s" : ""}`
    : "Le référentiel du compte : chaque domaine et les compétences qu’il porte.";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <EnteteVueAtelier
        titre={titrePrincipal}
        description={sousTitrePrincipal}
        vue="domaines"
        onChangerVue={changerVue}
      />

      <div className="p-6 lg:p-8 space-y-4">
        {/* Ligne discrète de tri et d'information */}
        <div className="flex items-center justify-between gap-4 text-xs text-texte-discret">
          <span className="font-medium text-texte-attenue">
            {domaines.length} domaine{domaines.length > 1 ? "s" : ""}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="tri-domaines" className="text-texte-discret text-xs">
              Trier par :
            </label>
            <select
              id="tri-domaines"
              value={tri}
              onChange={(e) => setTri(e.target.value as TriDomaine)}
              className="rounded-md border border-bordure bg-surface px-2.5 py-1 text-xs font-medium text-texte transition-colors hover:border-primaire/40 focus:border-primaire focus:outline-hidden cursor-pointer"
            >
              {Object.entries(LIBELLES_TRIS_DOMAINES).map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grille des domaines */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {domainesAffiches.map((domaine) => {
            const total = domaine.competences.length;
            const evaluees = domaine.nombreEvaluees;
            const ratio = total > 0 ? Math.round((evaluees / total) * 100) : 0;
            return (
              <div key={domaine.id} className="group relative">
                <button
                  type="button"
                  onClick={() => ouvrirElement(`domaine:${domaine.id}`)}
                  className="flex h-full w-full flex-col justify-between rounded-xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <span className="rounded-md bg-primaire-faible px-2.5 py-1 text-xs font-semibold text-primaire">
                        Domaine
                      </span>
                      <span className="chiffres text-xs text-texte-discret">
                        {total} compétence{total > 1 ? "s" : ""}
                      </span>
                    </div>
                    <h3 className="mt-3 font-serif text-lg font-medium leading-snug text-texte group-hover:text-primaire">
                      {domaine.nom}
                    </h3>
                    {domaine.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-texte-attenue">
                        {domaine.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-bordure pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-texte-discret">
                      <span>Couverture</span>
                      <span className="chiffres font-medium text-texte">{ratio}% ({evaluees}/{total})</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-primaire transition-all duration-300" style={{ width: `${ratio}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-texte-discret pt-0.5">
                      <span>Dernière activité</span>
                      <span className="chiffres text-texte-attenue font-medium">
                        {domaine.derniereActivite ? formatDateRelative(domaine.derniereActivite) : "Aucune"}
                      </span>
                    </div>
                  </div>
                </button>

                {!estArchives && (
                  <BoutonSuppressionCarte
                    titre="Archiver ce domaine"
                    onClick={() => setDomaineASupprimer(domaine)}
                  />
                )}
              </div>
            );
          })}

          {!estArchives && compteId && (
            <CarteCreationPointillee
              titre="Ajouter un domaine"
              description="Créer une nouvelle branche de compétences"
              onClick={() => setModaleCreationOuverte(true)}
            />
          )}
        </div>
      </div>

      {domaineASupprimer && (
        <ModaleConfirmationSuppression
          titre="Archiver le domaine"
          nomElement={domaineASupprimer.nom}
          typeElement="domaine"
          mode="archivage"
          explication="Ce domaine et ses compétences seront retirés du pilotage actif. Toutes les preuves d'apprentissage et historiques restent fidèlement conservés dans le système."
          texteBoutonConfirmer="Confirmer l’archivage"
          onConfirmer={async () => {
            await archiverDomaine(domaineASupprimer.id);
            setDomaineASupprimer(null);
            router.refresh();
          }}
          onFermer={() => setDomaineASupprimer(null)}
        />
      )}

      {modaleCreationOuverte && compteId && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          onFermer={() => setModaleCreationOuverte(false)}
          surEnregistre={() => {
            setModaleCreationOuverte(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
