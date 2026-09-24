"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { MAX_COMPETENCES_ORGANISATION_DEPOT, type DepotDocumentaire, type AnalyseDepot, type CompetenceProposeeDepot } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";
import type { ChoixClassementRessource } from "@/lib/documents/classement-ressources";
import { cheminDomaineClassement as cheminDomaine, MAX_COMPETENCES_LIEES_RESSOURCE } from "@/lib/documents/classement-ressources";
import { evaluerDelegationClassement } from "@/lib/documents/delegation-classement";
import { annulerRattachementDelegueAction, rattacherDomaineDelegueAction } from "@/lib/store/delegation-classement-actions";
import { lireClassementRessourcesAction, confirmerClassementRessourcesAction } from "@/lib/store/classement-ressources-actions";
import { motifRefusUsageDomaine } from "@/lib/domain/usage-domaine";
import { enregistrerBrouillonClassementAction } from "@/lib/store/brouillon-classement-actions";
import { CarteClassementRessource, EditeurClassementRessource, type ClassementSaisi } from "./choix-classement-ressource";
import { composerIntitule } from "@/lib/domain/atomicite";
import type { CorrectionCompetenceClassement } from "@/lib/documents/corrections-classement";
import { CorrectionCompetenceProposee } from "./correction-competence-proposee";
import { repereSourceDepot } from "@/lib/documents/dialogue-documentaire";
import { ClassementManuelSansAnalyse } from "./classement-manuel-sans-analyse";

export type EtatActionsRelecture = { disabled: boolean; enregistrement: boolean };
type Props = { depots: DepotDocumentaire[]; chargement: boolean; occupe: boolean; formulaireId: string; onEtatActions: (etat: EtatActionsRelecture) => void; onActualiser: (id: string) => void; afficherTitres: boolean; onDiscuter?: (depot: DepotDocumentaire) => void };
type Choix = ClassementSaisi & { analyseId: string; version: string; codes: string[]; propositions: number[]; corrections: CorrectionCompetenceClassement[] };

function libelleRelationSupport(relation: CompetenceProposeeDepot["relationSupport"]): string | null {
  if (relation === "mention") return "Mentionnée dans le document";
  if (relation === "enseignee") return "Enseignée dans le document";
  if (relation === "demandee") return "Demandée dans le document";
  return null;
}

export function derniereAnalyse(depot: DepotDocumentaire): AnalyseDepot | undefined {
  const courante = [...depot.analyses].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
  return courante?.statut === "terminee" && courante.restitution ? courante : undefined;
}

export function choixInitial(depot: DepotDocumentaire, referentiel: ContexteOrganisationDepot): Choix {
  const analyseId = derniereAnalyse(depot)!.id;
  const brouillon = depot.brouillonClassement;
  if (brouillon?.analyseId === analyseId) {
    const domaine = brouillon.domaine;
    return { analyseId, version: depot.modifieLe, destination: domaine?.mode === "existant" ? domaine.id : domaine?.mode === "nouveau" ? "nouveau" : "",
      nom: domaine?.mode === "nouveau" ? domaine.nom : "", parentId: domaine?.mode === "nouveau" ? domaine.parentId ?? "" : "",
      usage: domaine?.mode === "nouveau" ? domaine.usage?.type ?? "indetermine" : "", annee: domaine?.mode === "nouveau" ? domaine.usage?.anneeAcademique ?? "" : "",
      codes: brouillon.codes, propositions: brouillon.propositions, corrections: brouillon.corrections ?? [] };
  }
  const retour = derniereAnalyse(depot)?.restitution;
  const organisation = retour?.version === 2 ? retour.organisation : undefined;
  const domaine = organisation?.domaine;
  const retraitConserve = depot.rangementOrigine === "personne" && depot.rangementStatut === "a-trier" && !depot.domaineId;
  const destination = brouillon ? brouillon.domaine?.mode === "existant" ? brouillon.domaine.id : brouillon.domaine?.mode === "nouveau" ? "nouveau" : "" : retraitConserve ? "" : depot.domaineId ?? (domaine?.mode === "existant" ? domaine.id : domaine?.mode === "nouveau" ? "nouveau" : "");
  // Le rattachement délégué ne valide aucune proposition de compétence.
  const classementDeCetteAnalyse = depot.rangementAnalyseId === analyseId && depot.rangementOrigine !== "assistant";
  const garderLiensActuels = classementDeCetteAnalyse || depot.rangementOrigine === "assistant" || Boolean(depot.creationDomaineDeleguee) || retraitConserve;
  const codes = garderLiensActuels ? depot.competencesLiees : [...depot.competencesLiees, ...(organisation?.competences.flatMap((c) => c.mode === "existante" ? [c.code] : []) ?? [])];
  const nouveauDomaineHumain = brouillon?.domaine?.mode === "nouveau" ? brouillon.domaine : undefined;
  return {
    analyseId, version: depot.modifieLe,
    destination: destination === "nouveau" || referentiel.domaines.some((d) => d.id === destination) ? destination : "",
    nom: nouveauDomaineHumain?.nom ?? (domaine?.mode === "nouveau" ? domaine.nom : ""), parentId: nouveauDomaineHumain ? nouveauDomaineHumain.parentId ?? "" : (domaine?.mode === "nouveau" ? domaine.parentId ?? "" : ""), usage: nouveauDomaineHumain?.usage?.type ?? "indetermine", annee: nouveauDomaineHumain?.usage?.anneeAcademique ?? "",
    codes: [...new Set(codes)].filter((code) => referentiel.competences.some((c) => c.code === code)),
    propositions: garderLiensActuels ? [] : organisation?.competences.flatMap((c, i) => c.mode === "nouvelle" ? [i] : []) ?? [],
    corrections: depot.correctionsClassement?.analyseId === analyseId ? depot.correctionsClassement.corrections : [],
  };
}

