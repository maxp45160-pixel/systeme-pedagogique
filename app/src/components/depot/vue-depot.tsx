"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { IconeDocuments, IconeDossier, IconePlus, IconeFermer, IconeValide, IconeFleche } from "@/components/ui/icones";
import { depuisDepotGlisse, depuisSelection, fusionnerImports, identiteImport, nomImport, type FichierImport } from "@/lib/documents/import-depot";
import { creerDepotAction, lireDepotAction, corrigerDepotAction } from "@/lib/store/depot-actions";
import { preparerTeleversementPieceAction, enregistrerPieceJointeAction } from "@/lib/store/document-actions";
import { demarrerLectureDepot } from "@/lib/store/depot-seance-actions";
import { createNavigateurClient } from "@/lib/supabase/client";
import { BUCKET_PIECES_JOINTES, mimeDepuisNomFichier } from "@/lib/documents/pieces-jointes";
import { MAX_NOTE_DEPOT, type DepotDocumentaire, type PreparationAnalyseDepot, type SourceDepot } from "@/lib/documents/depot";

interface FichierReception extends FichierImport { etat:"attente"|"recu"|"echec"; erreur?:string; chemin?:string; envoye?:boolean }
const euros = (micro:number) => (micro/1_000_000).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2});
const champ = "mt-2 w-full rounded-xl border border-bordure bg-surface p-3 text-sm text-texte";
const messageErreur = (e:unknown) => e instanceof Error ? e.message : "L'opération n'a pas abouti.";

