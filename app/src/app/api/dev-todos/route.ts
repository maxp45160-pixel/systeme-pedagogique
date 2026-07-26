/**
 * API route — TODOs de développement partagées.
 *
 * Contrairement aux collections pédagogiques isolées par `user_id`, les TODOs
 * dev sont **globales** : chaque développeur connecté lit et modifie la même
 * liste. Le stockage utilise Supabase quand il est configuré, sinon un fichier
 * JSON local (fonctionnel en mono-navigateur uniquement).
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

export interface DevTodo {
  id: string;
  texte: string;
  priorite: "haute" | "moyenne" | "basse";
  fait: boolean;
  ordre: number;
  creeA: string;
  auteur?: string;
  images?: string[];
}

/* ------------------------------------------------------------------ */
/* Stockage local (fallback sans Supabase)                             */
/* ------------------------------------------------------------------ */

const RACINE = path.join(process.cwd(), "data", "store");
const FICHIER = path.join(RACINE, "dev-todos.json");

async function lireLocal(): Promise<DevTodo[]> {
  try {
    const brut = await fs.readFile(FICHIER, "utf8");
    return JSON.parse(brut) as DevTodo[];
  } catch {
    return [];
  }
}

async function ecrireLocal(todos: DevTodo[]): Promise<void> {
  await fs.mkdir(RACINE, { recursive: true });
  const temporaire = `${FICHIER}.tmp`;
  await fs.writeFile(temporaire, JSON.stringify(todos, null, 2), "utf8");
  await fs.rename(temporaire, FICHIER);
}

/* ------------------------------------------------------------------ */
/* Supabase (partagé entre tous les utilisateurs)                      */
/* ------------------------------------------------------------------ */

async function supabaseClient() {
  // Import dynamique pour ne pas embarquer `server-only` dans le bundle client.
  const { supabaseConfigure } = await import("@/lib/supabase/config");
  if (!supabaseConfigure) return null;
  const { createServeurClient } = await import("@/lib/supabase/server");
  return createServeurClient();
}

async function lireSupabase(): Promise<DevTodo[] | null> {
  const sb = await supabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("dev_todos")
    .select("*")
    .order("ordre", { ascending: true });
  if (error) {
    console.warn("[dev-todos] Supabase read error, falling back to local:", error.message);
    return null;
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    texte: r.texte as string,
    priorite: r.priorite as DevTodo["priorite"],
    fait: r.fait as boolean,
    ordre: r.ordre as number,
    creeA: r.cree_a as string,
    auteur: (r.auteur as string) || undefined,
    images: (r.images as string[]) ?? [],
  }));
}

async function ecrireSupabase(todo: DevTodo): Promise<boolean> {
  const sb = await supabaseClient();
  if (!sb) return false;
  const { error } = await sb.from("dev_todos").upsert({
    id: todo.id,
    texte: todo.texte,
    priorite: todo.priorite,
    fait: todo.fait,
    ordre: todo.ordre,
    cree_a: todo.creeA,
    auteur: todo.auteur ?? null,
    images: todo.images ?? [],
  });
  if (error) {
    console.warn("[dev-todos] Supabase write error:", error.message);
    return false;
  }
  return true;
}

async function supprimerSupabase(id: string): Promise<boolean> {
  const sb = await supabaseClient();
  if (!sb) return false;
  const { error } = await sb.from("dev_todos").delete().eq("id", id);
  if (error) {
    console.warn("[dev-todos] Supabase delete error:", error.message);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Lecture unifiée                                                      */
/* ------------------------------------------------------------------ */

async function lireTodos(): Promise<DevTodo[]> {
  const depuisSupabase = await lireSupabase();
  if (depuisSupabase !== null) return depuisSupabase;
  return lireLocal();
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/** GET — toutes les TODOs triées par ordre. */
export async function GET() {
  const todos = await lireTodos();
  return NextResponse.json(todos);
}

/** POST — créer une TODO. Body : `{ texte, priorite }`. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const texte = (body.texte ?? "").trim();
  if (!texte) {
    return NextResponse.json({ error: "texte requis" }, { status: 400 });
  }

  const todos = await lireTodos();
  const maxOrdre = todos.reduce((m, t) => Math.max(m, t.ordre), -1);

  const nouveau: DevTodo = {
    id: `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    texte,
    priorite: body.priorite ?? "moyenne",
    fait: false,
    ordre: maxOrdre + 1,
    creeA: new Date().toISOString(),
    auteur: body.auteur ?? undefined,
    images: [],
  };

  const ecritDansSupabase = await ecrireSupabase(nouveau);
  if (!ecritDansSupabase) {
    await ecrireLocal([...todos, nouveau]);
  }

  return NextResponse.json(nouveau, { status: 201 });
}

/** PUT — mettre à jour une TODO. Body : `{ id, ...champs }`. */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...champs } = body as { id: string } & Partial<DevTodo>;
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const todos = await lireTodos();
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "todo introuvable" }, { status: 404 });
  }

  const maj: DevTodo = { ...todos[index], ...champs, id };

  const ecritDansSupabase = await ecrireSupabase(maj);
  if (!ecritDansSupabase) {
    todos[index] = maj;
    await ecrireLocal(todos);
  }

  return NextResponse.json(maj);
}

/** DELETE — supprimer une TODO. Query : `?id=xxx`. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const supprimeDansSupabase = await supprimerSupabase(id);
  if (!supprimeDansSupabase) {
    const todos = await lireTodos();
    await ecrireLocal(todos.filter((t) => t.id !== id));
  }

  return NextResponse.json({ ok: true });
}
