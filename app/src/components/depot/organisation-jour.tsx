"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ModaleCompetence, type BrancheInitiale } from "@/components/referentiel/modale-competence";
import { Bouton } from "@/components/ui/primitives";
import { IconeFleche, IconeValide } from "@/components/ui/icones";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import {
  branchesProposeesDepot,
  derniereOrganisationDepot,
  rangementProposeDepot,
  type BrancheProposeeDepot,
  type ContexteOrganisationDepot,
} from "@/lib/documents/organisation-depot";
import { prefixeParDefaut } from "@/lib/domain/referentiel-compte";
import {
  lireContexteOrganisationDepotAction,
  marquerReferentielRessourceAction,
  rangerRessourceDepotAction,
} from "@/lib/store/depot-actions";

type Donnees = { ressources: DepotDocumentaire[]; referentiel: ContexteOrganisationDepot };
const messageErreur = (erreur: unknown) => erreur instanceof Error ? erreur.message : "L'opération n'a pas abouti.";

export function OrganisationJour({ documentIds }: { documentIds: string[] }) {
  const router = useRouter();
  const cleIds = documentIds.join("|");
  const [donnees,setDonnees] = useState<Donnees | null>(null);
  const [erreur,setErreur] = useState("");
  const [occupe,setOccupe] = useState(false);
  const [brancheOuverte,setBrancheOuverte] = useState<BrancheProposeeDepot | null>(null);

  const charger = useCallback(async () => {
    const ids = cleIds ? cleIds.split("|") : [];
    if (!ids.length) { setDonnees(null); return; }
    try {
      setErreur("");
      setDonnees(await lireContexteOrganisationDepotAction(ids));
    } catch (cause) {
      setErreur(messageErreur(cause));
    }
  }, [cleIds]);

  useEffect(() => {
    const ids = cleIds ? cleIds.split("|") : [];
    if (!ids.length) return;
    let actif = true;
    lireContexteOrganisationDepotAction(ids).then((resultat) => {
      if (actif) { setErreur("");setDonnees(resultat); }
    }).catch((cause) => {
      if (actif) setErreur(messageErreur(cause));
    });
    return () => { actif=false; };
  }, [cleIds]);

  const ressourcesAnalysees = useMemo(
    () => donnees?.ressources.filter((ressource) => derniereOrganisationDepot(ressource)) ?? [],
    [donnees],
  );
  const aRelire = useMemo(
    () => ressourcesAnalysees.filter((ressource) => ressource.referentielAnalyseId !== derniereOrganisationDepot(ressource)?.analyseId),
    [ressourcesAnalysees],
  );
  const branches = useMemo(
    () => donnees ? branchesProposeesDepot(aRelire,donnees.referentiel) : [],
    [aRelire,donnees],
  );

  async function terminerRevueReferentiel() {
    if (!donnees || !aRelire.length) return;
    setOccupe(true);setErreur("");
    try {
      const resultats = await Promise.allSettled(aRelire.map(async (ressource) => {
        const analyse = derniereOrganisationDepot(ressource);
        if (analyse) await marquerReferentielRessourceAction(ressource.id,analyse.analyseId,ressource.modifieLe);
      }));
      await charger();
      router.refresh();
      const echecs=resultats.filter((resultat)=>resultat.status==="rejected");
      if(echecs.length)setErreur(`${resultats.length-echecs.length} ressource${resultats.length-echecs.length>1?"s":""} confirmée${resultats.length-echecs.length>1?"s":""} ; ${echecs.length} échec${echecs.length>1?"s":""}. Réessayez les ressources encore affichées.`);
    } catch (cause) {
      setErreur(messageErreur(cause));
      await charger();
    } finally {
      setOccupe(false);
    }
  }

  if (!documentIds.length) return null;
  if (!donnees && !erreur) return <p role="status" className="text-sm text-texte-attenue">Préparation du rangement…</p>;
  if (!donnees) return <p role="alert" className="rounded-xl border border-bordure bg-surface p-4 text-sm">{erreur}</p>;
  if (!ressourcesAnalysees.length) return null;

  const existantesSuggerees = [...new Set(aRelire.flatMap((ressource) =>
    ressource.analyses.flatMap((analyse) => analyse.restitution?.version === 2
      ? analyse.restitution.organisation.competences.flatMap((competence) => competence.mode === "existante" ? [competence.code] : [])
      : []),
  ))].map((code) => donnees.referentiel.competences.find((competence) => competence.code === code)).filter(Boolean);

  return <section className="space-y-6" aria-label="Organiser les ressources du jour">
    {aRelire.length > 0 ? <div className="rounded-3xl border border-bordure bg-surface p-6 md:p-8">
      <p className="text-xs font-medium uppercase tracking-widest text-primaire">1. Référentiel</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Relisez ce que vos ressources pourraient ajouter.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-texte-attenue">Rien n’est créé automatiquement. Ouvrez une branche pour corriger ses compétences, ou terminez la revue sans rien ajouter.</p>

      {existantesSuggerees.length > 0 && <div className="mt-5 rounded-2xl bg-fond/60 p-4">
        <h3 className="text-sm font-medium">Déjà dans votre référentiel</h3>
        <ul className="mt-2 space-y-1 text-sm text-texte-attenue">{existantesSuggerees.map((competence) => competence && <li key={competence.code}><span className="font-mono text-xs">{competence.code}</span> · {competence.intitule}</li>)}</ul>
      </div>}

      {branches.length > 0 ? <ul className="mt-5 space-y-3">{branches.map((branche) => <li key={branche.cle} className="rounded-2xl border border-bordure p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-medium">{branche.domaine}</h3><p className="mt-1 text-xs text-texte-attenue">{branche.competences.length} compétence{branche.competences.length > 1 ? "s" : ""} proposée{branche.competences.length > 1 ? "s" : ""} depuis {branche.ressources.join(", ")}</p></div>
          <Bouton taille="petite" disabled={occupe} onClick={() => setBrancheOuverte(branche)}>Relire cette branche</Bouton>
        </div>
        <ul className="mt-3 space-y-1 text-sm">{branche.competences.map((competence) => <li key={competence.intitule}>{competence.intitule}</li>)}</ul>
      </li>)}</ul> : <p className="mt-5 text-sm text-texte-attenue">Aucune nouvelle compétence recevable n’est proposée.</p>}

      <div className="mt-6 border-t border-bordure pt-5">
        <Bouton variante="principal" disabled={occupe} onClick={() => void terminerRevueReferentiel()}>{occupe ? "Enregistrement…" : "Terminer la revue du référentiel"} <IconeFleche className="ml-2 size-4"/></Bouton>
        <p className="mt-2 text-xs text-texte-attenue">Ce geste confirme seulement la revue. Les ressources ne seront rangées qu’à l’étape suivante.</p>
      </div>
    </div> : <div className="flex items-center gap-3 rounded-2xl bg-primaire/5 px-5 py-4 text-sm"><IconeValide className="size-4 text-primaire"/><span>Le référentiel a été relu pour les analyses actuelles.</span></div>}

    {aRelire.length === 0 && <section className="space-y-4" aria-label="Ranger chaque ressource">
      <div><p className="text-xs font-medium uppercase tracking-widest text-primaire">2. Ressources</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Rangez chaque ressource à votre rythme.</h2><p className="mt-2 text-sm text-texte-attenue">Le domaine principal et les liens ne deviennent réels qu’après votre validation.</p></div>
      {ressourcesAnalysees.map((ressource) => <CarteRangement key={`${ressource.id}:${ressource.modifieLe}`} ressource={ressource} contexte={donnees.referentiel} onMaj={(maj) => { setDonnees((courantes) => courantes ? { ...courantes,ressources:courantes.ressources.map((item) => item.id === maj.id ? maj : item) } : courantes);router.refresh(); }}/>) }
    </section>}

    {erreur && <p role="alert" className="rounded-xl border border-bordure bg-surface p-4 text-sm">{erreur}</p>}

    {brancheOuverte && (() => {
      const initiale: BrancheInitiale = {
        domaine:brancheOuverte.domaine,
        prefixe:brancheOuverte.prefixe || prefixeParDefaut(brancheOuverte.domaine),
        description:brancheOuverte.description,
        justification:brancheOuverte.justification,
        competences:brancheOuverte.competences,
      };
      return <ModaleCompetence
        onFermer={() => setBrancheOuverte(null)}
        domainesExistants={donnees.referentiel.domaines}
        compteId={donnees.referentiel.compteId}
        {...(brancheOuverte.domaineId ? { domaineInitial:brancheOuverte.domaine } : {})}
        brancheInitiale={initiale}
        usageRequis={!brancheOuverte.domaineId}
        surEnregistre={() => { setBrancheOuverte(null);void charger(); }}
      />;
    })()}
  </section>;
}

