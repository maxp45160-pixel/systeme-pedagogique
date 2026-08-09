import { describe, expect, it } from "vitest";
import { validerUrlFournisseur } from "./url-fournisseur";
import { configVersEnv, FOURNISSEURS } from "./cle-client";

/*
 * SSRF — audit §2.7, 09/08/2026.
 *
 * `config.urlBase` est saisie dans les réglages, stockée en `localStorage` et
 * renvoyée au serveur à chaque appel. Elle arrivait telle quelle dans
 * `TUTEUR_URL_BASE`, et `compatible-openai.ts` faisait
 * `fetch(\`${base}/chat/completions\`)`. Un utilisateur authentifié pouvait
 * faire émettre au serveur une requête vers n'importe quelle adresse interne
 * et en relire les 300 premiers caractères.
 */

describe("validerUrlFournisseur — les cibles internes sont refusées", () => {
  const refusees = [
    ["http://api.mistral.ai/v1", "HTTPS"],
    ["ftp://exemple.test/v1", "HTTPS"],
    ["https://localhost:8080/v1", "bouclage"],
    ["https://127.0.0.1/v1", "bouclage"],
    ["https://[::1]/v1", "bouclage"],
    ["https://169.254.169.254/latest/meta-data", "lien-local"],
    ["https://10.0.0.5/v1", "réseau privé"],
    ["https://192.168.1.1/v1", "réseau privé"],
    ["https://172.16.0.1/v1", "réseau privé"],
    ["https://172.31.255.254/v1", "réseau privé"],
    ["https://100.64.0.1/v1", "réseau partagé"],
    ["https://consul.service.internal/v1", "domaine interne"],
    ["https://imprimante.local/v1", "domaine local"],
    ["https://[fd00::1]/v1", "réseau privé IPv6"],
    ["https://[fe80::1]/v1", "lien-local IPv6"],
  ] as const;

  for (const [url, attendu] of refusees) {
    it(`refuse ${url}`, () => {
      const r = validerUrlFournisseur(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motif).toContain(attendu);
    });
  }

  it("refuse les identifiants avant l'arobase — ils trompent la lecture", () => {
    const r = validerUrlFournisseur("https://interne@evil.test/v1");
    expect(r.ok).toBe(false);
  });

  it("refuse le vide et l'illisible plutôt que de deviner", () => {
    expect(validerUrlFournisseur("").ok).toBe(false);
    expect(validerUrlFournisseur("   ").ok).toBe(false);
    expect(validerUrlFournisseur("api.mistral.ai/v1").ok).toBe(false);
  });

  /*
   * 172.16.0.0/12 s'arrête à 172.31 : une expression trop large aurait refusé
   * des adresses publiques légitimes. Le refus doit être exact, pas prudent.
   */
  it("ne déborde pas hors du bloc 172.16/12", () => {
    expect(validerUrlFournisseur("https://172.15.0.1/v1").ok).toBe(true);
    expect(validerUrlFournisseur("https://172.32.0.1/v1").ok).toBe(true);
  });

  it("laisse passer un fournisseur public en HTTPS, y compris auto-hébergé", () => {
    // `custom` existe pour pointer un service que les presets ignorent : la
    // validation borne les cibles, elle ne réduit pas la fonctionnalité.
    expect(validerUrlFournisseur("https://mon-modele.exemple.fr/v1")).toEqual({
      ok: true,
      url: "https://mon-modele.exemple.fr/v1",
    });
    expect(validerUrlFournisseur("https://api.groq.com/openai/v1").ok).toBe(true);
  });

  it("accepte les URL de base de tous les presets livrés", () => {
    for (const preset of FOURNISSEURS) {
      if (!preset.urlBase) continue;
      expect(validerUrlFournisseur(preset.urlBase).ok, preset.cle).toBe(true);
    }
  });
});

describe("configVersEnv — le refus ne peut pas être ignoré", () => {
  it("refuse une config dont l'URL vise le réseau interne", () => {
    const r = configVersEnv({
      fournisseur: "custom",
      cle: "sk-test",
      urlBase: "http://169.254.169.254/latest/meta-data",
    });
    expect(r.ok).toBe(false);
  });

  it("refuse « custom » sans URL — aucun repli implicite vers un preset", () => {
    const r = configVersEnv({ fournisseur: "custom", cle: "sk-test" });
    expect(r.ok).toBe(false);
  });

  it("laisse passer un preset et pose l'URL validée", () => {
    const r = configVersEnv({ fournisseur: "mistral", cle: "sk-test" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.env.TUTEUR_URL_BASE).toBe("https://api.mistral.ai/v1");
      expect(r.env.TUTEUR_MOTEUR).toBe("compatible-openai");
    }
  });

  it("Anthropic n'a pas d'URL de base : rien à valider, rien à refuser", () => {
    const r = configVersEnv({ fournisseur: "anthropic", cle: "sk-ant-test" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
      expect(r.env.TUTEUR_URL_BASE).toBeUndefined();
    }
  });
});
