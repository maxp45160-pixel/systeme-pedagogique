/**
 * API route — upload d'images pour les TODOs dev.
 *
 * Les images sont stockées dans `public/uploads/dev-todos/` pour être servies
 * directement par Next.js comme fichiers statiques. Le nom est dédupliqué par
 * un préfixe temporel.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const DOSSIER_UPLOADS = path.join(process.cwd(), "public", "uploads", "dev-todos");

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const fichier = formData.get("fichier") as File | null;
  const todoId = formData.get("todoId") as string | null;

  if (!fichier || !todoId) {
    return NextResponse.json({ error: "fichier et todoId requis" }, { status: 400 });
  }

  // Vérifier le type
  if (!fichier.type.startsWith("image/")) {
    return NextResponse.json({ error: "seules les images sont acceptées" }, { status: 400 });
  }

  // Limiter la taille (5 Mo)
  if (fichier.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "image trop volumineuse (max 5 Mo)" }, { status: 400 });
  }

  await fs.mkdir(DOSSIER_UPLOADS, { recursive: true });

  // Nom unique : todoId + timestamp + extension originale
  const ext = fichier.name.split(".").pop() ?? "png";
  const nomFichier = `${todoId}-${Date.now().toString(36)}.${ext}`;
  const cheminComplet = path.join(DOSSIER_UPLOADS, nomFichier);

  const buffer = Buffer.from(await fichier.arrayBuffer());
  await fs.writeFile(cheminComplet, buffer);

  const url = `/uploads/dev-todos/${nomFichier}`;

  return NextResponse.json({ url }, { status: 201 });
}
