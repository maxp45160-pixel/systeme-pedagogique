"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import type { DepotDocumentaire, AnalyseDepot } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";
import type { ChoixClassementRessource } from "@/lib/documents/classement-ressources";
import { cheminDomaineClassement as cheminDomaine } from "@/lib/documents/classement-ressources";
import { evaluerDelegationClassement } from "@/lib/documents/delegation-classement";
import { annulerRattachementDelegueAction } from "@/lib/store/delegation-classement-actions";
import { lireClassementRessourcesAction, confirmerClassementRessourcesAction } from "@/lib/store/classement-ressources-actions";
import { motifRefusUsageDomaine } from "@/lib/domain/usage-domaine";
import { enregistrerBrouillonClassementAction } from "@/lib/store/brouillon-classement-actions";
import { CarteClassementRessource, EditeurClassementRessource, type ClassementSaisi } from "./choix-classement-ressource";

export type EtatActionsRelecture = { disabled: boolean; enregistrement: boolean };
type Props = { depots: DepotDocumentaire[]; chargement: boolean; occupe: boolean; formulaireId: string; onEtatActions: (etat: EtatActionsRelecture) => void; onActualiser: (id: string) => void; afficherTitres: boolean };
type Choix = ClassementSaisi & { analyseId: string; version: string; codes: string[]; propositions: number[] };

function derniereAnalyse(depot: DepotDocumentaire): AnalyseDepot | undefined {
  return depot.analyses.filter((a) => a.statut === "terminee" && a.restitution).sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
}

export function choixInitial(depot: DepotDocumentaire, referentiel: ContexteOrganisationDepot): Choix {
  const analyseId = derniereAnalyse(depot)!.id;
  const brouillon = depot.brouillonClassement;
  if (brouillon?.analyseId === analyseId) {
    const domaine = brouillon.domaine;
    return { analyseId, version: depot.modifieLe, destination: domaine?.mode === "existant" ? domaine.id : domaine?.mode === "nouveau" ? "nouveau" : "",
      nom: domaine?.mode === "nouveau" ? domaine.nom : "", parentId: domaine?.mode === "nouveau" ? domaine.parentId ?? "" : "",
      usage: domaine?.mode === "nouveau" ? domaine.usage?.type ?? "" : "", annee: domaine?.mode === "nouveau" ? domaine.usage?.anneeAcademique ?? "" : "",
      codes: brouillon.codes, propositions: brouillon.propositions };
  }
  const retour = derniereAnalyse(depot)?.restitution;
  const organisation = retour?.version === 2 ? retour.organisation : undefined;
  const domaine = organisation?.domaine;
  const retraitConserve = depot.rangementOrigine === "personne" && depot.rangementStatut === "a-trier" && !depot.domaineId;
  const destination = brouillon ? brouillon.domaine?.mode === "existant" ? brouillon.domaine.id : brouillon.domaine?.mode === "nouveau" ? "nouveau" : "" : retraitConserve ? "" : depot.domaineId ?? (domaine?.mode === "existant" ? domaine.id : domaine?.mode === "nouveau" ? "nouveau" : "");
  // Le rattachement délégué ne valide aucune proposition de compétence.
  const classementDeCetteAnalyse = depot.rangementAnalyseId === analyseId && depot.rangementOrigine !== "assistant";
  const garderLiensActuels = classementDeCetteAnalyse || depot.rangementOrigine === "assistant" || retraitConserve;
  const codes = garderLiensActuels ? depot.competencesLiees : [...depot.competencesLiees, ...(organisation?.competences.flatMap((c) => c.mode === "existante" ? [c.code] : []) ?? [])];
  const nouveauDomaineHumain = brouillon?.domaine?.mode === "nouveau" ? brouillon.domaine : undefined;
  return {
    analyseId, version: depot.modifieLe,
    destination: destination === "nouveau" || referentiel.domaines.some((d) => d.id === destination) ? destination : "",
    nom: nouveauDomaineHumain?.nom ?? (domaine?.mode === "nouveau" ? domaine.nom : ""), parentId: nouveauDomaineHumain?.parentId ?? "", usage: nouveauDomaineHumain?.usage?.type ?? "", annee: nouveauDomaineHumain?.usage?.anneeAcademique ?? "",
    codes: [...new Set(codes)].filter((code) => referentiel.competences.some((c) => c.code === code)),
    propositions: garderLiensActuels ? [] : organisation?.competences.flatMap((c, i) => c.mode === "nouvelle" ? [i] : []) ?? [],
  };
}

