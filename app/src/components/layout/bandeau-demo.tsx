import { basculerModeDemo } from "@/lib/store/actions";
import { classesBouton } from "@/components/ui/primitives";

/**
 * Bandeau permanent en mode démonstration.
 *
 * Exigence du protocole anti-hallucination §7 (non-invention) : des données
 * fictives ne doivent jamais pouvoir être prises pour l'état réel. Le bandeau
 * n'est donc pas masquable et reste visible sur toutes les pages.
 */
export function BandeauDemo() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-alerte/30 bg-alerte-faible px-4 py-2 text-xs">
      <p className="text-alerte">
        <strong className="font-semibold">Mode démonstration.</strong> Ces données sont fictives et
        servent uniquement à visualiser l&apos;interface. Ton profil réel n&apos;est ni lu ni modifié
        tant que ce mode est actif.
      </p>
      <form action={basculerModeDemo}>
        <button type="submit" className={classesBouton("secondaire", "petite")}>
          Revenir à mes données réelles
        </button>
      </form>
    </div>
  );
}

/** Entrée dans le mode démonstration, proposée depuis les états vides. */
export function BoutonActiverDemo({ libelle = "Voir avec des données de démonstration" }: { libelle?: string }) {
  return (
    <form action={basculerModeDemo}>
      <button type="submit" className={classesBouton("secondaire", "petite")}>
        {libelle}
      </button>
    </form>
  );
}
