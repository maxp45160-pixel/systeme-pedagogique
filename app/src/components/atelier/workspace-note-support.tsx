"use client";

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { CoquilleWorkspace } from "@/components/atelier/coquille-workspace";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { definitionTypeDocument, type PieceJointeDocument } from "@/lib/documents/types-documents";
import { lireValeursSections, mettreAJourSections } from "@/lib/documents/sections-markdown";
import { erreurFichierPdf, televerserPdf } from "@/lib/documents/televersement-pdf";
import { sauvegarderDocumentAction } from "@/lib/store/document-actions";

export interface WorkspaceNoteSupportProps {
  id: string;
  contenuInitial: string;
  updatedAtInitial?: string;
  piecesInitiales: PieceJointeDocument[];
}

const CONSIGNES_PAR_TYPE: Record<string, string> = {
  article: "Lis le papier, puis transforme sa lecture en fiche et en cas d’application.",
  cours: "Reprends le cours, structure ce qui est important et montre comment l’utiliser.",
  formule: "Explique les formules, leurs variables, puis applique-les à un cas concret.",
  reference: "Lis la référence, garde les passages utiles et montre quand t’y reporter.",
  livre: "Parcours les chapitres utiles et transforme la lecture en fiche exploitable.",
  note: "Clarifie cette note et transforme-la en ressource réutilisable.",
  reflexion: "Développe la réflexion et fais émerger une conclusion applicable.",
};

export function WorkspaceNoteSupport({
  id,
  contenuInitial,
  updatedAtInitial,
  piecesInitiales,
}: WorkspaceNoteSupportProps) {
  const analyse = useMemo(() => analyserDocumentMarkdown(id, contenuInitial), [id, contenuInitial]);
  const definition = analyse.type ? definitionTypeDocument(analyse.type) : null;
  const section = definition?.sections[0] ?? "Contenu";
  const [contenu, setContenu] = useState(contenuInitial);
  const [updatedAt, setUpdatedAt] = useState(updatedAtInitial);
  const [valeur, setValeur] = useState(() => lireValeursSections(contenuInitial, [section])[section] ?? "");
  const [pieces, setPieces] = useState(piecesInitiales);
  const [enregistrement, setEnregistrement] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const [depotActif, setDepotActif] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const estSupport = analyse.frontMatter.role === "support";

  async function enregistrer() {
    if (enregistrement || !estSupport) return;
    setEnregistrement(true);
    setMessage(null);
    setErreur(null);
    const contenuSuivant = mettreAJourSections(contenu, [section], { [section]: valeur });
    try {
      const resultat = await sauvegarderDocumentAction(id, contenuSuivant, false, updatedAt);
      setContenu(contenuSuivant);
      if (resultat) setUpdatedAt(resultat.updatedAt);
      setMessage("Fiche enregistrée.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "La fiche n’a pas pu être enregistrée.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function ajouterPdf(fichier: File | undefined) {
    if (!fichier || televersement || !estSupport) return;
    const messageErreur = erreurFichierPdf(fichier);
    if (messageErreur) {
      setErreur(messageErreur);
      return;
    }
    setTeleversement(true);
    setMessage(null);
    setErreur(null);
    try {
      const piece = await televerserPdf(id, fichier);
      setPieces((anciennes) => [piece, ...anciennes]);
      setMessage("PDF attaché à la ressource.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Le PDF n’a pas pu être attaché.");
    } finally {
      setTeleversement(false);
    }
  }

  function lireFichier(event: ChangeEvent<HTMLInputElement>) {
    void ajouterPdf(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function deposerFichier(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDepotActif(false);
    void ajouterPdf(event.dataTransfer.files?.[0]);
  }

  const consigne = CONSIGNES_PAR_TYPE[analyse.type ?? ""]
    ?? "Lis la ressource et transforme-la en fiche de travail exploitable.";

  return (
    <CoquilleWorkspace
      surtitre={definition ? `Fiche de travail · ${definition.libelle}` : "Fiche de travail"}
      titre={analyse.titre || "Ressource documentaire"}
      sortie={{ href: "/", libelle: "Retourner au tableau de bord" }}
    >
      {!estSupport ? (
        <div className="mx-auto max-w-3xl">
          <BandeauInfo ton="danger">
            <p>Cette fiche n’est pas une ressource documentaire éditable.</p>
          </BandeauInfo>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0 rounded-xl border border-bordure bg-surface-2 p-4 sm:p-6">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">Cas d’application</p>
            <h2 className="mt-2 font-serif text-2xl font-medium">Travaille cette ressource</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-texte-attenue">{consigne}</p>
            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Ta fiche de travail</span>
              <textarea
                value={valeur}
                onChange={(event) => { setValeur(event.target.value); setMessage(null); }}
                disabled={enregistrement}
                rows={24}
                className="mt-2 min-h-[32rem] w-full resize-y rounded-lg border border-bordure-controle bg-surface px-4 py-3 text-sm leading-relaxed outline-none focus:border-primaire"
                placeholder="Écris ici ce que tu comprends, les points importants et ton cas d’application…"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4">
              <p className="text-xs text-texte-discret">Le texte est enregistré dans la fiche documentaire.</p>
              <Bouton type="button" variante="principal" onClick={() => void enregistrer()} enChargement={enregistrement}>
                Enregistrer la fiche
              </Bouton>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-bordure bg-surface-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Ressource attachée</p>
              <div
                className={cx(
                  "mt-3 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
                  depotActif ? "border-primaire bg-primaire-faible/35" : "border-bordure-contraste",
                )}
                onDragEnter={(event) => { event.preventDefault(); setDepotActif(true); }}
                onDragOver={(event) => { event.preventDefault(); setDepotActif(true); }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setDepotActif(false);
                }}
                onDrop={deposerFichier}
              >
                <input id={`workspace-pdf-${id}`} type="file" accept="application/pdf,.pdf" onChange={lireFichier} className="sr-only" />
                <label htmlFor={`workspace-pdf-${id}`} className="cursor-pointer text-xs font-medium hover:text-primaire">
                  {televersement ? "Ajout du PDF…" : "Déposer ou choisir un PDF"}
                </label>
                <p className="mt-1 text-[0.6875rem] text-texte-discret">10 Mo maximum</p>
              </div>
              {pieces.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {pieces.map((piece) => (
                    <li key={piece.id}>
                      {piece.url ? (
                        <a href={piece.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-primaire hover:underline" title={piece.nom}>
                          {piece.nom}
                        </a>
                      ) : (
                        <span className="block truncate text-xs">{piece.nom}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="text-xs leading-relaxed text-texte-discret">La ressource reste dans l’Atelier. C’est un support de travail : ça ne compte pas comme un exercice.</p>
          </aside>
        </div>
      )}
      {erreur && <p className="mx-auto mt-4 max-w-3xl rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
      {message && !erreur && <p className="mx-auto mt-4 max-w-3xl text-xs text-succes" role="status">{message}</p>}
    </CoquilleWorkspace>
  );
}