export function ActionsRelectureRessources({ etat, onFermer }: { formulaireId: string; etat: EtatActionsRelecture; avecResultats: boolean; onFermer: () => void }) {
  return <Bouton variante="discret" disabled={etat.enregistrement} onClick={onFermer}>Fermer</Bouton>;
}

export function RelectureRessources({ depots, chargement, occupe, formulaireId, onEtatActions, onActualiser, afficherTitres, onDiscuter }: Props) {
  const [contexte, setContexte] = useState<ContexteOrganisationDepot | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const ids = depots.map((d) => d.id).join(",");
  const versions = depots.map((d) => `${d.id}:${d.modifieLe}`).join(",");
  useEffect(() => {
    if (!ids) return;
    let actif = true;
    void lireClassementRessourcesAction(ids.split(",")).then((resultat) => {
      if (actif) { setContexte(resultat.referentiel); setErreur(null); }
    }).catch(() => { if (actif) setErreur("Le classement n’a pas pu être chargé. Vos ressources sont conservées."); });
    return () => { actif = false; };
  }, [ids, versions, revision]);
  const pretes = depots.filter((d) => derniereAnalyse(d));
  const sansAnalyse = depots.filter((d) => d.version === 2 && !derniereAnalyse(d));
  if (!depots.length) return <p className="text-sm leading-relaxed text-texte-attenue">{chargement ? "Nous retrouvons vos ressources et les lectures déjà enregistrées…" : "Aucun document accessible dans cette sélection."}</p>;
  if (!contexte) return <div className="space-y-2"><p role={erreur ? "alert" : "status"} className="text-sm">{erreur ?? "Préparation du classement…"}</p>{erreur && <Bouton variante="secondaire" onClick={() => setRevision((r) => r + 1)}>Réessayer sans relancer l’IA</Bouton>}</div>;
  return <div className="space-y-6">
    {pretes.length > 0 && <FormulaireRelectureRessources depots={pretes} referentiel={contexte} onReferentielActualise={setContexte} occupe={occupe || chargement} autres={depots.length - pretes.length} formulaireId={formulaireId} onEtatActions={onEtatActions} onActualiser={onActualiser} afficherTitres={afficherTitres} onDiscuter={onDiscuter} />}
    {sansAnalyse.map((depot) => <ClassementManuelSansAnalyse key={`${depot.id}:${depot.modifieLe}`} depot={depot} referentiel={contexte} occupe={occupe || chargement} onActualiser={onActualiser} />)}
  </div>;
}

