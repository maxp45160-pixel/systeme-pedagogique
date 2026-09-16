"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { identifierRessourcesAssistantAction, lireRessourceAssistantAction } from "@/lib/store/ressource-assistant-actions";
import { rattacherDomaineDelegueAction } from "@/lib/store/delegation-classement-actions";
import { ActionsRelectureRessources, RelectureRessources, type EtatActionsRelecture } from "./modale-ressources";
import { bilanSelectionAnalyses, eurosDocumentaires, referencesRessourcesConversation, type AutorisationAnalyseDepot } from "@/lib/documents/conversation-ressources";
import type { PreparationAnalyseDepot } from "@/lib/documents/depot";

import { lireConfigTuteur, type ConfigTuteurClient } from "@/lib/tutor/cle-client";

type Ressource = Awaited<ReturnType<typeof lireRessourceAssistantAction>>;
type Ligne = { id: string; titre?: string; introuvable?: boolean; ressource?: Ressource; preparation?: PreparationAnalyseDepot; erreur?: string; erreurClassement?: string; selectionnee: boolean };

/** Seulement après le succès d'une première lecture déclenchée dans ce parcours. */
export async function rattacherApresPremiereLecture(avant: Ligne, suivante: Ligne, analyseId: string): Promise<Ligne> {
  if (!avant.ressource || avant.ressource.depot.analyses.length || !suivante.ressource) return suivante;
  try {
    const resultat = await rattacherDomaineDelegueAction(suivante.id, analyseId, suivante.ressource.depot.modifieLe);
    return { ...suivante, ressource: { ...suivante.ressource, depot: resultat.ressource } };
  } catch {
    return { ...suivante, erreurClassement: "Le rattachement n’est pas confirmé. Relisez l’état enregistré avant de corriger ; l’analyse reste conservée." };
  }
}

/** Un dépôt neuf seulement : rouvrir un résultat ou une erreur ne relance jamais l’IA. */
export function selectionAnalyseAutomatique(lignes: Ligne[]): Ligne[] {
  return lignes.filter((l) => !l.introuvable && !l.erreur && l.preparation?.disponible && !l.preparation.syntheseDe && !l.preparation.analyseExistante && l.ressource?.depot.analyses.length === 0);
}

export function autorisationCorrespond(lignes: Ligne[], autorisation: AutorisationAnalyseDepot): boolean {
  const cout = bilanSelectionAnalyses(lignes.map((l) => l.preparation!)).cout;
  return Number.isFinite(cout) && cout >= 0 && cout <= autorisation.coutMaximum && lignes.every((l) => (l.preparation?.fournisseur ?? "mistral") === autorisation.fournisseur);
}

export function preparationsChargees(lignes: Ligne[]): boolean {
  return lignes.every((l) => l.introuvable || Boolean(l.preparation) || Boolean(l.erreur));
}

export function syntheseAReprendre(ressource: Ressource): string | undefined {
  const analyses = [...ressource.depot.analyses].sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  if (!["echec", "interrompue"].includes(analyses[0]?.statut ?? "")) return;
  return analyses.find((a) => a.statut === "terminee" && a.restitution?.version === 2)?.id;
}

function selectionReprise(lignes: Ligne[]): Ligne[] {
  return lignes.filter((l) => !l.introuvable && !l.erreur && l.preparation?.disponible && !["en-cours", "terminee"].includes(l.preparation.analyseExistante?.statut ?? ""));
}

export function lectureAProposer(ligne: Ligne): boolean {
  return !ligne.introuvable && (!ligne.ressource?.depot.analyses.some((a) => a.statut === "terminee" && a.restitution)
    || Boolean(ligne.preparation?.disponible)
    || Boolean(ligne.erreur)
    || Boolean(ligne.ressource?.depot.analyses.some((a) => a.statut === "en-cours")));
}

