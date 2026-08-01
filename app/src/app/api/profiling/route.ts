/**
 * API route — profilage serveur.
 *
 * Expose le registre des mesures collectées par `lib/profiling/server.ts`.
 * Réservé au développement : la route renvoie 404 si le profilage est inactif.
 */

import { mesuresActuelles, viderRegistre, profilageActif } from "@/lib/profiling/server";

export async function GET() {
  if (!profilageActif()) {
    return Response.json({ erreur: "profilage-inactif" }, { status: 404 });
  }

  const mesures = mesuresActuelles();

  // Agrégation par opération : durée totale, moyenne, nombre d'appels.
  const parOperation = new Map<
    string,
    { operation: string; appels: number; totalMs: number; maxMs: number; moyenneMs: number }
  >();
  for (const m of mesures) {
    const e = parOperation.get(m.operation) ?? {
      operation: m.operation,
      appels: 0,
      totalMs: 0,
      maxMs: 0,
      moyenneMs: 0,
    };
    e.appels += 1;
    e.totalMs += m.dureeMs;
    e.maxMs = Math.max(e.maxMs, m.dureeMs);
    e.moyenneMs = e.totalMs / e.appels;
    parOperation.set(m.operation, e);
  }

  const agrege = [...parOperation.values()].sort((a, b) => b.totalMs - a.totalMs);

  return Response.json({
    actif: true,
    totalMesures: mesures.length,
    totalMs: mesures.reduce((s, m) => s + m.dureeMs, 0),
    parOperation: agrege,
    dernieres: mesures.slice(0, 50),
  });
}

export async function DELETE() {
  if (!profilageActif()) {
    return Response.json({ erreur: "profilage-inactif" }, { status: 404 });
  }

  viderRegistre();
  return Response.json({ ok: true });
}