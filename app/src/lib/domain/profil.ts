/**
 * Le profil déclaré d'un compte — et la distinction entre « déclaré » et
 * « pas encore rempli ».
 *
 * `profiles.formation`, `objectif_moyen_terme` et `objectif_long_terme` portent
 * en base des valeurs par défaut qui sont des LIBELLÉS D'INVITE, pas des
 * réponses : « Formation à renseigner ». Les transmettre au tuteur comme s'il
 * s'agissait de données produirait exactement l'invention que le protocole
 * anti-hallucination interdit (§7) — et les traiter comme vides sans le dire
 * priverait le tuteur de l'information « il faut le demander ».
 *
 * Cette distinction est devenue portante le 31/07/2026 : jusque-là le tuteur
 * recevait un profil écrit en dur dans les instructions (« Révise et approfondit
 * son BUT QLIO, prépare un Master ITI… »), envoyé à **tous** les comptes. Un
 * utilisateur tiers se voyait donc attribuer un diplôme et des objectifs qui
 * n'étaient pas les siens. Voir ADR-029.
 */

import type { User } from "./types";

/**
 * Marqueur des valeurs par défaut du schéma (`schema.sql` § 1) et de
 * `profilNeutre` (`lib/store/db.ts`). Les trois libellés le contiennent, et
 * aucune réponse réelle ne devrait le contenir.
 */
const INVITE = "à renseigner";

export function estRenseigne(valeur: string | undefined | null): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0 && !valeur.includes(INVITE);
}

/** La valeur si elle est réelle, `null` si c'est encore un libellé d'invite. */
export function valeurDeclaree(valeur: string | undefined | null): string | null {
  return estRenseigne(valeur) ? valeur!.trim() : null;
}

export interface ProfilDeclare {
  formation: string | null;
  objectifMoyenTerme: string | null;
  objectifLongTerme: string | null;
  preferencesPedagogiques: string[];
  /** Plan de travail rédigé par la personne, `null` s'il n'y en a pas. */
  plan: string | null;
  /** Vrai si rien n'a été déclaré : le tuteur doit demander, pas supposer. */
  vide: boolean;
}

export function profilDeclare(user: User): ProfilDeclare {
  const formation = valeurDeclaree(user.formation);
  const objectifMoyenTerme = valeurDeclaree(user.objectifMoyenTerme);
  const objectifLongTerme = valeurDeclaree(user.objectifLongTerme);
  const preferencesPedagogiques = (user.preferencesPedagogiques ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Le plan ne passe pas par `valeurDeclaree` : il n'a pas de libellé d'invite
  // en base — la colonne est nullable, sans DEFAULT.
  const plan = user.plan?.trim() ? user.plan.trim() : null;

  return {
    formation,
    objectifMoyenTerme,
    objectifLongTerme,
    preferencesPedagogiques,
    plan,
    // Un plan compte comme une déclaration : sans lui dans ce test, une
    // personne qui n'aurait écrit que son plan verrait le tuteur affirmer que
    // « rien n'a été déclaré » — et son plan tomberait avec le repli.
    vide:
      !formation &&
      !objectifMoyenTerme &&
      !objectifLongTerme &&
      preferencesPedagogiques.length === 0 &&
      !plan,
  };
}

/**
 * Sérialise le profil déclaré pour le tuteur.
 *
 * Ce qui n'est pas déclaré est nommé comme non déclaré, avec la consigne de le
 * demander. C'est la seule façon honnête de remplir la place qu'occupait un
 * profil écrit en dur.
 */
export function serialiserProfilDeclare(user: User): string {
  const p = profilDeclare(user);
  const lignes: string[] = ["## PROFIL DÉCLARÉ PAR L'UTILISATEUR"];

  if (p.vide) {
    lignes.push("");
    lignes.push(
      "Rien n'a encore été déclaré : ni formation, ni objectif, ni préférence.",
    );
    lignes.push(
      "N'INVENTE NI DIPLÔME NI OBJECTIF, et n'en déduis aucun de ses compétences ou de son référentiel. Demande-les — l'importance des compétences et la priorisation en dépendent.",
    );
    return lignes.join("\n");
  }

  lignes.push("");
  lignes.push(`Formation ou point de départ : ${p.formation ?? "non déclaré — à demander"}`);
  lignes.push(`Objectif à moyen terme : ${p.objectifMoyenTerme ?? "non déclaré — à demander"}`);
  lignes.push(`Objectif à long terme : ${p.objectifLongTerme ?? "non déclaré"}`);
  lignes.push(
    "Ces trois lignes sont ce que l'utilisateur a écrit lui-même. Ce qui est marqué non déclaré ne doit pas être supposé.",
  );

  if (p.preferencesPedagogiques.length > 0) {
    lignes.push("");
    lignes.push("Préférences pédagogiques déclarées (à respecter, jamais à inférer) :");
    for (const pref of p.preferencesPedagogiques) lignes.push(`- ${pref}`);
  }

  // Plan de travail détaillé (Chantier 14).
  if (p.plan) {
    lignes.push("");
    lignes.push("## PLAN DE TRAVAIL DÉCLARÉ");
    lignes.push("");
    lignes.push(p.plan);
    lignes.push("");
    lignes.push(
      "Ce plan est ce que l'utilisateur veut accomplir. Tiens-en compte pour prioriser les compétences et orienter les exercices, sans pour autant écarter les compétences qui ne figurent pas explicitement dans le plan.",
    );
  }

  return lignes.join("\n");
}
