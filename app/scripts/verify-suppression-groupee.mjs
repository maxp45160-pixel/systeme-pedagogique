// Recette MENAGE-0001 : vrais composants React/CSS, actions différées en mémoire.
// Depuis la racine : node app/scripts/verify-suppression-groupee.mjs
// Aucun serveur Next/Supabase : seules next/navigation et document-actions sont simulées.
// refresh() compte les demandes sans remonter l'arbre ni relire de données serveur.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const racine = fileURLToPath(new URL('../', import.meta.url));
const prefixe = '\0suppression-recette:';
const mocks = {
  'next/navigation': `export const useRouter = () => ({refresh(){window.recette.rafraichissements++;}});`,
  '@/lib/store/document-actions': `
    export function supprimerArchivesAction(){
      window.recette.appels++;
      return new Promise((resolve,reject)=>{
        window.recette.reussir = resolve;
        window.recette.echouer = (message)=>reject(new Error(message));
      });
    }
    const interdit=()=>{throw new Error('Action individuelle hors recette');};
    export const archiverDocumentAction=interdit;
    export const restaurerDocumentAction=interdit;
    export const supprimerDocumentAction=interdit;
  `,
};
const entree = `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {VueRessources} from '/src/components/atelier/vues-ressources-atelier.tsx';
  import '/src/app/globals.css';
  window.recette={appels:0,rafraichissements:0};
  const elements=['archive-a','archive-b'].map((id,i)=>({
    id,titre:'Archive synthétique '+(i+1),type:'cours',typeLibelle:'Cours',
    categorie:'ressource',rangement:{zone:'ressource',rattachements:[]},
    contenuMd:'',contenuCharge:true,frontMatter:{archive:true},liens:[],
    sortants:[],entrants:[],snapshots:[],tentatives:[],source:'document',lectureSeule:false,
  }));
  const noop=()=>{};
  createRoot(document.getElementById('root')).render(<main>
    <VueRessources elements={elements} ouvrirElement={noop} changerVue={noop}
      competencesParCode={new Map()} nomsDomaines={{}} domaineDeCompetence={{}} statut="archives"/>
  </main>);
`;
const server = await createServer({
  configFile: false, root: racine, logLevel: 'error',
  resolve: { alias: [
    ...Object.keys(mocks).map(find => ({ find, replacement: prefixe + find })),
    { find: /^@\//, replacement: racine.replaceAll('\\', '/') + 'src/' },
  ] },
  plugins: [{
    name: 'suppression-groupee-recette', enforce: 'pre',
    resolveId(id) { if (id.startsWith(prefixe) || id === '/recette.tsx') return id; },
    load(id) {
      if (id.startsWith(prefixe)) return mocks[id.slice(prefixe.length)];
      if (id === '/recette.tsx') return entree;
    },
    configureServer(s) {
      s.middlewares.use((req, res, next) => {
        if (req.url === '/') {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><html lang="fr"><head><title>Recette suppression groupée</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/recette.tsx"></script></body></html>');
        } else next();
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
});

let browser;
const resultats = [];
try {
  await server.listen();
  const origine = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  async function cas(nom, verifier) {
    const page = await browser.newPage();
    page.setDefaultTimeout(4000);
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    // Les ressources et modules sont locaux ; tout autre accès réseau est bloqué.
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origine) return route.continue();
      erreurs.push(`Accès externe interdit : ${route.request().url()}`);
      return route.abort();
    });
    try {
      await page.goto(origine);
      await page.getByRole('button', { name: 'Tout supprimer (2)', exact: true }).click();
      await page.getByRole('dialog', { name: 'Supprimer définitivement les archives', exact: true }).waitFor();
      await verifier(page);
      assert.deepEqual(erreurs, [], 'Aucune exception navigateur ni accès externe');
      resultats.push({ nom, resultat: 'passed' });
    } catch (e) {
      resultats.push({ nom, resultat: 'failed', erreur: e.message, erreursNavigateur: erreurs });
    } finally {
      await page.close();
    }
  }
  const confirmation = page => page.getByRole('dialog', { name: 'Supprimer définitivement les archives', exact: true });
  const confirmer = page => confirmation(page).getByRole('button', { name: /^Tout supprimer définitivement(?:\s*Chargement…)?$/ });
  // Laisse React publier ses transitions après les microtâches, sans délai réseau arbitraire.
  const publier = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function lancer(page) {
    await confirmer(page).click();
    await page.waitForFunction(() => window.recette.appels === 1);
    await publier(page);
  }
  async function attente(page) {
    return {
      confirmationVisible: await confirmation(page).isVisible(),
      confirmationIndisponible: await confirmer(page).count() === 1 && await confirmer(page).isDisabled(),
      annulationIndisponible: await confirmation(page).getByRole('button', { name: 'Annuler', exact: true }).count() === 1
        && await confirmation(page).getByRole('button', { name: 'Annuler', exact: true }).isDisabled(),
      rafraichissements: await page.evaluate(() => window.recette.rafraichissements),
    };
  }
  await cas('Succès différé : confirmation conservée et boutons indisponibles jusqu’au résultat', async page => {
    await lancer(page);
    const pendant = await attente(page);
    await page.evaluate(() => window.recette.reussir({ supprimees: 2, echecs: [] }));
    const bilan = page.getByRole('dialog', { name: 'Archives supprimées', exact: true });
    await bilan.waitFor();
    assert.match(await bilan.innerText(), /2 ressources supprimées/);
    assert.equal(await confirmation(page).count(), 0);
    assert.equal(await page.evaluate(() => window.recette.rafraichissements), 1);
    assert.deepEqual(pendant, {
      confirmationVisible: true, confirmationIndisponible: true,
      annulationIndisponible: true, rafraichissements: 0,
    });
  });
  await cas('Rejet différé : erreur visible, confirmation conservée et nouvel essai possible', async page => {
    await lancer(page);
    await page.evaluate(() => window.recette.echouer('Échec synthétique du réseau'));
    await publier(page);
    const apres = {
      confirmationVisible: await confirmation(page).isVisible(),
      erreurVisible: await page.getByText('Échec synthétique du réseau', { exact: true }).isVisible(),
      nouvelEssaiPossible: await confirmer(page).count() === 1 && await confirmer(page).isEnabled(),
      rafraichissements: await page.evaluate(() => window.recette.rafraichissements),
    };
    assert.deepEqual(apres, {
      confirmationVisible: true, erreurVisible: true, nouvelEssaiPossible: true, rafraichissements: 0,
    });
    await confirmer(page).click();
    await page.waitForFunction(() => window.recette.appels === 2);
    await page.evaluate(() => window.recette.reussir({ supprimees: 2, echecs: [] }));
    await page.getByRole('dialog', { name: 'Archives supprimées', exact: true }).waitFor();
  });
  await cas('Succès partiel : bilan du nombre supprimé et du refus conservé', async page => {
    await lancer(page);
    await page.evaluate(() => window.recette.reussir({
      supprimees: 1, echecs: [{ id: 'archive-b', motif: 'Archive synthétique 2 : historique conservé' }],
    }));
    const bilan = page.getByRole('dialog', { name: 'Suppression partielle', exact: true });
    await bilan.waitFor();
    await publier(page);
    assert.match(await bilan.innerText(), /1 ressource supprimée/);
    assert.match(await bilan.innerText(), /1 ressource n'a pas pu être supprimée/);
    assert.equal(await bilan.getByText('Archive synthétique 2 : historique conservé', { exact: true }).isVisible(), true);
    assert.equal(await confirmation(page).count(), 0);
    assert.equal(await page.evaluate(() => window.recette.rafraichissements), 1);
    await bilan.getByRole('button', { name: 'Fermer', exact: true }).filter({ hasText: 'Fermer' }).click();
    await bilan.waitFor({ state: 'detached' });
  });
  console.log(JSON.stringify(resultats, null, 2));
  if (resultats.some(r => r.resultat === 'failed')) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
