"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { identifierRessourcesAssistantAction, lireRessourceAssistantAction } from "@/lib/store/ressource-assistant-actions";
import { rattacherDomaineDelegueAction } from "@/lib/store/delegation-classement-actions";
import { ActionsRelectureRessources, RelectureRessources, type EtatActionsRelecture } from "./modale-ressources";
import { bilanSelectionAnalyses, referencesRessourcesConversation, type AutorisationAnalyseDepot } from "@/lib/documents/conversation-ressources";
import type { DepotDocumentaire, PreparationAnalyseDepot } from "@/lib/documents/depot";

import { lireConfigTuteur, type ConfigTuteurClient } from "@/lib/tutor/cle-client";

type Ressource = Awaited<ReturnType<typeof lireRessourceAssistantAction>>;
type Ligne = { id: string; titre?: string; introuvable?: boolean; ressource?: Ressource; preparation?: PreparationAnalyseDepot; erreur?: string; erreurClassement?: string; selectionnee: boolean };

/** Seulement après le succès d'une première lecture déclenchée dans ce parcours. */
export async function rattacherApresPremiereLecture(avant: Ligne, suivante: Ligne, analyseId: string): Promise<Ligne> {
  if (!avant.ressource || avant.ressource.depot.analyses.length || !suivante.ressource) return suivante;
  try {
    const resultat = await rattacherDomaineDelegueAction(suivante.id, analyseId, suivante.ressource.depot.modifieLe);
    return { ...suivante, ressource: { ...suivante.ressource, depot: resultat.ressource }, ...(resultat.statut !== "rattache" && resultat.ressource.creationDomaineDeleguee ? { erreurClassement: resultat.raison } : {}) };
  } catch {
    // La réservation ou la création peut avoir réussi avant la réponse perdue.
    // Une simple lecture rend ce point de reprise visible, sans nouvel effet.
    let ressource = suivante.ressource;
    try { ressource = await lireRessourceAssistantAction(suivante.id); } catch { /* conserver la dernière lecture */ }
    return { ...suivante, ressource, erreurClassement: "Le rattachement n’est pas confirmé. Relisez l’état enregistré avant de corriger ; l’analyse reste conservée." };
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
  const couvertures = analyses.filter((a) => a.statut === "terminee").flatMap((a) => a.couvertures ?? []);
  // Une tranche suivante échouée reprend ses pages manquantes, pas la synthèse précédente.
  if (couvertures.some((c) => new Set(couvertures.filter((v) => v.pieceId === c.pieceId).flatMap((v) => v.pagesLues)).size < c.totalPages)) return;
  return analyses.find((a) => a.statut === "terminee" && a.restitution?.version === 2)?.id;
}

export function selectionReprise(lignes: Ligne[]): Ligne[] {
  return lignes.filter((l) => {
    const analyses = l.ressource?.depot.analyses ?? [];
    const derniere = [...analyses].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
    return !l.introuvable && !l.erreur && l.preparation?.disponible && !["en-cours", "terminee"].includes(l.preparation.analyseExistante?.statut ?? "")
      && (!analyses.length || ["echec", "interrompue"].includes(derniere?.statut ?? ""));
  });
}

export function etatLectureSuivante(ligne: Ligne): "absente" | "a-confirmer" | "indisponible" | "disponible" {
  const depot = ligne.ressource?.depot;
  const preparation = ligne.preparation;
  const derniere = depot && [...depot.analyses].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  if (ligne.introuvable || ligne.erreur || !depot || !preparation || preparation.syntheseDe || preparation.analyseExistante
    || !preparation.tranches?.some((t) => t.pages.length) || derniere?.statut !== "terminee") return "absente";
  if (depot.rangementAnalyseId !== derniere.id || depot.rangementOrigine !== "personne" || depot.brouillonClassement) return "a-confirmer";
  const cout = preparation.fournisseur === "qwen" ? preparation.coutMaximumMicroDollars : preparation.coutMaximumMicroEuros;
  if (typeof cout !== "number" || !Number.isSafeInteger(cout) || cout < 0) return "indisponible";
  return preparation.disponible ? "disponible" : "indisponible";
}

export function descriptionLecture(preparation: PreparationAnalyseDepot): string {
  const fournisseur = preparation.fournisseur === "qwen" ? "Qwen" : "Mistral";
  const cout = preparation.fournisseur === "qwen" ? preparation.coutMaximumMicroDollars : preparation.coutMaximumMicroEuros;
  const montant = typeof cout === "number" && Number.isFinite(cout) && cout >= 0 ? `${(cout / 1_000_000).toFixed(6)} ${preparation.fournisseur === "qwen" ? "$" : "€"}` : "coût indisponible";
  const nonAnalysees = preparation.sectionsNonAnalysees?.reduce((n, groupe) => n + groupe.sections.length, 0) ?? 0;
  return `${fournisseur} · ${preparation.tranches.map((t) => `${t.nom} : ${t.unite === "section" ? "sections" : "pages"} ${t.pages.join(", ")}`).join(" ; ")} · au maximum ${montant}.${nonAnalysees ? ` ${nonAnalysees} section(s) sans texte restent non analysées.` : ""}`;
}

/** Visible même quand aucune nouvelle tranche textuelle n'est disponible. */
export function SectionsNonAnalysees({ preparation }: { preparation: PreparationAnalyseDepot }) {
  const groupes = preparation.sectionsNonAnalysees?.filter((groupe) => groupe.sections.length) ?? [];
  if (!groupes.length) return null;
  return <div className="space-y-2 rounded-lg border border-bordure p-3 text-sm">
    <p className="font-medium">Sections non analysées</p>
    <p>Ces sections ne contiennent pas de texte extractible. Leurs illustrations et autres contenus n’ont pas été analysés. L’original reste conservé ; vous pouvez fournir ces passages en PDF ou en image.</p>
    {groupes.map((groupe) => <div key={groupe.pieceId} className="space-y-1"><p className="font-medium">{groupe.nom}</p><ul className="list-disc space-y-1 pl-5">{groupe.sections.map((section) => <li key={section.chemin}>{section.titre} — <span className="break-all text-xs text-texte-attenue">{section.chemin}</span>{section.limites?.map((limite, i) => <p key={i} className="text-xs text-texte-attenue">{limite}</p>)}</li>)}</ul></div>)}
  </div>;
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
export function RessourcesConversation({ compteId, references, ouverte, onFermer, onRetirerReference, autorisationAnalyse, revision = 0, onDiscuter }: { compteId: string; references: string[]; ouverte: boolean; onFermer: () => void; onRetirerReference?: (id: string) => void; autorisationAnalyse?: AutorisationAnalyseDepot; revision?: number; onDiscuter?: (depot: DepotDocumentaire) => void }) {
  const cle = referencesRessourcesConversation(references).join(",");
  return cle ? <RessourcesChargees key={cle} cle={cle} compteId={compteId} ouverte={ouverte} onFermer={onFermer} onRetirerReference={onRetirerReference} autorisationAnalyse={autorisationAnalyse} revision={revision} onDiscuter={onDiscuter} /> : null;
}

function RessourcesChargees({ compteId, cle, ouverte, onFermer, onRetirerReference, autorisationAnalyse, revision, onDiscuter }: { compteId: string; cle: string; ouverte: boolean; onFermer: () => void; onRetirerReference?: (id: string) => void; autorisationAnalyse?: AutorisationAnalyseDepot; revision: number; onDiscuter?: (depot: DepotDocumentaire) => void }) {
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

  async function continuer(ligne: Ligne) {
    if (verrou.current || etatActions.enregistrement || etatLectureSuivante(ligne) !== "disponible") return;
    verrou.current = true; setOccupe("Vérification de la prochaine lecture…"); setErreur(null);
    let relue: Ligne | undefined;
    try {
      relue = await preparerLigne(ligne.id, configQwen());
      remplacer(relue);
      if (etatLectureSuivante(relue) !== "disponible" || JSON.stringify(relue.preparation) !== JSON.stringify(ligne.preparation)) {
        setErreur("La lecture ou les choix ont changé. Relisez les informations avant de continuer ; aucune analyse n’a été lancée.");
        return;
      }
    } catch { setErreur("La lecture n’a pas pu être vérifiée. Aucune analyse n’a été lancée."); return; }
    finally { verrou.current = false; if (monte.current) setOccupe(null); }
    if (monte.current && relue) await analyser([relue]);
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
  const lectureIncomplete = disponibles.some((l) => l.erreur || !l.ressource || ["echec", "interrompue"].includes([...l.ressource.depot.analyses].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0]?.statut ?? "") || !l.ressource.depot.analyses.some((a) => a.statut === "terminee") || l.ressource.depot.analyses.some((a) => a.statut === "en-cours"));
  const nouvelles = selectionAnalyseAutomatique(lignes);
  const accordDepasse = autorisationAnalyse && nouvelles.length > 0 && !autorisationCorrespond(nouvelles, autorisationAnalyse);
  const anomalie = erreur || (accordDepasse ? "Le fournisseur ou le coût a changé. Vérifiez la nouvelle estimation avant de réessayer." : lectureIncomplete ? "La proposition n’est pas encore complète. Vos documents sont conservés." : null);
  const noms = disponibles.map((l, index) => l.ressource?.depot.pieces.map((p) => p.nom).join(", ") || l.ressource?.depot.titre || l.titre || `Document ${index + 1} — ouverture en cours`);
  return <Modale titre={uniques ? disponibles[0]?.ressource?.depot.titre ?? disponibles[0]?.titre ?? "Ouvrir le document" : disponibles.length ? `Vérifier ${disponibles.length} documents` : "Document indisponible"} sousTitre={noms.length > 0 ? `${noms.slice(0, 3).join(" · ")}${noms.length > 3 ? ` · et ${noms.length - 3} autres documents` : ""}` : "Aucun document accessible dans cette sélection"} onFermer={onFermer} masquee={!ouverte} largeur="3xl" pied={<ActionsRelectureRessources formulaireId={formulaireId} etat={etatActions} avecResultats={depots.some((d) => d.analyses.some((a) => a.statut === "terminee" && a.restitution))} onFermer={onFermer} />}>
    <div className="space-y-6">
      {lignes.filter((l) => l.introuvable).map((ligne) => <div key={ligne.id} className="rounded-lg border border-bordure bg-surface p-3 text-sm"><p>Un ancien lien de cet échange ne correspond plus à un document accessible. Il n’est pas inclus dans le classement.</p>{onRetirerReference && <Bouton taille="petite" variante="discret" onClick={() => onRetirerReference(ligne.id)}>Retirer ce lien de l’échange</Bouton>}</div>)}
      {disponibles.filter((ligne) => ligne.preparation).map((ligne) => <SectionsNonAnalysees key={`non-analysees-${ligne.id}`} preparation={ligne.preparation!} />)}
      {occupe && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-primaire/5 p-3"><p role="status" className="text-sm">{occupe}</p>{analyseEnCours && <Bouton taille="petite" variante="discret" onClick={() => controleAnalyse.current?.abort()}>Arrêter</Bouton>}</div>}
      {!chargement && !occupe && anomalie && <div className="space-y-2"><p role="alert" className="text-sm text-danger">{anomalie}</p>{reprises.map((ligne) => <p key={ligne.id} className="text-xs text-texte-attenue">{descriptionLecture(ligne.preparation!)}</p>)}<Bouton taille="petite" variante="secondaire" onClick={() => void reessayer()}>Réessayer</Bouton></div>}
      {lignes.filter((l) => l.erreurClassement).map((ligne) => <div key={`classement-${ligne.id}`} className="space-y-2"><p role="alert" className="text-sm text-danger">{ligne.ressource?.depot.titre} : {ligne.erreurClassement}</p><Bouton type="button" variante="secondaire" disabled={Boolean(occupe)} onClick={() => void relire()}>Relire l’état enregistré sans relancer l’IA</Bouton></div>)}
      {disponibles.length > 0 && <RelectureRessources depots={depots} chargement={chargement} occupe={Boolean(occupe) || chargement || analyseEnCours} formulaireId={formulaireId} onEtatActions={setEtatActions} onActualiser={() => void relire()} afficherTitres={!uniques} onDiscuter={onDiscuter} />}
      {!chargement && disponibles.filter((l) => etatLectureSuivante(l) !== "absente").map((ligne) => <div key={`suite-${ligne.id}`} className="space-y-2 rounded-lg border border-bordure p-3">
        <p className="text-sm font-medium">Poursuivre la lecture de « {ligne.ressource!.depot.titre} »</p>
        <p className="text-xs text-texte-attenue">{descriptionLecture(ligne.preparation!)}</p>
        <p className="text-xs text-texte-attenue">Ce geste autorise uniquement cette tranche. Les lectures précédentes restent conservées ; toutes les pages lues ne garantissent pas toutes les compétences repérées.</p>
        {etatLectureSuivante(ligne) === "a-confirmer" ? <p className="text-sm">Confirmez d’abord les choix de classement de la lecture actuelle pour conserver vos corrections avant de poursuivre.</p> : etatLectureSuivante(ligne) === "indisponible" ? <p className="text-sm">{ligne.preparation?.motifIndisponible ?? "Cette lecture n’est pas disponible."}</p> : <Bouton type="button" variante="secondaire" disabled={Boolean(occupe) || analyseEnCours || etatActions.enregistrement} onClick={() => void continuer(ligne)}>Lire la suite</Bouton>}
      </div>)}
      {depots.map((depot) => {
        const precedentes = depot.analyses.filter((a) => a.statut === "terminee" && a.restitution).sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(1);
        return precedentes.length ? <details key={`historique-${depot.id}`} className="text-sm"><summary>Lectures précédentes de « {depot.titre} »</summary><p className="my-2 text-xs text-texte-attenue">Résultats conservés pour consultation. Les choix actuels se règlent dans le classement ci-dessus.</p>{precedentes.map((analyse) => <div key={analyse.id} className="my-3 space-y-2 border-l border-bordure pl-3"><p>{analyse.couvertures.map((c) => `${c.nom} — ${c.unite === "section" ? "sections" : "pages"} ${c.pagesLues.join(", ")}`).join(" ; ")}</p>{analyse.restitution!.elements.map((element) => <p key={element.id}>{element.texte}</p>)}{analyse.restitution?.version === 2 && <ul className="list-disc pl-5">{analyse.restitution.organisation.competences.map((p, i) => <li key={i}>{p.mode === "nouvelle" ? p.intitule : p.code} — {p.justification}</li>)}</ul>}</div>)}</details> : null;
      })}
      {chargement && <p role="status" className="text-sm text-texte-attenue">Préparation de vos documents…</p>}
    </div>
  </Modale>;
}
