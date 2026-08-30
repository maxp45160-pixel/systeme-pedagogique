"use client";

/**
 * Démarrage automatique de la tentative, dans le déroulé d'une séance.
 *
 * Entrer en séance EST le geste de commencer : un bouton « Commencer
 * l'exercice » entre la séance et l'énoncé n'ajoutait aucune décision — il
 * répétait celle qu'on venait de poser en ouvrant le travail. La tentative
 * est donc créée au montage quand rien n'est encore ouvert, et l'écran se
 * recharge pour passer directement en mode résolution.
 *
 * ## Défaut corrigé (25/08/2026)
 *
 * L'action serveur était lancée sans être attendue, sans rafraîchir l'écran,
 * et son échec était ignoré : la tentative existait en base mais l'écran
 * continuait d'afficher l'état « pas encore commencée » — aucune zone de
 * réponse, sans message ni geste pour sortir de là. Trois conséquences :
 *
 * - **Attendre puis rafraîchir.** L'action revalide le layout ; le composant
 *   attend sa fin puis recharge les Server Components pour que `enCours`
 *   devienne vrai et que la zone de réponse apparaisse.
 * - **Un état de chargement visible.** Entre le clic d'entrée en séance et le
 *   retour du rafraîchissement, l'écran annonce ce qui se passe au lieu de
 *   laisser une carte muette.
 * - **Un repli manuel.** Si l'action échoue (réseau, session expirée), un
 *   bouton relance le démarrage sous forme de formulaire — le chemin standard
 *   des Server Actions, avec sa gestion d'erreur propre — plutôt qu'un écran
 *   coincé.
 *
 * ⚠️ Invariant intact : une tentative créée puis quittée reste une tentative
 * abandonnée, qui ne produit AUCUNE preuve (ADR-030). L'automatisme ne fabrique
 * donc pas d'observation fantôme — il avance seulement le moment où le temps
 * commence à courir.
 *
 * ## Défaut corrigé (30/08/2026)
 *
 * L'App Router active Strict Mode par défaut. Au montage, React exécute donc
 * l'effet, son nettoyage, puis l'effet survivant. L'ancien verrou `lance`
 * restait vrai après le nettoyage alors que le premier effet était marqué
 * démonté : l'écriture finissait, mais aucun effet vivant ne rafraîchissait la
 * vue. Le démarrage est maintenant différé d'un tour ; le premier passage est
 * annulé par le rejeu et seul l'effet survivant lance l'action.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demarrerTentative } from "@/lib/store/actions";
import { Bouton, Carte, PointActif } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";

export function planifierDemarrageAutomatique(
  demarrer: () => Promise<void>,
  rafraichir: () => void,
  signalerEchec: () => void,
): () => void {
  let actif = true;
  const minuteur = setTimeout(() => {
    void demarrer().then(
      () => {
        if (actif) rafraichir();
      },
      () => {
        if (actif) signalerEchec();
      },
    );
  }, 0);

  return () => {
    actif = false;
    clearTimeout(minuteur);
  };
}

export function DemarrageAuto({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  /** `echec` seul rend le repli manuel ; `cours` rend l'écran d'attente. */
  const [etat, setEtat] = useState<"cours" | "echec">("cours");

  useEffect(() => {
    return planifierDemarrageAutomatique(
      () => demarrerTentative(exerciseId),
      () => router.refresh(),
      () => setEtat("echec"),
    );
  }, [exerciseId, router]);

  if (etat === "echec") {
    /*
     * Repli manuel : un `<form action>` plutôt qu'un second appel programmatique.
     * Next.js gère lui-même l'état d'envoi et le rafraîchissement après une
     * Server Action posée sur un formulaire.
     */
    return (
      <Carte accent>
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium">Le démarrage n&apos;a pas abouti</p>
          <p className="mt-1 text-xs text-texte-attenue">
            La tentative n&apos;a pas pu être ouverte. Rien n&apos;est perdu :
            réessayez — si l&apos;échec se répète, vérifiez votre connexion.
          </p>
          <form action={demarrerTentative.bind(null, exerciseId)}>
            <Bouton type="submit" variante="principal" taille="petite" className="mt-3">
              Commencer l&apos;exercice
              <IconeFleche className="size-4" />
            </Bouton>
          </form>
        </div>
      </Carte>
    );
  }

  return (
    <Carte accent>
      <div className="flex items-center gap-3 px-4 py-3.5" aria-busy="true">
        <PointActif />
        <p className="text-sm text-texte-attenue">Ouverture de l&apos;exercice…</p>
      </div>
    </Carte>
  );
}
