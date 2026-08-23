/**
 * Lecture de l'accès — côté serveur uniquement (ADR-074).
 *
 * Deux lectures, et rien d'autre : l'accès du compte courant, et la liste
 * complète pour le panel. Aucune écriture ici — elles vivent dans
 * `acces-actions.ts`, qui est un module `"use server"`.
 *
 * Ces fonctions ne décident de rien : elles rapportent ce que RLS a bien voulu
 * rendre. `admin_comptes()` refuse d'elle-même un appelant non administrateur ;
 * si elle répondait quand même, la page qui l'appelle n'aurait aucun moyen de
 * le savoir. C'est la base qui tranche, ici comme ailleurs.
 */

import "server-only";

import { cache } from "react";
import { dorsaleCompte } from "./db";
import { verifier } from "./supabase-backend";
import { estRoleConnu, type CompteAdministre, type RoleCompte } from "@/lib/domain/acces";

export interface AccesCourant {
  userId: string;
  role: RoleCompte;
  suspenduLe: string | null;
  motif: string | null;
}

/**
 * L'accès du compte connecté.
 *
 * `null` quand la ligne n'existe pas encore — le trigger d'inscription n'a pas
 * tourné, ou le compte date d'avant la table. Traité comme « membre actif » par
 * les appelants : refuser l'entrée à quelqu'un dont on ne sait rien serait
 * inventer une suspension que personne n'a prononcée.
 */
export const lireAccesCourant = cache(async (): Promise<AccesCourant | null> => {
  const { supabase, userId } = await dorsaleCompte();

  const { data, error } = await supabase
    .from("comptes_acces")
    .select("user_id, role, suspendu_le, motif")
    .eq("user_id", userId)
    .maybeSingle();
  verifier("lecture de l'accès du compte", error);
  if (!data) return null;

  const role = typeof data.role === "string" && estRoleConnu(data.role) ? data.role : "membre";
  return {
    userId: data.user_id as string,
    role,
    suspenduLe: (data.suspendu_le as string | null) ?? null,
    motif: (data.motif as string | null) ?? null,
  };
});

/** Vrai si le compte connecté administre. Employé pour afficher, jamais pour autoriser. */
export async function estAdministrateur(): Promise<boolean> {
  const acces = await lireAccesCourant();
  return acces?.role === "admin" && acces.suspenduLe === null;
}

/**
 * Tous les comptes, avec leurs compteurs.
 *
 * Passe par la fonction SQL et non par une lecture de tables : RLS interdit —
 * à raison — de lire les lignes d'autrui depuis le client, et c'est exactement
 * ce qu'il faut pour compter. La fonction ne renvoie que des nombres et
 * l'identité ; aucun énoncé, aucune observation, aucun document n'en sort (P8).
 */
export async function listerComptes(): Promise<CompteAdministre[]> {
  const { supabase } = await dorsaleCompte();

  const { data, error } = await supabase.rpc("admin_comptes");
  verifier("lecture des comptes", error);

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    userId: l.user_id as string,
    email: (l.email as string | null) ?? null,
    prenom: (l.prenom as string | null) ?? null,
    role: typeof l.role === "string" && estRoleConnu(l.role) ? l.role : "membre",
    suspenduLe: (l.suspendu_le as string | null) ?? null,
    motif: (l.motif as string | null) ?? null,
    creeLe: (l.cree_le as string | null) ?? null,
    observations: Number(l.observations ?? 0),
    exercices: Number(l.exercices ?? 0),
    seances: Number(l.seances ?? 0),
    competences: Number(l.competences ?? 0),
    derniereActivite: (l.derniere_activite as string | null) ?? null,
    quotaMensuel: Number(l.quota_mensuel ?? 0),
    quotaAppels: Number(l.quota_appels ?? 0),
  }));
}
