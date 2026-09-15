"use client";
import { useRef, useState, type DragEvent } from "react";
import { depuisSelection, depuisDepotGlisse, fusionnerImports, identiteImport, type FichierImport } from "@/lib/documents/import-depot";
import { recevoirFichierDepot, type ReceptionFichierDepot } from "@/lib/documents/recevoir-fichier-depot";
import { creerRessourceDepotAction } from "@/lib/store/depot-actions";
import { MAX_NOTE_DEPOT } from "@/lib/documents/depot";
import { Bouton } from "@/components/ui/primitives";
import { IconePlus, IconeFermer, IconeDossier } from "@/components/ui/icones";

export function usePiecesConversation(onConserver?: (texte: string, recu: string, ressources: string[]) => void) {
  const [fichiers, setFichiers] = useState<ReceptionFichierDepot[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [survol, setSurvol] = useState(false);
  const verrou = useRef(false);
  const note = useRef<{ texte: string; cle: string; id?: string } | null>(null);
  const selection = useRef<HTMLInputElement>(null);
  const dossier = useRef<HTMLInputElement>(null);

  function ajouter(ajouts: FichierImport[]) {
    const resultat = fusionnerImports(fichiers, ajouts);
    setFichiers(resultat.fichiers.map((f) => fichiers.find((ancien) => identiteImport(ancien) === identiteImport(f)) ?? { ...f, etat: "attente" }));
    setErreurs(resultat.refuses);
  }
  async function deposer(e: DragEvent) {
    e.preventDefault(); setSurvol(false);
    if (verrou.current) return;
    try { ajouter(await depuisDepotGlisse(e.dataTransfer)); }
    catch { setErreurs(["Ce dépôt n'a pas pu être lu. Choisissez les fichiers avec le bouton Joindre."]); }
  }
  async function envoyer(texte: string): Promise<boolean> {
    if (verrou.current || !onConserver) return false;
    if (texte.length > MAX_NOTE_DEPOT) { setErreurs(["Le texte joint est trop long pour être conservé comme note."]); return false; }
    verrou.current = true; setOccupe(true); setErreurs([]);
    const ressources: string[] = [];
    let noteSauvee = false;
    const echecs: string[] = [];
    try {
      if (texte.trim()) {
        if (note.current?.texte !== texte) note.current = { texte, cle: crypto.randomUUID() };
        if (!note.current.id) {
          try {
            note.current.id = await creerRessourceDepotAction({ nature: "note", titre: texte.split(/\r?\n/)[0].slice(0,200), note: texte }, note.current.cle);
            noteSauvee = true;
            ressources.push(note.current.id);
          } catch { echecs.push("La note n'a pas pu être conservée. Son texte reste dans la saisie."); }
        }
      }
      for (const fichier of fichiers) {
        if (fichier.etat === "recu") continue;
        try {
          const id = await recevoirFichierDepot(fichier);
          ressources.push(id);
        } catch (e) {
          fichier.etat = "echec";
          fichier.erreur = e instanceof Error ? e.message : "Enregistrement impossible.";
          echecs.push(`${fichier.relatif} : ${fichier.erreur}`);
        }
        setFichiers([...fichiers]);
      }
      if (ressources.length) onConserver(noteSauvee ? texte : "", `${ressources.length} ressource${ressources.length > 1 ? "s conservées" : " conservée"}. Vous pouvez lancer leur analyse ci-dessous.${echecs.length ? " Certains éléments restent à envoyer dans la saisie." : ""}`, ressources);
      setErreurs(echecs);
      if (!echecs.length) { setFichiers([]); note.current = null; return true; }
      return false;
    } finally { verrou.current = false; setOccupe(false); }
  }
  function interfacePieces(desactive: boolean) {
    return <>
      <input ref={selection} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" aria-label="Choisir des pièces jointes" onChange={(e) => { if (e.target.files) ajouter(depuisSelection(e.target.files)); e.target.value = ""; }} />
      <input ref={dossier} type="file" multiple {...{ webkitdirectory: "" }} className="hidden" aria-label="Choisir un dossier" onChange={(e) => { if (e.target.files) ajouter(depuisSelection(e.target.files)); e.target.value = ""; }} />
      <div className="flex gap-1">
        <Bouton taille="petite" variante="discret" disabled={desactive || occupe} onClick={() => selection.current?.click()}><IconePlus className="mr-1 size-4"/>Joindre</Bouton>
        <Bouton taille="petite" variante="discret" disabled={desactive || occupe} onClick={() => dossier.current?.click()} aria-label="Joindre un dossier"><IconeDossier className="size-4"/></Bouton>
      </div>
    </>;
  }
  const liste = <>
    {fichiers.length > 0 && <ul className="mb-3 max-h-36 overflow-y-auto text-xs" aria-label="Pièces jointes de ce message">{fichiers.map((f) => <li key={identiteImport(f)} className="flex items-center gap-2 rounded-md bg-fond px-2 py-1">
      <span className="min-w-0 flex-1 break-words">{f.relatif}{f.etat === "recu" ? " · Conservé" : f.etat === "echec" ? " · À réessayer" : ""}</span>
      {!f.documentId && <button type="button" className="p-2" disabled={occupe} aria-label={`Retirer ${f.relatif}`} onClick={() => setFichiers(fichiers.filter((x) => x !== f))}><IconeFermer className="size-4"/></button>}
    </li>)}</ul>}
    {erreurs.length > 0 && <p role="alert" className="mb-2 text-xs text-danger">{erreurs.join(" ")}</p>}
  </>;
  return { fichiers, occupe, envoyer, interfacePieces, liste, survol, setSurvol, deposer };
}