export async function preparerLigne(id: string, config: ConfigTuteurClient | null, onRessource?: (ressource: Ressource) => void, syntheseDe?: string): Promise<Ligne> {
  const ressource = await lireRessourceAssistantAction(id);
  syntheseDe ??= syntheseAReprendre(ressource);
  onRessource?.(ressource);
  try {
  const reponse = await fetch(`/api/depot/analyser?${new URLSearchParams({ documentId: id, maximum: "20", ...(syntheseDe ? {syntheseDe} : {}), ...(config?.fournisseur === "qwen" ? { fournisseur: "qwen" } : {}) })}`);
  if (!reponse.ok) throw new Error("Préparation indisponible");
  const preparation: PreparationAnalyseDepot = await reponse.json();
  if (preparation.syntheseDe !== syntheseDe) throw new Error("La préparation ne correspond plus à la lecture choisie.");
  return { id, ressource, preparation, selectionnee: preparation.disponible && !["en-cours", "terminee"].includes(preparation.analyseExistante?.statut ?? "") };
  } catch {
    return { id, ressource, selectionnee: false, erreur: "Le document est disponible, mais la préparation d’une nouvelle lecture n’a pas pu être chargée. Les résultats déjà obtenus restent affichés." };
  }
}

/** Le compte rendu reste dans le fil visuel, jamais dans les messages envoyés au modèle du chat. */
export function RessourcesConversation({ compteId, references, ouverte, onFermer, onRetirerReference, autorisationAnalyse, revision = 0 }: { compteId: string; references: string[]; ouverte: boolean; onFermer: () => void; onRetirerReference?: (id: string) => void; autorisationAnalyse?: AutorisationAnalyseDepot; revision?: number }) {
  const cle = referencesRessourcesConversation(references).join(",");
  return cle ? <RessourcesChargees key={cle} cle={cle} compteId={compteId} ouverte={ouverte} onFermer={onFermer} onRetirerReference={onRetirerReference} autorisationAnalyse={autorisationAnalyse} revision={revision} /> : null;
}

