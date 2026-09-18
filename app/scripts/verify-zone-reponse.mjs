// Recette isolée : vrais React et ZoneReponse, serveur et éditeur simulés.
// Requiert les outils de vérification déjà disponibles : Vite et Playwright.
// Aucun accès à Supabase ni à un fournisseur. Depuis la racine :
// node app/scripts/verify-zone-reponse.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const racine = resolve('app');
const modules = {
  'next/navigation': 'export const useRouter = () => ({push: u => window.destinations.push(u)});',
  '@/lib/store/actions': 'export const enregistrerReponse = (id, corps) => new Promise((resolve,reject) => window.envois.push({id,corps,resolve,reject}));',
  '@/lib/ui/hydratation': 'export const useEstHydrate = () => true;',
  '@/components/ui/palette-formules': 'export const PaletteFormules = () => null;',
  '@/lib/documents/insertion-formule-editeur': 'export const insererFormuleDansEditeur = () => {};',
  '@/components/atelier/editeur-document': `import React from 'react'; export const EditeurDirect = p => React.createElement('textarea', {'aria-label':p.ariaLabel, value:p.contenuInitialMd, readOnly:p.lectureSeule, onChange:e=>p.onSynchroniser(e.target.value), onKeyDown:p.onRaccourci});`,
  '@/components/ui/primitives': `import React from 'react'; export const Bouton = ({children,taille,variante,...p}) => React.createElement('button',p,children);`,
  './abandon': 'export const BoutonAbandon = () => null;',
};
const entree = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ZoneReponse} from '/src/components/exercices/zone-reponse.tsx';
window.envois=[]; window.destinations=[]; const root=createRoot(document.getElementById('root'));
window.afficher = (attemptId='a',valeur='Original',compteId='compte-test') => root.render(React.createElement(ZoneReponse,{attemptId,valeur,compteId,urlCorrection:'/corriger'}));
window.afficher();`;
const server = await createServer({
  configFile:false, root:racine, logLevel:'error',
  resolve:{alias:[...Object.keys(modules).map(find=>({find,replacement:'\0recette:'+find})),{find:/^@\//,replacement:racine.replaceAll('\\','/')+'/src/'}]},
  plugins:[{name:'recette-isolee',enforce:'pre',resolveId(id){if(id.startsWith('\0recette:'))return id;if(Object.hasOwn(modules,id))return '\0recette:'+id;},load(id){if(id.startsWith('\0recette:'))return modules[id.slice(9)];},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/recette.tsx"></script>');}else if(req.url==='/recette.tsx'){s.transformRequest('/entree-virtuelle.tsx').then(r=>{res.setHeader('Content-Type','application/javascript');res.end(r.code);}).catch(next);}else next();});}},{name:'entree',resolveId(id){if(id==='/entree-virtuelle.tsx')return id;},load(id){if(id==='/entree-virtuelle.tsx')return entree;}}],
  server:{host:'127.0.0.1',port:0},
});
let browser;
const resultats=[];
try{
 await server.listen();
 const adresse=server.httpServer.address();
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();
 page.setDefaultTimeout(5000);
 page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 page.on('pageerror',e=>console.error('Erreur navigateur:',e.message));
 async function frais(){await page.goto(`http://127.0.0.1:${adresse.port}`);await page.getByRole('textbox').waitFor();}
 async function cas(nom,fn){try{await frais();await fn();resultats.push({nom,resultat:'passed'});}catch(e){resultats.push({nom,resultat:'failed',erreur:e.message});}}
 const champ=()=>page.getByRole('textbox');
 const envoi=()=>page.waitForFunction(()=>window.envois.length>0);
 await cas('Changement de tentative : aucune réponse de la précédente',async()=>{
  await page.evaluate(()=>window.afficher('b','Réponse B'));
  await page.waitForFunction(()=>document.querySelector('textarea').value==='Réponse B',{},{timeout:1500});
 });
 await cas('Changement de compte : aucun brouillon du précédent',async()=>{
  await page.evaluate(()=>window.afficher('a','Compte B','autre-compte'));
  await page.waitForFunction(()=>document.querySelector('textarea').value==='Compte B',{},{timeout:1500});
 });
 await cas('Revenir au texte initial pendant un envoi garde la protection de fermeture',async()=>{
  await champ().fill('Modification en vol');await envoi();await champ().fill('Original');
  await page.waitForTimeout(450);
  const protege=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
  assert.equal(protege,true);
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('systeme-pedagogique:brouillon-reponse:a:compte-test'))),'Original');
 });
 await cas('Correction attend les deux écritures et résiste au double raccourci',async()=>{
  await champ().fill('Première réponse suffisamment détaillée');await envoi();
  await champ().fill('Dernière réponse suffisamment détaillée');await champ().press('Control+Enter');await champ().press('Control+Enter');
  assert.deepEqual(await page.evaluate(()=>window.destinations),[]);
  await page.evaluate(()=>window.envois[0].resolve());
  await page.waitForFunction(()=>window.envois.length===2);
  assert.equal(await page.evaluate(()=>window.envois[1].corps),'Dernière réponse suffisamment détaillée');
  await page.evaluate(()=>window.envois[1].resolve());await page.waitForFunction(()=>window.destinations.length===1);
 });
 await cas('Échec réseau : réponse conservée et aucune navigation',async()=>{
  await champ().fill('Ma réponse à conserver malgré une coupure');await champ().press('Control+Enter');await envoi();
  await page.evaluate(()=>window.envois[0].reject(new Error('Réseau indisponible')));
  await page.getByText('Réseau indisponible').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.destinations),[]);
  assert.equal(await champ().inputValue(),'Ma réponse à conserver malgré une coupure');
  assert.equal(await champ().isEditable(),true);
 });
 await cas('Réponse serveur perdue : réécrire le texte rétabli avant correction',async()=>{
  await champ().fill('Modification éventuellement écrite par le serveur');await envoi();
  await champ().fill('Original');
  await page.evaluate(()=>window.envois[0].reject(new Error('Réponse serveur perdue')));
  await page.getByText('Réponse serveur perdue').waitFor();
  await champ().press('Control+Enter');
  assert.deepEqual(await page.evaluate(()=>window.destinations),[]);
  await page.waitForFunction(()=>window.envois.length===2);
  assert.equal(await page.evaluate(()=>window.envois[1].corps),'Original');
  await page.evaluate(()=>window.envois[1].resolve());
  await page.waitForFunction(()=>window.destinations.length===1);
 });
 for(const issue of ['succès','échec'])await cas(`Ancien écran : son ${issue} ne remplace pas le nouveau brouillon`,async()=>{
  await champ().fill('Ancienne version en vol');await envoi();
  await page.evaluate(()=>window.afficher('b','Réponse B'));
  await page.waitForFunction(()=>document.querySelector('textarea').value==='Réponse B');
  await page.evaluate(()=>window.afficher('a','Original'));
  await page.waitForFunction(()=>document.querySelector('textarea').value==='Ancienne version en vol');
  await champ().fill('Dernière version à préserver');
  await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('systeme-pedagogique:brouillon-reponse:a:compte-test'))==='Dernière version à préserver');
  await page.evaluate(issue=>{if(issue==='succès')window.envois[0].resolve();else window.envois[0].reject(new Error('Ancien envoi perdu'));},issue);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('systeme-pedagogique:brouillon-reponse:a:compte-test'))),'Dernière version à préserver');
 });
 console.log(JSON.stringify(resultats,null,2));
 if(resultats.some(r=>r.resultat==='failed'))process.exitCode=1;
}finally{await browser?.close();await server.close();}
