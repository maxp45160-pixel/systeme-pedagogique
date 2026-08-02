/**
 * API route — profilage serveur.
 *
 * Expose le registre des mesures collectées par `lib/profiling/server.ts` et
 * permet de démarrer/arrêter le profilage au runtime (POST).
 *
 * `GET` renvoie toujours l'état (`actif`) et les mesures — même quand le
 * profilage est inactif, pour que le panneau puisse afficher le bouton
 * « Démarrer ». Les mesures sont vides dans ce cas.
 */

import {
  activerProfilage,
  desactiverProfilage,
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
    totalMesures: mesures.length,
    totalMs: mesures.reduce((s, m) => s + m.dureeMs, 0),
    parOperation: agrege,
    dernieres: mesures.slice(0, 50),
  });
}

/**
 * `POST` — bascule le profilage serveur au runtime.
 *
 * Corps : `{ action: "start" | "stop" }`.
 *
 * - `start` lève le drapeau runtime ; les opérations instrumentées
 *   commencent à s'enregistrer.
 * - `stop` baisse le drapeau et vide le registre.
 *
 * Le profilage activé par variable d'environnement (`PROFILAGE=1` ou
 * `NODE_ENV=development`) ne peut pas être arrêté : `stop` ne fait rien dans ce
 * cas, et la réponse l'indique (`actif: true`).
 */
export async function POST(request: Request) {
  let corps: { action?: string };
  try {
    corps = (await request.json()) as { action?: string };
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

  const actifParEnv =
    process.env.NODE_ENV === "development" || process.env.PROFILAGE === "1";

  if (action === "start") {
    activerProfilage();
  } else {
    // Arrêter n'a d'effet que sur le drapeau runtime. Si l'environnement a
    // activé le profilage, il reste actif — on ne peut pas le couper sans
    // redémarrer.
    if (!actifParEnv) {
      desactiverProfilage();
    } else {
      viderRegistre();
    }
  }

  return Response.json({ ok: true, actif: profilageActif(), actifParEnv });
}