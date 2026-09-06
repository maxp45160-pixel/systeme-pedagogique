"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { lireReformulationDepot, sauvegarderReformulationDepot } from "@/lib/store/depot-seance-actions";
import { terminerIntervention } from "@/lib/store/seance-actions";
import { Bouton } from "@/components/ui/primitives";

export function ReformulationDocumentaire({ sessionId, interventionId, sourceHref }: {sessionId:string;interventionId:string;sourceHref?:string}) {
  const router = useRouter();
  const [compris,setCompris] = useState("");
  const [flou,setFlou] = useState("");
  const [version,setVersion] = useState<string|null>(null);
  const [pret,setPret] = useState(false);
  const [lectureSeule,setLectureSeule] = useState(true);
  const [occupe,setOccupe] = useState(false);
  const [message,setMessage] = useState("");
  const [erreur,setErreur] = useState("");
  const verrou = useRef(false);
  useEffect(()=>{
    let actif=true;
    lireReformulationDepot(sessionId,interventionId).then((r)=>{
      if (!actif) return;
      setCompris(r.compris);setFlou(r.flou);setVersion(r.version);setLectureSeule(r.lectureSeule);setPret(true);
    }).catch((e)=>{if(actif)setErreur(e instanceof Error?e.message:"Écriture indisponible.");});
    return ()=>{actif=false;};
  },[sessionId,interventionId]);
  async function sauvegarder(terminer:boolean) {
    if(verrou.current)return;
    verrou.current=true;setOccupe(true);setErreur("");setMessage("");
    try {
      const r=await sauvegarderReformulationDepot(sessionId,interventionId,compris,flou,version);
      setVersion(r.version);setMessage("Votre texte est enregistré.");
      if(terminer) { const url=await terminerIntervention(sessionId,interventionId);setLectureSeule(true);router.push(url);router.refresh(); }
    }catch(e){setErreur(e instanceof Error?e.message:"Enregistrement impossible.");}
    finally{verrou.current=false;setOccupe(false);}
  }
  const champ="mt-2 w-full rounded-xl border border-bordure bg-surface p-3 text-sm text-texte";
  return <div className="space-y-4">
    <p className="text-sm text-texte-attenue">Relisez le passage, puis expliquez-le avec vos mots. Notez ensuite ce qui reste flou. Votre texte est conservé sans correction IA ni mesure de compétence.</p>
    {sourceHref && <a href={sourceHref} target="_blank" rel="noreferrer" className="text-sm text-primaire underline">Ouvrir le passage source</a>}
    <label className="block text-sm">Ce que j&apos;ai compris<textarea className={champ} rows={7} value={compris} maxLength={12000} disabled={!pret||lectureSeule||occupe} onChange={e=>{setCompris(e.target.value);setMessage("Texte modifié — pensez à enregistrer avant de quitter.");}} /></label>
    <label className="block text-sm">Ce qui reste flou<textarea className={champ} rows={3} value={flou} maxLength={4000} disabled={!pret||lectureSeule||occupe} onChange={e=>{setFlou(e.target.value);setMessage("Texte modifié — pensez à enregistrer avant de quitter.");}} /></label>
    <p role="status" className="text-sm text-texte-attenue">{message||(!pret&&!erreur?"Lecture de votre texte…":"")}</p>
    {erreur&&<p role="alert" className="text-sm text-danger">{erreur}</p>}
    {pret&&!lectureSeule&&<div className="flex flex-wrap gap-2"><Bouton disabled={occupe||!(compris.trim()||flou.trim())} onClick={()=>void sauvegarder(false)}>Enregistrer</Bouton><Bouton disabled={occupe||!(compris.trim()||flou.trim())} onClick={()=>void sauvegarder(true)}>Enregistrer et terminer</Bouton></div>}
  </div>;
}
