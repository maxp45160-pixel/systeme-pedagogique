import Link from "next/link";

/**
 * Le lien de remontée d'une page profonde.
 *
 * Trois pages en avaient un, écrit trois fois à l'identique — même classes,
 * même flèche, même marge (audit §1.5). Ce n'est pas grave tant que les trois
 * copies s'accordent ; c'est exactement pour cela qu'elles finissent par ne
 * plus s'accorder.
 *
 * Il n'y a **pas** de fil d'Ariane, et ce n'est pas un oubli : la hiérarchie du
 * produit n'a que deux niveaux sous chaque pôle. Un fil d'Ariane à deux
 * segments dit la même chose qu'une flèche, en occupant plus de place.
 */
export function LienRetour({ href, libelle }: { href: string; libelle: string }) {
  return (
    <div className="mb-3">
      <Link href={href} className="text-xs text-texte-attenue hover:text-texte">
        ← {libelle}
      </Link>
    </div>
  );
}
