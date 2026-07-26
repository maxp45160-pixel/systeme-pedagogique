/**
 * API route — TODOs de développement partagées.
 *
 * Contrairement aux collections pédagogiques isolées par `user_id`, les TODOs
 * dev sont **globales** : chaque compte connecté lit et modifie la même liste.
 * C'est un choix assumé (tableau d'équipe), matérialisé côté base par une
 * politique RLS ouverte à `authenticated` — cf. `supabase/schema.sql`, § 12.
 *
 * L'arbitrage du stockage suit la règle du reste du système : `supabaseConfigure`
 * décide, jamais un `try/catch` silencieux.
 *
 *   * Supabase configuré → Supabase, et lui seul. Une écriture qui échoue
 *     remonte en erreur ; elle n'est pas repliée sur le fichier local, ce qui
 *     ferait diverger deux sources sans que personne ne s'en aperçoive — et ne
 *     survivrait de toute façon pas au système de fichiers en lecture seule de
 *     Vercel.
 *   * Supabase absent → fichier JSON local, mono-poste (comportement historique
 *     du mode local).
 *
 * La route n'est pas publique : le proxy la protège et elle revérifie la session.
 */

import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseConfigure } from "@/lib/supabase/config";
import { compteCourant, createServeurClient } from "@/lib/supabase/server";

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

const PRIORITES = ["haute", "moyenne", "basse"] as const;

/** Un libellé de TODO n'est pas une zone de saisie libre : au-delà, c'est un abus. */
const TEXTE_MAX = 500;
const IMAGES_MAX = 12;

/* ------------------------------------------------------------------ */
/* Validation des entrées                                              */
/* ------------------------------------------------------------------ */

function texteValide(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const t = valeur.trim();
  if (!t || t.length > TEXTE_MAX) return null;
  return t;
}

function prioriteValide(valeur: unknown): DevTodo["priorite"] | null {
  return PRIORITES.includes(valeur as DevTodo["priorite"])
    ? (valeur as DevTodo["priorite"])
    : null;
}

/**
 * Les URL d'images sont celles produites par `/api/dev-todos/upload`, et rien
 * d'autre : on n'accepte pas qu'un client fasse pointer une vignette vers un
 * hôte arbitraire.
 */
function imagesValides(valeur: unknown): string[] | null {
  if (!Array.isArray(valeur) || valeur.length > IMAGES_MAX) return null;
  const ok = valeur.every(
    (u) =>
      typeof u === "string" &&
      u.length <= 500 &&
      (u.startsWith("/uploads/dev-todos/") ||
        u.includes("/storage/v1/object/public/dev-todos/")),
  );
  return ok ? (valeur as string[]) : null;
}

/**
 * Champs qu'un client a le droit de modifier. `id`, `creeA` et `auteur` sont
 * posés par le serveur : les laisser passer permettrait de réécrire l'origine
 * d'une ligne.
 */
function champsModifiables(body: Record<string, unknown>): Partial<DevTodo> | "invalide" {
  const champs: Partial<DevTodo> = {};

  if ("texte" in body) {
    const t = texteValide(body.texte);
    if (t === null) return "invalide";
    champs.texte = t;
  }
  if ("priorite" in body) {
    const p = prioriteValide(body.priorite);
    if (p === null) return "invalide";
    champs.priorite = p;
  }
  if ("fait" in body) {
    if (typeof body.fait !== "boolean") return "invalide";
    champs.fait = body.fait;
  }
  if ("ordre" in body) {
    if (typeof body.ordre !== "number" || !Number.isFinite(body.ordre)) return "invalide";
    champs.ordre = body.ordre;
  }
  if ("images" in body) {
    const i = imagesValides(body.images);
    if (i === null) return "invalide";
    champs.images = i;
  }

  return champs;
}

/* ------------------------------------------------------------------ */
/* Stockage local (mode mono-poste, sans Supabase)                     */
/* ------------------------------------------------------------------ */

const RACINE = path.join(process.cwd(), "data", "store");
const FICHIER = path.join(RACINE, "dev-todos.json");

async function lireLocal(): Promise<DevTodo[]> {
  try {
    const brut = await fs.readFile(FICHIER, "utf8");
    const donnees = JSON.parse(brut);
    return Array.isArray(donnees) ? (donnees as DevTodo[]) : [];
  } catch {
    return [];
  }
}

