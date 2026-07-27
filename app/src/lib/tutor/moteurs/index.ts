/**
 * Sélection du moteur du tuteur (ADR-007).
 *
 * `choisirConfiguration` est **pure** : elle prend un environnement et rend un
 * choix, sans rien instancier. C'est ce qui la rend testable sans clé ni
 * réseau. `creerMoteur` fait l'instanciation, séparément.
 */

import { MODELE_ANTHROPIC_PAR_DEFAUT, moteurAnthropic } from "./anthropic";
import { moteurCompatibleOpenAI } from "./compatible-openai";
import type { MoteurTuteur } from "./types";

export type { DemandeTuteur, MessageTuteur, MoteurTuteur } from "./types";

export type ChoixMoteur =
  | { kind: "anthropic"; cle: string; modele: string }
  | { kind: "compatible-openai"; cle: string; urlBase: string; modele: string }
  | { kind: "aucun"; raison: string };

/** Alias tolérés pour `TUTEUR_MOTEUR`, pour ne pas piéger sur l'ordre des mots. */
const ALIAS_COMPATIBLE = new Set([
  "compatible-openai",
  "openai-compatible",
  "openai",
  "gratuit",
]);

function vide(valeur: string | undefined): boolean {
  return valeur === undefined || valeur.trim() === "";
}

/**
 * Détermine le moteur à utiliser.
 *
 * Sans `TUTEUR_MOTEUR`, la détection est automatique et **privilégie le palier
 * gratuit** : c'est la contrainte posée le 27/07. La clé Anthropic ne sert
 * alors que de repli si aucun fournisseur gratuit n'est configuré.
 *
 * `aucun` n'est pas une erreur : l'interface bascule sur « copier le
 * contexte », qui reste un chemin parfaitement utilisable.
 */
export function choisirConfiguration(
  env: Record<string, string | undefined>,
): ChoixMoteur {
  const demande = env.TUTEUR_MOTEUR?.trim().toLowerCase();

  const cleAnthropic = env.ANTHROPIC_API_KEY;
  const cleCompatible = env.TUTEUR_CLE;
  const urlBase = env.TUTEUR_URL_BASE;
  const modeleDemande = env.TUTEUR_MODELE;

  const compatibleComplet =
    !vide(cleCompatible) && !vide(urlBase) && !vide(modeleDemande);

  if (demande !== undefined && demande !== "" && demande !== "auto") {
    if (demande === "anthropic") {
      return vide(cleAnthropic)
        ? {
            kind: "aucun",
            raison:
              "TUTEUR_MOTEUR=anthropic mais ANTHROPIC_API_KEY est absente de app/.env.local.",
          }
        : {
            kind: "anthropic",
            cle: cleAnthropic!,
            modele: vide(modeleDemande) ? MODELE_ANTHROPIC_PAR_DEFAUT : modeleDemande!,
          };
    }

    if (ALIAS_COMPATIBLE.has(demande)) {
      if (compatibleComplet) {
        return {
          kind: "compatible-openai",
          cle: cleCompatible!,
          urlBase: urlBase!,
          modele: modeleDemande!,
        };
      }
      const manquantes = [
        vide(cleCompatible) ? "TUTEUR_CLE" : null,
        vide(urlBase) ? "TUTEUR_URL_BASE" : null,
        vide(modeleDemande) ? "TUTEUR_MODELE" : null,
      ].filter((v): v is string => v !== null);
      return {
        kind: "aucun",
        raison: `Moteur compatible OpenAI demandé mais incomplet — manque : ${manquantes.join(", ")}.`,
      };
    }

    return {
      kind: "aucun",
      raison: `Valeur inconnue pour TUTEUR_MOTEUR : « ${demande} ». Attendu : anthropic, compatible-openai, ou auto.`,
    };
  }

  // Détection automatique — le gratuit d'abord.
  if (compatibleComplet) {
    return {
      kind: "compatible-openai",
      cle: cleCompatible!,
      urlBase: urlBase!,
      modele: modeleDemande!,
    };
  }
  if (!vide(cleAnthropic)) {
    return {
      kind: "anthropic",
      cle: cleAnthropic!,
      modele: vide(modeleDemande) ? MODELE_ANTHROPIC_PAR_DEFAUT : modeleDemande!,
    };
  }

  return {
    kind: "aucun",
    raison:
      "Aucun moteur configuré. Renseigne TUTEUR_CLE / TUTEUR_URL_BASE / TUTEUR_MODELE (palier gratuit) ou ANTHROPIC_API_KEY dans app/.env.local.",
  };
}

export function creerMoteur(choix: ChoixMoteur): MoteurTuteur | null {
  switch (choix.kind) {
    case "anthropic":
      return moteurAnthropic(choix.cle, choix.modele);
    case "compatible-openai":
      return moteurCompatibleOpenAI(choix.cle, choix.urlBase, choix.modele);
    case "aucun":
      return null;
  }
}

/** Libellé affiché dans le manifeste de l'interface. Ne divulgue aucune clé. */
export function decrireChoix(choix: ChoixMoteur): string {
  switch (choix.kind) {
    case "anthropic":
      return `${choix.modele} (Anthropic)`;
    case "compatible-openai":
      return `${choix.modele} (${choix.urlBase})`;
    case "aucun":
      return "aucun moteur configuré";
  }
}
