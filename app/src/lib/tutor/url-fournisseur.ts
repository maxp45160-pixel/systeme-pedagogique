/**
 * Validation de l'URL de base du fournisseur — module pur, testable sans réseau.
 *
 * ## Le défaut
 *
 * `config.urlBase` est saisie dans les réglages, stockée en `localStorage`, et
 * renvoyée telle quelle au serveur à chaque appel. `configVersEnv` la plaçait
 * dans `TUTEUR_URL_BASE`, et `compatible-openai.ts` faisait
 * `fetch(\`${base}/chat/completions\`)` — sans jamais la regarder. Les sept
 * routes SSE fusionnaient la config client dans l'environnement du serveur.
 *
 * Un utilisateur authentifié pouvait donc faire émettre au serveur une requête
 * POST vers **n'importe quelle adresse** — y compris les adresses internes de
 * l'hébergeur — et en relire les 300 premiers caractères de réponse, que
 * `compatible-openai.ts` recopie dans son message d'erreur. C'est une SSRF.
 *
 * ## Pourquoi pas une liste blanche d'hôtes
 *
 * Le fournisseur `custom` existe précisément pour pointer un service que la
 * liste des presets ne connaît pas — un modèle auto-hébergé, un palier gratuit
 * nouveau. N'accepter que les hôtes des presets supprimerait la fonctionnalité
 * au lieu de la sécuriser.
 *
 * On interdit donc les **cibles**, pas les fournisseurs : tout ce qui n'est pas
 * joignable depuis l'Internet public n'a rien à faire ici. Un fournisseur d'API
 * est sur une adresse publique, en HTTPS ; les adresses de bouclage, privées et
 * lien-local ne désignent que la machine du serveur ou son réseau interne.
 *
 * ## ⚠️ Ce que ce module ne couvre PAS
 *
 * Le **rebinding DNS** : un nom public qui résout vers `169.254.169.254` passe
 * cette validation, parce qu'elle s'exerce sur la chaîne et non sur l'adresse
 * finalement contactée. S'en protéger demanderait de résoudre le nom puis
 * d'épingler l'IP pour la connexion, ce que `fetch` ne permet pas ici. Le
 * risque résiduel est écrit plutôt que tu : une protection qu'on croit totale
 * est plus dangereuse qu'une protection dont on connaît le bord.
 */

/** Familles d'adresses qui ne désignent jamais un fournisseur d'API public. */
const MOTIFS_HOTES_INTERNES: { motif: RegExp; nom: string }[] = [
  { motif: /^localhost$/i, nom: "bouclage" },
  { motif: /^127\./, nom: "bouclage" },
  { motif: /^\[?::1\]?$/, nom: "bouclage" },
  { motif: /^0\./, nom: "adresse nulle" },
  { motif: /^10\./, nom: "réseau privé" },
  // 172.16.0.0/12 — de 172.16 à 172.31, pas au-delà.
  { motif: /^172\.(1[6-9]|2\d|3[01])\./, nom: "réseau privé" },
  { motif: /^192\.168\./, nom: "réseau privé" },
  // 169.254.0.0/16 — lien-local, dont 169.254.169.254 (métadonnées cloud).
  { motif: /^169\.254\./, nom: "lien-local" },
  // 100.64.0.0/10 — CGNAT, employé par certains réseaux d'hébergeurs.
  { motif: /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, nom: "réseau partagé" },
  // IPv6 : fc00::/7 (unique local) et fe80::/10 (lien-local).
  { motif: /^\[?f[cd][0-9a-f]{2}:/i, nom: "réseau privé IPv6" },
  { motif: /^\[?fe[89ab][0-9a-f]:/i, nom: "lien-local IPv6" },
  { motif: /\.local$/i, nom: "domaine local" },
  { motif: /\.internal$/i, nom: "domaine interne" },
  { motif: /\.localhost$/i, nom: "domaine local" },
];

export type ValidationUrl =
  | { ok: true; url: string }
  | { ok: false; motif: string };

/**
 * L'URL est-elle une cible acceptable pour un appel sortant du serveur ?
 *
 * Refuse plutôt que de corriger : une URL qu'on « répare » silencieusement
 * n'est plus celle que la personne a saisie, et l'écart ne se verrait nulle
 * part. Le motif est renvoyé pour être affiché.
 */
export function validerUrlFournisseur(brut: string): ValidationUrl {
  const candidat = brut.trim();
  if (candidat === "") return { ok: false, motif: "L'URL du fournisseur est vide." };

  let url: URL;
  try {
    url = new URL(candidat);
  } catch {
    return {
      ok: false,
      motif: `URL du fournisseur illisible : « ${candidat} ». Attendu une adresse complète, par exemple https://api.mistral.ai/v1`,
    };
  }

  // HTTPS seulement. `http:` exposerait la clé API en clair sur le réseau, et
  // les autres schémas (`file:`, `gopher:`…) sont des vecteurs classiques.
  if (url.protocol !== "https:") {
    return {
      ok: false,
      motif: `L'URL du fournisseur doit être en HTTPS (reçu « ${url.protocol.replace(":", "")} ») : la clé API y circule.`,
    };
  }

  // `https://interne@fournisseur.example/` : la partie avant l'arobase trompe
  // la lecture humaine et certains analyseurs. Aucun fournisseur n'en a besoin.
  if (url.username !== "" || url.password !== "") {
    return {
      ok: false,
      motif: "L'URL du fournisseur ne doit pas contenir d'identifiants avant l'arobase.",
    };
  }

  const hote = url.hostname;
  const interne = MOTIFS_HOTES_INTERNES.find((h) => h.motif.test(hote));
  if (interne) {
    return {
      ok: false,
      motif: `« ${hote} » est une adresse ${interne.nom} : le serveur ne s'adresse qu'à des fournisseurs joignables publiquement.`,
    };
  }

  return { ok: true, url: candidat };
}
