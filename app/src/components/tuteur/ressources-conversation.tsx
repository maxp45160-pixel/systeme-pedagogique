"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bouton } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/markdown";
import { lireRessourceAssistantAction } from "@/lib/store/ressource-assistant-actions";
import { completerRessourceAction } from "@/lib/store/completer-ressource-action";
import { derniereOrganisationDepot } from "@/lib/documents/organisation-depot";
import { bilanSelectionAnalyses, eurosDocumentaires, referencesRessourcesConversation } from "@/lib/documents/conversation-ressources";
import type { PreparationAnalyseDepot } from "@/lib/documents/depot";

import { lireConfigTuteur, type ConfigTuteurClient } from "@/lib/tutor/cle-client";

type Ressource = Awaited<ReturnType<typeof lireRessourceAssistantAction>>;
type Ligne = { id: string; ressource?: Ressource; preparation?: PreparationAnalyseDepot; erreur?: string; selectionnee: boolean };

async function preparerLigne(id: string, config: ConfigTuteurClient | null): Promise<Ligne> {
  const ressource = await lireRessourceAssistantAction(id);
  const reponse = await fetch(`/api/depot/analyser?${new URLSearchParams({ documentId: id, maximum: "20", ...(config?.fournisseur === "qwen" ? { fournisseur: "qwen" } : {}) })}`);
  if (!reponse.ok) return { id, ressource, erreur: "La préparation de l'analyse n'a pas abouti. Vos ressources sont conservées.", selectionnee: false };
  const preparation: PreparationAnalyseDepot = await reponse.json();
  return { id, ressource, preparation, selectionnee: preparation.disponible && preparation.analyseExistante?.statut !== "en-cours" };
}

/** Le compte rendu reste dans le fil visuel, jamais dans les messages envoyés au modèle du chat. */
export function RessourcesConversation({ compteId, references, onCorriger, revision = 0 }: { compteId: string; references: string[]; revision?: number; onCorriger?: (cible: { id: string; version: string; titre: string }) => void }) {
  const cle = referencesRessourcesConversation(references).join(",");
  return cle ? <RessourcesChargees key={cle} cle={cle} compteId={compteId} onCorriger={onCorriger} revision={revision} /> : null;
}