function CarteRangement({ ressource,contexte,onMaj }: { ressource: DepotDocumentaire; contexte: ContexteOrganisationDepot; onMaj: (ressource: DepotDocumentaire) => void }) {
  const proposition = rangementProposeDepot(ressource,contexte);
  const derniere = derniereOrganisationDepot(ressource);
  const [titre,setTitre] = useState(proposition?.titre ?? ressource.titre);
  const [type,setType] = useState(proposition?.type ?? ressource.type);
  const [domaineId,setDomaineId] = useState(proposition?.domaineId ?? "");
  const [codes,setCodes] = useState<string[]>(proposition?.codes ?? ressource.competencesLiees);
  const [occupe,setOccupe] = useState(false);
  const [message,setMessage] = useState("");
  if (!proposition || !derniere) return null;

  function basculer(code: string) {
    setCodes((courants) => courants.includes(code) ? courants.filter((item) => item !== code) : [...courants,code]);
  }

  async function sauvegarder(aTrier: boolean) {
    if (!derniere) return;
    setOccupe(true);setMessage("");
    try {
      const maj = await rangerRessourceDepotAction(ressource.id,{
        titre,
        type,
        ...(aTrier ? {} : domaineId ? { domaineId } : {}),
        codes:aTrier ? ressource.competencesLiees : codes,
        analyseId:derniere.analyseId,
        aTrier,
      },ressource.modifieLe);
      setMessage(aTrier ? "Ressource conservée dans À trier." : "Ressource rangée.");
      onMaj(maj);
    } catch (cause) {
      setMessage(messageErreur(cause));
    } finally {
      setOccupe(false);
    }
  }

  const suggestions = new Set(proposition.codes);
  const dejaRangee = ressource.rangementAnalyseId === derniere.analyseId;
  return <article className="rounded-3xl border border-bordure bg-surface p-6 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{ressource.titre}</h3><p className="mt-1 text-xs text-texte-attenue">{ressource.sourceRelativePath ?? (ressource.pieces.length ? ressource.pieces[0]?.nom : "Note libre")}</p></div>{dejaRangee && <span className="rounded-full bg-primaire/10 px-3 py-1 text-xs text-primaire">{ressource.rangementStatut==="a-trier"?"À trier":"Rangement relu"}</span>}</div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">Titre<input className="mt-2 w-full rounded-xl border border-bordure bg-fond/40 p-3 text-sm" value={titre} maxLength={200} disabled={occupe} onChange={(event) => setTitre(event.target.value)}/></label>
      <label className="text-sm font-medium">Type de support<select className="mt-2 w-full rounded-xl border border-bordure bg-fond/40 p-3 text-sm" value={type} disabled={occupe} onChange={(event) => setType(event.target.value)}>{FORMATS_PAR_ROLE.support.map((format) => <option key={format.valeur} value={format.valeur}>{format.libelle}</option>)}</select></label>
      <label className="text-sm font-medium md:col-span-2">Domaine principal <span className="font-normal text-texte-attenue">facultatif</span><select className="mt-2 w-full rounded-xl border border-bordure bg-fond/40 p-3 text-sm" value={domaineId} disabled={occupe} onChange={(event) => setDomaineId(event.target.value)}><option value="">À trier</option>{contexte.domaines.map((domaine) => <option key={domaine.id} value={domaine.id}>{domaine.nom}</option>)}</select></label>
    </div>
    <fieldset className="mt-5"><legend className="text-sm font-medium">Compétences liées</legend><div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-bordure p-3">{contexte.competences.length ? contexte.competences.map((competence) => <label key={competence.code} className="flex items-start gap-3 rounded-lg p-2 text-sm hover:bg-fond/60"><input type="checkbox" className="mt-0.5 size-4" checked={codes.includes(competence.code)} disabled={occupe} onChange={() => basculer(competence.code)}/><span><span className="font-medium">{competence.intitule}</span><span className="ml-2 text-xs text-texte-attenue">{competence.domaineNom}{suggestions.has(competence.code) ? " · suggérée" : ""}</span></span></label>) : <p className="text-sm text-texte-attenue">Aucune compétence active. Revenez à l’étape Référentiel pour en créer une.</p>}</div></fieldset>
    <details className="mt-4 text-xs text-texte-attenue"><summary className="cursor-pointer">Pourquoi cette suggestion ?</summary><p className="mt-2">{derniere.organisation.justification}</p>{derniere.organisation.sources.map((source,index) => <blockquote key={index} className="mt-2 border-l-2 border-primaire/25 pl-3">« {source.citation} »</blockquote>)}</details>
    <div className="mt-6 flex flex-wrap items-center gap-3"><Bouton variante="principal" disabled={occupe || !titre.trim()} onClick={() => void sauvegarder(false)}>{occupe ? "Enregistrement…" : dejaRangee ? "Mettre à jour le rangement" : "Ranger cette ressource"}</Bouton><Bouton variante="discret" disabled={occupe || !titre.trim()} onClick={() => void sauvegarder(true)}>Laisser à trier</Bouton><Link className="text-sm text-primaire hover:underline" href={`/atelier?document=${encodeURIComponent(ressource.id)}`}>Ouvrir dans Mes cours</Link></div>
    {message && <p role="status" className="mt-3 text-sm text-texte-attenue">{message}</p>}
  </article>;
}
