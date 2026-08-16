"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { FilArianeAtelier } from "./fil-ariane-atelier";
import { compterElements, trouverNoeudDossier, type NoeudDossier } from "@/lib/documents/arbre-atelier";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import type { ElementAtelier } from "./types-atelier";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ModaleTheme } from "@/components/seances/modale-theme";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "./modale-confirmation-suppression";
import { archiverDomaine, retirerCompetences } from "@/lib/store/referentiel-actions";
import { retirerTheme } from "@/lib/store/theme-actions";
import { supprimerDocumentAction } from "@/lib/store/document-actions";
import type { CalibrageModale, CompetenceModale } from "@/components/exercices/proprietes-generation";
import {
  IconeTheme,
  IconeCompetences,
  IconeExercices,
  IconeDocuments,
  IconeFleche,
} from "@/components/ui/icones";
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

export function BarreVuesAtelier({
  vue,
  onChanger,
}: {
  vue: "graphe" | "domaines" | "transversal";
  onChanger: (v: "graphe" | "domaines" | "transversal") => void;
}) {
  const options = [
    { cle: "domaines" as const, libelle: "Domaines" },
    { cle: "transversal" as const, libelle: "Transversal" },
    { cle: "graphe" as const, libelle: "Constellation" },
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
  surtitre = "Mémoire documentaire",
  titre,
  description,
  vue,
  onChangerVue,
}: {
  surtitre?: string;
  titre: string;
  description?: string;
  vue: "graphe" | "domaines" | "transversal";
  onChangerVue: (v: "graphe" | "domaines" | "transversal") => void;
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
  revenirGrapheGlobal,
  selection,
  compteId,
  domainesExistants = [],
}: {
  domaines: VueDomaineAtelier[];
  ouvrirElement: (id: string) => void;
  revenirGrapheGlobal: () => void;
  selection?: string | null;
  compteId?: string;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
}) {
  const router = useRouter();
  const [modaleCreationOuverte, setModaleCreationOuverte] = useState(false);
  const [domaineASupprimer, setDomaineASupprimer] = useState<VueDomaineAtelier | null>(null);
  const [tri, setTri] = useState<TriDomaine>("recent");

  const estTransversal = selection === "transversal";
  const estArchives = selection === "domaines-archives";

  const domainesAffiches = useMemo(() => {
    return filtrerEtTrierDomaines(domaines, { tri });
  }, [domaines, tri]);

  const titrePrincipal = estTransversal
    ? "Vue transversale"
    : estArchives
    ? "Domaines archivés"
    : "Domaines d’apprentissage";

  const sousTitrePrincipal = estTransversal
    ? "Vue d’ensemble des thèmes, notes et compétences transversales"
    : estArchives
    ? `Vue d’ensemble des ${domaines.length} domaine(s) archivé(s)`
    : `Vue d’ensemble des ${domaines.length} domaines du système pédagogique`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <EnteteVueAtelier
        titre={titrePrincipal}
        description={sousTitrePrincipal}
        vue={estTransversal ? "transversal" : "domaines"}
        onChangerVue={(v) => {
          if (v === "graphe") revenirGrapheGlobal();
          else ouvrirElement(v);
        }}
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

          {!estArchives && !estTransversal && compteId && (
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

export function VueTransversale({
  racine,
  ouvrirDossier,
  ouvrirElement,
  revenirGrapheGlobal,
}: {
  racine: NoeudDossier<ElementAtelier> | null;
  ouvrirDossier: (chemin: string) => void;
  ouvrirElement: (id: string) => void;
  revenirGrapheGlobal: () => void;
  compteId?: string;
  competencesParCode?: Map<string, { intitule: string; domaine: string }>;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
}) {

  const categoriesPresentes = racine?.enfants ?? [];
  const nomVersNoeud = new Map(categoriesPresentes.map((c) => [c.nom.toLowerCase(), c]));

  const CATEGORIES_CANONIQUES = [
    {
      nom: "Compétences",
      chemin: "Transversal/Compétences",
      description: "Toutes les compétences observables découpées par domaine",
    },
    {
      nom: "Thèmes",
      chemin: "Transversal/Thèmes",
      description: "Thèmes et projets transversaux reliant plusieurs compétences",
    },
    {
      nom: "Exercices",
      chemin: "Transversal/Exercices",
      description: "Exercices et mises en situation d’entraînement",
    },
    {
      nom: "Preuves",
      chemin: "Transversal/Preuves",
      description: "Traces et évaluations d’apprentissage enregistrées",
    },
    {
      nom: "Documents",
      chemin: "Transversal/Documents",
      description: "Notes de travail, synthèses et fiches opérationnelles",
    },
  ];

  const categories = CATEGORIES_CANONIQUES.map((canonique) => {
    const existant = nomVersNoeud.get(canonique.nom.toLowerCase());
    return {
      nom: canonique.nom,
      chemin: existant?.chemin ?? canonique.chemin,
      total: existant ? compterElements(existant) : 0,
      description: canonique.description,
    };
  });

  const nomsCanoniques = new Set(CATEGORIES_CANONIQUES.map((c) => c.nom.toLowerCase()));
  const categoriesSupplementaires = categoriesPresentes.filter(
    (c) => !nomsCanoniques.has(c.nom.toLowerCase()),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <EnteteVueAtelier
        titre="Catégories transversales"
        description="Des accès dérivés vers les mêmes fiches, sans créer un second référentiel."
        vue="transversal"
        onChangerVue={(v) => {
          if (v === "graphe") revenirGrapheGlobal();
          else ouvrirElement(v);
        }}
      />
      <div className="p-6 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((categorie) => (
            <button
              key={categorie.chemin}
              type="button"
              onClick={() => ouvrirDossier(categorie.chemin)}
              className="flex min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primaire">
                    Catégorie
                  </span>
                  <span className="chiffres text-xs text-texte-discret">
                    {categorie.total} fiche{categorie.total > 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="mt-3 font-serif text-lg font-medium">{categorie.nom}</h3>
                <p className="mt-1 text-xs text-texte-attenue leading-relaxed">
                  {categorie.description}
                </p>
              </div>
              <div className="mt-4 border-t border-bordure/60 pt-3 text-xs font-medium text-primaire">
                Ouvrir la catégorie →
              </div>
            </button>
          ))}

          {categoriesSupplementaires.map((categorie) => (
            <button
              key={categorie.chemin}
              type="button"
              onClick={() => ouvrirDossier(categorie.chemin)}
              className="flex min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primaire">
                    Sous-dossier
                  </span>
                  <span className="chiffres text-xs text-texte-discret">
                    {compterElements(categorie)}
                  </span>
                </div>
                <h3 className="mt-3 font-serif text-lg font-medium">{categorie.nom}</h3>
              </div>
              <div className="mt-4 border-t border-bordure/60 pt-3 text-xs font-medium text-primaire">
                Ouvrir →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VueCategorieTransversale({
  noeud,
  arbreDossiers = [],
  elements = [],
  ouvrirDossier,
  ouvrirElement,
  revenirTransversal,
  revenirGrapheGlobal,
  compteId,
  generation,
  competencesParCode,
  domainesExistants = [],
}: {
  noeud: NoeudDossier<ElementAtelier>;
  arbreDossiers?: NoeudDossier<ElementAtelier>[];
  elements?: ElementAtelier[];
  ouvrirDossier: (chemin: string) => void;
  ouvrirElement: (id: string) => void;
  revenirTransversal: () => void;
  revenirGrapheGlobal?: () => void;
  compteId?: string;
  generation?: { competences: CompetenceModale[]; calibrages: Record<string, CalibrageModale> };
  competencesParCode?: Map<string, { intitule: string; domaine: string }>;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
}) {
  const router = useRouter();
  const [modaleThemeOuverte, setModaleThemeOuverte] = useState(false);
  const [modaleCompetenceOuverte, setModaleCompetenceOuverte] = useState(false);
  const [elementASupprimer, setElementASupprimer] = useState<ElementAtelier | null>(null);

  const parties = noeud.chemin.split("/").map((p) => p.trim()).filter(Boolean);
  const nomDossier = noeud.nom.toLowerCase();
  const cheminDossier = noeud.chemin.toLowerCase();

  const estThemes = nomDossier === "thèmes" || nomDossier === "themes" || cheminDossier.includes("/thèmes") || cheminDossier.includes("/themes");
  const estExercices = nomDossier === "exercices" || cheminDossier.includes("/exercices");
  const estCompetences = nomDossier === "compétences" || nomDossier === "competences" || cheminDossier.includes("/compétences") || cheminDossier.includes("/competences");
  const estPreuves = nomDossier === "preuves" || cheminDossier.includes("/preuves");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/30">
      <header className="border-b border-bordure bg-surface px-6 py-4 lg:px-8">
        <FilArianeAtelier
          dossier={parties.slice(0, -1).join("/")}
          titreCourant={noeud.nom}
          revenirGraphe={revenirGrapheGlobal}
          actionRetour={revenirTransversal}
          libelleRetour="Retour"
          ouvrirElement={ouvrirElement}
          ouvrirDossier={ouvrirDossier}
          arbreDossiers={arbreDossiers}
          elements={elements}
          className="mb-3"
        />
        <h2 className="font-serif text-2xl font-medium tracking-tight">{noeud.nom}</h2>
        <p className="mt-1 text-xs text-texte-attenue">{compterElements(noeud)} fiche{compterElements(noeud) > 1 ? "s" : ""} accessible{compterElements(noeud) > 1 ? "s" : ""} dans cette catégorie.</p>
      </header>
      <div className="space-y-6 p-6 lg:p-8">
        {noeud.enfants.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {noeud.enfants.map((enfant) => (
              <button key={enfant.chemin} type="button" onClick={() => ouvrirDossier(enfant.chemin)} className="rounded-xl border border-bordure bg-surface p-4 text-left hover:border-primaire/40 cursor-pointer transition-colors">
                <span className="text-sm font-semibold">{enfant.nom}</span>
                <span className="ml-2 text-xs text-texte-discret">{compterElements(enfant)}</span>
              </button>
            ))}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {noeud.elements.map((element) => {
            const estTheme = element.id.startsWith("theme:") || element.type === "theme";
            const estDoc = element.type === "document" || element.type === "note" || element.id.startsWith("note-") || element.id.startsWith("doc-");
            const estComp = element.type === "competence";
            const estExo = element.type === "exercice";
            const supprimable = estTheme || estDoc || estComp;
            const vuePedag = element.vuePedagogique as any;

            if (estTheme) {
              const nbCodes = Array.isArray(element.frontMatter.codes) ? element.frontMatter.codes.length : (vuePedag?.competences?.length ?? 0);
              const intention = typeof element.frontMatter.intention === "string" ? element.frontMatter.intention : vuePedag?.intention;

              return (
                <div key={element.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => ouvrirElement(element.id)}
                    className="flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 pr-8">
                        <span className="grid size-9 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent shadow-xs">
                          <IconeTheme className="size-4.5" />
                        </span>
                        {nbCodes > 0 && (
                          <span className="chiffres text-xs font-medium text-texte-discret">
                            {nbCodes} compétence{nbCodes > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3.5 font-serif text-base font-semibold leading-snug text-texte group-hover:text-primaire transition-colors">
                        {element.titre}
                      </h3>

                      {intention && (
                        <p className="mt-2 line-clamp-2 text-xs italic font-serif leading-relaxed text-texte-attenue">
                          « {intention} »
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
                      <span className="font-medium text-primaire group-hover:underline">Explorer le thème</span>
                      <IconeFleche className="size-3.5 text-texte-discret transition-colors group-hover:text-primaire" />
                    </div>
                  </button>

                  <BoutonSuppressionCarte
                    titre={`Supprimer le thème ${element.titre}`}
                    onClick={() => setElementASupprimer(element)}
                  />
                </div>
              );
            }

            if (estComp) {
              const code = element.id;
              const niveau = vuePedag?.niveau;
              const nbPreuves = vuePedag?.nombrePreuves ?? 0;
              const domaineNom = vuePedag?.domaineNom;

              return (
                <div key={element.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => ouvrirElement(element.id)}
                    className="flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 pr-8">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-primaire-faible text-primaire">
                          {code}
                        </span>
                        <span className="chiffres rounded-md bg-surface-2 px-2 py-0.5 text-[0.625rem] text-texte-discret font-medium">
                          {niveau === null || niveau === undefined ? "Non évalué" : `Niveau ${niveau}`}
                        </span>
                      </div>

                      <h3 className="mt-3 font-serif text-sm font-semibold leading-snug text-texte group-hover:text-primaire transition-colors">
                        {element.titre}
                      </h3>

                      {domaineNom && (
                        <p className="mt-1.5 line-clamp-1 text-xs text-texte-attenue">
                          {domaineNom}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
                      <span className="chiffres">
                        {nbPreuves} preuve{nbPreuves > 1 ? "s" : ""}
                      </span>
                      <span className="text-[0.6875rem] capitalize text-texte-discret">
                        {vuePedag?.palier ?? "fondamentaux"}
                      </span>
                    </div>
                  </button>

                  <BoutonSuppressionCarte
                    titre={`Retirer la compétence ${element.titre}`}
                    onClick={() => setElementASupprimer(element)}
                  />
                </div>
              );
            }

            if (estExo) {
              const difficulte = typeof element.frontMatter.difficulte === "number" ? element.frontMatter.difficulte : null;
              const nbTentatives = element.tentatives?.length ?? 0;

              return (
                <div key={element.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => ouvrirElement(element.id)}
                    className="flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 pr-8">
                        <span className="grid size-9 place-items-center rounded-xl bg-info-faible text-info">
                          <IconeExercices className="size-4.5" />
                        </span>
                        {difficulte !== null && (
                          <span className="chiffres text-xs text-texte-discret">
                            Diff. {difficulte}/5
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3.5 font-serif text-sm font-semibold leading-snug text-texte group-hover:text-primaire transition-colors">
                        {element.titre}
                      </h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
                      <span className="chiffres">
                        {nbTentatives} tentative{nbTentatives > 1 ? "s" : ""}
                      </span>
                      <span className="font-medium text-primaire group-hover:underline">S’exercer →</span>
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <div key={element.id} className="group relative">
                <button
                  type="button"
                  onClick={() => ouvrirElement(element.id)}
                  className="flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <span className="grid size-9 place-items-center rounded-xl bg-primaire-faible text-primaire">
                        <IconeDocuments className="size-4.5" />
                      </span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-medium capitalize text-texte-discret">
                        {element.type}
                      </span>
                    </div>

                    <h3 className="mt-3.5 font-serif text-sm font-semibold leading-snug text-texte group-hover:text-primaire transition-colors">
                      {element.titre}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
                    <span>Fiche de travail</span>
                    <span className="font-medium text-primaire group-hover:underline">Ouvrir →</span>
                  </div>
                </button>

                {supprimable && (
                  <BoutonSuppressionCarte
                    titre={`Supprimer ${element.titre}`}
                    onClick={() => setElementASupprimer(element)}
                  />
                )}
              </div>
            );
          })}

          {noeud.elements.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-2 rounded-2xl border border-dashed border-bordure bg-surface/40 p-8 text-center">
              <p className="font-serif text-base font-medium text-texte">
                {estThemes
                  ? "Aucun thème transversal pour le moment"
                  : "Aucun document dans cette catégorie"}
              </p>
              <p className="mt-1.5 text-xs text-texte-attenue max-w-sm mx-auto leading-relaxed">
                {estThemes
                  ? "Un thème regroupe des compétences complémentaires issues de plusieurs domaines (ex : « IA multimodale », « Projets de recherche »)."
                  : "Utilise le bouton ci-contre pour ajouter ton premier élément."}
              </p>
            </div>
          )}

          {estThemes && compteId && competencesParCode && (
            <CarteCreationPointillee
              titre="Nouveau thème transversal"
              description="Composer un thème reliant des compétences"
              onClick={() => setModaleThemeOuverte(true)}
            />
          )}

          {estExercices && generation && compteId && (
            <CarteCreationPointillee
              titre="Composer une séance"
              description="Créer une séance d’entraînement avec le tuteur IA"
              onClick={() =>
                router.push(
                  `/seances?composer=1&code=${encodeURIComponent(generation.competences[0]?.code ?? "")}`,
                )
              }
            />
          )}

          {estCompetences && compteId && (
            <CarteCreationPointillee
              titre="Ajouter une compétence"
              description="Créer ou déclarer une nouvelle compétence"
              onClick={() => setModaleCompetenceOuverte(true)}
            />
          )}

          {estPreuves && generation && compteId && (
            <CarteCreationPointillee
              titre="Composer une séance d’évaluation"
              description="Produire une nouvelle preuve d’apprentissage"
              onClick={() =>
                router.push(
                  `/seances?composer=1&code=${encodeURIComponent(generation.competences[0]?.code ?? "")}`,
                )
              }
            />
          )}
        </section>
      </div>

      {modaleThemeOuverte && compteId && competencesParCode && (
        <ModaleTheme
          compteId={compteId}
          competencesParCode={competencesParCode}
          domainesExistants={domainesExistants}
          onFermer={() => setModaleThemeOuverte(false)}
          onCree={(theme) => {
            setModaleThemeOuverte(false);
            router.refresh();
            ouvrirElement(`theme:${theme.id}`);
          }}
        />
      )}

      {modaleCompetenceOuverte && compteId && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          onFermer={() => setModaleCompetenceOuverte(false)}
          surEnregistre={() => {
            setModaleCompetenceOuverte(false);
            router.refresh();
          }}
        />
      )}

      {elementASupprimer && (
        <ModaleConfirmationSuppression
          titre={`Supprimer ${elementASupprimer.typeLibelle.toLowerCase()}`}
          nomElement={elementASupprimer.titre}
          typeElement={elementASupprimer.type as any}
          mode="suppression"
          explication={
            elementASupprimer.type === "theme" || elementASupprimer.id.startsWith("theme:")
              ? "Ce thème transversal sera retiré. Les compétences et exercices associés restent préservés."
              : elementASupprimer.type === "competence"
              ? "Cette compétence sera retirée du référentiel."
              : "Ce document sera définitivement supprimé de votre espace."
          }
          texteBoutonConfirmer="Confirmer la suppression"
          onConfirmer={async () => {
            if (elementASupprimer.type === "theme" || elementASupprimer.id.startsWith("theme:")) {
              const themeId = elementASupprimer.id.replace(/^theme:/, "");
              await retirerTheme(themeId);
            } else if (elementASupprimer.type === "competence") {
              await retirerCompetences([elementASupprimer.id]);
            } else {
              await supprimerDocumentAction(elementASupprimer.id);
            }
            setElementASupprimer(null);
            router.refresh();
          }}
          onFermer={() => setElementASupprimer(null)}
        />
      )}
    </div>
  );
}
