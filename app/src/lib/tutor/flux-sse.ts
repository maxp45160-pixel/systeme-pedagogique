/**
 * Lecteur SSE partagé des surfaces de génération.
 *
 * La boucle `getReader()` / `TextDecoder` / découpage en blocs était recopiée
 * à l'identique dans chaque composant qui consomme un flux du tuteur — et les
 * copies divergeaient déjà (deux gestions différentes du « flux interrompu »).
 * Une seule implémentation, testée, que chaque surface branche à son tour.
 *
 * Ce module ne décide rien : il délègue chaque événement complet
 * (`event:` + `data:`) au consommateur, qui garde la main sur son état.
 */
export async function consommerFluxSse(
  reponse: Response,
  surEvenement: (type: string, donnees: string) => void,
): Promise<void> {
  if (!reponse.body) return;

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    const blocs = tampon.split("\n\n");
    tampon = blocs.pop() ?? "";

    for (const bloc of blocs) {
      const lignes = bloc.split("\n");
      const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
      const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();
      if (!donnees) continue;
      surEvenement(type, donnees);
    }
  }
}