export function VueDepot({ documentInitial }: {documentInitial?:string}) {
  const router=useRouter();
  const [note,setNote]=useState("");
  const [noteConservee,setNoteConservee]=useState(false);
  const [chargementInitial,setChargementInitial]=useState(Boolean(documentInitial));
  const [fichiers,setFichiers]=useState<FichierReception[]>([]);
  const [depot,setDepot]=useState<DepotDocumentaire|null>(null);
  const [preparation,setPreparation]=useState<PreparationAnalyseDepot|null>(null);
  const [maximum,setMaximum]=useState(20);
  const [occupe,setOccupe]=useState("");
  const [erreur,setErreur]=useState("");
  const [refuses,setRefuses]=useState<string[]>([]);
  const [survol,setSurvol]=useState(false);
  const [correction,setCorrection]=useState<{elementId:string|null;texte:string;cle:string}|null>(null);
  const reception=useRef({cle:"",id:""});
  const verrou=useRef(false);
  const fichierInput=useRef<HTMLInputElement>(null);
  const dossierInput=useRef<HTMLInputElement>(null);
  const clesTravail=useRef(new Map<string,string>());
  useEffect(()=>{
    let actif=true;
    if(documentInitial) lireDepotAction(documentInitial).then(d=>{if(actif){setDepot(d);reception.current.id=d.id;}}).catch(e=>{if(actif)setErreur(messageErreur(e));}).finally(()=>{if(actif)setChargementInitial(false);});
    return()=>{actif=false;};
  },[documentInitial]);
  async function executer(libelle:string, action:()=>Promise<void>) {
    if(verrou.current)return;
    verrou.current=true;setOccupe(libelle);setErreur("");
    try{await action();}catch(e){setErreur(messageErreur(e));}
    finally{verrou.current=false;setOccupe("");}
  }
  function selection(ajouts:FichierImport[]) {
    const recus=fichiers.filter(f=>f.etat==="recu");
    const resultat=fusionnerImports(fichiers,ajouts,Math.max(0,(depot?.pieces.length??0)-recus.length),Math.max(0,(depot?.pieces.reduce((s,p)=>s+p.tailleOctets,0)??0)-recus.reduce((s,f)=>s+f.fichier.size,0)));
    setFichiers(resultat.fichiers.map(f=>fichiers.find(ancien=>identiteImport(ancien)===identiteImport(f))??{...f,etat:"attente"}));
    setRefuses(resultat.refuses);setErreur("");setPreparation(null);
  }
  async function recevoir() {
    await executer("Conservation du dépôt…",async()=>{
      reception.current.cle ||= crypto.randomUUID();
      reception.current.id ||= await creerDepotAction(note,reception.current.cle);
      setNoteConservee(true);
      const id=reception.current.id;
      for(const entree of fichiers){
        if(entree.etat==="recu")continue;
        try{
          const client=createNavigateurClient();
          if(!client)throw new Error("Connexion au stockage indisponible.");
          const mime=mimeDepuisNomFichier(entree.fichier.name);
          if(!mime)throw new Error("Format de fichier non reconnu.");
          if(!entree.envoye){
            const upload=await preparerTeleversementPieceAction(id,entree.fichier.name,mime);
            entree.chemin=upload.chemin;
            const resultat=await client.storage.from(BUCKET_PIECES_JOINTES).uploadToSignedUrl(upload.chemin,upload.token,entree.fichier,{contentType:mime});
            if(resultat.error)throw new Error("Le transfert du fichier a échoué.");
            entree.envoye=true;
          }
          await enregistrerPieceJointeAction(id,entree.chemin!,nomImport(entree),entree.fichier.size,mime);
          entree.etat="recu";entree.erreur=undefined;
        }catch(e){entree.etat="echec";entree.erreur=messageErreur(e);}
        setFichiers([...fichiers]);
      }
      setDepot(await lireDepotAction(id));setPreparation(null);
      window.history.replaceState(null,"",`/app?depot=${encodeURIComponent(id)}`);
    });
  }
  async function preparer() {
    if(!depot)return;
    await executer("Vérification des documents à lire…",async()=>{
      const r=await fetch(`/api/depot/analyser?${new URLSearchParams({documentId:depot.id,maximum:String(maximum)})}`);
      const data=await r.json();if(!r.ok)throw new Error(data.message);
      setPreparation(data);
    });
  }
  const analyseEnCours=depot?.analyses.some(a=>a.statut==="en-cours")??false;
  const depotId=depot?.id;
  useEffect(()=>{
    if(!depotId||!analyseEnCours||occupe)return;
    let actif=true;
    let enLecture=false;
    const timer=setInterval(()=>{
      if(enLecture)return;
      enLecture=true;
      lireDepotAction(depotId).then(d=>{if(actif)setDepot(d);}).catch(()=>{if(actif)setErreur("Connexion interrompue. Le suivi reprendra automatiquement.");}).finally(()=>{enLecture=false;});
    },5000);
    return()=>{actif=false;clearInterval(timer);};
  },[depotId,analyseEnCours,occupe]);
  async function analyser(reprise=false) {
    if(!depot||!preparation)return;
    await executer("Lecture par Mistral en cours…",async()=>{
      try {
        const r=await fetch("/api/depot/analyser",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentId:depot.id,empreinte:preparation.empreinte,maximum,consentement:true,reprise})});
        const data=await r.json();if(!r.ok)throw new Error(data.message);
        setDepot(data);setPreparation(null);
      } catch(e) {
        // Une réponse perdue ne doit pas masquer une analyse déjà démarrée.
        try { setDepot(await lireDepotAction(depot.id)); } catch { /* Garder l'erreur d'origine. */ }
        throw e;
      }
    });
  }
  async function travailler(source:SourceDepot) {
    if(!depot)return;
    await executer("Ouverture du travail…",async()=>{
      const key=JSON.stringify(source);if(!clesTravail.current.has(key))clesTravail.current.set(key,crypto.randomUUID());
      const id=await demarrerLectureDepot(depot.id,source,clesTravail.current.get(key)!);
      router.push(`/seances?session=${encodeURIComponent(id)}`);
    });
  }
  const hrefSource=(source:SourceDepot)=>source.pieceId ? `/api/depot/source?${new URLSearchParams({documentId:source.documentId,pieceId:source.pieceId})}#page=${source.page}` : `/atelier?document=${encodeURIComponent(source.documentId)}`;
  const attente=fichiers.filter(f=>f.etat!=="recu");
  const aUnRetour=depot?.analyses.some(a=>a.restitution)??false;
  const bloque=Boolean(occupe);
  return (
    <section className="space-y-6" aria-label="Dépôt documentaire">
      {chargementInitial && <p role="status">Ouverture de vos documents…</p>}
      {!chargementInitial && (
        <div className="overflow-hidden rounded-3xl border border-bordure bg-surface shadow-[var(--ombre-carte)]">
          {!depot ? (
            <div className="px-6 pt-8 md:px-10">
              <p className="text-xs font-medium uppercase tracking-widest text-primaire">Votre journée, en vrac</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Tout commence par ce que vous déposez.</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-texte-attenue">Vos notes, vos cours, les idées qui restent en tête. Posez-les ici, sans les classer.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bordure px-6 py-5 md:px-10">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primaire/10 text-primaire"><IconeValide className="size-4"/></span>
                <div><h2 className="font-semibold">Vos documents sont là.</h2><p className="mt-1 text-xs text-texte-attenue">{depot.pieces.length} fichier{depot.pieces.length>1?"s":""} conservé{depot.pieces.length>1?"s":""}{depot.note?" et votre note":""}</p></div>
              </div>
            </div>
          )}

          {!depot && <div className="px-6 pt-6 md:px-10">
            <label className="text-sm font-medium">Une pensée à garder ? <span className="font-normal text-texte-attenue">Facultatif</span>
              <textarea className={champ+" resize-y bg-fond/40"} rows={3} maxLength={MAX_NOTE_DEPOT} value={note} disabled={bloque||noteConservee} onChange={e=>setNote(e.target.value)} placeholder="Ce que je n’ai pas compris aujourd’hui, ce que je veux creuser…"/>
            </label>
          </div>}

          {depot && <div className="px-6 pt-7 md:px-10">
            {!aUnRetour && <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-widest text-primaire">La suite</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Faisons le point sur vos documents.</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-texte-attenue">Retrouvez les sujets abordés, les annotations importantes et ce qui mérite d’être éclairci. Vous pourrez corriger le retour, puis choisir un passage à travailler.</p>
            </div>}
            {!preparation && !analyseEnCours && <div className="mb-6">
              <Bouton variante="principal" disabled={bloque||attente.length>0} onClick={()=>void preparer()}>
                {aUnRetour?"Comprendre les pages suivantes":"Comprendre mes documents"} <IconeFleche className="ml-2 size-4"/>
              </Bouton>
              <p className="mt-2 text-xs text-texte-attenue">Vous verrez ce qui sera envoyé à Mistral avant de confirmer.</p>
            </div>}
            {preparation && <section aria-label="Autoriser la lecture par Mistral" className="mb-6 rounded-2xl bg-primaire/5 p-5 ring-1 ring-primaire/15">
              <h3 className="font-semibold">D’accord pour confier cette lecture à Mistral ?</h3>
              <p className="mt-2 text-sm text-texte-attenue">Les fichiers ci-dessous seront transmis à Mistral. Seules les pages indiquées seront analysées.</p>
              <ul className="mt-4 space-y-2 text-sm">{preparation.tranches.map(t=><li key={t.pieceId}><span className="font-medium">{t.nom}</span><span className="text-texte-attenue"> · pages {t.pages.join(", ")} sur {t.totalPages}</span></li>)}</ul>
              {preparation.noteIncluse&&<p className="mt-2 text-sm">Votre note sera aussi transmise.</p>}
              <p className="mt-4 text-sm">Au maximum <strong>{euros(preparation.coutMaximumMicroEuros)}</strong> pour cette lecture · {euros(preparation.budgetRestantMicroEuros)} disponibles sur les 5 € du mois.</p>
              {preparation.pagesRestantes>0&&<p className="mt-2 text-xs text-texte-attenue">{preparation.pagesRestantes} pages resteront disponibles pour une prochaine lecture, à votre demande.</p>}
              {preparation.motifIndisponible&&<p className="mt-4 rounded-lg bg-surface p-3 text-sm" role="status">{preparation.motifIndisponible}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <Bouton variante="principal" disabled={bloque||!preparation.disponible} onClick={()=>void analyser(Boolean(preparation.analyseExistante))}>{preparation.analyseExistante?"Autoriser une nouvelle tentative":"Autoriser et analyser"}</Bouton>
                <Bouton variante="discret" disabled={bloque} onClick={()=>setPreparation(null)}>Pas maintenant</Bouton>
              </div>
              <details className="mt-4 text-xs text-texte-attenue"><summary className="cursor-pointer">Analyser moins de pages à la fois</summary>
                <label className="mt-3 block">Nombre de pages<select className={champ} value={maximum} disabled={bloque} onChange={e=>{setMaximum(Number(e.target.value));setPreparation(null);}}>{[20,10,5,1].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
              </details>
            </section>}
          </div>}

          <div className="px-6 py-6 md:px-10">
            {depot && <details className="mb-4 text-sm">
              <summary className="cursor-pointer font-medium">Voir les fichiers et la note</summary>
              <ul className="mt-3 divide-y divide-bordure">{depot.pieces.map(p=><li key={p.id} className="flex items-center gap-3 py-3"><IconeDocuments className="size-4 shrink-0 text-primaire"/><a className="min-w-0 break-words text-primaire hover:underline" href={hrefSource({documentId:depot.id,pieceId:p.id,page:1,citation:""})} target="_blank" rel="noreferrer">{p.nom}</a></li>)}</ul>
              {depot.note&&<p className="mt-3 whitespace-pre-wrap rounded-xl bg-fond/50 p-4 text-texte-attenue">{depot.note}</p>}
            </details>}
            <div
              className={"rounded-2xl border border-dashed p-6 text-center transition-colors "+(survol?"border-primaire bg-primaire/10":"border-primaire/30 bg-primaire/[0.03]")}
              onDragOver={e=>{e.preventDefault();if(!bloque)setSurvol(true);}}
              onDragLeave={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))setSurvol(false);}}
              onDrop={e=>{e.preventDefault();setSurvol(false);if(!bloque){const lecture=depuisDepotGlisse(e.dataTransfer);void executer("Lecture des fichiers du dossier…",async()=>selection(await lecture));}}}
            >
              {!depot&&<IconeDossier className="mx-auto mb-3 size-8 text-primaire"/>}
              <p className="text-sm font-medium">{depot?"Ajouter des documents à ce dépôt":"Glissez vos fichiers ou un dossier ici"}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Bouton disabled={bloque} onClick={()=>fichierInput.current?.click()}><IconePlus className="mr-2 size-4"/>Ajouter des fichiers</Bouton>
                <Bouton disabled={bloque} onClick={()=>dossierInput.current?.click()}><IconeDossier className="mr-2 size-4"/>Choisir un dossier</Bouton>
              </div>
              <input ref={fichierInput} hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>{if(e.target.files)selection(depuisSelection(e.target.files));e.target.value="";}}/>
              <input ref={dossierInput} hidden type="file" multiple {...{webkitdirectory:""}} onChange={e=>{if(e.target.files)selection(depuisSelection(e.target.files));e.target.value="";}}/>
              <p className="mt-4 text-xs leading-relaxed text-texte-attenue">PDF et images · sous-dossiers inclus · 10 Mio par fichier<br/>Jusqu’à 100 fichiers et 100 Mio par dépôt. reMarkable : exportez en PDF.</p>
            </div>
            {fichiers.length>0&&<ul className="mt-4 max-h-64 divide-y divide-bordure overflow-y-auto text-sm" aria-label="Fichiers sélectionnés">
              {fichiers.map((f,i)=><li key={identiteImport(f)} className="flex items-center gap-3 py-3">
                <IconeDocuments className="size-4 shrink-0 text-texte-attenue"/>
                <div className="min-w-0 flex-1"><p className="break-words">{f.relatif}</p><p className="mt-1 text-xs text-texte-attenue">{f.etat==="recu"?"Enregistré":f.etat==="echec"?f.erreur:"Prêt à déposer"}</p></div>
                {f.etat==="recu"?<IconeValide className="size-4 shrink-0 text-primaire"/>:!f.envoye&&<button className="rounded-lg p-2 text-texte-attenue hover:bg-fond" aria-label={"Retirer "+f.relatif} disabled={bloque} onClick={()=>setFichiers(liste=>liste.filter((_,j)=>j!==i))}><IconeFermer className="size-4"/></button>}
              </li>)}
            </ul>}
            {refuses.length>0&&<details className="mt-4 rounded-xl border border-bordure p-3 text-sm"><summary className="cursor-pointer">{refuses.length} fichier{refuses.length>1?"s":""} non ajouté{refuses.length>1?"s":""} — voir pourquoi</summary><ul className="mt-2 max-h-48 space-y-2 overflow-auto text-xs text-texte-attenue">{refuses.map((r,i)=><li key={i}>{r}</li>)}</ul></details>}
            {(!depot||attente.length>0)&&<div className="mt-6 flex flex-wrap items-center gap-4">
              <Bouton variante="principal" disabled={bloque||(!note.trim()&&!attente.length)} onClick={()=>void recevoir()}>{depot?"Enregistrer les fichiers ajoutés":"Déposer"+(fichiers.length?" "+fichiers.length+" fichier"+(fichiers.length>1?"s":""):" ma note")}</Bouton>
              <span className="text-xs text-texte-attenue">Conservé dans votre espace privé. Aucun envoi à l’IA à cette étape.</span>
            </div>}
          </div>
        </div>
      )}
      {occupe&&<p role="status" className="flex items-center gap-3 text-sm text-primaire"><span className="size-2 rounded-full bg-primaire motion-safe:animate-pulse"/>{occupe}</p>}
      {erreur&&<p role="alert" className="rounded-xl border border-bordure bg-surface p-4 text-sm">{erreur}</p>}

      {depot?.analyses.map(a=><section key={a.id} className="rounded-3xl border border-bordure bg-surface p-6 md:p-10">
        <p className="text-xs font-medium uppercase tracking-widest text-primaire">{a.restitution?"Votre retour":"Lecture des documents"}</p>
        <h3 className="mt-2 text-2xl font-semibold">{a.restitution?"Voici ce qui ressort.":a.statut==="en-cours"?"Mistral lit vos documents…":"La lecture n’a pas abouti."}</h3>
        <p className="mt-2 text-xs text-texte-attenue">{new Date(a.creeLe).toLocaleString("fr-FR")}{a.restitution?" · Une lecture par l’IA, que vous pouvez corriger.":""}</p>
        {a.statut==="en-cours"&&<p className="mt-4 text-sm text-texte-attenue">Le résultat apparaîtra ici automatiquement. Vous pouvez revenir plus tard.</p>}
        {a.erreur&&<p className="mt-4 text-sm">{a.erreur}</p>}
        {!a.restitution&&<Bouton className="mt-4" disabled={bloque} onClick={()=>void preparer()}>Revoir la lecture à lancer</Bouton>}
        {a.pages.some(p=>p.incertain)&&<p className="mt-4 rounded-xl bg-fond/60 p-3 text-sm">Certains passages sont difficiles à lire. Gardez l’original à portée de main.</p>}
        {a.restitution?.elements.length===0&&<p className="mt-4 text-sm">Aucun point suffisamment fiable n’a pu être restitué. Vous pouvez consulter les originaux ci-dessous.</p>}
        <div className="mt-6 space-y-6">{a.restitution?.elements.map(e=><article key={e.id} className="border-t border-bordure pt-6">
          <p className="text-xs font-medium text-primaire">{e.nature==="incertitude"?"À éclaircir":e.nature==="annotation"?"Dans vos annotations":"Sujet repéré"}</p>
          <p className="mt-2 text-base leading-relaxed">{e.texte}</p>
          {e.sources.map((s,i)=><div key={i} className="mt-4 border-l-2 border-primaire/25 pl-4">
            <blockquote className="text-sm leading-relaxed text-texte-attenue">« {s.citation} »</blockquote>
            <a className="mt-2 inline-block text-xs text-primaire hover:underline" href={hrefSource(s)} target="_blank" rel="noreferrer">{s.pieceId?(depot.pieces.find(p=>p.id===s.pieceId)?.nom??"Fichier source")+", page "+s.page:"Votre note"}</a>
            <div className="mt-3"><Bouton taille="petite" disabled={bloque} onClick={()=>void travailler(s)}>Travailler ce passage <IconeFleche className="ml-2 size-4"/></Bouton></div>
            <p className="mt-2 text-xs text-texte-attenue">Relisez-le, expliquez avec vos mots et gardez vos questions. Sans note ni correction IA.</p>
          </div>)}
          <Bouton variante="discret" taille="petite" className="mt-3" disabled={bloque} onClick={()=>setCorrection({elementId:e.id,texte:"",cle:crypto.randomUUID()})}>Ce n’est pas tout à fait ça</Bouton>
          {depot.corrections.filter(c=>c.elementId===e.id).map(c=><p key={c.id} className="mt-2 rounded-xl bg-primaire/5 p-3 text-sm"><strong>Votre précision :</strong> {c.texte}</p>)}
        </article>)}</div>
        <details className="mt-6 border-t border-bordure pt-4 text-xs text-texte-attenue"><summary className="cursor-pointer">Quelles pages ont été lues ?</summary>{a.couvertures.map(c=><p key={c.pieceId} className="mt-2">{c.nom} : {c.pagesLues.join(", ")||"aucune page"} sur {c.totalPages} pages.</p>)}</details>
      </section>)}

      {depot&&<details className="rounded-2xl border border-bordure bg-surface/70 p-5 text-sm">
        <summary className="cursor-pointer font-medium">Je préfère travailler directement sur mes documents</summary>
        <p className="mt-3 max-w-xl text-texte-attenue">Choisissez un document. Vous pourrez le lire, expliquer ce que vous avez compris et noter vos questions, sans utiliser l’IA.</p>
        <div className="mt-4 space-y-2">{depot.pieces.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure py-3"><span className="min-w-0 break-words">{p.nom}</span><Bouton taille="petite" disabled={bloque} onClick={()=>void travailler({documentId:depot.id,pieceId:p.id,page:1,citation:""})}>Ouvrir un espace de travail</Bouton></div>)}</div>
        {depot.note&&<Bouton className="mt-3" disabled={bloque} onClick={()=>void travailler({documentId:depot.id,citation:depot.note.slice(0,1000)})}>Travailler à partir de ma note</Bouton>}
      </details>}
      {depot&&aUnRetour&&<>
        {depot.corrections.filter(c=>c.elementId===null).map(c=><p key={c.id} className="rounded-xl bg-surface p-4 text-sm"><strong>Votre précision :</strong> {c.texte}</p>)}
        <Bouton variante="discret" disabled={bloque} onClick={()=>setCorrection({elementId:null,texte:"",cle:crypto.randomUUID()})}>Il manque quelque chose dans ce retour</Bouton>
      </>}
      {correction&&depot&&<div className="rounded-2xl border border-primaire/30 bg-surface p-5">
        <label className="block text-sm font-medium">Qu’est-ce qu’il faut préciser ?<textarea autoFocus className={champ} value={correction.texte} maxLength={4000} rows={3} disabled={bloque} onChange={e=>setCorrection({...correction,texte:e.target.value})}/></label>
        <p className="my-3 text-xs text-texte-attenue">Votre précision sera conservée avec le retour. Cela ne relance pas l’IA.</p>
        <div className="flex gap-2"><Bouton disabled={bloque||!correction.texte.trim()} onClick={()=>void executer("Enregistrement…",async()=>{setDepot(await corrigerDepotAction(depot.id,correction.elementId,correction.texte,correction.cle));setCorrection(null);})}>Garder ma précision</Bouton><Bouton variante="discret" disabled={bloque} onClick={()=>setCorrection(null)}>Annuler</Bouton></div>
      </div>}
    </section>
  );
}