function RessourcesChargees({ compteId, cle, onCorriger, revision }: { compteId: string; cle: string; revision: number; onCorriger?: (cible: { id: string; version: string; titre: string }) => void }) {
  const configQwen = useCallback(() => { const c = lireConfigTuteur(compteId); return c?.fournisseur === "qwen" ? c : null; }, [compteId]);
  const [lignes, setLignes] = useState<Ligne[]>(() => cle.split(",").map((id) => ({ id, selectionnee: false })));
  const [occupe, setOccupe] = useState<string | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);
  const monte = useRef(true);
  const controleAnalyse = useRef<AbortController | null>(null);
  const revisionLue = useRef(0);
  useEffect(() => {
    if (!revision || revisionLue.current === revision || occupe) return;
    let actif = true;
    void (async () => {
      for (const id of cle.split(",")) {
        try {
          const ressource = await lireRessourceAssistantAction(id);
          if (actif) setLignes((avant) => avant.map((l) => l.id === id ? { ...l, ressource } : l));
        } catch { /* Actualiser reste disponible ; aucun résultat n'est supposé. */ }
      }
      if (actif) revisionLue.current = revision;
    })();
    return () => { actif = false; };
  }, [revision, occupe, cle]);

  useEffect(() => {
    let actif = true;
    monte.current = true;
    const ids = cle ? cle.split(",") : [];
    // Une seule lecture de PDF en vol : les dossiers volumineux ne saturent pas le serveur.
    void (async () => {
      for (const id of ids) {
        if (!actif) break;
        let ligne: Ligne;
        try { ligne = await preparerLigne(id, configQwen()); }
        catch { ligne = { id, selectionnee: false, erreur: "Impossible de relire cette ressource. Réessayez l'actualisation." }; }
        if (actif) setLignes((avant) => avant.map((l) => l.id === id ? ligne : l));
      }
    })();
    return () => { actif = false; monte.current = false; controleAnalyse.current?.abort(); };
  }, [cle, configQwen]);

  function remplacer(ligne: Ligne) {
    if (monte.current) setLignes((avant) => avant.map((l) => l.id === ligne.id ? ligne : l));
  }
  async function actualiser(id: string) {
    if (verrou.current) return;
    verrou.current = true; setOccupe("Je relis l'état enregistré…"); setErreur(null);
    try { remplacer(await preparerLigne(id, configQwen())); }
    catch { setErreur("L'état n'a pas pu être relu. Aucun appel IA n'a été lancé."); }
    finally { verrou.current = false; if (monte.current) setOccupe(null); }
  }
  async function reprendreRangement(ligne: Ligne) {
    const derniere = ligne.ressource && derniereOrganisationDepot(ligne.ressource.depot);
    if (verrou.current || !derniere) return;
    verrou.current = true; setOccupe("Je vérifie le rangement et les liens…"); setErreur(null);
    try {
      await completerRessourceAction(ligne.id, derniere.analyseId);
      remplacer(await preparerLigne(ligne.id, configQwen()));
    } catch { setErreur("Le rangement n'est pas confirmé. Actualisez puis reprenez le rangement ; aucune analyse payante n'est relancée."); }
    finally { verrou.current = false; if (monte.current) setOccupe(null); }
  }
  const selection = lignes.filter((l) => l.selectionnee && l.preparation?.disponible && l.preparation.analyseExistante?.statut !== "en-cours");
  const fournisseursCompatibles = new Set(selection.map((l) => l.preparation?.fournisseur ?? "mistral")).size <= 1;
  const montant = (n: number) => selection[0]?.preparation?.fournisseur === "qwen" ? (n / 1000000).toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 3 }) : eurosDocumentaires(n);
  const bilan = bilanSelectionAnalyses(selection.map((l) => l.preparation!));
  const chargement = lignes.some((l) => !l.ressource && !l.erreur);

  async function analyser() {
    if (verrou.current || !selection.length || !fournisseursCompatibles || bilan.cout > bilan.budget || chargement) return;
    const configuration = configQwen();
    if (selection.some((l) => (l.preparation?.fournisseur === "qwen") !== Boolean(configuration))) {
      setErreur("Le fournisseur a changé. Actualisez les ressources pour relire le coût avant de lancer l’analyse.");
      return;
    }
    verrou.current = true; setErreur(null);
    const controle = new AbortController();
    controleAnalyse.current = controle;
    setAnalyseEnCours(true);
    try {
      for (const [index, ligne] of selection.entries()) {
        if (!monte.current || controle.signal.aborted) break;
        setOccupe(`Lecture de ${ligne.ressource?.depot.titre ?? "la ressource"} (${index + 1}/${selection.length})…`);
        const preparation = ligne.preparation!;
        try {
          const reponse = await fetch("/api/depot/analyser", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: ligne.id, empreinte: preparation.empreinte, maximum: 20, consentement: true, organiser: true, ...(preparation.fournisseur === "qwen" ? { config: configuration } : {}), reprise: ["echec", "interrompue"].includes(preparation.analyseExistante?.statut ?? "") }),
            signal: AbortSignal.any([controle.signal, AbortSignal.timeout(270_000)]),
          });
          const refus = !reponse.ok ? await reponse.json().catch(() => null) : null;
          // Relire Supabase même si la réponse a été perdue après une écriture.
          const suivante = await preparerLigne(ligne.id, configQwen());
          suivante.selectionnee = false;
          remplacer(suivante);
          const analyse = suivante.ressource?.depot.analyses.find((a) => a.empreinte === preparation.empreinte);
          if (!reponse.ok || analyse?.statut !== "terminee") {
            const motif = analyse?.erreur ?? refus?.message;
            throw new Error(typeof motif === "string" ? motif.slice(0, 2000) : "Analyse non confirmée");
          }
        } catch (incident) {
          const motif = !controle.signal.aborted && incident instanceof Error ? ` ${incident.message}` : "";
          if (monte.current) setErreur(`${controle.signal.aborted ? "Arrêt demandé." : "Le traitement s'est arrêté."}${motif} Les éléments déjà enregistrés sont conservés. Actualisez la ressource concernée avant toute reprise ; les suivantes n'ont pas été envoyées.`);
          break;
        }
      }
    } finally { verrou.current = false; controleAnalyse.current = null; if (monte.current) { setOccupe(null); setAnalyseEnCours(false); } }
  }

  if (!cle) return null;
  return <section aria-label="Ressources de cet échange" className="ml-2 space-y-3 rounded-lg border border-bordure bg-surface p-4 text-sm">
    <p className="font-medium">Vos ressources</p>
    {lignes.map((ligne) => {
      const depot = ligne.ressource?.depot;
      const derniere = depot && derniereOrganisationDepot(depot);
      const retour = depot?.analyses.find((a) => a.id === derniere?.analyseId)?.restitution;
      const enCours = depot?.analyses.some((a) => a.statut === "en-cours");
      return <div key={ligne.id} className="space-y-2 border-t border-bordure pt-3">
        <div className="flex items-start gap-2">
          {ligne.preparation?.disponible && !enCours && <input type="checkbox" checked={ligne.selectionnee} disabled={Boolean(occupe)} aria-label={`Analyser ${depot?.titre ?? "cette ressource"}`} onChange={(e) => setLignes((avant) => avant.map((l) => l.id === ligne.id ? { ...l, selectionnee: e.target.checked } : l))} className="mt-1" />}
          <Link className="min-w-0 break-words underline" href={`/atelier?document=${encodeURIComponent(ligne.id)}`}>{depot?.titre ?? "Ressource conservée"}</Link>
        </div>
        {!depot && !ligne.erreur && <p role="status">Préparation de la lecture…</p>}
        {ligne.erreur && <p role="alert" className="text-danger">{ligne.erreur}</p>}
        {enCours && <p role="status">Une analyse est en cours. Actualisez pour retrouver son résultat, sans nouvel appel IA.</p>}
        {["echec", "interrompue"].includes(ligne.preparation?.analyseExistante?.statut ?? "") && <p className="text-texte-attenue">L’analyse précédente n’a pas abouti. Une reprise nécessite de sélectionner cette ressource puis de la demander explicitement.</p>}
        {depot?.rangementRevuLe && <p>{!ligne.ressource?.liensVerifies ? "Fiche enregistrée ; les liens restent à réparer avec Reprendre l’organisation" : depot.rangementStatut === "a-trier" ? "Rangement partiel" : "Rangement enregistré"}{ligne.ressource?.domaine ? ` dans ${ligne.ressource.domaine}` : ""}.{ligne.ressource?.liensVerifies && (ligne.ressource.competences.length ? ` Compétences liées : ${ligne.ressource.competences.map((c) => c.intitule).join(" ; ")}.` : " Aucune compétence liée.")}</p>}
        {!!ligne.ressource?.aPreciser.length && <ul className="list-disc space-y-1 pl-5 text-texte-attenue">{ligne.ressource.aPreciser.map((message) => <li key={message}>{message}</li>)}</ul>}
        {derniere && derniere.organisation.competences.some((p) => p.mode === "nouvelle") && <details>
          <summary className="cursor-pointer">Compétences proposées par l’analyse</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{derniere.organisation.competences.flatMap((p, index) => p.mode === "nouvelle" ? <li key={index}>{p.intitule}</li> : [])}</ul>
        </details>}
        {retour && <details>
          <summary className="cursor-pointer">Ce que j’ai compris · sources et transcription</summary>
          <div className="mt-2 space-y-3">
            {retour.elements.map((element) => <div key={element.id}>
              <p>{element.texte}</p>
              {element.sources.map((source, i) => <blockquote key={i} className="mt-1 border-l-2 border-bordure pl-3 text-xs text-texte-attenue">{source.citation}{source.page ? ` (page ${source.page})` : ""}</blockquote>)}
            </div>)}
            {depot?.analyses.filter((a) => a.restitution).flatMap((a) => a.pages).map((page, i) => <details key={`${page.pieceId}:${page.page}:${i}`}><summary>Transcription de la page {page.page}{page.incertain ? " · lecture incertaine" : ""}</summary><Markdown contenu={page.texte} /></details>)}
          </div>
        </details>}
        {ligne.preparation?.disponible && <p className="text-xs text-texte-attenue">{ligne.preparation.noteIncluse ? "Note incluse. " : ""}{ligne.preparation.tranches.map((t) => `${t.nom} : pages ${t.pages.join(", ")} sur ${t.totalPages}`).join(" ; ")}{ligne.preparation.pagesRestantes ? ` · ${ligne.preparation.pagesRestantes} page(s) resteront à lire.` : ""}</p>}
        {!ligne.preparation?.disponible && ligne.preparation?.motifIndisponible && <p className="text-xs text-texte-attenue">{ligne.preparation.motifIndisponible}</p>}
        {derniere && !enCours && <p className="text-xs text-texte-attenue">Reprendre l’organisation répare les liens et complète les compétences sourcées dans les domaines existants, sans nouvel appel IA.</p>}
        <div className="flex flex-wrap gap-2">
          {derniere && depot && onCorriger && <Bouton taille="petite" variante="discret" disabled={Boolean(occupe) || enCours} onClick={() => onCorriger({ id: depot.id, version: depot.modifieLe, titre: depot.titre })}>Corriger ou compléter</Bouton>}
          <Bouton taille="petite" variante="discret" disabled={Boolean(occupe)} onClick={() => void actualiser(ligne.id)}>Actualiser</Bouton>
          {derniere && !enCours && <Bouton taille="petite" variante="discret" disabled={Boolean(occupe)} onClick={() => void reprendreRangement(ligne)}>Reprendre l’organisation</Bouton>}
        </div>
      </div>;
    })}
    {!!selection.length && !fournisseursCompatibles && <p role="alert">Le fournisseur a changé. Actualisez les ressources sélectionnées pour obtenir un coût cohérent.</p>}
    {!!selection.length && fournisseursCompatibles && <div className="space-y-2 border-t border-bordure pt-3">
      <p className="text-xs text-texte-attenue">En lançant l’analyse, vous transmettez les {selection.length} ressource(s) sélectionnée(s) à {selection[0]?.preparation?.fournisseur === "qwen" ? "Qwen (Alibaba Cloud)" : "Mistral"} pour lecture et organisation. Les compétences justifiées seront créées dans les domaines existants ; un nouveau domaine demandera une précision. Coût maximal : {montant(bilan.cout)} · budget restant : {montant(bilan.budget)}. Aucun niveau ni séance ne sera créé.</p>
      {bilan.cout > bilan.budget && <p role="alert">Le budget ne couvre pas cette sélection. Décochez des ressources.</p>}
      <Bouton disabled={Boolean(occupe) || chargement || bilan.cout > bilan.budget} onClick={() => void analyser()}>{bilan.reprise ? "Réessayer la sélection et ranger" : "Analyser et ranger"}</Bouton>
    </div>}
    {occupe && <div className="flex items-center gap-3"><p role="status">{occupe}</p>{analyseEnCours && <Bouton taille="petite" variante="discret" onClick={() => controleAnalyse.current?.abort()}>Arrêter</Bouton>}</div>}
    {erreur && <p role="alert" className="text-danger">{erreur}</p>}
  </section>;
}