export function FormulaireRelectureRessources({ depots, referentiel, onReferentielActualise, occupe, autres, formulaireId, onEtatActions, onActualiser, afficherTitres = true, onDiscuter }: { depots: DepotDocumentaire[]; referentiel: ContexteOrganisationDepot; onReferentielActualise?: (contexte: ContexteOrganisationDepot) => void; occupe: boolean; autres: number; formulaireId: string; onEtatActions: (etat: EtatActionsRelecture) => void; onActualiser?: (id: string) => void; afficherTitres?: boolean; onDiscuter?: (depot: DepotDocumentaire) => void }) {
  const router = useRouter();
  const [choix, setChoix] = useState<Record<string, Choix>>(() => Object.fromEntries(depots.map((d) => [d.id, choixInitial(d, referentiel)])));
  const [modifies, setModifies] = useState<string[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [synthesesOuvertes, setSynthesesOuvertes] = useState<Record<string, boolean>>({});
  const [sourcesOuvertes, setSourcesOuvertes] = useState<Record<string, boolean>>({});
  const [editions, setEditions] = useState<Record<string, boolean>>({});
  const [recherchesCompetences, setRecherchesCompetences] = useState<Record<string, string>>({});
  const [ressourcesEnregistrees, setRessourcesEnregistrees] = useState<Record<string, { versionSource: string; ressource: DepotDocumentaire }>>({});
  const verrou = useRef(false);
  const depotsCourants = depots.map((d) => ressourcesEnregistrees[d.id]?.versionSource === d.modifieLe ? ressourcesEnregistrees[d.id].ressource : d);
  const domaines = [...referentiel.domaines].sort((a, b) => cheminDomaine(a.id, referentiel.domaines).localeCompare(cheminDomaine(b.id, referentiel.domaines), "fr"));
  const choixDepot = (depot: DepotDocumentaire) => choix[depot.id]?.analyseId === derniereAnalyse(depot)?.id && choix[depot.id]?.version === depot.modifieLe ? choix[depot.id] : choixInitial(depot, referentiel);
  const choixComplet = (c: Choix) => Boolean(c.destination && c.propositions.length <= MAX_COMPETENCES_ORGANISATION_DEPOT && c.codes.length + c.propositions.length <= MAX_COMPETENCES_LIEES_RESSOURCE && (c.destination !== "nouveau" || (c.nom.trim() && (!c.sousDomaine || c.parentId) && c.usage && (c.usage !== "continu" || c.codes.length + c.propositions.length > 0) && !motifRefusUsageDomaine({ type: c.usage, ...(c.usage === "module" ? { anneeAcademique: c.annee } : {}) }))));
  const disabled = occupe || enregistrement;
  useEffect(() => { onEtatActions({ disabled, enregistrement }); }, [disabled, enregistrement, onEtatActions]);
  function modifier(id: string, changement: Partial<Choix>) { const depot = depotsCourants.find((d) => d.id === id)!; setModifies((avant) => [...new Set([...avant, id])]); setChoix((avant) => ({ ...avant, [id]: { ...choixDepot(depot), ...changement } })); }
  async function sauvegarderChoix(depot: DepotDocumentaire, saisie: Partial<Choix>) {
    const c = { ...choixDepot(depot), ...saisie };
      const conserve = await enregistrerBrouillonClassementAction({ documentId: depot.id, updatedAtAttendu: depot.modifieLe, analyseId: c.analyseId,
        domaine: c.destination === "nouveau" ? { mode: "nouveau", nom: c.nom.trim(), ...(c.parentId ? { parentId: c.parentId } : {}), ...(c.usage ? { usage: { type: c.usage, ...(c.usage === "module" && c.annee.trim() ? { anneeAcademique: c.annee.trim() } : {}) } } : {}) } : c.destination ? { mode: "existant", id: c.destination } : null,
        codes: c.codes, propositions: c.propositions, corrections: c.corrections });
      setRessourcesEnregistrees((avant) => ({ ...avant, [depot.id]: { versionSource: depots.find((d) => d.id === depot.id)!.modifieLe, ressource: conserve } }));
      setChoix((avant) => ({ ...avant, [depot.id]: choixInitial(conserve, referentiel) }));
      return conserve;
  }
  async function conserverCorrection(depot: DepotDocumentaire, indice: number, correction: CorrectionCompetenceClassement | undefined) {
    if (verrou.current || disabled) throw new Error("Un enregistrement est déjà en cours.");
    verrou.current = true; setEnregistrement(true);
    try {
      const corrections = choixDepot(depot).corrections.filter((c) => c.indice !== indice);
      if (correction) corrections.push(correction);
      await sauvegarderChoix(depot, { corrections });
      setModifies((avant) => [...new Set([...avant, depot.id])]);
    } finally { verrou.current = false; setEnregistrement(false); }
  }
  async function confirmer(documentId: string) {
    if (verrou.current || disabled) return;
    const selection = depotsCourants.filter((d) => d.id === documentId);
    if (!selection.length || !selection.every((d) => choixComplet(choixDepot(d)))) return;
    verrou.current = true; setEnregistrement(true); setErreurs({});
    try {
      const etapes = [];
      for (const d of selection) etapes.push({ ressource: await sauvegarderChoix(d, choixDepot(d)), choix: choixDepot(d) });
      const demandes: ChoixClassementRessource[] = etapes.map(({ ressource: d, choix: c }) => {
        return { documentId: d.id, analyseId: derniereAnalyse(d)!.id, updatedAtAttendu: d.modifieLe,
          domaine: c.destination === "nouveau" ? { mode: "nouveau", nom: c.nom.trim(), ...(c.parentId ? { parentId: c.parentId } : {}), usage: { type: c.usage, ...(c.usage === "module" ? { anneeAcademique: c.annee.trim() } : {}) } } : { mode: "existant", id: c.destination },
          codes: c.codes, propositions: c.propositions, corrections: c.corrections };
      });
      const resultat = await confirmerClassementRessourcesAction(demandes);
      const reussis = resultat.resultats.filter((r) => r.statut === "confirmee").map((r) => r.documentId);
      setModifies((avant) => avant.filter((id) => !reussis.includes(id)));
      for (const resultatRessource of resultat.resultats) {
        if (resultatRessource.ressource) {
          const ressource = resultatRessource.ressource;
          setRessourcesEnregistrees((avant) => ({ ...avant, [ressource.id]: { versionSource: depots.find((d) => d.id === ressource.id)!.modifieLe, ressource } }));
          // Le référentiel peut avoir grandi : ne pas filtrer ici les nouveaux
          // domaine/codes à travers le contexte précédant la confirmation.
          setChoix((avant) => { const suivant = { ...avant }; delete suivant[ressource.id]; return suivant; });
          setEditions((avant) => ({ ...avant, [ressource.id]: false }));
        }
      }
      setErreurs(Object.fromEntries(resultat.resultats.filter((r) => r.statut !== "confirmee").map((r) => [r.documentId, r.erreur ?? "Le classement n’est pas confirmé. Les autres ressources restent conservées."])));
      if (reussis.length) {
        try {
          const relu = await lireClassementRessourcesAction(reussis);
          onReferentielActualise?.(relu.referentiel);
        } catch {
          setErreurs((avant) => ({ ...avant, global: "Le choix est enregistré, mais la liste des domaines n’a pas pu être actualisée. Rouvrez la fenêtre avant de classer un autre document." }));
        }
        router.refresh();
      }
    } catch (incident) {
      setErreurs({ global: incident instanceof Error ? incident.message : "Le classement n’a pas été confirmé. Vos ressources sont conservées ; aucun nouvel appel IA n’a été lancé." });
    } finally { verrou.current = false; setEnregistrement(false); }
  }
  async function retirerRattachement(depot: DepotDocumentaire) {
    if (verrou.current || disabled || !depot.rangementAnalyseId) return;
    verrou.current = true; setEnregistrement(true); setErreurs({});
    try {
      const { ressource, raison } = await annulerRattachementDelegueAction(depot.id, depot.rangementAnalyseId, depot.modifieLe);
      setRessourcesEnregistrees((avant) => ({ ...avant, [depot.id]: { versionSource: depots.find((d) => d.id === depot.id)!.modifieLe, ressource } }));
      setChoix((avant) => ({ ...avant, [depot.id]: choixInitial(ressource, referentiel) }));
      setModifies((avant) => avant.filter((id) => id !== depot.id));
      setEditions((avant) => ({ ...avant, [depot.id]: false }));
      if (ressource.domaineId) setErreurs({ [depot.id]: raison ?? "Le classement a changé ; le rattachement n’a pas été retiré. Relisez l’état enregistré." });
      router.refresh();
    } catch (incident) {
      setErreurs({ [depot.id]: incident instanceof Error ? incident.message : "Le retrait n’est pas confirmé. Relisez l’état enregistré." });
    } finally { verrou.current = false; setEnregistrement(false); }
  }
  async function reprendreCreation(depot: DepotDocumentaire) {
    if (verrou.current || disabled || !depot.creationDomaineDeleguee) return;
    verrou.current = true; setEnregistrement(true); setErreurs({});
    try {
      const resultat = await rattacherDomaineDelegueAction(depot.id, depot.creationDomaineDeleguee.analyseId, depot.modifieLe);
      const ressource = resultat.ressource;
      setRessourcesEnregistrees((avant) => ({ ...avant, [depot.id]: { versionSource: depots.find((d) => d.id === depot.id)!.modifieLe, ressource } }));
      setChoix((avant) => { const suivant = { ...avant }; delete suivant[depot.id]; return suivant; });
      if (resultat.statut !== "rattache") setErreurs({ [depot.id]: resultat.raison ?? "Ce rangement reste à contrôler." });
      const relu = await lireClassementRessourcesAction([depot.id]);
      onReferentielActualise?.(relu.referentiel);
      router.refresh();
    } catch (incident) {
      setErreurs({ [depot.id]: incident instanceof Error ? incident.message : "La création reste à vérifier. Relisez le rangement enregistré ; aucun appel IA n’a été relancé." });
    } finally { verrou.current = false; setEnregistrement(false); }
  }
  return <form id={formulaireId} className="space-y-6" onSubmit={(event) => { event.preventDefault(); }}>
    <p className="text-sm text-texte-attenue">Lorsque leur analyse le permet, les nouveaux documents sont rattachés à un domaine adapté, créé si nécessaire sans compétence obligatoire. Contrôlez seulement les points à préciser ; vous pouvez fermer et retrouver vos originaux sans tout valider.</p>
    {depotsCourants.map((depot) => {
      const analyse = derniereAnalyse(depot)!;
      const retour = analyse.restitution!;
      const organisation = retour.version === 2 ? retour.organisation : undefined;
      const sujets = retour.elements.filter((e) => e.nature === "sujet");
      const c = choixDepot(depot);
      const confirme = Boolean(depot.rangementRevuLe && depot.rangementStatut !== "a-trier" && !depot.brouillonClassement && !modifies.includes(depot.id));
      const delegue = confirme && depot.rangementOrigine === "assistant";
      const bloque = occupe || enregistrement;
      const enEdition = Boolean(editions[depot.id]);
      const competences = organisation?.competences ?? [];
      const rechercheCompetence = recherchesCompetences[depot.id]?.trim().toLocaleLowerCase("fr-FR") ?? "";
      const competencesDejaVisibles = referentiel.competences.filter((competence) => depot.competencesLiees.includes(competence.code) || competences.some((p) => p.mode === "existante" && p.code === competence.code) || c.codes.includes(competence.code));
      const competencesRecherchees = rechercheCompetence.length >= 2 ? referentiel.competences.filter((competence) => !competencesDejaVisibles.some((visible) => visible.code === competence.code) && `${competence.code} ${competence.intitule} ${competence.domaineNom}`.toLocaleLowerCase("fr-FR").includes(rechercheCompetence)).slice(0, 20) : [];
      const competencesExistantesVisibles = [...competencesDejaVisibles, ...competencesRecherchees];
      const synthese = (sujets.length ? sujets : retour.elements)[0];
      const syntheseOuverte = Boolean(synthesesOuvertes[depot.id]);
      const syntheseId = `${formulaireId}-synthese-${depot.id}`;
      const domainePropose = organisation?.domaine;
      const suggestionRetenue = domainePropose?.mode === "existant" ? c.destination === domainePropose.id : domainePropose?.mode === "nouveau" && c.destination === "nouveau" && c.nom === domainePropose.nom;
      const brouillonConserve = Boolean(depot.brouillonClassement);
      const nouvellesCompetencesARelire = depot.brouillonClassement && depot.brouillonClassement.analyseId !== analyse.id;
      const sourcesId = `${formulaireId}-sources-${depot.id}`;
      const incertitudes = retour.elements.filter((e) => e.nature === "incertitude");
      const delegation = evaluerDelegationClassement(depot, analyse.id, referentiel);
      const creationEnAttente = depot.creationDomaineDeleguee && !depot.domaineId && !depot.rangementRevuLe && !depot.brouillonClassement && depot.rangementOrigine !== "personne";
      const pagesSource = (sources: { page?: number; section?: { titre: string; chemin: string } }[]) => {
        if (sources.some((s) => s.section)) return [...new Set(sources.map(repereSourceDepot))].join(" ; ");
        const pages = [...new Set(sources.flatMap((s) => s.page === undefined ? [] : [s.page]))].sort((a, b) => a - b);
        return pages.length ? `${pages.length > 1 ? "Pages" : "Page"} ${pages.join(", ")}` : "";
      };
      return <section key={depot.id} aria-label={depot.titre} className="space-y-4 border-b border-bordure pb-6 last:border-0">
        <div className="space-y-3">
          {afficherTitres && <h2 className="break-words text-xl font-semibold leading-snug tracking-tight">{depot.titre}</h2>}
          {synthese && <div className="space-y-2">
            <div id={syntheseId} className="space-y-2">
              <p className={`text-sm leading-relaxed text-texte-attenue ${syntheseOuverte ? "" : "line-clamp-3"}`}>{synthese.texte}</p>
              {syntheseOuverte && (sujets.length ? sujets : retour.elements).slice(1).map((e) => <p key={e.id} className="text-sm leading-relaxed text-texte-attenue">{e.texte}</p>)}
            </div>
            <button type="button" aria-expanded={syntheseOuverte} aria-controls={syntheseId} className="min-h-9 rounded text-xs font-medium text-primaire underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primaire" onClick={() => setSynthesesOuvertes((avant) => ({ ...avant, [depot.id]: !syntheseOuverte }))}>{syntheseOuverte ? "Réduire la synthèse" : "Lire la synthèse complète"}</button>
          </div>}
          {!retour.elements.length && <p className="text-sm text-texte-attenue">Aucune synthèse n’a été enregistrée pour cette ressource.</p>}
          <p className="text-xs text-texte-attenue">{retour.couvertures.map((couverture) => `${couverture.nom} : ${new Set(couverture.pagesLues).size} ${couverture.unite === "section" ? "section(s) extraite(s)" : "page(s) lue(s)"} sur ${couverture.totalPages}`).join(" · ") || "Lecture de la note jointe."}</p>
          {analyse.pages.flatMap((p) => p.section?.limites?.map((limite) => `${p.section!.titre} : ${limite}`) ?? []).map((limite, i) => <p key={i} className="text-xs text-texte-attenue">À relire dans l’original : {limite}</p>)}
        </div>
        <fieldset disabled={bloque} className="space-y-3 rounded-carte border border-bordure p-4">
          <legend className="px-1 text-sm font-semibold">{delegue ? "Rattachement effectué" : confirme ? "Classement enregistré" : "Où ranger ce document ?"}</legend>
          {nouvellesCompetencesARelire && <p className="text-xs text-texte-attenue">Votre choix de domaine est conservé. Les compétences de cette nouvelle analyse sont à relire.</p>}
          {enEdition
            ? <EditeurClassementRessource choix={c} domaines={domaines} bloque={bloque} onChanger={(saisie) => modifier(depot.id, saisie)} onReduire={() => setEditions((avant) => ({ ...avant, [depot.id]: false }))} />
            : <CarteClassementRessource choix={c} domaines={domaines} bloque={bloque} provenance={brouillonConserve ? "Votre choix est conservé. Il reste à confirmer." : delegue ? "Rattaché par Twiny · vous pouvez corriger ce choix." : depot.domaineId ? "Classement actuel conservé." : suggestionRetenue ? "Suggestion de l’IA · à vérifier" : "Votre choix · à confirmer"} onModifier={() => setEditions((avant) => ({ ...avant, [depot.id]: true }))} />}
          {delegue && depot.creationDomaineDeleguee?.statut === "cree" && <p className="text-xs text-texte-attenue">Twiny a créé ce domaine pour organiser le document. Son contexte d’études reste à votre choix.</p>}
          {delegue && !depot.competencesLiees.length && <p className="text-xs text-texte-attenue">Ce rattachement n’a créé ni associé aucune compétence.</p>}
          {creationEnAttente && <div className="space-y-2"><p role="status" className="text-sm">{depot.creationDomaineDeleguee!.statut === "cree" ? `La création du domaine « ${depot.creationDomaineDeleguee!.nom} » est enregistrée ; le rattachement reste à terminer.` : `La création du domaine « ${depot.creationDomaineDeleguee!.nom} » reste à vérifier.`}</p><Bouton type="button" variante="secondaire" disabled={bloque} onClick={() => void reprendreCreation(depot)}>Reprendre le rangement sans relancer l’IA</Bouton></div>}
          {!creationEnAttente && depot.creationDomaineDeleguee?.statut === "reservee" && <p role="status" className="text-sm">Une création du domaine « {depot.creationDomaineDeleguee.nom} » a été engagée avant votre choix actuel. Celui-ci est conservé. Consultez Mes cours pour vérifier si ce domaine a été créé sans rattachement.</p>}
          {delegue && competences.length > 0 && <p className="text-xs text-texte-attenue">Les compétences ci-dessous restent facultatives : sélectionnez celles que vous souhaitez associer.</p>}
          {depot.rangementOrigine === "assistant" && depot.domaineId && <Bouton type="button" variante="discret" disabled={bloque} onClick={() => void retirerRattachement(depot)}>Retirer ce rattachement</Bouton>}
          {depot.rangementOrigine === "personne" && depot.rangementStatut === "a-trier" && !depot.domaineId && <p className="text-xs text-texte-attenue">Votre retrait est conservé. Le document reste disponible sans domaine.</p>}
          {!confirme && delegation.statut === "a-controler" && <p className="text-xs text-texte-attenue">{delegation.raison}</p>}
          {c.destination === "nouveau" && c.usage === "continu" && !c.codes.length && !c.propositions.length && <p className="text-xs text-texte-attenue">Un nouveau domaine de progression continue demande au moins une compétence associée. Vous pouvez aussi choisir un domaine existant.</p>}
          {c.codes.length + c.propositions.length > MAX_COMPETENCES_LIEES_RESSOURCE && <p className="text-xs text-danger">Cette ressource atteint la limite de {MAX_COMPETENCES_LIEES_RESSOURCE} compétences liées.</p>}
        </fieldset>
        <fieldset disabled={bloque} className="space-y-3">
          <legend className="text-base font-semibold">Compétences proposées</legend>
          <div className="space-y-1 text-xs leading-relaxed text-texte-attenue">
            <p className="font-medium text-texte">{c.propositions.length > 0 ? `${c.propositions.length} nouvelle${c.propositions.length > 1 ? "s" : ""} compétence${c.propositions.length > 1 ? "s" : ""}` : ""}{c.propositions.length > 0 && c.codes.length > 0 ? " · " : ""}{c.codes.length > 0 ? `${c.codes.length} compétence${c.codes.length > 1 ? "s" : ""} existante${c.codes.length > 1 ? "s" : ""}` : ""}{!c.codes.length && !c.propositions.length ? "Aucune compétence associée" : ""}</p>
            {c.propositions.length > 0 && <p>{c.propositions.length > 1 ? "Créées" : "Créée"} après confirmation.</p>}
          </div>
          <p className="text-xs text-texte-attenue">Choisissez les compétences principales à relier à ce document. Une mention ne signifie pas que vous les avez travaillées ou maîtrisées. Vous pouvez décocher une proposition ou préciser son intitulé avant sa création.</p>
          <label className="block space-y-1 text-sm"><span>Ajouter une compétence de votre référentiel</span><input type="search" className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={recherchesCompetences[depot.id] ?? ""} onChange={(event) => setRecherchesCompetences((avant) => ({ ...avant, [depot.id]: event.target.value }))} placeholder="Rechercher par nom, code ou domaine" /></label>
          <div className="space-y-2">
            {competencesExistantesVisibles.map((competence) => {
              const proposition = competences.find((p) => p.mode === "existante" && p.code === competence.code);
              const pages = pagesSource(proposition?.sources ?? []);
              return <label key={competence.code} className="flex cursor-pointer items-start gap-3 rounded-lg border border-bordure p-3 hover:bg-primaire/5"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primaire" checked={c.codes.includes(competence.code)} onChange={(e) => modifier(depot.id, { codes: e.target.checked ? [...c.codes, competence.code] : c.codes.filter((code) => code !== competence.code) })} /><span className="min-w-0 space-y-1"><span className="block text-sm font-medium leading-relaxed">{competence.intitule}</span><span className="block text-xs text-texte-attenue">{proposition ? "Compétence proposée" : "Compétence de votre référentiel"}{libelleRelationSupport(proposition?.relationSupport) ? ` · ${libelleRelationSupport(proposition?.relationSupport)}` : ""}{pages ? ` · ${pages}` : ""}</span></span></label>;
            })}
            {competences.flatMap((p, i) => {
              if (p.mode !== "nouvelle") return [];
              const correction = c.corrections.find((correction) => correction.indice === i);
              return <div key={i} className="rounded-lg border border-bordure p-3">
                <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primaire" checked={c.propositions.includes(i)} onChange={(e) => modifier(depot.id, { propositions: e.target.checked ? [...c.propositions, i] : c.propositions.filter((index) => index !== i) })} /><span className="min-w-0 space-y-1"><span className="block text-sm font-medium leading-relaxed">{correction ? composerIntitule(correction) : p.intitule}</span><span className="block text-xs text-texte-attenue">{correction ? "Votre correction · " : ""}Nouvelle compétence{libelleRelationSupport(p.relationSupport) ? ` · ${libelleRelationSupport(p.relationSupport)}` : ""}{pagesSource(p.sources) ? ` · ${pagesSource(p.sources)}` : ""}</span></span></label>
                {(!confirme || delegue) && <CorrectionCompetenceProposee key={`${analyse.id}:${i}`} proposition={p} correction={correction} indice={i} disabled={bloque} onConserver={(correction) => conserverCorrection(depot, i, correction)} />}
              </div>;
            })}
          </div>
        </fieldset>
        {!c.codes.length && !competences.length && <p className="text-sm text-texte-attenue">Aucune compétence n’a encore été proposée pour ce document.</p>}
        {incertitudes.length > 0 && <aside aria-label="Points à vérifier" className="space-y-2 rounded-lg border border-bordure p-3"><h3 className="text-sm font-medium">À vérifier</h3>{incertitudes.map((e) => <p key={e.id} className="text-sm leading-relaxed text-texte-attenue">{e.texte}</p>)}</aside>}
        <Bouton type="button" variante="discret" taille="petite" aria-expanded={Boolean(sourcesOuvertes[depot.id])} aria-controls={sourcesId} onClick={() => setSourcesOuvertes((avant) => ({ ...avant, [depot.id]: !avant[depot.id] }))}>{sourcesOuvertes[depot.id] ? "Masquer les sources" : "Consulter les sources"}</Bouton>
        <section id={sourcesId} hidden={!sourcesOuvertes[depot.id]} aria-label="Sources du document" className="space-y-5 rounded-lg border border-bordure p-4">
          {domainePropose && <section aria-label="Raison du classement proposé" className="space-y-2"><h3 className="text-sm font-medium">Pourquoi ce classement a été proposé</h3><p className="text-xs text-texte-attenue">Suggestion d’origine : {domainePropose.mode === "existant" ? cheminDomaine(domainePropose.id, referentiel.domaines) : domainePropose.nom}.</p><p className="text-sm leading-relaxed">{domainePropose.justification}</p></section>}
          <section aria-label="Passages cités" className="space-y-3"><h3 className="text-sm font-medium">Passages cités</h3>{retour.elements.map((e) => <div key={e.id}><p className="text-sm leading-relaxed">{e.texte}</p>{e.sources.map((source, i) => <blockquote key={i} className="mt-1 border-l-2 border-bordure pl-3 text-xs leading-relaxed text-texte-attenue">{source.citation}{` — ${repereSourceDepot(source)}`}</blockquote>)}</div>)}</section>
          {competences.some((p) => p.sources.length) && <section aria-label="Sources des compétences" className="space-y-3"><h3 className="text-sm font-medium">Sources des compétences</h3>{competences.map((p, index) => {
            if (!p.sources.length) return null;
            const correction = p.mode === "nouvelle" ? c.corrections.find((c) => c.indice === index) : undefined;
            return <div key={index}><p className="text-sm font-medium">{correction ? composerIntitule(correction) : p.mode === "nouvelle" ? p.intitule : referentiel.competences.find((c) => c.code === p.code)?.intitule ?? "Compétence proposée"}</p>{correction && p.mode === "nouvelle" && <p className="text-xs text-texte-attenue">Votre correction · Proposition d’origine : {p.intitule}</p>}{p.sources.map((source, i) => <blockquote key={i} className="mt-1 border-l-2 border-bordure pl-3 text-xs leading-relaxed text-texte-attenue">{source.citation}{` — ${repereSourceDepot(source)}`}</blockquote>)}</div>;
          })}</section>}
        </section>
        {(!confirme || (delegue && (c.codes.length + c.propositions.length > 0))) && <Bouton type="button" variante="principal" disabled={bloque || !choixComplet(c)} onClick={() => void confirmer(depot.id)}>{enregistrement ? "Enregistrement…" : delegue ? "Appliquer les compétences choisies" : "Appliquer ce choix"}</Bouton>}
        {depot.contextePersonnel?.contexte && <p className="text-sm"><strong>Votre contexte :</strong> {depot.contextePersonnel.contexte.texte}</p>}
        {depot.contextePersonnel?.intention && <p className="text-sm"><strong>Votre intention :</strong> {depot.contextePersonnel.intention.texte}</p>}
        {onDiscuter && <div className="space-y-1"><Bouton type="button" variante="secondaire" disabled={bloque} onClick={() => onDiscuter(depot)}>En discuter</Bouton><p className="text-xs text-texte-attenue">Relisez les extraits préparés avant de les envoyer, puis précisez leur place dans votre travail.</p></div>}
        <a className="block text-sm text-primaire hover:underline" href={`/atelier?document=${encodeURIComponent(depot.id)}`}>Retrouver ce document dans Mes cours</a>
        {erreurs[depot.id] && <div className="space-y-2"><p role="alert" className="text-sm text-danger">{erreurs[depot.id]}</p>{onActualiser && <Bouton type="button" taille="petite" variante="secondaire" disabled={occupe || enregistrement} onClick={() => onActualiser(depot.id)}>Relire l’état enregistré</Bouton>}</div>}
      </section>;
    })}
    {autres > 0 && <p className="text-xs text-texte-attenue">{autres} autre(s) ressource(s) reste(nt) à lire. Elles sont conservées ; cette confirmation concerne uniquement les résultats ci-dessus.</p>}
    {erreurs.global && <p role="alert" className="text-sm text-danger">{erreurs.global}</p>}
  </form>;
}
