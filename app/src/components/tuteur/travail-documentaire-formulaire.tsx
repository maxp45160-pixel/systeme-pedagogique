"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { INTERVENTION_TYPES, type InterventionType } from "@/lib/domain/intervention-seance";
import { LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE, MAX_NOTE_TRAVAIL_DOCUMENTAIRE, MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE } from "@/lib/domain/travail-documentaire";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { enregistrerTravailDocumentaireAction } from "@/lib/store/travail-documentaire-actions";

export function TravailDocumentaireFormulaire({ depots, occupe }: { depots: DepotDocumentaire[]; occupe: boolean }) {
  const [selection, setSelection] = useState<string[]>([]);
  const [geste, setGeste] = useState<InterventionType | "">("");
  const [note, setNote] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const cleEnCours = useRef<string | null>(null);
  const selectionValide = selection.filter((id) => depots.some((depot) => depot.id === id));

  function modifierSaisie() {
    setSessionId(null);
    setErreur(null);
    cleEnCours.current = null;
  }

  async function enregistrer() {
    if (occupe || enregistrement || sessionId || !geste || !selectionValide.length) return;
    const cle = cleEnCours.current ?? crypto.randomUUID();
    cleEnCours.current = cle;
    setEnregistrement(true);
    setErreur(null);
    try {
      const resultat = await enregistrerTravailDocumentaireAction({ documentIds: selectionValide, geste, note, cle });
      setSessionId(resultat.sessionId);
    } catch (incident) {
      setErreur(incident instanceof Error ? incident.message : "Le travail n’a pas pu être enregistré. Réessayez pour vérifier la même opération.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (!depots.length) return null;
  return <section aria-labelledby="travail-documentaire-titre" className="space-y-4 rounded-lg border border-bordure p-4">
    <div className="space-y-1">
      <h2 id="travail-documentaire-titre" className="text-base font-semibold">Conserver mon travail d’aujourd’hui</h2>
      <p className="text-xs text-texte-attenue">Indiquez le geste réellement effectué et les documents utilisés. Ce souvenir ne mesure pas votre maîtrise.</p>
    </div>
    <fieldset disabled={occupe || enregistrement || Boolean(sessionId)} className="space-y-2">
      <legend className="text-sm font-medium">Documents utilisés</legend>
      {depots.length > 1 && <Bouton type="button" variante="discret" taille="petite" onClick={() => { modifierSaisie(); setSelection(depots.slice(0, MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE).map((depot) => depot.id)); }}>Sélectionner les documents affichés</Bouton>}
      {depots.map((depot) => <label key={depot.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-primaire" checked={selectionValide.includes(depot.id)} disabled={!selectionValide.includes(depot.id) && selectionValide.length >= MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE} onChange={(event) => { modifierSaisie(); setSelection(event.target.checked ? [...new Set([...selectionValide, depot.id])] : selectionValide.filter((id) => id !== depot.id)); }} /><span className="break-words">{depot.titre}</span></label>)}
      {depots.length > MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE && <p className="text-xs text-texte-attenue">Choisissez jusqu’à {MAX_RESSOURCES_TRAVAIL_DOCUMENTAIRE} documents pour cette activité.</p>}
    </fieldset>
    <label className="block space-y-1.5 text-sm"><span className="font-medium">Ce que vous avez fait</span><select className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={geste} disabled={occupe || enregistrement || Boolean(sessionId)} onChange={(event) => { modifierSaisie(); setGeste(event.target.value as InterventionType | ""); }}><option value="">Choisir un geste</option>{INTERVENTION_TYPES.map((type) => <option key={type} value={type}>{LIBELLES_GESTES_TRAVAIL_DOCUMENTAIRE[type]}</option>)}</select></label>
    <label className="block space-y-1.5 text-sm"><span className="font-medium">Précision personnelle, facultative</span><textarea className="min-h-20 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={note} maxLength={MAX_NOTE_TRAVAIL_DOCUMENTAIRE} disabled={occupe || enregistrement || Boolean(sessionId)} onChange={(event) => { modifierSaisie(); setNote(event.target.value); }} placeholder="Ex. J’ai repris le chapitre sur les probabilités conditionnelles." /></label>
    <Bouton type="button" variante="secondaire" taille="petite" disabled={occupe || enregistrement || Boolean(sessionId) || !geste || !selectionValide.length} onClick={() => void enregistrer()}>{enregistrement ? "Enregistrement…" : "Enregistrer ce travail"}</Bouton>
    {sessionId && <div className="space-y-2"><p role="status" className="text-sm">Travail conservé avec {selectionValide.length} document{selectionValide.length > 1 ? "s" : ""}. <Link className="text-primaire underline" href="/seances">Le retrouver dans mon cahier</Link></p><Bouton type="button" variante="discret" taille="petite" onClick={() => { setSelection([]); setGeste(""); setNote(""); modifierSaisie(); }}>Déclarer une autre activité</Bouton></div>}
    {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
  </section>;
}
