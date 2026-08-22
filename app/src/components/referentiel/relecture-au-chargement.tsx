"use client";

/**
 * Le déclenchement de la relecture, en tâche de fond — ADR-108.
 *
 * ## La question qu'ADR-108 laisse ouverte, et ce qui la tranche ici
 *
 * L'ADR dit *qu'*une relecture est due — la péremption —, pas *quand* la
 * lancer : « ouverture d'un domaine, tâche de fond après commande, ou bouton :
 * à trancher sur le coût observé, pas d'avance ». Maxime a tranché le
 * 22/08/2026 : à l'ouverture de l'Atelier si le référentiel a bougé, plus un
 * bouton explicite sur l'écran des propositions.
 *
 * ## Pourquoi ce composant ne rend rien
 *
 * La relecture ne doit rien bloquer et rien annoncer. Elle part, elle prend le
 * temps qu'elle prend, et son résultat attend la personne au passage suivant —
 * sur le tableau de bord, où l'avis l'attend. Un indicateur de chargement ferait
 * attendre un résultat qu'on n'a pas demandé.
 *
 * ## Pourquoi il n'est PAS sur le chemin d'écriture
 *
 * C'est un refus explicite d'ADR-108 : « une création de compétence ne doit
 * jamais échouer parce qu'un fournisseur de modèle a mis quatre secondes ». Ce
 * composant vit dans le rendu d'une page de lecture, appelle une route séparée,
 * et n'entre dans aucune transaction de référentiel. Un échec ne se voit pas,
 * et c'est correct : rien n'a été demandé.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function RelectureAuChargement({ due }: { due: boolean }) {
  const router = useRouter();
  /*
   * Un garde par montage, en plus de `due`.
   *
   * `due` vient du rendu serveur : entre le départ de la requête et le
   * `router.refresh()`, il vaut encore `true`. En mode strict de développement,
   * React monte deux fois — sans ce garde, deux relectures partiraient, donc
   * deux appels au modèle pour un seul chargement.
   */
  const parti = useRef(false);

  useEffect(() => {
    if (!due || parti.current) return;
    parti.current = true;

    const abandon = new AbortController();
    void fetch("/api/referentiel/relecture", { method: "POST", signal: abandon.signal })
      .then((reponse) => {
        // Le rafraîchissement ne sert qu'à faire apparaître l'avis ailleurs
        // dans l'application. Un échec reste muet : personne n'a rien demandé.
        if (reponse.ok) router.refresh();
      })
      .catch(() => {});

    return () => abandon.abort();
  }, [due, router]);

  return null;
}
