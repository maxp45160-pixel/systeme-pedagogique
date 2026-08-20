/**
 * Projection des seules déclarations encore portées par le profil de compte.
 *
 * Les objectifs structurés vivent dans `objectifs` et les chemins dans
 * `parcours`. Le profil ne doit donc plus les recopier sous forme de texte.
 */

import type { User } from "./types";

const INVITE = "à renseigner";

export function estRenseigne(valeur: string | undefined | null): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0 && !valeur.includes(INVITE);
}

export function valeurDeclaree(valeur: string | undefined | null): string | null {
  return estRenseigne(valeur) ? valeur!.trim() : null;
}

export interface ProfilDeclare {
  formation: string | null;
  preferencesPedagogiques: string[];
  vide: boolean;
}

export function profilDeclare(user: User): ProfilDeclare {
  const formation = valeurDeclaree(user.formation);
  const preferencesPedagogiques = (user.preferencesPedagogiques ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return {
    formation,
    preferencesPedagogiques,
    vide: !formation && preferencesPedagogiques.length === 0,
  };
}

export function serialiserProfilDeclare(user: User): string {
  const p = profilDeclare(user);
  const lignes: string[] = ["## PROFIL DÉCLARÉ PAR L'UTILISATEUR", ""];

  if (p.vide) {
    lignes.push(
      "Aucune formation ni préférence n'a encore été déclarée. N'INVENTE PAS ces informations : demande-les si elles sont nécessaires.",
    );
    return lignes.join("\n");
  }

  lignes.push(`Formation ou point de départ : ${p.formation ?? "non déclaré — à demander"}`);
  lignes.push(
    "Les lignes ci-dessus sont les déclarations du compte. Ce qui est non déclaré ne doit pas être supposé.",
  );

  if (p.preferencesPedagogiques.length > 0) {
    lignes.push("", "Préférences pédagogiques déclarées (à respecter, jamais à inférer) :");
    for (const pref of p.preferencesPedagogiques) lignes.push(`- ${pref}`);
  }

  return lignes.join("\n");
}
