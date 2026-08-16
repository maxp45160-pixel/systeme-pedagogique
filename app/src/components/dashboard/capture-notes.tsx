"use client";

import { useState, useTransition, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { IconeArticle, IconeCours, IconeFleche, IconeNote } from "@/components/ui/icones";
import { Modale } from "@/components/ui/modale";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import type { RecommandationDocumentaire } from "@/lib/documents/recommandations";
import { erreurFichierPdf, televerserPdf } from "@/lib/documents/televersement-pdf";

/**
 * CaptureNotes reste l'entrée des notes de support.
 *
 * Un travail n'est pas une note que l'on saisit avant de commencer : il a son
 * propre parcours et peut produire une fiche ensuite. Garder les deux rôles
 * dans cette modale mélangeait une capture documentaire avec un geste de
 * travail.
 */
export function CaptureNotes({
  recommandations,
}: {
  recommandations: RecommandationDocumentaire[];
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [cible, setCible] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [format, setFormat] = useState(FORMATS_PAR_ROLE.support[0].valeur);
  const [contexte, setContexte] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [depotActif, setDepotActif] = useState(false);
  const [ficheCreeeId, setFicheCreeeId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const recommandationSelectionnee = cible && cible !== "autre"
    ? recommandations.find((recommandation) => recommandation.id === cible)
    : undefined;

  function ouvrir(cibleInitiale: string) {
    setOuverte(true);
    setCible(cibleInitiale);
    setTitre("");
    setFormat(
      recommandations.find((recommandation) => recommandation.id === cibleInitiale)?.format
        ?? FORMATS_PAR_ROLE.support[0].valeur,
    );
    setContexte("");
    setFichier(null);
    setFicheCreeeId(null);
    setErreur(null);
  }

  function choisirFichier(candidate: File | undefined) {
    if (!candidate) return;
    const message = erreurFichierPdf(candidate);
    if (message) {
      setFichier(null);
      setErreur(message);
      return;
    }
    setFichier(candidate);
    setErreur(null);
  }

  function lireFichier(event: ChangeEvent<HTMLInputElement>) {
    choisirFichier(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function deposerFichier(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDepotActif(false);
    choisirFichier(event.dataTransfer.files?.[0]);
  }

  function creer() {
    if (!titre.trim() || !contexte.trim() || ficheCreeeId) return;
    setErreur(null);
    demarrer(async () => {
      let ficheId: string | null = null;
      try {
        const fiche = await creerNoteAction("support", format, titre.trim(), {
          contexte,
          // Le classement de domaine est laissé au système ; une ressource
          // non encore classée reste transversalement accessible.
          domaine: "transversal",
        });
        ficheId = fiche.id;
        if (fichier) await televerserPdf(fiche.id, fichier);
        setOuverte(false);
        router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
        router.refresh();
      } catch (cause) {
        if (ficheId) setFicheCreeeId(ficheId);
        setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      }
    });
  }

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-texte">Renseigner une donnée</h3>
              <p className="text-xs text-texte-attenue mt-0.5">Enrichir le corpus documentaire & notes de support</p>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {recommandations.slice(0, 2).map((recommandation, index) => (
              <button
                key={recommandation.id}
                type="button"
                onClick={() => ouvrir(recommandation.id)}
                className="group flex flex-col justify-between rounded-xl border border-bordure bg-surface-2 p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-primaire-faible/25"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-texte group-hover:text-primaire min-w-0">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primaire-faible text-primaire shrink-0">
                      {recommandation.format === "article" ? (
                        <IconeArticle className="size-3.5" />
                      ) : (
                        <IconeCours className="size-3.5" />
                      )}
                    </span>
                    <span className="truncate">{recommandation.intitule}</span>
                  </span>
                  <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire shrink-0" />
                </div>
                <p className="mt-2 text-xs text-texte-discret line-clamp-2">
                  Piste {index + 1} · {recommandation.description}
                </p>
              </button>
            ))}

            {recommandations.length === 0 && (
              <div className="rounded-xl border border-bordure bg-surface-2 p-3.5 text-xs text-texte-discret">
                Corpus documentaire à jour.
              </div>
            )}

            <button
              type="button"
              onClick={() => ouvrir("autre")}
              className={cx(
                "group flex items-center justify-between rounded-xl border border-dashed border-bordure-contraste bg-surface p-3.5 text-left transition-all hover:border-primaire/40 hover:bg-primaire-faible/25",
                recommandations.length < 2 && "col-span-1 sm:col-span-2",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-texte group-hover:text-primaire">
                <span className="flex size-6 items-center justify-center rounded-md bg-surface-2 text-texte-discret group-hover:text-primaire shrink-0">
                  <IconeNote className="size-3.5" />
                </span>
                Autre note ou document support
              </span>
              <IconeFleche className="size-3 text-texte-discret transition-transform group-hover:translate-x-0.5 group-hover:text-primaire shrink-0" />
            </button>
          </div>
        </div>
      </Carte>



      {ouverte && (
        <Modale
          titre="Nouvelle donnée"
          sousTitre="Cette fiche enrichit ton contexte documentaire ; elle ne mesure aucune compétence."
          largeur="md"
          onFermer={() => setOuverte(false)}
          pied={
            <>
              {ficheCreeeId ? (
                <Bouton
                  variante="principal"
                  onClick={() => router.push(`/atelier?note=${encodeURIComponent(ficheCreeeId)}`)}
                >
                  Ouvrir la fiche
                </Bouton>
              ) : (
                <>
                  <Bouton variante="secondaire" onClick={() => setOuverte(false)}>Annuler</Bouton>
                  <Bouton
                    variante="principal"
                    onClick={creer}
                    disabled={!titre.trim() || !contexte.trim()}
                    enChargement={enCours}
                    className={cx(enCours && "pointer-events-none")}
                  >
                    Créer et ouvrir
                  </Bouton>
                </>
              )}
            </>
          }
        >
          <div className="space-y-4">
            {recommandationSelectionnee && (
              <div className="rounded-lg border border-primaire/35 bg-primaire-faible/35 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primaire">Piste choisie</p>
                <p className="mt-1 text-sm font-medium">{recommandationSelectionnee.intitule}</p>
                <p className="mt-1 text-xs text-texte-discret">Format : {recommandationSelectionnee.formatLibelle}</p>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Titre</span>
              <input
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") creer(); }}
                placeholder="Ex. Notes sur la théorie des files"
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Contexte</span>
              <input
                value={contexte}
                onChange={(event) => setContexte(event.target.value)}
                placeholder="Ex. Cours suivi, projet professionnel, curiosité personnelle…"
                maxLength={200}
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
              />
            </label>
            {cible === "autre" ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Type de donnée</span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm"
                >
                  {FORMATS_PAR_ROLE.support.map((option) => (
                    <option key={option.valeur} value={option.valeur}>{option.libelle}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Format classé automatiquement</p>
                <p className="mt-1 font-medium">
                  {recommandationSelectionnee?.formatLibelle ?? FORMATS_PAR_ROLE.support.find((option) => option.valeur === format)?.libelle}
                </p>
              </div>
            )}
            <div
              className={cx(
                "rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
                depotActif ? "border-primaire bg-primaire-faible/35" : "border-bordure-contraste bg-surface-2/50",
              )}
              onDragEnter={(event) => { event.preventDefault(); setDepotActif(true); }}
              onDragOver={(event) => { event.preventDefault(); setDepotActif(true); }}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDepotActif(false);
              }}
              onDrop={deposerFichier}
            >
              <input id="capture-pdf" type="file" accept="application/pdf,.pdf" onChange={lireFichier} className="sr-only" />
              <label htmlFor="capture-pdf" className="cursor-pointer text-sm font-medium hover:text-primaire">
                {fichier ? fichier.name : "Dépose un PDF ici ou choisis un fichier"}
              </label>
              <p className="mt-1 text-xs text-texte-discret">PDF uniquement · 10 Mo maximum · facultatif</p>
              {fichier && (
                <button
                  type="button"
                  onClick={() => setFichier(null)}
                  className="mt-2 text-xs text-danger hover:underline"
                >
                  Retirer le PDF
                </button>
              )}
            </div>
            {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
          </div>
        </Modale>
      )}
    </>
  );
}
