// Vrais composants React/CSS dans Edge ; aucune donnée ni service distant.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const racine = resolve('app');
const mocks = {
 '@/lib/store/marge-actions':'export const noterDansLaMarge=()=>{};export const basculerLigneMargeAction=()=>{};export const retirerLigneMargeAction=()=>{};',
 '@/components/seances/traiter-ligne-marge':'export const TraiterLigneMarge=()=>null;',
 '@/components/ui/palette-formules':'export const ApercuFormulesTexte=()=>null;export const PaletteFormules=()=>null;',
};
const entree = `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Modale} from '/src/components/ui/modale.tsx';
import {EtapeBesoin} from '/src/components/seances/etape-besoin.tsx';
import {ChampMarge} from '/src/components/seances/marge-cahier.tsx';
import '/src/app/globals.css';
function Recette(){
 const [parent,P]=useState(false),[enfant,E]=useState(false),[masquee,M]=useState(false);
 window.etat={parent,enfant,masquee};window.fermerParent=()=>P(false);
 return <main style={{padding:20}}><h1>Recette accessibilité</h1>
 <button id="ouvrir" onClick={()=>{M(false);P(true)}}>Ouvrir</button><button id="derriere">Arrière-plan</button>
 {parent&&<Modale titre="Fenêtre principale" masquee={masquee} onFermer={()=>P(false)}>
 <div data-focus-initial={location.search==='?initial'?true:undefined}>Contexte de la séance</div>
 <button id="enfant" onClick={()=>E(true)}>Ouvrir la seconde fenêtre</button>
 <button id="masquer" onClick={()=>M(true)}>Masquer</button>
 <h3 id="statique" tabIndex={-1}>Repère statique</h3>
 <button tabIndex={-1}>Exclu de la tabulation</button>
 <label htmlFor="reponse">Réponse</label><div id="reponse" role="textbox" aria-label="Réponse" contentEditable suppressContentEditableWarning>Texte éditable</div>
 </Modale>}
 {enfant&&<Modale titre="Seconde fenêtre" onFermer={()=>E(false)}><button id="fin-enfant" onClick={()=>E(false)}>Terminer</button></Modale>}
 </main>;
}
const noop=()=>{};
const props={themePrincipal:{cle:'synth',libelle:'Sujet synthétique',detail:'Test'},sourceTheme:'Test',suggestions:[],themesDeDomaine:[],themesDeCompetence:[],surChoisirTheme:noop,temps:'30',setTemps:noop,conseil:null,intention:'',setIntention:noop,intentionOuverte:false,setIntentionOuverte:noop,erreur:null};
createRoot(document.getElementById('root')).render(location.search==='?saisie'?<main><EtapeBesoin {...props}/><section aria-label="Bloc-notes"><ChampMarge variante="barre"/></section></main>:<Recette/>);`;
const server=await createServer({configFile:false,root:racine,logLevel:'error',
 resolve:{alias:[...Object.keys(mocks).map(find=>({find,replacement:'\0recette:'+find})),{find:/^@\//,replacement:racine.replaceAll('\\','/')+'/src/'}]},
 plugins:[{name:'recette',enforce:'pre',resolveId(id){if(id.startsWith('\0recette:')||id==='/recette.tsx')return id;},load(id){if(id.startsWith('\0recette:'))return mocks[id.slice(9)];if(id==='/recette.tsx')return entree;},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><head><title>Recette accessibilité</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/recette.tsx"></script></body></html>');}else next();});}}],server:{host:'127.0.0.1',port:0}});
let browser;const resultats=[];
try{
 await server.listen();browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();page.setDefaultTimeout(3000);
 const erreurs=[];page.on('pageerror',e=>erreurs.push(e.message));
 async function cas(nom,fn){try{await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);await page.locator('#ouvrir').click();await page.getByRole('dialog').waitFor();await fn();assert.deepEqual(erreurs,[]);resultats.push({nom,resultat:'passed'});}catch(e){resultats.push({nom,resultat:'failed',erreur:e.message});}}
 const focus=()=>page.evaluate(()=>document.activeElement?.id||document.activeElement?.getAttribute('aria-label'));
 await cas('Échap ferme seulement la fenêtre supérieure et restitue le focus',async()=>{
  await page.locator('#enfant').click();await page.getByRole('dialog',{name:'Seconde fenêtre',exact:true}).waitFor();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!window.etat.enfant);assert.equal(await page.evaluate(()=>window.etat.parent),true);
  await page.waitForFunction(()=>document.activeElement?.id==='enfant');
 });
 await cas('Le masquage restitue le focus sans démonter',async()=>{
  await page.locator('#masquer').click();await page.waitForFunction(()=>document.activeElement?.id==='ouvrir');
  assert.equal(await page.locator('[role=dialog]').count(),1);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.locator('#ouvrir').click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Fermer');
 });
 await cas('Tab boucle depuis le dernier éditeur contenteditable',async()=>{
  await page.locator('#reponse').focus();await page.keyboard.press('Tab');assert.equal(await focus(),'Fermer');
 });
 await cas('Shift+Tab boucle depuis une cible statique initiale',async()=>{
  await page.locator('#statique').focus();await page.keyboard.press('Shift+Tab');assert.equal(await focus(),'reponse');
 });
 await cas('Le verrou de défilement survit à la fermeture du parent',async()=>{
  await page.locator('#enfant').click();await page.getByRole('dialog',{name:'Seconde fenêtre',exact:true}).waitFor();
  await page.evaluate(()=>window.fermerParent());await page.waitForFunction(()=>!window.etat.parent);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.etat.enfant);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 });
 await cas('Boucle clavier et restitution à la fermeture normale',async()=>{
  await page.keyboard.press('Shift+Tab');assert.equal(await focus(),'reponse');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.id==='ouvrir');
 });
 await cas('Cible initiale non focalisable : entrée de secours dans la fenêtre',async()=>{
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?initial`);
  await page.locator('#ouvrir').click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Fermer');
 });
 for(const theme of ['light','dark'])for(const largeur of [320,1280])await cas(`Axe WCAG 2.1 AA et débordement : ${theme}, ${largeur}px`,async()=>{
  await page.setViewportSize({width:largeur,height:800});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.addScriptTag({path:require.resolve('axe-core')});
  const violations=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('[role=dialog]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
  assert.deepEqual(violations,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 await cas('Filtre de compétence : label associé et saisie conservée',async()=>{
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?saisie`);
  await page.getByRole('button',{name:'Choisir un autre sujet'}).click();
  const recherche=page.getByLabel('Une compétence précise',{exact:true});assert.equal(await recherche.count(),1);
  await page.getByText('Une compétence précise',{exact:true}).click();
  assert.equal(await recherche.evaluate(e=>e===document.activeElement),true);
  await recherche.fill('filtre synthétique');assert.equal(await recherche.inputValue(),'filtre synthétique');
 });
 await cas('Bloc-notes : bouton Noter visible au focus clavier',async()=>{
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?saisie`);
  const marge=page.getByRole('region',{name:'Bloc-notes'});
  await marge.getByLabel('Noter dans le bloc-notes').focus();await page.keyboard.press('Tab');
  const bouton=marge.getByRole('button',{name:'Noter',exact:true});
  const etat=await bouton.evaluate(e=>({focus:e===document.activeElement,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,clip:getComputedStyle(e).clip,type:e.type}));
  assert.equal(etat.focus,true);assert(etat.width>30);assert(etat.height>20);assert.equal(etat.clip,'auto');assert.equal(etat.type,'submit');
 });
 console.log(JSON.stringify(resultats,null,2));if(resultats.some(r=>r.resultat==='failed'))process.exitCode=1;
}finally{await browser?.close();await server.close();}
