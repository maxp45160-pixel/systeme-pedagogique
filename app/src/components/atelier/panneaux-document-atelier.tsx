"use client";

import Link from "next/link";
import type { ElementAtelier } from "./types-atelier";

/**
 * Panneau latéral spécialisé pour les projections d'exercice.
 *
 * Remplace les métadonnées techniques brutes par les informations utiles :
 *  - Le domaine de rattachement (avec lien direct cliquable).
 *  - Les compétences cibles (avec code, intitulé et lien direct cliquable).
 *  - L'historique des tentatives réalisées.
 *  - Le raccourci principal pour s'exercer dans le cahier.
 */
export function PanneauExerciceAtelier({
  element,
  elements,
  ouvrirElement,
}: {
  element: ElementAtelier;
  elements: ElementAtelier[];
  ouvrirElement: (id: string) => void;
}) {
  /*
   * Le domaine se lit sur l'élément, plus dans son chemin de dossier.
   *
   * On le déduisait en découpant `Domaines/Algèbre/Exercices` et en cherchant
   * un domaine dont le **nom** correspondait au segment du milieu : deux
   * domaines homonymes, ou un domaine renommé, et le lien tombait à côté.
   * `domaineId` est celui que porte l'exercice en base.
   */
  const domaineId = element.rangement.domaineId ?? element.domaineId;
  const domaineEl = domaineId
    ? elements.find(
        (el) => el.type === "domaine" && el.vuePedagogique?.kind === "domaine" && el.vuePedagogique.id === domaineId,
      )
    : null;
  const nomDomaine =
    domaineEl?.vuePedagogique?.kind === "domaine" ? domaineEl.vuePedagogique.nom : domaineId;

  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texte-attenue">
          Domaine de rattachement
        </h2>
        {domaineEl ? (
          <button
            type="button"
            onClick={() => ouvrirElement(domaineEl.id)}
            className="mt-2 block w-full rounded-lg border border-bordure bg-surface p-3 text-left transition-colors hover:border-primaire hover:bg-surface-2 cursor-pointer"
          >
            <span className="block text-xs font-semibold text-primaire">Voir le domaine →</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-texte">
              {(domaineEl.vuePedagogique?.kind === "domaine" ? domaineEl.vuePedagogique.nom : undefined) ?? domaineEl.titre}
            </span>
          </button>
        ) : (
          <p className="mt-2 text-xs text-texte-discret">{nomDomaine ?? "Non spécifié"}</p>
        )}
      </div>

      {(() => {
        const sortantsElements = element.sortants.map((code) => ({
          code,
          compEl: elements.find((el) => el.id === code),
        }));
        const competencesCibles = sortantsElements.filter(({ code, compEl }) => {
          return compEl?.type === "competence" || (!code.startsWith("preuve-") && !code.startsWith("exercice:") && !code.startsWith("note-") && !code.startsWith("document:") && !code.startsWith("theme:") && !code.startsWith("domaine:"));
        });
        const documentsAssocies = sortantsElements.filter(({ code }) => !competencesCibles.some((c) => c.code === code));

        return (
          <>
            <div className="border-t border-bordure pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-texte-attenue">Compétences cibles</h3>
                <span className="text-[0.6875rem] text-texte-discret">{competencesCibles.length}</span>
              </div>
              {competencesCibles.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {competencesCibles.map(({ code, compEl }) => (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => ouvrirElement(code)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primaire hover:bg-surface-2 cursor-pointer"
                      >
                        <span className="font-mono text-[0.6875rem] font-semibold text-primaire">{code}</span>
                        <span className="truncate flex-1 font-medium text-texte">{compEl?.titre ?? code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-texte-discret">Aucune compétence directement ciblée.</p>
              )}
            </div>

            {documentsAssocies.length > 0 && (
              <div className="border-t border-bordure pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold text-texte-attenue">Documents et preuves associés</h3>
                  <span className="text-[0.6875rem] text-texte-discret">{documentsAssocies.length}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {documentsAssocies.map(({ code, compEl }) => (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => ouvrirElement(code)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-bordure bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primaire hover:bg-surface-2 cursor-pointer"
                      >
                        <span className="truncate flex-1 font-medium text-texte">{compEl?.titre ?? code}</span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                          {compEl?.typeLibelle ?? (code.startsWith("preuve-") ? "Preuve" : "Document")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
      })()}

      <div className="border-t border-bordure pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-texte-attenue">Tentatives réalisées</h3>
          <span className="text-[0.6875rem] text-texte-discret">{element.tentatives.length}</span>
        </div>
        {element.tentatives.length === 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-texte-discret">
            Aucune tentative enregistrée. S’exercer dans le cahier générera la première preuve.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {element.tentatives.map((tentative) => (
              <li key={tentative.id} className="rounded-md border border-bordure bg-surface px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {tentative.resultat === "reussi" ? "Réussi" : tentative.resultat === "echec" ? "Échec" : "Partiel"}
                  </span>
                  <span className="text-[0.6875rem] text-texte-discret">
                    {new Date(tentative.fin ?? tentative.debut).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.6875rem] text-texte-discret">
                  <span>{tentative.statut === "terminee" ? "Terminée" : tentative.statut === "abandonnee" ? "Abandonnée" : "En cours"}</span>
                  {tentative.dureeMin !== undefined && <span>{tentative.dureeMin} min</span>}
                  <span>{tentative.indicesUtilises} indice{tentative.indicesUtilises > 1 ? "s" : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-bordure pt-4">
        <Link
          href={`/exercices/${element.id.replace(/^exercice:/, "")}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primaire px-4 py-2.5 text-xs font-semibold text-texte-inverse shadow hover:bg-primaire-survol transition-colors"
        >
          <span>S’exercer dans le cahier</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}