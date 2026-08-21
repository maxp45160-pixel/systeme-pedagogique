"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui/primitives";
import {
  archiverDocumentAction,
  restaurerDocumentAction,
  supprimerDocumentAction,
} from "@/lib/store/document-actions";
import { IconeDocuments, IconeFleche } from "@/components/ui/icones";
import { estATrier } from "@/lib/documents/rangement-atelier";
import {
  BoutonRestaurationCarte,
  BoutonSuppressionCarte,
  ModaleConfirmationSuppression,
} from "./modale-confirmation-suppression";
import { type VueAtelier } from "./vues-synthese-atelier";
import type { ElementAtelier } from "./types-atelier";

const CLASSE_CARTE =
  "flex h-full w-full min-h-[170px] flex-col justify-between rounded-2xl border border-bordure bg-surface p-5 text-left shadow-[var(--ombre-posee)] transition-all duration-200 hover:-translate-y-1 hover:border-primaire/40 hover:shadow-[var(--ombre-levee)] cursor-pointer";

/**
 * Les ressources — cours, papiers, notes, projets, séances.
 */
export function VueRessources({
  elements,
  ouvrirElement,
  competencesParCode,
  statut = "actifs",
  onArchiver,
  onRestaurer,
  onSupprimer,
}: {
  elements: ElementAtelier[];
  ouvrirElement: (id: string) => void;
  changerVue: (vue: VueAtelier) => void;
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  statut?: "actifs" | "archives";
  onArchiver?: (docId: string) => void;
  onRestaurer?: (docId: string) => void;
  onSupprimer?: (docId: string) => void;
}) {
  const router = useRouter();
  const [ressourceAArchiver, setRessourceAArchiver] = useState<ElementAtelier | null>(null);
  const [ressourceARestaurer, setRessourceARestaurer] = useState<ElementAtelier | null>(null);
  const [ressourceASupprimer, setRessourceASupprimer] = useState<ElementAtelier | null>(null);

  const estArchives = statut === "archives";

  const { aTrier, rattachees, archivees } = useMemo(() => {
    const ressources = elements
      .filter((element) => element.rangement.zone === "ressource")
      .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

    if (estArchives) {
      return {
        aTrier: [],
        rattachees: [],
        archivees: ressources.filter((element) => Boolean(element.frontMatter.archive)),
      };
    }

    const actives = ressources.filter((element) => !element.frontMatter.archive);
    return {
      aTrier: actives.filter((element) => estATrier(element.rangement)),
      rattachees: actives.filter((element) => !estATrier(element.rangement)),
      archivees: [],
    };
  }, [elements, estArchives]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2/30">
      <div className="space-y-8 p-5 sm:p-6 lg:p-8">
        {estArchives ? (
          <section>
            {archivees.length > 0 && (
              <div className="mb-6 rounded-xl border border-bordure bg-surface p-4 text-xs text-texte-attenue shadow-xs">
                <p className="font-semibold text-texte">Ressources archivées</p>
                <p className="mt-1 leading-relaxed text-texte-discret">
                  Ces ressources sont retirées du flux actif. Vous pouvez les restaurer dans vos ressources de travail ou les supprimer définitivement.
                </p>
              </div>
            )}

            {archivees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-bordure bg-surface/40 p-8 text-center">
                <p className="font-serif text-sm font-semibold text-texte">Aucune ressource archivée</p>
                <p className="mt-1 text-xs text-texte-discret">
                  Toutes vos ressources sont actuellement actives.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archivees.map((element) => (
                  <CarteRessource
                    key={element.id}
                    element={element}
                    competencesParCode={competencesParCode}
                    ouvrirElement={ouvrirElement}
                    onRestaurer={() => setRessourceARestaurer(element)}
                    onSupprimer={() => setRessourceASupprimer(element)}
                    libelleAction="Ouvrir la ressource"
                    estArchive
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {aTrier.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg font-medium text-texte">À trier</h3>
                  <span className="chiffres text-xs text-texte-discret">{aTrier.length}</span>
                </div>
                <p className="mt-1 text-xs text-texte-attenue">
                  Ces ressources ne servent encore aucune compétence. Ouvre-les pour les rattacher.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {aTrier.map((element) => (
                    <CarteRessource
                      key={element.id}
                      element={element}
                      competencesParCode={competencesParCode}
                      ouvrirElement={ouvrirElement}
                      onArchiver={() => setRessourceAArchiver(element)}
                      libelleAction="Ouvrir la ressource"
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              {aTrier.length > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg font-medium text-texte">Rattachées</h3>
                  <span className="chiffres text-xs text-texte-discret">{rattachees.length}</span>
                </div>
              )}
              {rattachees.length === 0 ? (
                <p
                  className={cx(
                    aTrier.length > 0 && "mt-4",
                    "rounded-2xl border border-dashed border-bordure bg-surface/40 p-6 text-center text-xs text-texte-attenue",
                  )}
                >
                  {aTrier.length > 0
                    ? "Aucune ressource rattachée pour l’instant."
                    : "Aucune ressource pour l’instant."}
                </p>
              ) : (
                <div
                  className={cx(
                    aTrier.length > 0 && "mt-4",
                    "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  {rattachees.map((element) => (
                    <CarteRessource
                      key={element.id}
                      element={element}
                      competencesParCode={competencesParCode}
                      ouvrirElement={ouvrirElement}
                      onArchiver={() => setRessourceAArchiver(element)}
                      libelleAction="Ouvrir"
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {ressourceAArchiver && (
        <ModaleConfirmationSuppression
          titre="Archiver la ressource"
          nomElement={ressourceAArchiver.titre}
          typeElement="document"
          mode="archivage"
          explication="Cette ressource sera retirée de vos ressources actives et rangée dans vos archives. Vous pourrez la restaurer à tout moment."
          texteBoutonConfirmer="Confirmer l’archivage"
          onConfirmer={async () => {
            const id = ressourceAArchiver.id;
            onArchiver?.(id);
            setRessourceAArchiver(null);
            await archiverDocumentAction(id);
            router.refresh();
          }}
          onFermer={() => setRessourceAArchiver(null)}
        />
      )}

      {ressourceARestaurer && (
        <ModaleConfirmationSuppression
          titre="Restaurer la ressource"
          nomElement={ressourceARestaurer.titre}
          typeElement="document"
          mode="restauration"
          explication="Cette ressource sera réintégrée dans vos ressources actives."
          texteBoutonConfirmer="Restaurer"
          onConfirmer={async () => {
            const id = ressourceARestaurer.id;
            onRestaurer?.(id);
            setRessourceARestaurer(null);
            await restaurerDocumentAction(id);
            router.refresh();
          }}
          onFermer={() => setRessourceARestaurer(null)}
        />
      )}

      {ressourceASupprimer && (
        <ModaleConfirmationSuppression
          titre="Supprimer définitivement la ressource"
          nomElement={ressourceASupprimer.titre}
          typeElement="document"
          mode="suppression"
          explication="Cette ressource et ses fichiers joints seront définitivement effacés de votre compte."
          texteBoutonConfirmer="Supprimer définitivement"
          onConfirmer={async () => {
            const id = ressourceASupprimer.id;
            onSupprimer?.(id);
            setRessourceASupprimer(null);
            await supprimerDocumentAction(id);
            router.refresh();
          }}
          onFermer={() => setRessourceASupprimer(null)}
        />
      )}
    </div>
  );
}

function CarteRessource({
  element,
  competencesParCode,
  ouvrirElement,
  onArchiver,
  onRestaurer,
  onSupprimer,
  libelleAction,
  estArchive = false,
}: {
  element: ElementAtelier;
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  ouvrirElement: (id: string) => void;
  onArchiver?: () => void;
  onRestaurer?: () => void;
  onSupprimer?: () => void;
  libelleAction: string;
  estArchive?: boolean;
}) {
  const rattachements = element.rangement.rattachements;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => ouvrirElement(element.id)}
        className={cx(CLASSE_CARTE, estArchive && "opacity-90 hover:opacity-100")}
      >
        <div>
          <div className="flex items-center justify-between gap-3 pr-16">
            <span
              className={cx(
                "grid size-9 place-items-center rounded-xl",
                estArchive
                  ? "bg-surface-3 text-texte-discret"
                  : "bg-primaire-faible text-primaire",
              )}
            >
              <IconeDocuments className="size-4.5" />
            </span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-medium text-texte-discret">
              {estArchive ? `${element.typeLibelle} archivé` : element.typeLibelle}
            </span>
          </div>
          <h3 className="mt-3.5 font-serif text-sm font-semibold leading-snug text-texte transition-colors group-hover:text-primaire">
            {element.titre}
          </h3>
          {rattachements.length > 0 ? (
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
          ) : (
            !estArchive && (
              <p className="mt-2.5 text-[0.6875rem] text-texte-discret italic">
                Non rattachée
              </p>
            )
          )}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-bordure/60 pt-3 text-xs text-texte-discret">
          <span className="font-medium text-primaire group-hover:underline">{libelleAction}</span>
          <IconeFleche className="size-3.5 text-texte-discret transition-colors group-hover:text-primaire" />
        </div>
      </button>

      {estArchive ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {onRestaurer && (
            <BoutonRestaurationCarte
              titre={`Restaurer ${element.titre}`}
              className="static opacity-0 group-hover:opacity-80 hover:!opacity-100"
              onClick={onRestaurer}
            />
          )}
          {onSupprimer && (
            <BoutonSuppressionCarte
              titre={`Supprimer définitivement ${element.titre}`}
              className="static opacity-0 group-hover:opacity-80 hover:!opacity-100"
              onClick={onSupprimer}
            />
          )}
        </div>
      ) : (
        onArchiver && (
          <BoutonSuppressionCarte
            titre={`Archiver ${element.titre}`}
            onClick={onArchiver}
          />
        )
      )}
    </div>
  );
}
