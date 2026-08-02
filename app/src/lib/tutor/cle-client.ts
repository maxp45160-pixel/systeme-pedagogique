/**
 * Configuration du moteur du tuteur saisie côté client — stockage navigateur.
 *
 * Permet à l'utilisateur de renseigner sa propre clé API (Mistral, Anthropic,
 * Groq…) depuis les réglages, sans avoir à éditer `app/.env.local`. La config
 * est isolée par compte (`cleParCompte`) : deux comptes sur le même navigateur
 * ne partagent pas leur clé.
 *
 * `localStorage` et non `sessionStorage` : c'est un réglage qui doit survivre
 * à la fermeture de l'onglet, contrairement à la conversation ou aux brouillons
 * (qui sont du travail en cours).
 *
 * ⚠️ La clé circule en clair vers la route `/api/tutor` (même origine). Elle ne
 * quitte jamais le navigateur pour un tiers. C'est un compromis acceptable pour
 * un outil personnel ; il est rappelé dans l'interface.
 */

import { cleParCompte } from "@/lib/ui/stockage-session";

export type FournisseurTuteur =
  | "anthropic"
  | "mistral"
  | "groq"
  | "openrouter"
  | "custom";

export interface ConfigTuteurClient {
  fournisseur: FournisseurTuteur;
  cle: string;
  /** URL de base pour les fournisseurs « compatible OpenAI ». */
  urlBase?: string;
  modele?: string;
}

export interface PresetFournisseur {
  cle: FournisseurTuteur;
  libelle: string;
  /** URL de base pré-remplie pour les fournisseurs compatibles OpenAI. */
  urlBase?: string;
  modeleParDefaut?: string;
  /** `true` si le fournisseur utilise le moteur Anthropic (SDK dédié). */
  anthropic: boolean;
  aide?: string;
}

/**
 * Fournisseurs proposés dans l'interface.
 *
 * Un seul moteur couvre les paliers gratuits (compatible OpenAI) : il suffit de
 * changer l'URL de base et le modèle. Anthropic a son propre moteur (ADR-007).
 */
export const FOURNISSEURS: PresetFournisseur[] = [
  {
    cle: "mistral",
    libelle: "Mistral AI",
    urlBase: "https://api.mistral.ai/v1",
    modeleParDefaut: "mistral-large-latest",
    anthropic: false,
    aide: "Clé depuis console.mistral.ai → API Keys.",
  },
  {
    cle: "groq",
    libelle: "Groq (gratuit)",
    urlBase: "https://api.groq.com/openai/v1",
    modeleParDefaut: "llama-3.3-70b-versatile",
    anthropic: false,
    aide: "Clé depuis console.groq.com → API Keys.",
  },
  {
    cle: "openrouter",
    libelle: "OpenRouter",
    urlBase: "https://openrouter.ai/api/v1",
    modeleParDefaut: "anthropic/claude-3.5-sonnet",
    anthropic: false,
    aide: "Clé depuis openrouter.ai → Keys. Le modèle préfixe le fournisseur.",
  },
  {
    cle: "anthropic",
    libelle: "Anthropic (Claude)",
    modeleParDefaut: "claude-opus-4-8",
    anthropic: true,
    aide: "Clé depuis console.anthropic.com → API Keys.",
  },
  {
    cle: "custom",
    libelle: "Personnalisé (compatible OpenAI)",
    anthropic: false,
    aide: "Renseigne l'URL de base et le modèle manuellement.",
  },
];

/** Événement diffusé sur `window` quand la config change (save/efface). */
export const EVENEMENT_CHANGEMENT_CONFIG = "cle-tuteur:change";

function notifierChangement(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_CHANGEMENT_CONFIG));
}

function cleStockage(compteId: string): string {
  return cleParCompte("cle-tuteur", compteId);
}

/** Lit la config enregistrée pour ce compte, ou `null` si aucune clé valide. */
export function lireConfigTuteur(compteId: string): ConfigTuteurClient | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(cleStockage(compteId));
    if (!brut) return null;
    const config = JSON.parse(brut) as ConfigTuteurClient;
    if (!config || typeof config.cle !== "string" || config.cle.trim() === "") {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

/** Enregistre la config pour ce compte. */
export function ecrireConfigTuteur(compteId: string, config: ConfigTuteurClient): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleStockage(compteId), JSON.stringify(config));
    notifierChangement();
  } catch {
    // localStorage indisponible ou plein : on ignore.
  }
}

/** Efface la config enregistrée pour ce compte. */
export function effacerConfigTuteur(compteId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cleStockage(compteId));
    notifierChangement();
  } catch {
    // ignore
  }
}

/** Masque la clé pour l'affichage : ne montre que les derniers caractères. */
export function masquerCle(cle: string): string {
  if (cle.length <= 8) return "•".repeat(cle.length);
  return "•".repeat(Math.min(cle.length - 4, 12)) + cle.slice(-4);
}

/** Libellé affiché dans le manifeste du chat. Ne divulgue aucune clé. */
export function decrireConfigClient(config: ConfigTuteurClient): string {
  const preset = FOURNISSEURS.find((f) => f.cle === config.fournisseur);
  const modele = config.modele || preset?.modeleParDefaut || "?";
  if (config.fournisseur === "anthropic") return `${modele} (Anthropic, clé locale)`;
  const url = config.urlBase || preset?.urlBase || "?";
  return `${modele} (${url}, clé locale)`;
}

/**
 * Traduit la config client en variables d'environnement pour
 * `choisirConfiguration`. Le moteur est déterminé par le fournisseur.
 *
 * Utilisé côté serveur par la route `/api/tutor` : la config client prime sur
 * `app/.env.local`, ce qui permet d'utiliser le tuteur sans modifier le fichier.
 */
export function configVersEnv(config: ConfigTuteurClient): Record<string, string> {
  if (config.fournisseur === "anthropic") {
    return {
      ANTHROPIC_API_KEY: config.cle,
      ...(config.modele ? { TUTEUR_MODELE: config.modele } : {}),
    };
  }
  const preset = FOURNISSEURS.find((f) => f.cle === config.fournisseur);
  return {
    TUTEUR_MOTEUR: "compatible-openai",
    TUTEUR_CLE: config.cle,
    TUTEUR_URL_BASE: config.urlBase || preset?.urlBase || "",
    TUTEUR_MODELE: config.modele || preset?.modeleParDefaut || "",
  };
}