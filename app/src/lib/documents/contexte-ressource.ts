/** Déclarations personnelles, jamais une interprétation de la compréhension. */
export interface DeclarationRessource { texte: string; declareLe: string }
export interface ContextePersonnelRessource {
  contexte?: DeclarationRessource;
  intention?: DeclarationRessource;
}
export const CHAMP_CONTEXTE_RESSOURCE = "contexte_ressource";
export const LIMITE_DECLARATION_RESSOURCE = 2000;

export function texteDeclarationValide(texte: unknown): texte is string {
  return typeof texte === "string" && texte.trim().length > 0
    && texte.length <= LIMITE_DECLARATION_RESSOURCE && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(texte);
}

/** Valeur absente = rien déclaré ; valeur invalide = erreur explicite. */
export function lireContexteRessource(frontmatter: Record<string, unknown>): ContextePersonnelRessource {
  const brut = frontmatter[CHAMP_CONTEXTE_RESSOURCE];
  if (brut === undefined) return {};
  try {
    if (typeof brut !== "string" || brut.length > 80000) throw new Error();
    const valeur = JSON.parse(decodeURIComponent(brut));
    if (!valeur || valeur.version !== 1 || Object.keys(valeur).some((k) => !["version", "contexte", "intention"].includes(k))) throw new Error();
    const resultat: ContextePersonnelRessource = {};
    for (const champ of ["contexte", "intention"] as const) {
      const declaration = valeur[champ];
      if (declaration === undefined) continue;
      if (!declaration || Object.keys(declaration).some((k) => !["texte", "declareLe"].includes(k))
        || !texteDeclarationValide(declaration.texte) || typeof declaration.declareLe !== "string"
        || !/^\d{4}-\d{2}-\d{2}T/.test(declaration.declareLe) || !Number.isFinite(Date.parse(declaration.declareLe))) throw new Error();
      resultat[champ] = { texte: declaration.texte, declareLe: declaration.declareLe };
    }
    return resultat;
  } catch { throw new Error("Le contexte personnel enregistré est invalide. Il n’a pas été remplacé."); }
}

/** Encodage scalaire réversible : les mots, accents et retours ligne sont préservés. */
export function champsContexteRessource(contexte: ContextePersonnelRessource): Record<string, string> {
  const champs = { [CHAMP_CONTEXTE_RESSOURCE]: encodeURIComponent(JSON.stringify({ version: 1, ...contexte })) };
  lireContexteRessource(champs);
  return champs;
}
