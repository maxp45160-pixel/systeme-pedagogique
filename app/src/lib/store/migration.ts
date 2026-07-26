"use server";

/**
 * Import du journal JSON local vers le compte Supabase connecté.
 *
 * Sert une fois, au basculement : les preuves accumulées avant l'ouverture
 * des comptes (synthèse du 25/07) doivent survivre au changement de dorsale.
 *
 * Deux garde-fous, dans cet ordre :
 *   * l'import est **idempotent** — un upsert sur `(user_id, id)`, donc le
 *     relancer ne duplique rien ;
 *   * il **n'écrase jamais une collection déjà peuplée** côté compte, sauf
 *     demande explicite. Sans cela, un second clic après plusieurs séances
 *     de travail réécrirait l'historique distant avec un instantané périmé.
 */

import { revalidatePath } from "next/cache";
import { dorsaleCompte, lireJournalLocal, type Collections } from "./db";
import { TABLES, entiteVersLigne, verifier, type CleListe } from "./supabase-backend";

const COLLECTIONS: CleListe[] = [
  "evidence",
  "exercises",
  "attempts",
  "errors",
  "projects",
  "readings",
  "knowledge",
  "sessions",
  "objectives",
];

export interface RapportImport {
  ok: boolean;
  message: string;
  /** Nombre de lignes envoyées, par collection. */
  detail: Record<string, number>;
}

export async function importerJournalLocal(
  ecraser = false,
): Promise<RapportImport> {
  const dorsale = await dorsaleCompte();
  if (!dorsale) {
    return {
      ok: false,
      message:
        "Aucun compte connecté. Connectez-vous avant d'importer le journal local.",
      detail: {},
    };
  }

  const { supabase, userId } = dorsale;
  const detail: Record<string, number> = {};

  try {
    for (const nom of COLLECTIONS) {
      const elements = (await lireJournalLocal(nom)) as unknown as { id: string }[];
      if (elements.length === 0) continue;

      if (!ecraser) {
        const { count, error } = await supabase
          .from(TABLES[nom])
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        verifier(`inventaire de « ${nom} »`, error);
        if ((count ?? 0) > 0) {
          detail[nom] = 0;
          continue;
        }
      }

      const { error } = await supabase
        .from(TABLES[nom])
        .upsert(elements.map((e) => entiteVersLigne(e, userId)), {
          onConflict: "user_id,id",
        });
      verifier(`import de « ${nom} »`, error);
      detail[nom] = elements.length;
    }

    // Le profil local décrit un vrai parcours : on le reporte sur le compte,
    // mais seulement s'il n'a pas déjà été personnalisé côté Supabase.
    const profilLocal = (await lireJournalLocal("user")) as Collections["user"];
    const { data: profilDistant, error: erreurProfil } = await supabase
      .from("profiles")
      .select("formation")
      .eq("id", userId)
      .maybeSingle();
    verifier("lecture du profil", erreurProfil);

    const vierge =
      !profilDistant || profilDistant.formation === "Formation à renseigner";
    if (vierge || ecraser) {
      const { error } = await supabase
        .from("profiles")
        .update({
          formation: profilLocal.formation,
          objectif_moyen_terme: profilLocal.objectifMoyenTerme,
          objectif_long_terme: profilLocal.objectifLongTerme,
          debut_suivi: profilLocal.debutSuivi,
          preferences_pedagogiques: profilLocal.preferencesPedagogiques ?? [],
        })
        .eq("id", userId);
      verifier("import du profil", error);
      detail.profil = 1;
    }
  } catch (erreur) {
    return {
      ok: false,
      message: erreur instanceof Error ? erreur.message : "Échec de l'import.",
      detail,
    };
  }

  revalidatePath("/", "layout");

  const total = Object.values(detail).reduce((s, n) => s + n, 0);
  return {
    ok: true,
    message:
      total === 0
        ? "Rien à importer : le compte contient déjà des données, ou le journal local est vide."
        : `Import terminé — ${total} enregistrement(s) transféré(s) vers votre compte.`,
    detail,
  };
}