export function ActionsRelectureRessources({ etat, onFermer }: { formulaireId: string; etat: EtatActionsRelecture; avecResultats: boolean; onFermer: () => void }) {
  return <Bouton variante="discret" disabled={etat.enregistrement} onClick={onFermer}>Fermer</Bouton>;
}

export function RelectureRessources({ depots, chargement, occupe, formulaireId, onEtatActions, onActualiser, afficherTitres }: Props) {
  const [contexte, setContexte] = useState<ContexteOrganisationDepot | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const ids = depots.filter((d) => derniereAnalyse(d)).map((d) => d.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let actif = true;
    void lireClassementRessourcesAction(ids.split(",")).then((resultat) => {
      if (actif) { setContexte(resultat.referentiel); setErreur(null); }
    }).catch(() => { if (actif) setErreur("Le classement n’a pas pu être chargé. Vos ressources sont conservées."); });
    return () => { actif = false; };
  }, [ids, revision]);
  const pretes = depots.filter((d) => derniereAnalyse(d));
  if (!pretes.length) return <p className="text-sm leading-relaxed text-texte-attenue">{chargement ? "Nous retrouvons vos ressources et les lectures déjà enregistrées…" : "Vos originaux sont conservés. Après la lecture, vous pourrez vérifier la synthèse et choisir leur classement ici."}</p>;
  if (!contexte) return <div className="space-y-2"><p role={erreur ? "alert" : "status"} className="text-sm">{erreur ?? "Préparation du classement…"}</p>{erreur && <Bouton variante="secondaire" onClick={() => setRevision((r) => r + 1)}>Réessayer sans relancer l’IA</Bouton>}</div>;
  return <FormulaireRelectureRessources depots={pretes} referentiel={contexte} onReferentielActualise={setContexte} occupe={occupe || chargement} autres={depots.length - pretes.length} formulaireId={formulaireId} onEtatActions={onEtatActions} onActualiser={onActualiser} afficherTitres={afficherTitres} />;
}

