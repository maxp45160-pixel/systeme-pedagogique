/**
 * Projection des déclarations textuelles portées par le profil de compte.
 *
 * Les objectifs moyen/long terme restent la formulation humaine de départ.
 * Le moteur peut en dériver une priorité interne ; il ne transforme pas cette
 * déclaration en écran de gestion.
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
  objectifMoyenTerme: string | null;
  objectifLongTerme: string | null;
  preferencesPedagogiques: string[];
  vide: boolean;
}

export function profilDeclare(user: User): ProfilDeclare {
  const formation = valeurDeclaree(user.formation);
  const objectifMoyenTerme = valeurDeclaree(user.objectifMoyenTerme);
  const objectifLongTerme = valeurDeclaree(user.objectifLongTerme);
  const preferencesPedagogiques = (user.preferencesPedagogiques ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return {
    formation,
    objectifMoyenTerme,
    objectifLongTerme,
    preferencesPedagogiques,
    vide:
      !formation
      && !objectifMoyenTerme
      && !objectifLongTerme
      && preferencesPedagogiques.length === 0,
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
  lignes.push(`Objectif à moyen terme : ${p.objectifMoyenTerme ?? "non déclaré — à demander"}`);
  lignes.push(`Objectif à long terme : ${p.objectifLongTerme ?? "non déclaré"}`);
  lignes.push(
    "Les lignes ci-dessus sont les déclarations du compte. Ce qui est non déclaré ne doit pas être supposé.",
  );

  if (p.preferencesPedagogiques.length > 0) {
    lignes.push("", "Préférences pédagogiques déclarées (à respecter, jamais à inférer) :");
    for (const pref of p.preferencesPedagogiques) lignes.push(`- ${pref}`);
  }

  return lignes.join("\n");
}