function RessourcesChargees({ compteId, cle, ouverte, onFermer, onRetirerReference, autorisationAnalyse, revision }: { compteId: string; cle: string; ouverte: boolean; onFermer: () => void; onRetirerReference?: (id: string) => void; autorisationAnalyse?: AutorisationAnalyseDepot; revision: number }) {
  const formulaireId = useId();
  const [etatActions, setEtatActions] = useState<EtatActionsRelecture>({ disabled: true, enregistrement: false });
  const configQwen = useCallback(() => { const c = lireConfigTuteur(compteId); return c?.fournisseur === "qwen" ? c : null; }, [compteId]);
  const [lignes, setLignes] = useState<Ligne[]>(() => cle.split(",").map((id) => ({ id, selectionnee: false })));
  const [occupe, setOccupe] = useState<string | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);
  const monte = useRef(true);
  const controleAnalyse = useRef<AbortController | null>(null);
  const revisionLue = useRef(0);
  const lancementConsomme = useRef(false);
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
      let identites: Awaited<ReturnType<typeof identifierRessourcesAssistantAction>> = [];
      try {
        identites = await identifierRessourcesAssistantAction(ids);
        if (actif) setLignes((avant) => identites.map((identite) => ({ ...avant.find((ligne) => ligne.id === identite.id), ...identite, selectionnee: false })));
      } catch { /* L'ouverture individuelle peut encore réussir. */ }
      for (const id of ids) {
        if (!actif) break;
        const identite = identites.find((i) => i.id === id);
        if (identite?.introuvable) continue;
        let ligne: Ligne;
        try { ligne = await preparerLigne(id, configQwen(), (ressource) => { if (actif) setLignes((avant) => avant.map((l) => l.id === id ? { id, ressource, selectionnee: false } : l)); }); }
        catch { ligne = { id, titre: identite?.titre, selectionnee: false, erreur: "L’ouverture de ce document a échoué. Réessayer ne lance pas de nouvelle analyse IA." }; }
        if (actif) setLignes((avant) => avant.map((l) => l.id === id ? ligne : l));
      }
    })();
    // L’appel déjà autorisé reste en vol si la vue se remonte ; seul « Arrêter » l’annule.
    return () => { actif = false; monte.current = false; };
  }, [cle, configQwen]);

  const remplacer = useCallback((ligne: Ligne) => {
    if (monte.current) setLignes((avant) => avant.map((l) => l.id === ligne.id ? ligne : l));
  }, []);
  const chargement = !preparationsChargees(lignes);

  const analyser = useCallback(async (selection: Ligne[]) => {
    if (verrou.current || !selection.length) return;
    const configuration = configQwen();
    const bilan = bilanSelectionAnalyses(selection.map((l) => l.preparation!));
    if (bilan.cout > bilan.budget) { setErreur("L’analyse ne peut pas démarrer : le budget disponible est insuffisant."); return; }
    if (selection.some((l) => (l.preparation?.fournisseur === "qwen") !== Boolean(configuration))) {
      setErreur("La configuration a changé. Réessayez pour relire les documents."); return;
    }
    verrou.current = true; setErreur(null);
    const controle = new AbortController();
    controleAnalyse.current = controle;
    setAnalyseEnCours(true);
    try {
      for (const [index, ligne] of selection.entries()) {
        if (!monte.current || controle.signal.aborted) break;
        setOccupe(`Lecture de ${ligne.ressource?.depot.titre ?? "votre document"} (${index + 1}/${selection.length})…`);
        const preparation = ligne.preparation!;
        try {
          const reponse = await fetch("/api/depot/analyser", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: ligne.id, empreinte: preparation.empreinte, maximum: 20, consentement: true, ...(preparation.syntheseDe ? { syntheseDe: preparation.syntheseDe } : {}), ...(preparation.fournisseur === "qwen" ? { config: configuration } : {}), reprise: Boolean(preparation.syntheseDe) || ["echec", "interrompue"].includes(preparation.analyseExistante?.statut ?? "") }),
            signal: AbortSignal.any([controle.signal, AbortSignal.timeout(270_000)]),
          });
          const suivante = await preparerLigne(ligne.id, configQwen());
          suivante.selectionnee = false;
          remplacer(suivante);
          const analyse = suivante.ressource?.depot.analyses.find((a) => a.empreinte === preparation.empreinte);
          if (!reponse.ok || analyse?.statut !== "terminee") throw new Error("Analyse non confirmée");
          remplacer(await rattacherApresPremiereLecture(ligne, suivante, analyse.id));
        } catch {
          if (monte.current) setErreur(controle.signal.aborted ? "La lecture est arrêtée. Vos documents sont conservés." : "La lecture n’a pas abouti. Vos documents et les résultats déjà obtenus sont conservés.");
          break;
        }
      }
    } finally { verrou.current = false; controleAnalyse.current = null; if (monte.current) { setOccupe(null); setAnalyseEnCours(false); } }
  }, [configQwen, remplacer]);

  useEffect(() => {
    if (!autorisationAnalyse || lancementConsomme.current || chargement) return;
    const nouvelles = selectionAnalyseAutomatique(lignes);
    if (!nouvelles.length) return;
    if (!autorisationCorrespond(nouvelles, autorisationAnalyse)) return;
    let actif = true;
    queueMicrotask(() => {
      if (!actif || !monte.current || lancementConsomme.current) return;
      lancementConsomme.current = true;
      void analyser(nouvelles);
    });
    return () => { actif = false; };
  }, [autorisationAnalyse, chargement, lignes, analyser]);

  async function reessayer() {
    if (verrou.current) return;
    const reprises = selectionReprise(lignes);
    const fournisseur = configQwen() ? "qwen" : "mistral";
    if (reprises.length && reprises.every((l) => (l.preparation?.fournisseur ?? "mistral") === fournisseur)) { await analyser(reprises); return; }
    await relire();
  }

  async function relire() {
    if (verrou.current) return;
    verrou.current = true; setOccupe("Reprise de vos documents…"); setErreur(null);
    try {
      for (const ligne of lignes.filter((l) => !l.introuvable)) {
        const relue = await preparerLigne(ligne.id, configQwen());
        remplacer(relue);
        if (relue.erreur) throw new Error("Lecture indisponible");
      }
    } catch { setErreur("La lecture reste indisponible. Vos documents sont conservés."); }
    finally { verrou.current = false; if (monte.current) setOccupe(null); }
  }
  const depots = lignes.flatMap((ligne) => ligne.ressource ? [ligne.ressource.depot] : []);
  const disponibles = lignes.filter((l) => !l.introuvable);
  const uniques = disponibles.length === 1;
  const reprises = selectionReprise(lignes);
  const coutReprise = bilanSelectionAnalyses(reprises.map((l) => l.preparation!)).cout;
  const lectureIncomplete = disponibles.some((l) => l.erreur || !l.ressource || syntheseAReprendre(l.ressource) || !l.ressource.depot.analyses.some((a) => a.statut === "terminee") || l.ressource.depot.analyses.some((a) => a.statut === "en-cours"));
  const nouvelles = selectionAnalyseAutomatique(lignes);
  const accordDepasse = autorisationAnalyse && nouvelles.length > 0 && !autorisationCorrespond(nouvelles, autorisationAnalyse);
  const anomalie = erreur || (accordDepasse ? "Le fournisseur ou le coût a changé. Vérifiez la nouvelle estimation avant de réessayer." : lectureIncomplete ? "La proposition n’est pas encore complète. Vos documents sont conservés." : null);
  const noms = disponibles.map((l, index) => l.ressource?.depot.pieces.map((p) => p.nom).join(", ") || l.ressource?.depot.titre || l.titre || `Document ${index + 1} — ouverture en cours`);
  return <Modale titre={uniques ? disponibles[0]?.ressource?.depot.titre ?? disponibles[0]?.titre ?? "Ouvrir le document" : disponibles.length ? `Vérifier ${disponibles.length} documents` : "Document indisponible"} sousTitre={noms.length > 0 ? `${noms.slice(0, 3).join(" · ")}${noms.length > 3 ? ` · et ${noms.length - 3} autres documents` : ""}` : "Aucun document accessible dans cette sélection"} onFermer={onFermer} masquee={!ouverte} largeur="3xl" pied={<ActionsRelectureRessources formulaireId={formulaireId} etat={etatActions} avecResultats={depots.some((d) => d.analyses.some((a) => a.statut === "terminee" && a.restitution))} onFermer={onFermer} />}>
    <div className="space-y-6">
      {lignes.filter((l) => l.introuvable).map((ligne) => <div key={ligne.id} className="rounded-lg border border-bordure bg-surface p-3 text-sm"><p>Un ancien lien de cet échange ne correspond plus à un document accessible. Il n’est pas inclus dans le classement.</p>{onRetirerReference && <Bouton taille="petite" variante="discret" onClick={() => onRetirerReference(ligne.id)}>Retirer ce lien de l’échange</Bouton>}</div>)}
      {occupe && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-primaire/5 p-3"><p role="status" className="text-sm">{occupe}</p>{analyseEnCours && <Bouton taille="petite" variante="discret" onClick={() => controleAnalyse.current?.abort()}>Arrêter</Bouton>}</div>}
      {!chargement && !occupe && anomalie && <div className="space-y-2"><p role="alert" className="text-sm text-danger">{anomalie}</p>{reprises.length > 0 && <p className="text-xs text-texte-attenue">{reprises[0].preparation?.fournisseur === "qwen" ? "Qwen" : "Mistral"} · {reprises.map((l) => l.ressource?.depot.titre).join(", ")} · {reprises.reduce((n, l) => n + (l.preparation?.tranches.reduce((s, t) => s + t.pages.length, 0) ?? 0), 0)} pages · au maximum {reprises[0].preparation?.fournisseur === "qwen" ? `${(coutReprise / 1_000_000).toFixed(3)} $` : eurosDocumentaires(coutReprise)}.</p>}<Bouton taille="petite" variante="secondaire" onClick={() => void reessayer()}>Réessayer</Bouton></div>}
      {lignes.filter((l) => l.erreurClassement).map((ligne) => <div key={`classement-${ligne.id}`} className="space-y-2"><p role="alert" className="text-sm text-danger">{ligne.ressource?.depot.titre} : {ligne.erreurClassement}</p><Bouton type="button" variante="secondaire" disabled={Boolean(occupe)} onClick={() => void relire()}>Relire l’état enregistré sans relancer l’IA</Bouton></div>)}
      {disponibles.length > 0 && <RelectureRessources depots={depots} chargement={chargement} occupe={Boolean(occupe) || chargement || analyseEnCours} formulaireId={formulaireId} onEtatActions={setEtatActions} onActualiser={() => void relire()} afficherTitres={!uniques} />}
      {chargement && <p role="status" className="text-sm text-texte-attenue">Préparation de vos documents…</p>}
    </div>
  </Modale>;
}
