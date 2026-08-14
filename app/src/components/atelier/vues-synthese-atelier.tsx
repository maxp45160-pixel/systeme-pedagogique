"use client";

import { cx } from "@/components/ui/primitives";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { BoutonOuvrirExplorateur } from "./fiche-pedagogique";
import { compterElements, trouverNoeudDossier, type NoeudDossier } from "@/lib/documents/arbre-atelier";
import type { VueDomaineAtelier } from "@/lib/documents/vue-atelier";
import type { ElementAtelier } from "./types-atelier";

export function BarreVuesAtelier({
  vue,
  onChanger,
}: {
  vue: "graphe" | "domaines" | "transversal";
  onChanger: (v: "graphe" | "domaines" | "transversal") => void;
}) {
  const options = [
    { cle: "graphe" as const, libelle: "Constellation" },
    { cle: "domaines" as const, libelle: "Domaines" },
    { cle: "transversal" as const, libelle: "Transversal" },
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
  sidebarOuverte,
  setSidebarOuverte,
}: {
  surtitre?: string;
  titre: string;
  description?: string;
  vue: "graphe" | "domaines" | "transversal";
  onChangerVue: (v: "graphe" | "domaines" | "transversal") => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
}) {
  return (
    <div className="flex h-[4.25rem] items-center justify-between gap-3 border-b border-bordure bg-surface px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {!sidebarOuverte && setSidebarOuverte && (
          <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
        )}
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
  sidebarOuverte,
  setSidebarOuverte,
  selection,
}: {
  domaines: VueDomaineAtelier[];
  ouvrirElement: (id: string) => void;
  revenirGrapheGlobal: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
  selection?: string | null;
}) {
  const estTransversal = selection === "transversal";
  const estArchives = selection === "domaines-archives";

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
        sidebarOuverte={sidebarOuverte}
        setSidebarOuverte={setSidebarOuverte}
      />

      <div className="p-6 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {domaines.map((domaine) => {
            const total = domaine.competences.length;
            const evaluees = domaine.nombreEvaluees;
            const ratio = total > 0 ? Math.round((evaluees / total) * 100) : 0;
            return (
              <button
                key={domaine.id}
                type="button"
                onClick={() => ouvrirElement(`domaine:${domaine.id}`)}
                className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
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

                <div className="mt-5 border-t border-bordure pt-3">
                  <div className="flex items-center justify-between text-xs text-texte-discret">
                    <span>Couverture</span>
                    <span className="chiffres font-medium text-texte">{ratio}% ({evaluees}/{total})</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-primaire transition-all duration-300" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VueTransversale({
  racine,
  ouvrirDossier,
  ouvrirElement,
  revenirGrapheGlobal,
  sidebarOuverte,
  setSidebarOuverte,
}: {
  racine: NoeudDossier<ElementAtelier> | null;
  ouvrirDossier: (chemin: string) => void;
  ouvrirElement: (id: string) => void;
  revenirGrapheGlobal: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
}) {
  const categories = racine?.enfants ?? [];
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
        sidebarOuverte={sidebarOuverte}
        setSidebarOuverte={setSidebarOuverte}
      />
      <div className="p-6 lg:p-8">
        {categories.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((categorie) => (
              <button key={categorie.chemin} type="button" onClick={() => ouvrirDossier(categorie.chemin)} className="rounded-xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all hover:-translate-y-0.5 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primaire">Catégorie</span>
                  <span className="chiffres text-xs text-texte-discret">{compterElements(categorie)}</span>
                </div>
                <h3 className="mt-3 font-serif text-lg font-medium">{categorie.nom}</h3>
                <p className="mt-2 text-xs text-texte-discret">Ouvrir la catégorie et ses sous-catégories</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-bordure bg-surface p-6 text-sm text-texte-discret">Aucune catégorie transversale n’est encore alimentée.</p>
        )}
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
  sidebarOuverte,
  setSidebarOuverte,
}: {
  noeud: NoeudDossier<ElementAtelier>;
  arbreDossiers?: NoeudDossier<ElementAtelier>[];
  elements?: ElementAtelier[];
  ouvrirDossier: (chemin: string) => void;
  ouvrirElement: (id: string) => void;
  revenirTransversal: () => void;
  revenirGrapheGlobal?: () => void;
  sidebarOuverte?: boolean;
  setSidebarOuverte?: (ouverte: boolean) => void;
}) {
  const parties = noeud.chemin.split("/").map((p) => p.trim()).filter(Boolean);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/30">
      <header className="border-b border-bordure bg-surface px-6 py-4 lg:px-8">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap mb-3">
          {!sidebarOuverte && setSidebarOuverte && (
            <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
          )}
          <BoutonRetour onClick={revenirTransversal} libelle="Retour" />
          {revenirGrapheGlobal && (
            <button
              type="button"
              onClick={revenirGrapheGlobal}
              className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0"
            >
              Atelier
            </button>
          )}
          {parties.map((partie, index) => {
            const cheminCumule = parties.slice(0, index + 1).join("/");
            const estDernier = index === parties.length - 1;
            if (estDernier) {
              return (
                <span key={cheminCumule} className="flex items-center gap-1.5 min-w-0">
                  <span className="text-texte-discret/60 shrink-0">/</span>
                  <span className="font-semibold text-texte truncate">{partie}</span>
                </span>
              );
            }
            const domaineEl = elements.find(
              (el) =>
                el.type === "domaine" &&
                ((el.vuePedagogique?.kind === "domaine" && el.vuePedagogique.nom === partie) || el.titre === partie),
            );
            let action: (() => void) | null = null;
            if (partie === "Domaines") {
              action = () => ouvrirElement("domaines");
            } else if (partie === "Transversal") {
              action = () => ouvrirElement("transversal");
            } else if (partie === "Domaines archivés" || partie === "Archivés") {
              action = () => ouvrirElement("domaines-archives");
            } else if (domaineEl) {
              action = () => ouvrirElement(domaineEl.id);
            } else if (trouverNoeudDossier(arbreDossiers, cheminCumule)) {
              action = () => ouvrirDossier(cheminCumule);
            }
            return (
              <span key={cheminCumule} className="flex items-center gap-1.5 shrink-0">
                <span className="text-texte-discret/60">/</span>
                {action ? (
                  <button
                    type="button"
                    onClick={action}
                    className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline"
                  >
                    {partie}
                  </button>
                ) : (
                  <span className="text-texte-discret">{partie}</span>
                )}
              </span>
            );
          })}
        </nav>
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
        {noeud.elements.length > 0 && (
          <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {noeud.elements.map((element) => (
              <button key={element.id} type="button" onClick={() => ouvrirElement(element.id)} className="rounded-xl border border-bordure bg-surface p-4 text-left hover:border-primaire/40 cursor-pointer transition-colors">
                <span className="text-[0.6875rem] text-texte-discret">{element.typeLibelle}</span>
                <span className="mt-1 block text-sm font-semibold">{element.titre}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}