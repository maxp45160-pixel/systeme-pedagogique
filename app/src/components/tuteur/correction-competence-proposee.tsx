"use client";

import { useId, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { composerIntitule, OBJET_MAX, PRECISION_MAX, VERBES_ACTION } from "@/lib/domain/atomicite";
import type { CompetenceProposeeDepot } from "@/lib/documents/depot";
import { validerCorrectionsClassement, type CorrectionCompetenceClassement } from "@/lib/documents/corrections-classement";

type Props = {
  proposition: Extract<CompetenceProposeeDepot, { mode: "nouvelle" }>;
  correction?: CorrectionCompetenceClassement;
  indice: number;
  disabled: boolean;
  onConserver: (correction: CorrectionCompetenceClassement | undefined) => Promise<void>;
};

/** Une correction déclarée ; la citation d'origine reste consultable et inchangée. */
export function CorrectionCompetenceProposee({ proposition, correction, indice, disabled, onConserver }: Props) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [structure, setStructure] = useState(correction ?? { indice, verbeAction: proposition.verbeAction, objet: proposition.objet, precision: proposition.precision });
  const [erreur, setErreur] = useState<string | null>(null);
  let refus: string | null = null;
  try { validerCorrectionsClassement([{ ...structure, indice }]); }
  catch (incident) { refus = incident instanceof Error ? incident.message : "Intitulé invalide."; }
  const ouvrir = () => {
    setStructure(correction ?? { indice, verbeAction: proposition.verbeAction, objet: proposition.objet, precision: proposition.precision });
    setErreur(null); setOuvert(true);
  };
  async function conserver(valeur: CorrectionCompetenceClassement | undefined) {
    setErreur(null);
    try { await onConserver(valeur); setOuvert(false); }
    catch (incident) { setErreur(incident instanceof Error ? incident.message : "La correction n’a pas été conservée. Réessayez sans relancer l’analyse."); }
  }
  if (!ouvert) return <Bouton type="button" taille="petite" variante="discret" disabled={disabled} aria-label={`Corriger ${correction ? composerIntitule(correction) : proposition.intitule}`} onClick={ouvrir}>Corriger l’intitulé</Bouton>;
  return <fieldset disabled={disabled} className="mt-2 space-y-3 rounded-lg bg-fond p-3">
    <legend className="text-sm font-medium">Corriger l’intitulé</legend>
    <p className="text-xs text-texte-attenue">Proposition d’origine : {proposition.intitule}. Votre correction sera conservée sans relancer l’analyse ; elle ne crée aucune compétence avant confirmation.</p>
    {proposition.sources.map((source, i) => <blockquote key={i} className="border-l-2 border-bordure pl-3 text-xs text-texte-attenue">{source.citation}{source.page ? ` — page PDF ${source.page}` : ""}</blockquote>)}
    <label htmlFor={`${id}-verbe`} className="block text-sm">Geste demandé</label>
    <select id={`${id}-verbe`} className="w-full rounded border border-bordure bg-surface p-2 text-sm" value={structure.verbeAction} onChange={(e) => setStructure({ ...structure, verbeAction: e.target.value })}>{VERBES_ACTION.map((verbe) => <option key={verbe} value={verbe}>{verbe}</option>)}</select>
    <label htmlFor={`${id}-objet`} className="block text-sm">Objet du geste</label>
    <input id={`${id}-objet`} className="w-full rounded border border-bordure bg-surface p-2 text-sm" value={structure.objet} maxLength={OBJET_MAX} onChange={(e) => setStructure({ ...structure, objet: e.target.value })} />
    <label htmlFor={`${id}-precision`} className="block text-sm">Précision facultative</label>
    <input id={`${id}-precision`} className="w-full rounded border border-bordure bg-surface p-2 text-sm" value={structure.precision ?? ""} maxLength={PRECISION_MAX} onChange={(e) => setStructure({ ...structure, precision: e.target.value })} />
    <p className="text-sm" aria-live="polite">{composerIntitule(structure)}</p>
    {refus && <p className="text-xs text-danger">{refus}</p>}
    {erreur && <p role="alert" className="text-sm text-danger">{erreur}</p>}
    <div className="flex flex-wrap gap-2">
      <Bouton type="button" taille="petite" disabled={disabled || Boolean(refus)} onClick={() => void conserver({ ...structure, indice })}>Conserver la correction</Bouton>
      <Bouton type="button" taille="petite" variante="discret" disabled={disabled} onClick={() => setOuvert(false)}>Annuler</Bouton>
      {correction && <Bouton type="button" taille="petite" variante="discret" disabled={disabled} onClick={() => void conserver(undefined)}>Revenir à la proposition d’origine</Bouton>}
    </div>
  </fieldset>;
}
