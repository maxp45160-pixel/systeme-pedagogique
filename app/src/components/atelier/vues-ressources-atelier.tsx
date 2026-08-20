"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import { ModaleTheme } from "@/components/seances/modale-theme";
import { retirerTheme } from "@/lib/store/theme-actions";
import { supprimerDocumentAction } from "@/lib/store/document-actions";
import { IconeTheme, IconeDocuments, IconeFleche } from "@/components/ui/icones";
import { estATrier } from "@/lib/documents/rangement-atelier";
import {
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "./modale-confirmation-suppression";
import { CarteCreationPointillee, type VueAtelier } from "./vues-synthese-atelier";
import type { ElementAtelier } from "./types-atelier";

const CLASSE_CARTE =
  "flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer";

/**
 * Les ressources — cours, papiers, notes, projets, séances.
 *
 * Une seule liste, coupée par la seule distinction qui change ce qu'on doit
 * faire : est-ce que cette ressource sert une compétence, ou est-ce qu'elle
 * attend encore qu'on le dise ? Les catégories transversales qui vivaient ici
 * — Compétences, Exercices, Observations, Documents — étaient un second référentiel
 * posé à côté du vrai : chaque compétence y apparaissait une seconde fois, et
 * les observations y occupaient la place des documents qu'on cherchait vraiment.
 */
export function VueRessources({
  elements,
  ouvrirElement,
  competencesParCode,
}: {
  elements: ElementAtelier[];
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
}) {
  const router = useRouter();
  const [elementASupprimer, setElementASupprimer] = useState<ElementAtelier | null>(null);

  const { aTrier, rattachees } = useMemo(() => {
    const ressources = elements
      .filter((element) => element.rangement.zone === "ressource")
      .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
    return {
      aTrier: ressources.filter((element) => estATrier(element.rangement)),
      rattachees: ressources.filter((element) => !estATrier(element.rangement)),
    };
  }, [elements]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <div className="space-y-8 p-5 sm:p-6 lg:p-8">
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-medium text-texte">À trier</h3>
            <span className="chiffres text-xs text-texte-discret">{aTrier.length}</span>
          </div>
          <p className="mt-1 text-xs text-texte-attenue">
            Ces ressources ne servent encore aucune compétence. Ouvre-les pour les rattacher.
          </p>
          {aTrier.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-bordure bg-surface/40 p-6 text-center text-xs text-texte-attenue">
              Rien en attente. Toutes tes ressources servent au moins une compétence.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {aTrier.map((element) => (
                <CarteRessource
                  key={element.id}
                  element={element}
                  competencesParCode={competencesParCode}
                  ouvrirElement={ouvrirElement}
                  onSupprimer={() => setElementASupprimer(element)}
                  libelleAction="Rattacher à une compétence"
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg font-medium text-texte">Rattachées</h3>
            <span className="chiffres text-xs text-texte-discret">{rattachees.length}</span>
          </div>
          {rattachees.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-bordure bg-surface/40 p-6 text-center text-xs text-texte-attenue">
              Aucune ressource rattachée pour l’instant.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rattachees.map((element) => (
                <CarteRessource
                  key={element.id}
                  element={element}
                  competencesParCode={competencesParCode}
                  ouvrirElement={ouvrirElement}
                  onSupprimer={() => setElementASupprimer(element)}
                  libelleAction="Ouvrir"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {elementASupprimer && (
        <ModaleConfirmationSuppression
          titre="Supprimer la ressource"
          nomElement={elementASupprimer.titre}
          typeElement="document"
          mode="suppression"
          explication="Cette ressource sera définitivement supprimée. Les compétences qu’elle servait ne changent pas."
          texteBoutonConfirmer="Confirmer la suppression"
          onConfirmer={async () => {
            await supprimerDocumentAction(elementASupprimer.id);
            setElementASupprimer(null);
            router.refresh();
          }}
          onFermer={() => setElementASupprimer(null)}
        />
      )}
    </div>
  );
}

function CarteRessource({
  element,
  competencesParCode,
  ouvrirElement,
  onSupprimer,
  libelleAction,
}: {
  element: ElementAtelier;
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  ouvrirElement: (id: string) => void;
  onSupprimer: () => void;
  libelleAction: string;
}) {
  const rattachements = element.rangement.rattachements;
  return (
    <div className="group relative">
      <button type="button" onClick={() => ouvrirElement(element.id)} className={CLASSE_CARTE}>
        <div>
          <div className="flex items-center justify-between gap-3 pr-8">
            <span className="grid size-9 place-items-center rounded-xl bg-primaire-faible text-primaire">
              <IconeDocuments className="size-4.5" />
            </span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-medium text-texte-discret">
              {element.typeLibelle}
            </span>
          </div>
          <h3 className="mt-3.5 font-serif text-sm font-semibold leading-snug text-texte transition-colors group-hover:text-primaire">
            {element.titre}
          </h3>
          {rattachements.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {rattachements.slice(0, 3).map((code) => (
                <li
                  key={code}
                  className="rounded-md bg-primaire-faible px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-primaire"
                  title={competencesParCode.get(code)?.intitule ?? code}
                >
                  {code}
                </li>
              ))}
              {rattachements.length > 3 && (
                <li className="chiffres text-[0.625rem] text-texte-discret">
                  +{rattachements.length - 3}
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
          <span className="font-medium text-primaire group-hover:underline">{libelleAction}</span>
          <IconeFleche className="size-3.5 text-texte-discret transition-colors group-hover:text-primaire" />
        </div>
      </button>
      <BoutonSuppressionCarte titre={`Supprimer ${element.titre}`} onClick={onSupprimer} />
    </div>
  );
}

/**
 * Les thèmes — des sélections de compétences, jamais des contenants.
 *
 * Un thème vivait dans `Transversal/Thèmes`, au même rang qu'un dossier de
 * documents, ce qui laissait croire qu'on pouvait y ranger des fiches. Il a sa
 * propre entrée : une liste de sélections, et rien d'autre.
 */
export function VueThemes({
  elements,
  ouvrirElement,
  compteId,
  competencesParCode,
  domainesExistants,
}: {
  elements: ElementAtelier[];
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
  compteId: string;
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
}) {
  const router = useRouter();
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [themeASupprimer, setThemeASupprimer] = useState<ElementAtelier | null>(null);

  const themes = useMemo(
    () =>
      elements
        .filter((element) => element.rangement.zone === "theme")
        .sort((a, b) => a.titre.localeCompare(b.titre, "fr")),
    [elements],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <div className="p-5 sm:p-6 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((element) => {
            const vue = element.vuePedagogique;
            const nombreCodes = vue?.kind === "theme" ? vue.competences.length : element.sortants.length;
            const intention = vue?.kind === "theme" ? vue.intention : undefined;
            return (
              <div key={element.id} className="group relative">
                <button type="button" onClick={() => ouvrirElement(element.id)} className={CLASSE_CARTE}>
                  <div>
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <span className="grid size-9 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent shadow-xs">
                        <IconeTheme className="size-4.5" />
                      </span>
                      {nombreCodes > 0 && (
                        <span className="chiffres text-xs font-medium text-texte-discret">
                          {nombreCodes} compétence{nombreCodes > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3.5 font-serif text-base font-semibold leading-snug text-texte transition-colors group-hover:text-primaire">
                      {element.titre}
                    </h3>
                    {intention && (
                      <p className="mt-2 line-clamp-2 font-serif text-xs italic leading-relaxed text-texte-attenue">
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
                  onClick={() => setThemeASupprimer(element)}
                />
              </div>
            );
          })}

          <CarteCreationPointillee
            titre="Nouveau thème"
            description="Réunir des compétences qui se travaillent ensemble"
            onClick={() => setModaleOuverte(true)}
          />
        </div>

        {themes.length === 0 && (
          <p className={cx("mt-6 text-center text-xs leading-relaxed text-texte-attenue")}>
            Un thème réunit des compétences qui se travaillent ensemble, même quand elles
            n’appartiennent pas au même domaine.
          </p>
        )}
      </div>

      {modaleOuverte && (
        <ModaleTheme
          compteId={compteId}
          competencesParCode={competencesParCode}
          domainesExistants={domainesExistants}
          onFermer={() => setModaleOuverte(false)}
          onCree={(theme) => {
            setModaleOuverte(false);
            router.refresh();
            ouvrirElement(`theme:${theme.id}`);
          }}
        />
      )}

      {themeASupprimer && (
        <ModaleConfirmationSuppression
          titre="Supprimer le thème"
          nomElement={themeASupprimer.titre}
          typeElement="theme"
          mode="suppression"
          explication="Le thème sera retiré. Les compétences qu’il réunissait ne changent pas."
          texteBoutonConfirmer="Confirmer la suppression"
          onConfirmer={async () => {
            await retirerTheme(themeASupprimer.id.replace(/^theme:/, ""));
            setThemeASupprimer(null);
            router.refresh();
          }}
          onFermer={() => setThemeASupprimer(null)}
        />
      )}
    </div>
  );
}
