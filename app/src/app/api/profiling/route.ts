/**
 * API route — profilage serveur.
 *
 * Expose le registre des mesures collectées par `lib/profiling/server.ts` et
 * permet de démarrer/arrêter l'enregistrement au runtime (POST).
 *
 * `GET` renvoie toujours l'état — même quand le profilage est indisponible,
 * pour que le panneau puisse afficher le bouton « Démarrer ». Les mesures
 * sont vides dans ce cas.
 */

import {
  definirEnregistrement,
  enregistrementActif,
  mesuresActuelles,
  profilageActif,
  viderRegistre,
} from "@/lib/profiling/server";

export async function GET() {
  const actif = profilageActif();
  const mesures = actif ? mesuresActuelles() : [];

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
    actif,
    enregistrement: enregistrementActif(),
    totalMesures: mesures.length,
    totalMs: mesures.reduce((s, m) => s + m.dureeMs, 0),
    parOperation: agrege,
    dernieres: mesures.slice(0, 50),
  });
}

/**
 * `POST` — démarre ou arrête l'enregistrement serveur.
 *
 * Corps : `{ action: "start" | "stop" }`.
 *
 * - `start` rend le profilage disponible (même hors `NODE_ENV=development`),
 *   vide le registre et commence à collecter ;
 * - `stop` arrête la collecte et conserve le registre, qu'on vient
 *   précisément d'arrêter pour lire. Le vider est le rôle de `DELETE`.
 *
 * Contrairement au drapeau de disponibilité, l'enregistrement s'arrête
 * toujours — y compris quand `PROFILAGE=1` ou `NODE_ENV=development` l'a
 * rendu disponible au démarrage.
 */
export async function POST(requete: Request) {
  let corps: { action?: string };
  try {
    corps = (await requete.json()) as { action?: string };
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const action = corps.action;
  if (action !== "start" && action !== "stop") {
    return Response.json(
      { erreur: "action inconnue — attendu : « start » ou « stop »." },
      { status: 400 },
    );
  }

  definirEnregistrement(action === "start");

  return Response.json({
    ok: true,
    actif: profilageActif(),
    enregistrement: enregistrementActif(),
  });
}

/** `DELETE` — vide le registre sans toucher à l'état d'enregistrement. */
export async function DELETE() {
  viderRegistre();
  return Response.json({ ok: true });
}
