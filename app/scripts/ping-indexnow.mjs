/**
 * Ping IndexNow (Bing, Yandex, Seznam) après un déploiement.
 *
 * Lit le sitemap du site et soumet chaque URL au collecteur IndexNow. La clé
 * est validée par les moteurs via `public/<clé>.txt` — le fichier doit être
 * déployé pour que la soumission soit acceptée.
 *
 * Usage :
 *   SITE_URL=https://systeme-pedagogique-nine.vercel.app node scripts/ping-indexnow.mjs
 *
 * Google n'écoute pas IndexNow ; ce script accélère Bing (et donc ChatGPT /
 * Copilot), pas l'index Google.
 */

const cle = "9ab5f8f4cc9be955239ceaa9f6e725e2";
const site = process.env.SITE_URL;

if (!site) {
  console.error("SITE_URL manquant. Exemple : SITE_URL=https://… node scripts/ping-indexnow.mjs");
  process.exit(1);
}

const reponse = await fetch(`${site}/sitemap.xml`);
if (!reponse.ok) {
  console.error(`Sitemap inaccessible : ${reponse.status}`);
  process.exit(1);
}
const xml = await reponse.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (urls.length === 0) {
  console.error("Aucune URL trouvée dans le sitemap.");
  process.exit(1);
}

const envoi = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(site).host,
    key: cle,
    urlList: urls,
  }),
});

console.log(`IndexNow : ${urls.length} URL(s), statut ${envoi.status}`);
if (!envoi.ok) {
  console.error(await envoi.text());
  process.exit(1);
}