export function FormulaireRelectureRessources({ depots, referentiel, onReferentielActualise, occupe, autres, formulaireId, onEtatActions, onActualiser, afficherTitres = true }: { depots: DepotDocumentaire[]; referentiel: ContexteOrganisationDepot; onReferentielActualise?: (contexte: ContexteOrganisationDepot) => void; occupe: boolean; autres: number; formulaireId: string; onEtatActions: (etat: EtatActionsRelecture) => void; onActualiser?: (id: string) => void; afficherTitres?: boolean }) {
  const router = useRouter();
  const [choix, setChoix] = useState<Record<string, Choix>>(() => Object.fromEntries(depots.map((d) => [d.id, choixInitial(d, referentiel)])));
  const [modifies, setModifies] = useState<string[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [synthesesOuvertes, setSynthesesOuvertes] = useState<Record<string, boolean>>({});
  const [sourcesOuvertes, setSourcesOuvertes] = useState<Record<string, boolean>>({});
  const [editions, setEditions] = useState<Record<string, boolean>>({});
  const [ressourcesEnregistrees, setRessourcesEnregistrees] = useState<Record<string, { versionSource: string; ressource: DepotDocumentaire }>>({});
  const verrou = useRef(false);
  const depotsCourants = depots.map((d) => ressourcesEnregistrees[d.id]?.versionSource === d.modifieLe ? ressourcesEnregistrees[d.id].ressource : d);
  const domaines = [...referentiel.domaines].sort((a, b) => cheminDomaine(a.id, referentiel.domaines).localeCompare(cheminDomaine(b.id, referentiel.domaines), "fr"));
  const choixDepot = (depot: DepotDocumentaire) => choix[depot.id]?.analyseId === derniereAnalyse(depot)?.id && choix[depot.id]?.version === depot.modifieLe ? choix[depot.id] : choixInitial(depot, referentiel);
  const choixComplet = (c: Choix) => Boolean(c.destination && c.codes.length + c.propositions.length <= 30 && (c.destination !== "nouveau" || (c.nom.trim() && (!c.sousDomaine || c.parentId) && c.usage && (c.usage !== "continu" || c.codes.length + c.propositions.length > 0) && !motifRefusUsageDomaine({ type: c.usage, ...(c.usage === "module" ? { anneeAcademique: c.annee } : {}) }))));
  const disabled = occupe || enregistrement;
  useEffect(() => { onEtatActions({ disabled, enregistrement }); }, [disabled, enregistrement, onEtatActions]);
  function modifier(id: string, changement: Partial<Choix>) { const depot = depotsCourants.find((d) => d.id === id)!; setModifies((avant) => [...new Set([...avant, id])]); setChoix((avant) => ({ ...avant, [id]: { ...choixDepot(depot), ...changement } })); }
  async function sauvegarderChoix(depot: DepotDocumentaire, saisie: ClassementSaisi) {
    const c = { ...choixDepot(depot), ...saisie };
      const conserve = await enregistrerBrouillonClassementAction({ documentId: depot.id, updatedAtAttendu: depot.modifieLe, analyseId: c.analyseId,
        domaine: c.destination === "nouveau" ? { mode: "nouveau", nom: c.nom.trim(), ...(c.parentId ? { parentId: c.parentId } : {}), ...(c.usage ? { usage: { type: c.usage, ...(c.usage === "module" && c.annee.trim() ? { anneeAcademique: c.annee.trim() } : {}) } } : {}) } : c.destination ? { mode: "existant", id: c.destination } : null,
        codes: c.codes, propositions: c.propositions });
      setRessourcesEnregistrees((avant) => ({ ...avant, [depot.id]: { versionSource: depots.find((d) => d.id === depot.id)!.modifieLe, ressource: conserve } }));
      setChoix((avant) => ({ ...avant, [depot.id]: choixInitial(conserve, referentiel) }));
      return conserve;
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
          codes: c.codes, propositions: c.propositions };
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
  return <form id={formulaireId} className="space-y-6" onSubmit={(event) => { event.preventDefault(); }}>
    <p className="text-sm text-texte-attenue">Les nouveaux documents sont rattachés aux domaines existants lorsque leur analyse le permet. Contrôlez seulement les points à préciser ; vous pouvez fermer et retrouver vos originaux sans tout valider.</p>
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
      const pagesSource = (sources: { page?: number }[]) => {
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
          <p className="text-xs text-texte-attenue">{retour.couvertures.map((couverture) => `${couverture.nom} : ${new Set(couverture.pagesLues).size} page(s) lue(s) sur ${couverture.totalPages}`).join(" · ") || "Lecture de la note jointe."}</p>
        </div>
        <fieldset disabled={bloque} className="space-y-3 rounded-carte border border-bordure p-4">
          <legend className="px-1 text-sm font-semibold">{delegue ? "Rattachement effectué" : confirme ? "Classement enregistré" : "Où ranger ce document ?"}</legend>
          {nouvellesCompetencesARelire && <p className="text-xs text-texte-attenue">Votre choix de domaine est conservé. Les compétences de cette nouvelle analyse sont à relire.</p>}
          {enEdition
            ? <EditeurClassementRessource choix={c} domaines={domaines} bloque={bloque} onChanger={(saisie) => modifier(depot.id, saisie)} onReduire={() => setEditions((avant) => ({ ...avant, [depot.id]: false }))} />
            : <CarteClassementRessource choix={c} domaines={domaines} bloque={bloque} provenance={brouillonConserve ? "Votre choix est conservé. Il reste à confirmer." : delegue ? "Rattaché par Twiny · vous pouvez corriger ce choix." : depot.domaineId ? "Classement actuel conservé." : suggestionRetenue ? "Suggestion de l’IA · à vérifier" : "Votre choix · à confirmer"} onModifier={() => setEditions((avant) => ({ ...avant, [depot.id]: true }))} />}
          {delegue && !depot.competencesLiees.length && <p className="text-xs text-texte-attenue">Ce rattachement n’a créé ni associé aucune compétence.</p>}
          {delegue && competences.length > 0 && <p className="text-xs text-texte-attenue">Les compétences ci-dessous restent facultatives : sélectionnez celles que vous souhaitez associer.</p>}
          {depot.rangementOrigine === "assistant" && depot.domaineId && <Bouton type="button" variante="discret" disabled={bloque} onClick={() => void retirerRattachement(depot)}>Retirer ce rattachement</Bouton>}
          {depot.rangementOrigine === "personne" && depot.rangementStatut === "a-trier" && !depot.domaineId && <p className="text-xs text-texte-attenue">Votre retrait est conservé. Le document reste disponible sans domaine.</p>}
          {!confirme && delegation.statut === "a-controler" && <p className="text-xs text-texte-attenue">{delegation.raison}</p>}
          {c.destination === "nouveau" && c.usage === "continu" && !c.codes.length && !c.propositions.length && <p className="text-xs text-texte-attenue">Un nouveau domaine de progression continue demande au moins une compétence associée. Vous pouvez aussi choisir un domaine existant.</p>}
          {c.codes.length + c.propositions.length > 30 && <p className="text-xs text-danger">Gardez au maximum 30 compétences pour cette ressource.</p>}
        </fieldset>
        {!!(c.codes.length || competences.length) && <fieldset disabled={bloque} className="space-y-3">
          <legend className="text-base font-semibold">Compétences proposées</legend>
          <div className="space-y-1 text-xs leading-relaxed text-texte-attenue">
            <p className="font-medium text-texte">{c.propositions.length > 0 ? `${c.propositions.length} nouvelle${c.propositions.length > 1 ? "s" : ""} compétence${c.propositions.length > 1 ? "s" : ""}` : ""}{c.propositions.length > 0 && c.codes.length > 0 ? " · " : ""}{c.codes.length > 0 ? `${c.codes.length} compétence${c.codes.length > 1 ? "s" : ""} existante${c.codes.length > 1 ? "s" : ""}` : ""}{!c.codes.length && !c.propositions.length ? "Aucune compétence associée" : ""}</p>
            {c.propositions.length > 0 && <p>{c.propositions.length > 1 ? "Créées" : "Créée"} après confirmation.</p>}
          </div>
          <p className="text-xs text-texte-attenue">Gardez les compétences que vous souhaitez travailler. Vous pouvez en décocher.</p>
          <div className="space-y-2">
            {referentiel.competences.filter((competence) => depot.competencesLiees.includes(competence.code) || competences.some((p) => p.mode === "existante" && p.code === competence.code)).map((competence) => {
              const proposition = competences.find((p) => p.mode === "existante" && p.code === competence.code);
              const pages = pagesSource(proposition?.sources ?? []);
              return <label key={competence.code} className="flex cursor-pointer items-start gap-3 rounded-lg border border-bordure p-3 hover:bg-primaire/5"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primaire" checked={c.codes.includes(competence.code)} onChange={(e) => modifier(depot.id, { codes: e.target.checked ? [...c.codes, competence.code] : c.codes.filter((code) => code !== competence.code) })} /><span className="min-w-0 space-y-1"><span className="block text-sm font-medium leading-relaxed">{competence.intitule}</span><span className="block text-xs text-texte-attenue">Compétence existante{pages ? ` · ${pages}` : ""}</span></span></label>;
            })}
            {competences.flatMap((p, i) => p.mode === "nouvelle" ? <label key={i} className="flex cursor-pointer items-start gap-3 rounded-lg border border-bordure p-3 hover:bg-primaire/5"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primaire" checked={c.propositions.includes(i)} onChange={(e) => modifier(depot.id, { propositions: e.target.checked ? [...c.propositions, i] : c.propositions.filter((index) => index !== i) })} /><span className="min-w-0 space-y-1"><span className="block text-sm font-medium leading-relaxed">{p.intitule}</span><span className="block text-xs text-texte-attenue">Nouvelle compétence{pagesSource(p.sources) ? ` · ${pagesSource(p.sources)}` : ""}</span></span></label> : [])}
          </div>
        </fieldset>}
        {!c.codes.length && !competences.length && <p className="text-sm text-texte-attenue">Aucune compétence n’a encore été proposée pour ce document.</p>}
        {incertitudes.length > 0 && <aside aria-label="Points à vérifier" className="space-y-2 rounded-lg border border-bordure p-3"><h3 className="text-sm font-medium">À vérifier</h3>{incertitudes.map((e) => <p key={e.id} className="text-sm leading-relaxed text-texte-attenue">{e.texte}</p>)}</aside>}
        <Bouton type="button" variante="discret" taille="petite" aria-expanded={Boolean(sourcesOuvertes[depot.id])} aria-controls={sourcesId} onClick={() => setSourcesOuvertes((avant) => ({ ...avant, [depot.id]: !avant[depot.id] }))}>{sourcesOuvertes[depot.id] ? "Masquer les sources" : "Consulter les sources"}</Bouton>
        <section id={sourcesId} hidden={!sourcesOuvertes[depot.id]} aria-label="Sources du document" className="space-y-5 rounded-lg border border-bordure p-4">
          {domainePropose && <section aria-label="Raison du classement proposé" className="space-y-2"><h3 className="text-sm font-medium">Pourquoi ce classement a été proposé</h3><p className="text-xs text-texte-attenue">Suggestion d’origine : {domainePropose.mode === "existant" ? cheminDomaine(domainePropose.id, referentiel.domaines) : domainePropose.nom}.</p><p className="text-sm leading-relaxed">{domainePropose.justification}</p></section>}
          <section aria-label="Passages cités" className="space-y-3"><h3 className="text-sm font-medium">Passages cités</h3>{retour.elements.map((e) => <div key={e.id}><p className="text-sm leading-relaxed">{e.texte}</p>{e.sources.map((source, i) => <blockquote key={i} className="mt-1 border-l-2 border-bordure pl-3 text-xs leading-relaxed text-texte-attenue">{source.citation}{source.page ? ` — page PDF ${source.page}` : ""}</blockquote>)}</div>)}</section>
          {competences.some((p) => p.sources.length) && <section aria-label="Sources des compétences" className="space-y-3"><h3 className="text-sm font-medium">Sources des compétences</h3>{competences.map((p, index) => p.sources.length > 0 && <div key={index}><p className="text-sm font-medium">{p.mode === "nouvelle" ? p.intitule : referentiel.competences.find((c) => c.code === p.code)?.intitule ?? "Compétence proposée"}</p>{p.sources.map((source, i) => <blockquote key={i} className="mt-1 border-l-2 border-bordure pl-3 text-xs leading-relaxed text-texte-attenue">{source.citation}{source.page ? ` — page PDF ${source.page}` : ""}</blockquote>)}</div>)}</section>}
        </section>
        {(!confirme || (delegue && (c.codes.length + c.propositions.length > 0))) && <Bouton type="button" variante="principal" disabled={bloque || !choixComplet(c)} onClick={() => void confirmer(depot.id)}>{enregistrement ? "Enregistrement…" : delegue ? "Appliquer les compétences choisies" : "Appliquer ce choix"}</Bouton>}
        <a className="block text-sm text-primaire hover:underline" href={`/atelier?document=${encodeURIComponent(depot.id)}`}>Retrouver ce document dans Mes cours</a>
        {erreurs[depot.id] && <div className="space-y-2"><p role="alert" className="text-sm text-danger">{erreurs[depot.id]}</p>{onActualiser && <Bouton type="button" taille="petite" variante="secondaire" disabled={occupe || enregistrement} onClick={() => onActualiser(depot.id)}>Relire l’état enregistré</Bouton>}</div>}
      </section>;
    })}
    {autres > 0 && <p className="text-xs text-texte-attenue">{autres} autre(s) ressource(s) reste(nt) à lire. Elles sont conservées ; cette confirmation concerne uniquement les résultats ci-dessus.</p>}
    {erreurs.global && <p role="alert" className="text-sm text-danger">{erreurs.global}</p>}
  </form>;
}
