import Link from "next/link";

/**
 * Layout dev — coque minimale pour les outils de développement.
 *
 * Navigation légère entre les sous-pages dev : `/dev/workflow` (graphe du
 * workflow utilisateur) et `/dev/profil` (profilage de performance). Pas de
 * rail, pas de cadre de carnet — ces pages n'ont pas besoin du contexte
 * pédagogique.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-bordure bg-surface-2 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-serif text-sm font-semibold tracking-tight text-texte-attenue">
              Dev
            </span>
            <nav className="flex gap-1">
              <DevNavLink href="/dev/workflow">Workflow</DevNavLink>
              <DevNavLink href="/dev/profil">Profilage</DevNavLink>
            </nav>
          </div>
          <Link href="/" className="text-xs text-texte-discret hover:text-texte">
            ← Retour à l&apos;app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

function DevNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface hover:text-texte"
    >
      {children}
    </Link>
  );
}
