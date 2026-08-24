"use client";

import { useState } from "react";
import { cx, classesLienBouton } from "@/components/ui/primitives";
import {
  IconeDocuments,
  IconeFermer,
  IconeValide,
  IconeFeuille,
} from "@/components/ui/icones";

interface Props {
  bilanMarkdown: string;
  nomApprenant?: string;
  dateExport: string;
}

export function ModaleExportBilan({
  bilanMarkdown,
  nomApprenant,
  dateExport,
}: Props) {
  const [estOuvert, setEstOuvert] = useState(false);
  const [aCopie, setACopie] = useState(false);

  const copierPressePapier = async () => {
    try {
      await navigator.clipboard.writeText(bilanMarkdown);
      setACopie(true);
      setTimeout(() => setACopie(false), 2500);
    } catch {
      // Fallback
    }
  };

  const imprimer = () => {
    window.print();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setEstOuvert(true)}
        className={cx(
          classesLienBouton("secondaire"),
          "inline-flex items-center gap-2 !py-1.5 !px-3 text-xs font-medium",
        )}
      >
        <IconeDocuments className="size-3.5" />
        <span>Exporter le bilan</span>
      </button>

      {estOuvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-modale-export"
          className="fixed inset-0 z-50 flex items-center justify-center bg-fond/80 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-carte border border-bordure bg-surface shadow-2xl">
            {/* En-tête */}
            <div className="flex items-center justify-between border-b border-bordure px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primaire-faible text-primaire">
                  <IconeFeuille className="size-4" />
                </div>
                <div>
                  <h3 id="titre-modale-export" className="font-serif text-base font-medium text-texte">
                    Bilan de compétences exportable
                  </h3>
                  <p className="text-xs text-texte-attenue">
                    Généré localement le {dateExport} {nomApprenant ? `pour ${nomApprenant}` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEstOuvert(false)}
                className="rounded p-1 text-texte-discret hover:bg-surface-2 hover:text-texte"
                aria-label="Fermer"
              >
                <IconeFermer className="size-4" />
              </button>
            </div>

            {/* Contenu Markdown Prévisualisé */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-lg border border-bordure bg-fond p-4 font-mono text-xs leading-relaxed text-texte selection:bg-primaire selection:text-primaire-contraste">
                <pre className="whitespace-pre-wrap font-mono">{bilanMarkdown}</pre>
              </div>
            </div>

            {/* Pied de page & actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure bg-surface-2 px-6 py-4">
              <p className="text-xs text-texte-discret">
                Format texte pur : compatible e-mail, dossier ou tuteur.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copierPressePapier}
                  className={cx(
                    classesLienBouton("secondaire"),
                    "!py-1.5 !px-3 text-xs",
                  )}
                >
                  {aCopie ? (
                    <>
                      <IconeValide className="size-3.5 text-valide" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <span>Copier en Markdown</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={imprimer}
                  className={cx(
                    classesLienBouton("principal"),
                    "!py-1.5 !px-3 text-xs",
                  )}
                >
                  <span>Imprimer / PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
