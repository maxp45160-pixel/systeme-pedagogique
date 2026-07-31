/**
 * API route — upload d'images pour les TODOs dev.
 *
 * Même arbitrage que la route parente :
 *
 *   * Supabase configuré → bucket public `dev-todos` (Supabase Storage).
 *     C'est le seul chemin viable en production : sur Vercel, le système de
 *     fichiers de la fonction est en lecture seule, et `public/` est figé au
 *     moment du build.
 *   * Supabase absent → `public/uploads/dev-todos/`, servi statiquement par
 *     Next.js. Utilisable en développement local uniquement.
 *
 * Le nom de fichier est construit *entièrement* côté serveur : ni le nom
 * d'origine ni l'identifiant transmis ne s'y retrouvent tels quels, sans quoi
 * un `../` glissé dans l'un d'eux ferait sortir l'écriture du dossier.
 */

import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseConfigure } from "@/lib/supabase/config";
import { compteCourant, createServeurClient } from "@/lib/supabase/server";

const DOSSIER_UPLOADS = path.join(process.cwd(), "public", "uploads", "dev-todos");
const BUCKET = "dev-todos";
const TAILLE_MAX = 5 * 1024 * 1024;

/** Types acceptés → extension. L'extension vient d'ici, jamais du nom fourni. */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Identifiant de fichier opaque : rien de ce qui vient du client n'y entre. */
function nomFichier(extension: string): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

export async function POST(req: NextRequest) {
  if (supabaseConfigure && !(await compteCourant())) {
    return Response.json({ erreur: "non-authentifie" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    return Response.json({ erreur: "fichier-requis" }, { status: 400 });
  }

  const extension = EXTENSIONS[fichier.type];
  if (!extension) {
    return Response.json(
      { erreur: "type-non-supporte", message: "Formats acceptés : PNG, JPEG, WebP, GIF, AVIF." },
      { status: 400 },
    );
  }

  if (fichier.size > TAILLE_MAX) {
    return Response.json(
      { erreur: "fichier-trop-volumineux", message: "Image trop volumineuse (max 5 Mo)." },
      { status: 400 },
    );
  }

  const nom = nomFichier(extension);
  const contenu = Buffer.from(await fichier.arrayBuffer());

  if (!supabaseConfigure) {
    await fs.mkdir(DOSSIER_UPLOADS, { recursive: true });
    await fs.writeFile(path.join(DOSSIER_UPLOADS, nom), contenu);
    return Response.json({ url: `/uploads/dev-todos/${nom}` }, { status: 201 });
  }

  const client = await createServeurClient();
  if (!client) return Response.json({ erreur: "supabase-indisponible" }, { status: 503 });

  const { error } = await client.storage.from(BUCKET).upload(nom, contenu, {
    contentType: fichier.type,
    upsert: false,
  });
  if (error) {
    const bucketAbsent = error.message.toLowerCase().includes("bucket");
    return Response.json(
      {
        erreur: bucketAbsent ? "bucket-absent" : "supabase",
        message: bucketAbsent
          ? "Le bucket `dev-todos` n'existe pas encore : applique `app/supabase/schema.sql` (§ 9) dans Supabase Studio."
          : error.message,
      },
      { status: bucketAbsent ? 503 : 500 },
    );
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(nom);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
