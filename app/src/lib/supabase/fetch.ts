/**
 * Repli étroit sur la seule course observée entre Auth et la Data API.
 *
 * Le 24/08/2026, un rafraîchissement de session a réussi à 17:49:59.364 puis
 * une lecture parallèle a reçu `PGRST303 — JWT issued at future` 20 ms plus
 * tard. La même lecture a réussi 448 ms après. Le JWT était valide ; un nœud
 * PostgREST avait seulement quelques fractions de seconde de retard sur Auth.
 *
 * Une seule lecture est rejouée, jamais une écriture. Toute autre erreur, ou
 * un second échec identique, remonte telle quelle au code appelant.
 */

const ATTENTE_JWT_FUTUR_MS = 500;

type FetchCompatible = typeof fetch;

function methode(input: Parameters<FetchCompatible>[0], init?: Parameters<FetchCompatible>[1]) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

async function estJwtEmisDansLeFutur(reponse: Response): Promise<boolean> {
  if (reponse.status !== 401) return false;
  try {
    const corps = (await reponse.clone().json()) as { code?: unknown; message?: unknown };
    return (
      corps.code === "PGRST303" &&
      typeof corps.message === "string" &&
      /jwt issued at future/i.test(corps.message)
    );
  } catch {
    return false;
  }
}

export function creerFetchAvecReessaiJwtFutur(
  fetcher: FetchCompatible = globalThis.fetch,
  attendre: (dureeMs: number) => Promise<void> =
    (dureeMs) => new Promise((resolve) => setTimeout(resolve, dureeMs)),
): FetchCompatible {
  return async (input, init) => {
    const premiere = await fetcher(input, init);
    const lecture = methode(input, init) === "GET" || methode(input, init) === "HEAD";
    if (!lecture || !(await estJwtEmisDansLeFutur(premiere))) return premiere;

    await attendre(ATTENTE_JWT_FUTUR_MS);
    return fetcher(input, init);
  };
}

export const fetchSupabase = creerFetchAvecReessaiJwtFutur();
