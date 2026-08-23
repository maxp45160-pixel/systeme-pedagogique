import Link from "next/link";
import { IconeMarque } from "@/components/ui/icones";

/**
 * Coque de la vitrine publique : en-tête avec navigation et pied de page.
 *
 * Séparée du groupe `(app)` car elle n'a besoin d'aucune donnée de compte —
 * le proxy laisse passer ces chemins sans session. La landing (`/`) redirige
 * elle-même les comptes déjà connectés vers `/app`.
 */

const NAVIGATION = [
  { href: "/methode", libelle: "La méthode" },
  { href: "/etudiants", libelle: "Pour les étudiants" },
  { href: "/autodidactes", libelle: "Pour les autodidactes" },
];

export default function LayoutPublic({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-fond">
      <header className="border-b border-bordure bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-texte">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primaire text-primaire-contraste">
              <IconeMarque className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Système pédagogique</span>
          </Link>

          <nav aria-label="Navigation publique" className="hidden items-center gap-5 md:flex">
            {NAVIGATION.map((entree) => (
              <Link
                key={entree.href}
                href={entree.href}
                className="text-sm text-texte-attenue transition-colors hover:text-texte"
              >
                {entree.libelle}
              </Link>
            ))}
          </nav>

          <Link href="/login?mode=inscription" className="shrink-0 rounded-lg bg-primaire px-3.5 py-1.5 text-sm font-medium text-primaire-contraste transition-opacity hover:opacity-90">
            Commencer
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-bordure bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <p className="text-xs text-texte-discret">
            © {new Date().getFullYear()} Système pédagogique
          </p>
          <nav aria-label="Liens de bas de page" className="flex items-center gap-5">
            {NAVIGATION.map((entree) => (
              <Link
                key={entree.href}
                href={entree.href}
                className="text-xs text-texte-discret transition-colors hover:text-texte"
              >
                {entree.libelle}
              </Link>
            ))}
            <Link href="/login" className="text-xs text-texte-discret transition-colors hover:text-texte">
              Connexion
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
