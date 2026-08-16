/**
 * Diagnostic système et sécurité — côté serveur uniquement.
 *
 * Collecte l'état d'infrastructure et de sécurité sans jamais exposer
 * de secrets ou clés d'API (seule la présence/absence est signalée).
 */

import "server-only";

import { dorsaleCompte } from "./db";
import { supabaseConfigure } from "@/lib/supabase/config";
import { choisirConfiguration } from "@/lib/tutor/moteurs";

export interface DiagnosticSysteme {
  baseDeDonnees: {
    configuree: boolean;
    joignable: boolean;
    latenceMs: number;
    erreur: string | null;
  };
  ia: {
    tuteurServeurActif: boolean;
    moteurServeur: string;
    modeleDefaut: string;
    gemini: boolean;
    mistral: boolean;
    openai: boolean;
    anthropic: boolean;
    tuteurCompatible: boolean;
  };
  environnement: {
    nodeEnv: string;
    estProduction: boolean;
    heureServeurUtc: string;
    versionNode: string;
  };
  securite: {
    rlsActive: boolean;
    protectionPairsAdmin: boolean;
    variablesSensiblesIsolees: boolean;
  };
}

export async function obtenirDiagnosticSysteme(): Promise<DiagnosticSysteme> {
  const debut = Date.now();
  let dbJoignable = false;
  let latenceMs = 0;
  let dbErreur: string | null = null;

  if (supabaseConfigure) {
    try {
      const { supabase } = await dorsaleCompte();
      const { error } = await supabase.from("comptes_acces").select("user_id").limit(1);
      latenceMs = Date.now() - debut;
      if (error) {
        dbErreur = error.message;
      } else {
        dbJoignable = true;
      }
    } catch (e) {
      latenceMs = Date.now() - debut;
      dbErreur = e instanceof Error ? e.message : "Erreur inconnue de connexion DB";
    }
  }

  const choixMoteur = choisirConfiguration(process.env);
  const gemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const mistral = Boolean(process.env.MISTRAL_API_KEY);
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const tuteurCompatible = Boolean(process.env.TUTEUR_CLE);

  let moteurServeur = "Aucun (clé client dans le navigateur)";
  let modeleDefaut = "Non configuré côté serveur";
  if (choixMoteur.kind === "anthropic") {
    moteurServeur = "Anthropic Claude";
    modeleDefaut = `Anthropic (${choixMoteur.modele})`;
  } else if (choixMoteur.kind === "compatible-openai") {
    moteurServeur = "Compatible OpenAI";
    modeleDefaut = `${choixMoteur.modele}`;
  }

  return {
    baseDeDonnees: {
      configuree: supabaseConfigure,
      joignable: dbJoignable,
      latenceMs,
      erreur: dbErreur,
    },
    ia: {
      tuteurServeurActif: choixMoteur.kind !== "aucun",
      moteurServeur,
      modeleDefaut,
      gemini,
      mistral,
      openai,
      anthropic,
      tuteurCompatible,
    },
    environnement: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      estProduction: process.env.NODE_ENV === "production",
      heureServeurUtc: new Date().toISOString(),
      versionNode: process.version,
    },
    securite: {
      rlsActive: true,
      protectionPairsAdmin: true,
      variablesSensiblesIsolees: !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}