async function ecrireLocal(todos: DevTodo[]): Promise<void> {
  await fs.mkdir(RACINE, { recursive: true });
  // Écriture atomique : un `writeFile` interrompu laisserait un JSON tronqué.
  const temporaire = `${FICHIER}.tmp`;
  await fs.writeFile(temporaire, JSON.stringify(todos, null, 2), "utf8");
  await fs.rename(temporaire, FICHIER);
}

/* ------------------------------------------------------------------ */
/* Stockage Supabase (table partagée `dev_todos`)                      */
/* ------------------------------------------------------------------ */

type LigneSupabase = {
  id: string;
  texte: string;
  priorite: DevTodo["priorite"];
  fait: boolean;
  ordre: number;
  cree_a: string;
  auteur: string | null;
  images: string[] | null;
};

function versDomaine(r: LigneSupabase): DevTodo {
  return {
    id: r.id,
    texte: r.texte,
    priorite: r.priorite,
    fait: r.fait,
    ordre: r.ordre,
    creeA: r.cree_a,
    auteur: r.auteur ?? undefined,
    images: r.images ?? [],
  };
}

function versLigne(t: DevTodo): LigneSupabase {
  return {
    id: t.id,
    texte: t.texte,
    priorite: t.priorite,
    fait: t.fait,
    ordre: t.ordre,
    cree_a: t.creeA,
    auteur: t.auteur ?? null,
    images: t.images ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Garde d'accès                                                       */
/* ------------------------------------------------------------------ */

type ClientSupabase = NonNullable<Awaited<ReturnType<typeof createServeurClient>>>;

type Acces =
  | { mode: "local" }
  | { mode: "supabase"; client: ClientSupabase; auteur: string }
  | { mode: "refus"; reponse: Response };

/**
 * Résout le mode de stockage *et* l'autorisation en une fois : sans compte
 * connecté, aucune requête ne doit atteindre la table partagée.
 */
async function acces(): Promise<Acces> {
  if (!supabaseConfigure) return { mode: "local" };

  const compte = await compteCourant();
  if (!compte) {
    return {
      mode: "refus",
      reponse: Response.json({ erreur: "non-authentifie" }, { status: 401 }),
    };
  }

  const client = await createServeurClient();
  if (!client) {
    return {
      mode: "refus",
      reponse: Response.json({ erreur: "supabase-indisponible" }, { status: 503 }),
    };
  }

  const auteur =
    (compte.user_metadata?.full_name as string | undefined) ??
    (compte.user_metadata?.name as string | undefined) ??
    compte.email ??
    "Compte";

  return { mode: "supabase", client, auteur };
}

/** Traduit une erreur PostgREST : la table encore absente mérite un message clair. */
function erreurSupabase(message: string): Response {
  const tableAbsente = message.includes("dev_todos") || message.includes("schema cache");
  return Response.json(
    {
      erreur: tableAbsente ? "table-absente" : "supabase",
      message: tableAbsente
        ? "La table `dev_todos` n'existe pas encore : applique `app/supabase/schema.sql` (§ 12) dans Supabase Studio."
        : message,
    },
    { status: tableAbsente ? 503 : 500 },
  );
}

async function corps(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const donnees = await req.json();
    return donnees && typeof donnees === "object" ? (donnees as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/** GET — toutes les TODOs, triées par ordre. */
export async function GET() {
  const a = await acces();
  if (a.mode === "refus") return a.reponse;
  if (a.mode === "local") return Response.json(await lireLocal());

  const { data, error } = await a.client
    .from("dev_todos")
    .select("*")
    .order("ordre", { ascending: true });
  if (error) return erreurSupabase(error.message);

  return Response.json(((data ?? []) as LigneSupabase[]).map(versDomaine));
}

/** POST — créer une TODO. Corps : `{ texte, priorite? }`. */
export async function POST(req: NextRequest) {
  const a = await acces();
  if (a.mode === "refus") return a.reponse;

  const body = await corps(req);
  if (!body) return Response.json({ erreur: "corps-invalide" }, { status: 400 });

  const texte = texteValide(body.texte);
  if (!texte) return Response.json({ erreur: "texte-invalide" }, { status: 400 });

  const priorite = body.priorite === undefined ? "moyenne" : prioriteValide(body.priorite);
  if (!priorite) return Response.json({ erreur: "priorite-invalide" }, { status: 400 });

  const locales = a.mode === "local" ? await lireLocal() : [];
  let maxOrdre = -1;
  if (a.mode === "local") {
    maxOrdre = locales.reduce((m, t) => Math.max(m, t.ordre), -1);
  } else {
    const { data, error } = await a.client
      .from("dev_todos")
      .select("ordre")
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return erreurSupabase(error.message);
    maxOrdre = (data as { ordre: number } | null)?.ordre ?? -1;
  }

  const nouveau: DevTodo = {
    id: `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    texte,
    priorite,
    fait: false,
    ordre: maxOrdre + 1,
    creeA: new Date().toISOString(),
    // L'auteur vient de la session, jamais du corps de la requête.
    auteur: a.mode === "supabase" ? a.auteur : undefined,
    images: [],
  };

  if (a.mode === "local") {
    await ecrireLocal([...locales, nouveau]);
  } else {
    const { error } = await a.client.from("dev_todos").insert(versLigne(nouveau));
    if (error) return erreurSupabase(error.message);
  }

  return Response.json(nouveau, { status: 201 });
}

/** PUT — mettre à jour une TODO. Corps : `{ id, texte?, priorite?, fait?, ordre?, images? }`. */
export async function PUT(req: NextRequest) {
  const a = await acces();
  if (a.mode === "refus") return a.reponse;

  const body = await corps(req);
  if (!body) return Response.json({ erreur: "corps-invalide" }, { status: 400 });

  const { id } = body;
  if (typeof id !== "string" || !id) {
    return Response.json({ erreur: "id-requis" }, { status: 400 });
  }

  const champs = champsModifiables(body);
  if (champs === "invalide") return Response.json({ erreur: "champs-invalides" }, { status: 400 });
  if (Object.keys(champs).length === 0) {
    return Response.json({ erreur: "aucun-champ" }, { status: 400 });
  }

  if (a.mode === "local") {
    const todos = await lireLocal();
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) return Response.json({ erreur: "todo-introuvable" }, { status: 404 });
    todos[index] = { ...todos[index], ...champs };
    await ecrireLocal(todos);
    return Response.json(todos[index]);
  }

  // Les noms de colonnes coïncident avec les champs modifiables (tous en un
  // seul mot) : aucune conversion camelCase → snake_case n'est nécessaire ici.
  const { data, error } = await a.client
    .from("dev_todos")
    .update(champs)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return erreurSupabase(error.message);
  if (!data) return Response.json({ erreur: "todo-introuvable" }, { status: 404 });

  return Response.json(versDomaine(data as LigneSupabase));
}

/**
 * PATCH — réordonner en une seule requête. Corps : `{ ordres: [{ id, ordre }, …] }`.
 *
 * Un glisser-déposer renumérote potentiellement toute la liste : le faire en N
 * requêtes PUT laisse la base dans un état intermédiaire à chaque aller-retour,
 * et un échec au milieu casse le tri pour tout le monde.
 */
export async function PATCH(req: NextRequest) {
  const a = await acces();
  if (a.mode === "refus") return a.reponse;

  const body = await corps(req);
  if (!body) return Response.json({ erreur: "corps-invalide" }, { status: 400 });

  if (!Array.isArray(body.ordres) || body.ordres.length === 0) {
    return Response.json({ erreur: "ordres-requis" }, { status: 400 });
  }

  const ordres: { id: string; ordre: number }[] = [];
  for (const e of body.ordres) {
    const id = (e as { id?: unknown } | null)?.id;
    const ordre = (e as { ordre?: unknown } | null)?.ordre;
    if (typeof id !== "string" || typeof ordre !== "number" || !Number.isFinite(ordre)) {
      return Response.json({ erreur: "ordres-invalides" }, { status: 400 });
    }
    ordres.push({ id, ordre });
  }

  if (a.mode === "local") {
    const todos = await lireLocal();
    const parId = new Map(ordres.map((o) => [o.id, o.ordre]));
    for (const t of todos) {
      const ordre = parId.get(t.id);
      if (ordre !== undefined) t.ordre = ordre;
    }
    await ecrireLocal(todos);
    return Response.json({ ok: true });
  }

  // Fonction SQL : une seule transaction pour toute la renumérotation.
  const { error } = await a.client.rpc("reordonner_dev_todos", { ordres });
  if (error) return erreurSupabase(error.message);

  return Response.json({ ok: true });
}

/** DELETE — supprimer une TODO. Requête : `?id=xxx`. */
export async function DELETE(req: NextRequest) {
  const a = await acces();
  if (a.mode === "refus") return a.reponse;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ erreur: "id-requis" }, { status: 400 });

  if (a.mode === "local") {
    const todos = await lireLocal();
    await ecrireLocal(todos.filter((t) => t.id !== id));
    return Response.json({ ok: true });
  }

  const { error } = await a.client.from("dev_todos").delete().eq("id", id);
  if (error) return erreurSupabase(error.message);

  return Response.json({ ok: true });
}
